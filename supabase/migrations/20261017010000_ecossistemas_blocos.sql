-- Blocos de ecossistema (cidade ou região) para o chevron da home.
-- Etapa 1: catálogo + seed Tríplice Fronteira. Vínculos empresa/profissional na etapa 2.

CREATE TABLE IF NOT EXISTS public.ecossistemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('cidade', 'regiao')),
  descricao text,
  disponivel_home boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  tile_sexto text NOT NULL DEFAULT 'aguarde',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ecossistemas_slug_len CHECK (
    char_length(btrim(slug)) >= 2 AND char_length(slug) <= 80
  ),
  CONSTRAINT ecossistemas_nome_len CHECK (
    char_length(btrim(nome)) >= 2 AND char_length(nome) <= 80
  ),
  CONSTRAINT ecossistemas_tile_sexto_chk CHECK (
    tile_sexto IN ('aguarde', 'compras_cde', 'servicos_locais')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS ecossistemas_um_padrao
  ON public.ecossistemas ((1))
  WHERE padrao IS TRUE;

CREATE INDEX IF NOT EXISTS ecossistemas_ordem_idx
  ON public.ecossistemas (ordem ASC, nome ASC);

COMMENT ON TABLE public.ecossistemas IS
  'Blocos (cidade avulsa ou região) disponíveis no chevron da home.';

CREATE TABLE IF NOT EXISTS public.ecossistema_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ecossistema_id uuid NOT NULL REFERENCES public.ecossistemas(id) ON DELETE CASCADE,
  cidade_chave text NOT NULL,
  cidade_label text NOT NULL,
  pais text,
  UNIQUE (ecossistema_id, cidade_chave)
);

CREATE INDEX IF NOT EXISTS ecossistema_cidades_eco_idx
  ON public.ecossistema_cidades (ecossistema_id);

COMMENT ON TABLE public.ecossistema_cidades IS
  'Cidades vinculadas a um bloco de ecossistema.';

ALTER TABLE public.ecossistemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecossistema_cidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ecossistemas_select ON public.ecossistemas;
CREATE POLICY ecossistemas_select ON public.ecossistemas
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS ecossistema_cidades_select ON public.ecossistema_cidades;
CREATE POLICY ecossistema_cidades_select ON public.ecossistema_cidades
FOR SELECT TO anon, authenticated
USING (true);

GRANT SELECT ON public.ecossistemas TO anon, authenticated;
GRANT SELECT ON public.ecossistema_cidades TO anon, authenticated;

-- Escritas só via service_role (API ADM).

INSERT INTO public.ecossistemas (
  slug, nome, tipo, descricao, disponivel_home, padrao, tile_sexto, ordem
)
VALUES (
  'triplice-fronteira',
  'Tríplice Fronteira',
  'regiao',
  'Foz do Iguaçu, Ciudad del Este e Puerto Iguazú.',
  true,
  true,
  'compras_cde',
  0
)
ON CONFLICT DO NOTHING;

INSERT INTO public.ecossistema_cidades (ecossistema_id, cidade_chave, cidade_label, pais)
SELECT e.id, v.chave, v.label, v.pais
FROM public.ecossistemas e
CROSS JOIN (
  VALUES
    ('Foz do Iguacu', 'Foz do Iguaçu', 'BR'),
    ('Ciudad del Este', 'Ciudad del Este', 'PY'),
    ('Puerto Iguazu', 'Puerto Iguazú', 'AR')
) AS v(chave, label, pais)
WHERE e.slug = 'triplice-fronteira'
ON CONFLICT (ecossistema_id, cidade_chave) DO NOTHING;
