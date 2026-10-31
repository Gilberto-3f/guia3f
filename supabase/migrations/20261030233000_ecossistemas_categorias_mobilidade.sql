-- Categorias de mobilidade por bloco (ADM marca o que o eco oferece).
-- Vazio = nenhuma. Anfitriao nao entra nesta lista (sempre disponivel).
-- Triplice nasce com as 4; demais ecos ficam vazios ate o ADM configurar.

ALTER TABLE public.ecossistemas
  ADD COLUMN IF NOT EXISTS categorias_mobilidade text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.ecossistemas.categorias_mobilidade IS
  'Categorias de mobilidade deste bloco: Guia, Taxista, Van, Motorista de App. Array vazio = nenhuma. Anfitriao nao entra aqui.';

ALTER TABLE public.ecossistemas
  DROP CONSTRAINT IF EXISTS ecossistemas_categorias_mobilidade_chk;

ALTER TABLE public.ecossistemas
  ADD CONSTRAINT ecossistemas_categorias_mobilidade_chk
  CHECK (
    categorias_mobilidade <@ ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App']::text[]
  );

UPDATE public.ecossistemas
SET categorias_mobilidade = ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App']::text[]
WHERE slug = 'triplice-fronteira';
