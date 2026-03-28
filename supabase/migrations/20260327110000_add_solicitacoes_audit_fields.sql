-- =====================================================
-- FASE 3.2 - AUDITORIA DE SOLICITACOES DE ACESSO
-- =====================================================

ALTER TABLE solicitacoes_acesso_docs
ADD COLUMN IF NOT EXISTS aprovado_por_email VARCHAR,
ADD COLUMN IF NOT EXISTS recusado_por_email VARCHAR,
ADD COLUMN IF NOT EXISTS conceder_acesso_ate TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION update_solicitacao_audit_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND NEW.aprovado_por IS NOT NULL THEN
    SELECT COALESCE(email, username || '@guia3f.local')
      INTO NEW.aprovado_por_email
    FROM usuarios
    WHERE id = NEW.aprovado_por;
  ELSIF NEW.status = 'recusado' AND NEW.recusado_por IS NOT NULL THEN
    SELECT COALESCE(email, username || '@guia3f.local')
      INTO NEW.recusado_por_email
    FROM usuarios
    WHERE id = NEW.recusado_por;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_solicitacao_audit_email ON solicitacoes_acesso_docs;
CREATE TRIGGER trigger_solicitacao_audit_email
BEFORE INSERT OR UPDATE OF status, aprovado_por, recusado_por ON solicitacoes_acesso_docs
FOR EACH ROW
EXECUTE FUNCTION update_solicitacao_audit_email();
