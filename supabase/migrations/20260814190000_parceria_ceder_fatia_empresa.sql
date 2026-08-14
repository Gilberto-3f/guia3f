-- Cessão da fatia 50/50 de comissões de empresa (REFORÇAR PARCERIA).
ALTER TABLE public.parcerias_profissionais
  ADD COLUMN IF NOT EXISTS cedeu_fatia_empresa_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cedeu_fatia_empresa_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recibo_comissao_empresa_emitido_em TIMESTAMPTZ;

COMMENT ON COLUMN public.parcerias_profissionais.cedeu_fatia_empresa_em IS
  'Indicador temporal: o profissional indicado cedeu sua fatia das comissões de empresa ao indicador (REFORÇAR PARCERIA).';
COMMENT ON COLUMN public.parcerias_profissionais.cedeu_fatia_empresa_por IS
  'usuarios.id do indicado que cedeu a fatia.';
COMMENT ON COLUMN public.parcerias_profissionais.recibo_comissao_empresa_emitido_em IS
  'Quando o recibo separado de parceria (comissões de empresa) foi emitido no canal financeiro.';
