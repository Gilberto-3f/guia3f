-- =====================================================
-- Canais, mensagens, canal financeiro, storage
-- =====================================================

CREATE TABLE IF NOT EXISTS canais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW ()
);

ALTER TABLE canais
ADD COLUMN IF NOT EXISTS tipo_publico TEXT,
ADD COLUMN IF NOT EXISTS categoria TEXT,
ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'geral',
ADD COLUMN IF NOT EXISTS ordem_tipo TEXT DEFAULT 'rotativo',
ADD COLUMN IF NOT EXISTS ordem_posicao INTEGER,
ADD COLUMN IF NOT EXISTS ultima_mensagem_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- UNIQUE (nome, tipo_publico): criar só se ainda for só UNIQUE(nome)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conrelid = 'public.canais'::regclass
      AND contype = 'u'
      AND conname = 'canais_nome_key'
  ) THEN
    ALTER TABLE canais DROP CONSTRAINT canais_nome_key;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

ALTER TABLE canais DROP CONSTRAINT IF EXISTS canais_nome_tipo_publico_key;

ALTER TABLE canais ADD CONSTRAINT canais_nome_tipo_publico_key UNIQUE (nome, tipo_publico);

CREATE INDEX IF NOT EXISTS idx_canais_tipo_publico ON canais (tipo_publico);

CREATE INDEX IF NOT EXISTS idx_canais_categoria ON canais (categoria);

CREATE INDEX IF NOT EXISTS idx_canais_pais ON canais (pais);

CREATE INDEX IF NOT EXISTS idx_canais_ordem ON canais (ordem_tipo, ordem_posicao, ultima_mensagem_em DESC);

COMMENT ON COLUMN canais.tipo_publico IS 'Quem pode ver o canal: turista, profissional, empresa, admin';

COMMENT ON COLUMN canais.categoria IS 'Categoria do canal: guias, taxistas, gastronomia, etc';

COMMENT ON COLUMN canais.pais IS 'País do canal: BR, AR, PY, geral';

COMMENT ON COLUMN canais.ordem_tipo IS 'fixo (ordem_posicao) ou rotativo (ultima_mensagem_em)';

COMMENT ON COLUMN canais.ultima_mensagem_em IS 'Para ordenação rotativa, atualizado a cada nova mensagem';

CREATE TABLE IF NOT EXISTS mensagens_canal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  canal_id UUID NOT NULL REFERENCES canais (id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  texto TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW (),
  pais TEXT DEFAULT 'geral'
);

ALTER TABLE mensagens_canal
ADD COLUMN IF NOT EXISTS anexo_url TEXT,
ADD COLUMN IF NOT EXISTS anexo_tipo TEXT,
ADD COLUMN IF NOT EXISTS reacoes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS lida_por JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_mensagens_canal_canal ON mensagens_canal (canal_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_canal_canal_pais ON mensagens_canal (canal_id, pais);

CREATE INDEX IF NOT EXISTS idx_mensagens_canal_created ON mensagens_canal (created_at);

COMMENT ON COLUMN mensagens_canal.pais IS 'Filtro por aba país (BR, AR, PY, geral)';

COMMENT ON COLUMN mensagens_canal.reacoes IS 'Array JSON [{ usuario_id, tipo }]';

COMMENT ON COLUMN mensagens_canal.lida_por IS 'Array JSON [{ usuario_id, lida_em }]';

CREATE OR REPLACE FUNCTION atualizar_ultima_mensagem_canal ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE canais
  SET
    ultima_mensagem_em = NEW.created_at
  WHERE
    id = NEW.canal_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mensagens_canal_ultima ON mensagens_canal;

CREATE TRIGGER trg_mensagens_canal_ultima
AFTER INSERT ON mensagens_canal FOR EACH ROW
EXECUTE FUNCTION atualizar_ultima_mensagem_canal ();

CREATE TABLE IF NOT EXISTS canal_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  profissional_id UUID NOT NULL REFERENCES profissionais (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  valor DECIMAL(10, 2),
  anexo_url TEXT,
  lida_por_profissional BOOLEAN DEFAULT false,
  lida_por_empresa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW ()
);

CREATE INDEX IF NOT EXISTS idx_canal_financeiro_profissional ON canal_financeiro (profissional_id);

CREATE INDEX IF NOT EXISTS idx_canal_financeiro_empresa ON canal_financeiro (empresa_id);

CREATE INDEX IF NOT EXISTS idx_canal_financeiro_nao_lidas ON canal_financeiro (profissional_id, lida_por_profissional)
WHERE
  lida_por_profissional = false;

-- Seeds (nome + tipo_publico únicos)
INSERT INTO
  canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao)
VALUES
  ('Turismo', 'turista', NULL, 'geral', 'fixo', 1)
ON CONFLICT (nome, tipo_publico) DO NOTHING;

