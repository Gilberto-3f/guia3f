-- Gerência ADM: país do moderador + vínculo auxiliar empresa.

ALTER TABLE public.convites_admin
  ADD COLUMN IF NOT EXISTS pais VARCHAR(10);

COMMENT ON COLUMN public.convites_admin.pais IS 'BR, AR ou PY — escopo do moderador (obrigatório quando nivel = 2).';

ALTER TABLE public.empresa_auxiliar_adm_solicitacoes
  ADD COLUMN IF NOT EXISTS auxiliar_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.empresa_auxiliar_adm_solicitacoes.auxiliar_usuario_id IS 'Auxiliar ADM (admin_level 4) atribuído à empresa.';

UPDATE public.empresa_auxiliar_adm_solicitacoes
SET auxiliar_usuario_id = moderador_usuario_id
WHERE auxiliar_usuario_id IS NULL AND moderador_usuario_id IS NOT NULL;
