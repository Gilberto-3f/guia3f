-- CNPJ / RUC / CUIT informado no fluxo Anexar documentos (empresa).

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS documento_fiscal TEXT;

COMMENT ON COLUMN public.empresas.documento_fiscal IS 'CNPJ, RUC ou CUIT da empresa';
