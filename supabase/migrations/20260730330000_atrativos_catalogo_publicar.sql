-- Atrativos: categorias + rascunho/publicado (espelho cardápio/serviços)
-- ============================================================================: 2026-07-25

CREATE TABLE IF NOT EXISTS public.atrativos_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT atrativos_categorias_nome_len CHECK (char_length(trim(nome)) >= 1),
  CONSTRAINT atrativos_categorias_empresa_norm_uq UNIQUE (empresa_id, nome_normalizado)
);

CREATE INDEX IF NOT EXISTS idx_atrativos_categorias_empresa
  ON public.atrativos_categorias (empresa_id);

CREATE INDEX IF NOT EXISTS idx_atrativos_categorias_norm
  ON public.atrativos_categorias (empresa_id, nome_normalizado);

COMMENT ON TABLE public.atrativos_categorias IS
  'Sessões/categorias do catálogo de atrativos (tickets) por empresa.';

ALTER TABLE public.atrativos_experiencias
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.atrativos_categorias (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS site_url TEXT;

-- Experiências já existentes: mantém visíveis no drawer público
UPDATE public.atrativos_experiencias
SET ativo = TRUE
WHERE ativo IS DISTINCT FROM TRUE;

CREATE INDEX IF NOT EXISTS idx_atrativos_experiencias_ativo
  ON public.atrativos_experiencias (ativo);

CREATE INDEX IF NOT EXISTS idx_atrativos_experiencias_categoria
  ON public.atrativos_experiencias (categoria_id);

COMMENT ON COLUMN public.atrativos_experiencias.ativo IS
  'false = rascunho; true = publicado no drawer/feed.';

COMMENT ON COLUMN public.atrativos_experiencias.site_url IS
  'Link externo opcional (VER MAIS no drawer).';

-- Limite de 30 caracteres do título é enforced na UI (novos cadastros).

-- RLS categorias
ALTER TABLE public.atrativos_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atrativos_categorias leitura" ON public.atrativos_categorias;
CREATE POLICY "atrativos_categorias leitura" ON public.atrativos_categorias FOR
SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "atrativos_categorias insert dono" ON public.atrativos_categorias;
CREATE POLICY "atrativos_categorias insert dono" ON public.atrativos_categorias FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "atrativos_categorias update dono" ON public.atrativos_categorias;
CREATE POLICY "atrativos_categorias update dono" ON public.atrativos_categorias FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "atrativos_categorias delete dono" ON public.atrativos_categorias;
CREATE POLICY "atrativos_categorias delete dono" ON public.atrativos_categorias FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid ()
  )
);

-- Leitura experiências: público só ativos; dono/admin veem rascunhos
DROP POLICY IF EXISTS "Leitura atrativos experiencias" ON public.atrativos_experiencias;
DROP POLICY IF EXISTS "atrativos_experiencias leitura publicos ativos" ON public.atrativos_experiencias;
CREATE POLICY "atrativos_experiencias leitura publicos ativos" ON public.atrativos_experiencias FOR
SELECT
  USING (
    COALESCE(ativo, FALSE) = TRUE
    OR EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = atrativos_experiencias.empresa_id AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid () AND u.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atrativos_categorias TO authenticated;
GRANT SELECT ON public.atrativos_categorias TO anon;