INSERT INTO
  canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao)
VALUES
  ('ADM', 'profissional', NULL, 'geral', 'fixo', 1),
  ('Financeiro', 'profissional', NULL, 'geral', 'fixo', 2),
  ('Motoristas App', 'profissional', 'app', 'geral', 'fixo', 3),
  ('Vans', 'profissional', 'vans', 'geral', 'fixo', 4),
  ('Táxis', 'profissional', 'taxistas', 'geral', 'fixo', 5),
  ('Guias', 'profissional', 'guias', 'geral', 'fixo', 6),
  ('Anfitriões', 'profissional', 'anfitrioes', 'geral', 'fixo', 7)
ON CONFLICT (nome, tipo_publico) DO NOTHING;

INSERT INTO
  canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao)
VALUES
  ('ADM', 'empresa', NULL, 'geral', 'fixo', 1),
  ('Financeiro', 'empresa', NULL, 'geral', 'fixo', 2),
  ('Gastronomia', 'empresa', 'gastronomia', 'geral', 'fixo', 3),
  ('Lojas', 'empresa', 'lojas', 'geral', 'fixo', 4),
  ('Passeios', 'empresa', 'passeios', 'geral', 'fixo', 5),
  ('Hospedagem', 'empresa', 'hospedagem', 'geral', 'fixo', 6)
ON CONFLICT (nome, tipo_publico) DO NOTHING;

INSERT INTO
  canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao)
VALUES
  ('Mensageiro ADM', 'admin', NULL, 'geral', 'fixo', 1)
ON CONFLICT (nome, tipo_publico) DO NOTHING;

-- Bucket anexos mensagens
INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('mensagens', 'mensagens', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "mensagens storage leitura" ON storage.objects;

DROP POLICY IF EXISTS "mensagens storage upload autenticado" ON storage.objects;

DROP POLICY IF EXISTS "mensagens storage delete pasta" ON storage.objects;

CREATE POLICY "mensagens storage leitura" ON storage.objects FOR
SELECT
  USING (bucket_id = 'mensagens');

CREATE POLICY "mensagens storage upload autenticado" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mensagens'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);

CREATE POLICY "mensagens storage delete pasta" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'mensagens'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);

-- RLS canais
ALTER TABLE canais ENABLE ROW LEVEL SECURITY;

ALTER TABLE mensagens_canal ENABLE ROW LEVEL SECURITY;

ALTER TABLE canal_financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canais select por papel" ON canais;

CREATE POLICY "canais select por papel" ON canais FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND COALESCE (ativo, TRUE) = TRUE
    AND (
      EXISTS (
        SELECT
          1
        FROM
          usuarios u
        WHERE
          u.id = auth.uid ()
          AND u.role = 'admin'
      )
      OR (
        tipo_publico = 'turista'
        AND EXISTS (
          SELECT
            1
          FROM
            usuarios u
          WHERE
            u.id = auth.uid ()
            AND u.role = 'turista'
        )
      )
      OR (
        tipo_publico = 'profissional'
        AND EXISTS (
          SELECT
            1
          FROM
            usuarios u
          WHERE
            u.id = auth.uid ()
            AND u.role = 'profissional'
        )
      )
      OR (
        tipo_publico = 'empresa'
        AND EXISTS (
          SELECT
            1
          FROM
            usuarios u
          WHERE
            u.id = auth.uid ()
            AND u.role = 'empresa'
        )
      )
      OR (
        tipo_publico = 'admin'
        AND EXISTS (
          SELECT
            1
          FROM
            usuarios u
          WHERE
            u.id = auth.uid ()
            AND u.role = 'admin'
        )
      )
    )
  );

-- RLS mensagens: leitura se acesso ao canal; país da mensagem deve combinar com visão (filtro no app)
DROP POLICY IF EXISTS "mensagens select se canal acessível" ON mensagens_canal;

CREATE POLICY "mensagens select se canal acessível" ON mensagens_canal FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        canais c
      WHERE
        c.id = mensagens_canal.canal_id
        AND COALESCE (c.ativo, TRUE) = TRUE
        AND (
          EXISTS (
            SELECT
              1
            FROM
              usuarios u
            WHERE
              u.id = auth.uid ()
              AND u.role = 'admin'
          )
          OR (
            c.tipo_publico = 'turista'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'turista'
            )
          )
          OR (
            c.tipo_publico = 'profissional'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'profissional'
            )
          )
          OR (
            c.tipo_publico = 'empresa'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'empresa'
            )
          )
          OR (
            c.tipo_publico = 'admin'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'admin'
            )
          )
        )
    )
  );

-- INSERT regras (alinhado ao fluxo do app)
DROP POLICY IF EXISTS "mensagens insert admin em turista" ON mensagens_canal;

DROP POLICY IF EXISTS "mensagens insert empresa em profissional" ON mensagens_canal;

