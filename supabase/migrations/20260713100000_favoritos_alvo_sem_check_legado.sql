-- Favoritos polimórficos: remove CHECK legado (empresa XOR produto) e alinha RLS.

ALTER TABLE public.favoritos DROP CONSTRAINT IF EXISTS favoritos_check;
ALTER TABLE public.favoritos DROP CONSTRAINT IF EXISTS favoritos_empresa_id_produto_id_check;

-- Colunas legadas podem existir; favoritos de acomodação/ticket/produto usam só alvo_*.
ALTER TABLE public.favoritos
  ALTER COLUMN empresa_id DROP NOT NULL;

ALTER TABLE public.favoritos
  ADD COLUMN IF NOT EXISTS alvo_id UUID,
  ADD COLUMN IF NOT EXISTS alvo_tipo TEXT;

DROP POLICY IF EXISTS "Usuários podem criar favoritos" ON public.favoritos;
CREATE POLICY "Usuários podem criar favoritos" ON public.favoritos FOR INSERT
WITH
  CHECK (
    auth.role () = 'authenticated'
    AND usuario_id = auth.uid ()
    AND alvo_id IS NOT NULL
    AND alvo_tipo IN ('empresa', 'acomodacao', 'produto', 'ticket')
  );

DROP POLICY IF EXISTS "Autenticados veem favoritos de empresas para seguidores" ON public.favoritos;
CREATE POLICY "Autenticados veem favoritos de empresas para seguidores" ON public.favoritos FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND COALESCE(alvo_tipo, '') = 'empresa'
    AND alvo_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_favoritos_usuario_alvo_unique
ON public.favoritos (usuario_id, alvo_tipo, alvo_id)
WHERE
  alvo_id IS NOT NULL
  AND alvo_tipo IS NOT NULL;
