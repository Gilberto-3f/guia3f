-- =====================================================
-- FASE 3.3 - REVOGACAO MANUAL E EXPIRACAO DE ACESSO
-- =====================================================

ALTER TABLE solicitacoes_acesso_docs
ADD COLUMN IF NOT EXISTS revogado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS revogado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS motivo_revogacao TEXT,
ADD COLUMN IF NOT EXISTS revogado_por_email VARCHAR;

ALTER TABLE solicitacoes_acesso_docs
DROP CONSTRAINT IF EXISTS solicitacoes_acesso_docs_status_check;

ALTER TABLE solicitacoes_acesso_docs
ADD CONSTRAINT solicitacoes_acesso_docs_status_check
CHECK (status IN ('pendente', 'aprovado', 'recusado', 'revogado', 'expirado'));

CREATE OR REPLACE FUNCTION update_revogacao_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'revogado' AND NEW.revogado_por IS NOT NULL THEN
    SELECT COALESCE(email, username || '@guia3f.local')
      INTO NEW.revogado_por_email
    FROM usuarios
    WHERE id = NEW.revogado_por;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_revogacao_email ON solicitacoes_acesso_docs;
CREATE TRIGGER trigger_revogacao_email
BEFORE UPDATE OF status, revogado_por ON solicitacoes_acesso_docs
FOR EACH ROW
EXECUTE FUNCTION update_revogacao_email();

CREATE OR REPLACE FUNCTION revogar_acesso_documentos(
  p_solicitacao_id UUID,
  p_motivo TEXT
)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
  v_admin_email TEXT;
  v_admin_nivel INTEGER;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida para revogacao';
  END IF;

  SELECT admin_level, COALESCE(email, username || '@guia3f.local')
    INTO v_admin_nivel, v_admin_email
  FROM usuarios
  WHERE id = v_admin_id;

  IF v_admin_nivel IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Apenas ADM GERAL pode revogar acesso';
  END IF;

  UPDATE solicitacoes_acesso_docs
  SET
    status = 'revogado',
    revogado_por = v_admin_id,
    revogado_em = NOW(),
    motivo_revogacao = p_motivo,
    conceder_acesso_ate = NULL
  WHERE id = p_solicitacao_id
    AND status = 'aprovado';

  INSERT INTO logs_verificacao (
    tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, detalhes
  ) VALUES (
    'solicitacao_acesso',
    p_solicitacao_id,
    'revogado_acesso',
    v_admin_id,
    v_admin_email,
    1,
    jsonb_build_object('motivo_revogacao', p_motivo)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION limpar_acessos_expirados()
RETURNS VOID AS $$
DECLARE
  v_system_admin UUID;
BEGIN
  SELECT id INTO v_system_admin
  FROM usuarios
  WHERE role = 'admin' AND admin_level = 1
  ORDER BY created_at ASC
  LIMIT 1;

  WITH expirados AS (
    UPDATE solicitacoes_acesso_docs
    SET status = 'expirado'
    WHERE status = 'aprovado'
      AND conceder_acesso_ate IS NOT NULL
      AND conceder_acesso_ate < NOW()
    RETURNING id, conceder_acesso_ate
  )
  INSERT INTO logs_verificacao (
    tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, detalhes
  )
  SELECT
    'solicitacao_acesso',
    e.id,
    'acesso_expirado',
    v_system_admin,
    'sistema@guia3f.com.br',
    0,
    jsonb_build_object('data_expiracao', e.conceder_acesso_ate)
  FROM expirados e
  WHERE v_system_admin IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
