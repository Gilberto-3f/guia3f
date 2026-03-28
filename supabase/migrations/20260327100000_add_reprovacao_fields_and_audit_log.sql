-- =====================================================
-- FASE 3.1 - MIGRACAO COMPLEMENTAR (VERSAO SEGURA)
-- =====================================================

-- 1) Campos de reprovacao/verificacao e aprovacao
ALTER TABLE turistas
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pre_aprovado',
ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT,
ADD COLUMN IF NOT EXISTS prazo_reenvio_dias INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS reprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reprovado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS verificado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS verificado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

ALTER TABLE profissionais
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT,
ADD COLUMN IF NOT EXISTS prazo_reenvio_dias INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS reprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reprovado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS verificado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS verificado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'aguardando_aprovacao',
ADD COLUMN IF NOT EXISTS motivo_reprovacao TEXT,
ADD COLUMN IF NOT EXISTS prazo_reenvio_dias INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS reprovado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reprovado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS verificado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS verificado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS aprovado_por UUID REFERENCES usuarios(id),
ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;

-- 2) Tabela de logs de verificacao
CREATE TABLE IF NOT EXISTS logs_verificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL,
  perfil_id UUID NOT NULL,
  acao VARCHAR(30) NOT NULL,
  admin_id UUID NOT NULL REFERENCES usuarios(id),
  admin_email VARCHAR NOT NULL,
  admin_nivel INTEGER NOT NULL,
  alvo_id UUID,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_verificacao_perfil ON logs_verificacao (perfil_id);
CREATE INDEX IF NOT EXISTS idx_logs_verificacao_admin ON logs_verificacao (admin_id);
CREATE INDEX IF NOT EXISTS idx_logs_verificacao_created_at ON logs_verificacao (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_verificacao_acao ON logs_verificacao (acao);

-- 3) Tabela de solicitacao de acesso a documentos
CREATE TABLE IF NOT EXISTS solicitacoes_acesso_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id UUID NOT NULL REFERENCES usuarios(id),
  perfil_tipo VARCHAR(20) NOT NULL,
  perfil_id UUID NOT NULL,
  motivo TEXT,
  status VARCHAR(20) DEFAULT 'pendente',
  aprovado_por UUID REFERENCES usuarios(id),
  aprovado_em TIMESTAMPTZ,
  recusado_por UUID REFERENCES usuarios(id),
  recusado_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_acesso_solicitante ON solicitacoes_acesso_docs (solicitante_id);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_acesso_status ON solicitacoes_acesso_docs (status);

-- 4) Funcao de email real
CREATE OR REPLACE FUNCTION get_admin_email(p_admin_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM usuarios WHERE id = p_admin_id;
  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_admin_id;
  END IF;
  RETURN COALESCE(v_email, 'unknown@guia3f.com.br');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Trigger de auditoria consolidado
CREATE OR REPLACE FUNCTION registrar_log_verificacao()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_admin_nivel INTEGER;
  v_acao VARCHAR(30);
BEGIN
  IF NEW.docs_verificado IS DISTINCT FROM OLD.docs_verificado AND NEW.docs_verificado = true THEN
    v_admin_id := COALESCE(NEW.docs_verificado_por, NEW.verificado_por);
    v_acao := 'docs_verificado';
  ELSIF NEW.status = 'reprovado' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_admin_id := NEW.reprovado_por;
    v_acao := 'reprovado';
  ELSIF NEW.status IN ('aprovado', 'ativo') AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_admin_id := NEW.aprovado_por;
    v_acao := 'aprovado';
  ELSE
    RETURN NEW;
  END IF;

  IF v_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT admin_level INTO v_admin_nivel FROM usuarios WHERE id = v_admin_id;

  INSERT INTO logs_verificacao (
    tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, detalhes
  ) VALUES (
    TG_TABLE_NAME,
    NEW.id,
    v_acao,
    v_admin_id,
    get_admin_email(v_admin_id),
    COALESCE(v_admin_nivel, 0),
    jsonb_build_object(
      'motivo', NEW.motivo_reprovacao,
      'prazo', NEW.prazo_reenvio_dias,
      'reprovado_em', NEW.reprovado_em,
      'aprovado_em', NEW.aprovado_em,
      'verificado_em', COALESCE(NEW.docs_verificado_em, NEW.verificado_em)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_verificacao_turistas ON turistas;
CREATE TRIGGER trigger_log_verificacao_turistas
AFTER UPDATE OF docs_verificado, status ON turistas
FOR EACH ROW
EXECUTE FUNCTION registrar_log_verificacao();

DROP TRIGGER IF EXISTS trigger_log_verificacao_profissionais ON profissionais;
CREATE TRIGGER trigger_log_verificacao_profissionais
AFTER UPDATE OF docs_verificado, status ON profissionais
FOR EACH ROW
EXECUTE FUNCTION registrar_log_verificacao();

DROP TRIGGER IF EXISTS trigger_log_verificacao_empresas ON empresas;
CREATE TRIGGER trigger_log_verificacao_empresas
AFTER UPDATE OF docs_verificado, status ON empresas
FOR EACH ROW
EXECUTE FUNCTION registrar_log_verificacao();

-- 6) RPC de solicitacao de acesso a documentos
CREATE OR REPLACE FUNCTION solicitar_acesso_documentos(
  p_solicitante_id UUID,
  p_perfil_tipo VARCHAR,
  p_perfil_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_solicitacao_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM usuarios
    WHERE id = p_solicitante_id
      AND role = 'admin'
      AND admin_level = 2
  ) THEN
    RAISE EXCEPTION 'Apenas moderadores podem solicitar acesso a documentos';
  END IF;

  IF EXISTS (
    SELECT 1 FROM solicitacoes_acesso_docs
    WHERE solicitante_id = p_solicitante_id
      AND perfil_id = p_perfil_id
      AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Ja existe solicitacao pendente para este perfil';
  END IF;

  INSERT INTO solicitacoes_acesso_docs (
    solicitante_id, perfil_tipo, perfil_id, motivo
  ) VALUES (
    p_solicitante_id, p_perfil_tipo, p_perfil_id, p_motivo
  )
  RETURNING id INTO v_solicitacao_id;

  INSERT INTO logs_verificacao (
    tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, alvo_id, detalhes
  ) VALUES (
    p_perfil_tipo, p_perfil_id, 'solicitado_acesso',
    p_solicitante_id,
    get_admin_email(p_solicitante_id),
    COALESCE((SELECT admin_level FROM usuarios WHERE id = p_solicitante_id), 0),
    v_solicitacao_id,
    jsonb_build_object('motivo', p_motivo)
  );

  RETURN v_solicitacao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

