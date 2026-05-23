-- Canal ADM profissional + canal financeiro: metadados, categorias de broadcast e RLS de insert (admin)

-- 1) Canal ADM global com categoria admin (filtro na UI)
UPDATE public.canais
SET
  categoria = 'admin',
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND empresa_id IS NULL
  AND UPPER(TRIM(nome)) = 'ADM';

-- 2) Canais globais de comunidade (onde o ADM publica avisos coletivos)
UPDATE public.canais
SET
  categoria = 'motorista_app',
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND empresa_id IS NULL
  AND nome IN ('Motoristas App', 'Motorista de App');

UPDATE public.canais
SET
  categoria = 'van',
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND empresa_id IS NULL
  AND nome IN ('Vans', 'Van');

UPDATE public.canais
SET
  categoria = 'taxista',
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND empresa_id IS NULL
  AND nome IN ('Táxis', 'Taxistas', 'Taxista');

UPDATE public.canais
SET
  categoria = 'guia',
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND empresa_id IS NULL
  AND nome IN ('Guias', 'Guia');

UPDATE public.canais
SET
  categoria = 'anfitriao',
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND empresa_id IS NULL
  AND nome IN ('Anfitriões', 'Anfitriao', 'Anfitrião');

-- 3) Canal financeiro: mensagens só do ADM / sistema (empresa opcional)
ALTER TABLE public.canal_financeiro
ALTER COLUMN empresa_id DROP NOT NULL;

COMMENT ON COLUMN public.canal_financeiro.empresa_id IS 'Opcional: null em avisos exclusivos do ADM ao profissional.';

-- 4) Admin e service role podem inserir notificações no canal financeiro do profissional
DROP POLICY IF EXISTS "cf insert admin" ON public.canal_financeiro;

CREATE POLICY "cf insert admin" ON public.canal_financeiro FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);
