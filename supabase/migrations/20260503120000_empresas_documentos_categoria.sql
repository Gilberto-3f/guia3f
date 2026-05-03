-- Documentação de categoria enviada pela empresa (menu Anexar documentos).
-- Alinha com fluxo semelhante a profissionais; admin já consulta documento_comercial_url em verificação.

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS documento_frente_url TEXT,
  ADD COLUMN IF NOT EXISTS documento_verso_url TEXT,
  ADD COLUMN IF NOT EXISTS comprovante_residencia_url TEXT,
  ADD COLUMN IF NOT EXISTS documento_comercial_url TEXT,
  ADD COLUMN IF NOT EXISTS documentos_enviados_em TIMESTAMPTZ;

COMMENT ON COLUMN public.empresas.documento_frente_url IS 'ID do representante legal — frente (JPG/PDF)';
COMMENT ON COLUMN public.empresas.documento_verso_url IS 'ID do representante legal — verso';
COMMENT ON COLUMN public.empresas.comprovante_residencia_url IS 'Comprovante de residência (empresa ou representante)';
COMMENT ON COLUMN public.empresas.documento_comercial_url IS 'Documento comercial / atividade da categoria (alvará, CNPJ, etc.)';
COMMENT ON COLUMN public.empresas.documentos_enviados_em IS 'Quando a empresa enviou o lote de documentos para análise';