DROP POLICY IF EXISTS "mensagens insert profissional em empresa" ON mensagens_canal;

DROP POLICY IF EXISTS "mensagens insert admin em admin" ON mensagens_canal;

CREATE POLICY "mensagens insert admin em turista" ON mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      canais c
    WHERE
      c.id = canal_id
      AND c.tipo_publico = 'turista'
      AND EXISTS (
        SELECT
          1
        FROM
          usuarios u
        WHERE
          u.id = auth.uid ()
          AND u.role = 'admin'
      )
  )
);

CREATE POLICY "mensagens insert empresa em profissional" ON mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      canais c
    WHERE
      c.id = canal_id
      AND c.tipo_publico = 'profissional'
      AND EXISTS (
        SELECT
          1
        FROM
          usuarios u
        WHERE
          u.id = auth.uid ()
          AND u.role = 'empresa'
      )
  )
);

CREATE POLICY "mensagens insert profissional em empresa" ON mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      canais c
    WHERE
      c.id = canal_id
      AND c.tipo_publico = 'empresa'
      AND EXISTS (
        SELECT
          1
        FROM
          usuarios u
        WHERE
          u.id = auth.uid ()
          AND u.role = 'profissional'
      )
  )
);

CREATE POLICY "mensagens insert admin em admin" ON mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      canais c
    WHERE
      c.id = canal_id
      AND c.tipo_publico = 'admin'
      AND EXISTS (
        SELECT
          1
        FROM
          usuarios u
        WHERE
          u.id = auth.uid ()
          AND u.role = 'admin'
      )
  )
);

DROP POLICY IF EXISTS "mensagens insert empresa em empresa" ON mensagens_canal;

DROP POLICY IF EXISTS "mensagens insert admin em qualquer canal" ON mensagens_canal;

CREATE POLICY "mensagens insert empresa em empresa" ON mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      canais c
    WHERE
      c.id = canal_id
      AND c.tipo_publico = 'empresa'
      AND EXISTS (
        SELECT
          1
        FROM
          usuarios u
        WHERE
          u.id = auth.uid ()
          AND u.role = 'empresa'
      )
  )
);

CREATE POLICY "mensagens insert admin em qualquer canal" ON mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "mensagens update quem vê o canal" ON mensagens_canal;

CREATE POLICY "mensagens update quem vê o canal" ON mensagens_canal FOR
UPDATE
  USING (
    EXISTS (
      SELECT
        1
      FROM
        canais c
      WHERE
        c.id = mensagens_canal.canal_id
        AND COALESCE (c.ativo, TRUE) = TRUE
        AND (
          EXISTS (
            SELECT
              1
            FROM
              usuarios u
            WHERE
              u.id = auth.uid ()
              AND u.role = 'admin'
          )
          OR (
            c.tipo_publico = 'turista'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'turista'
            )
          )
          OR (
            c.tipo_publico = 'profissional'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'profissional'
            )
          )
          OR (
            c.tipo_publico = 'empresa'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'empresa'
            )
          )
          OR (
            c.tipo_publico = 'admin'
            AND EXISTS (
              SELECT
                1
              FROM
                usuarios u
              WHERE
                u.id = auth.uid ()
                AND u.role = 'admin'
            )
          )
        )
    )
  )
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      canais c
    WHERE
      c.id = mensagens_canal.canal_id
  )
);

-- canal_financeiro
DROP POLICY IF EXISTS "cf select profissional" ON canal_financeiro;

DROP POLICY IF EXISTS "cf select empresa" ON canal_financeiro;

DROP POLICY IF EXISTS "cf update profissional leitura" ON canal_financeiro;

DROP POLICY IF EXISTS "cf update empresa leitura" ON canal_financeiro;

CREATE POLICY "cf select profissional" ON canal_financeiro FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        profissionais p
      WHERE
        p.id = canal_financeiro.profissional_id
        AND p.usuario_id = auth.uid ()
    )
  );

CREATE POLICY "cf select empresa" ON canal_financeiro FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        empresas e
      WHERE
        e.id = canal_financeiro.empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

CREATE POLICY "cf update profissional leitura" ON canal_financeiro FOR
UPDATE
  USING (
    EXISTS (
      SELECT
        1
      FROM
        profissionais p
      WHERE
        p.id = canal_financeiro.profissional_id
        AND p.usuario_id = auth.uid ()
    )
  )
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      profissionais p
    WHERE
      p.id = canal_financeiro.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

CREATE POLICY "cf update empresa leitura" ON canal_financeiro FOR
UPDATE
  USING (
    EXISTS (
      SELECT
        1
      FROM
        empresas e
      WHERE
        e.id = canal_financeiro.empresa_id
        AND e.usuario_id = auth.uid ()
    )
  )
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      empresas e
    WHERE
      e.id = canal_financeiro.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);
