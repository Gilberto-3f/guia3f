-- Colunas usadas pelo gate do turista (compras/reservas e pré-liberação).

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS documentacao_validada_adm BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS turista_janela_48h_inicio TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS turista_pre_liberado_ate TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS turista_pre_liberado_por UUID NULL REFERENCES public.usuarios (id);

COMMENT ON COLUMN public.usuarios.documentacao_validada_adm IS
  'TRUE quando o ADM aprovou a documentação do turista (acesso pleno permanente).';
