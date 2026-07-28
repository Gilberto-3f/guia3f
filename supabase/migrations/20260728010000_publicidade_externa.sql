-- Catálogo Publicidade Externa (ADM → drawer empresa)

-- WhatsApp global (singleton)
CREATE TABLE IF NOT EXISTS public.publicidade_externa_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.publicidade_externa_config (id, whatsapp)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.publicidade_externa_config IS
  'Config global do catálogo Publicidade Externa (WhatsApp do rodapé).';

-- Cards do catálogo
CREATE TABLE IF NOT EXISTS public.publicidade_externa_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  fotos text[] NOT NULL DEFAULT '{}',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publicidade_externa_cards_titulo_len CHECK (
    char_length(btrim(titulo)) >= 1 AND char_length(titulo) <= 30
  ),
  CONSTRAINT publicidade_externa_cards_descricao_len CHECK (char_length(descricao) <= 750),
  CONSTRAINT publicidade_externa_cards_fotos_max CHECK (cardinality(fotos) <= 5)
);

CREATE INDEX IF NOT EXISTS idx_publicidade_externa_cards_ordem
  ON public.publicidade_externa_cards (ordem ASC, created_at ASC);

COMMENT ON TABLE public.publicidade_externa_cards IS
  'Cards informativos de publicidade externa (cadastrados no ADM).';

ALTER TABLE public.publicidade_externa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicidade_externa_cards ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado (empresas com plano veem no drawer)
DROP POLICY IF EXISTS publicidade_externa_config_select ON public.publicidade_externa_config;
CREATE POLICY publicidade_externa_config_select ON public.publicidade_externa_config
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS publicidade_externa_cards_select ON public.publicidade_externa_cards;
CREATE POLICY publicidade_externa_cards_select ON public.publicidade_externa_cards
FOR SELECT TO authenticated
USING (true);

-- Escrita: ADM Geral (level 1) ou ADM Financeiro (level 3 / cargo FINANCEIRO)
DROP POLICY IF EXISTS publicidade_externa_config_upsert_admin ON public.publicidade_externa_config;
CREATE POLICY publicidade_externa_config_upsert_admin ON public.publicidade_externa_config
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
);

DROP POLICY IF EXISTS publicidade_externa_cards_admin_all ON public.publicidade_externa_cards;
CREATE POLICY publicidade_externa_cards_admin_all ON public.publicidade_externa_cards
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
);
