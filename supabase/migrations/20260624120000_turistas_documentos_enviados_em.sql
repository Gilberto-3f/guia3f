-- Turista: marca envio de documentos para fila ADM (mesmo padrão de profissionais/empresas).

ALTER TABLE public.turistas
  ADD COLUMN IF NOT EXISTS documentos_enviados_em TIMESTAMPTZ;

COMMENT ON COLUMN public.turistas.documentos_enviados_em IS
  'Quando o turista enviou lote de documentos para análise (fila admin).';
