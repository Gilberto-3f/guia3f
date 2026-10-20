-- Etapa 2: colaborador ADM nível 2 (moderador) e 4 (auxiliar) fica preso a um bloco.
-- Nível 1 (geral) e 3 (financeiro) permanecem sem vínculo — trocam via chevron na etapa 3.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS ecossistema_id uuid REFERENCES public.ecossistemas(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_usuarios_ecossistema_id
  ON public.usuarios (ecossistema_id);

COMMENT ON COLUMN public.usuarios.ecossistema_id IS
  'Bloco (cidade/região) do colaborador ADM níveis 2 e 4. Nulo para ADM geral e financeiro.';

ALTER TABLE public.convites_admin
  ADD COLUMN IF NOT EXISTS ecossistema_id uuid REFERENCES public.ecossistemas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.convites_admin.ecossistema_id IS
  'Bloco atribuído no convite (obrigatório para nível 2 e 4).';

-- Colaboradores já ativos entram no bloco padrão (Tríplice).
UPDATE public.usuarios u
SET
  ecossistema_id = e.id,
  admin_permissoes = coalesce(u.admin_permissoes, '{}'::jsonb)
    || jsonb_build_object('ecossistema_id', to_jsonb(e.id::text))
FROM (
  SELECT id
  FROM public.ecossistemas
  WHERE padrao IS TRUE
  ORDER BY created_at ASC
  LIMIT 1
) e
WHERE u.admin_level IN (2, 4)
  AND u.ecossistema_id IS NULL;

UPDATE public.usuarios
SET ecossistema_id = NULL
WHERE admin_level IS NULL
   OR admin_level IN (1, 3);
