-- Canais segmento (empresa) visíveis a profissionais + leitura para badges + RLS

-- Canal Atrativos (profissionais veem junto com BR/AR/PY no feed geral do segmento)
INSERT INTO
  canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao)
VALUES
  ('Atrativos', 'empresa', 'atrativos', 'geral', 'rotativo', NULL)
ON CONFLICT (nome, tipo_publico) DO NOTHING;

-- Ordenação por última mensagem nos segmentos que o profissional vê
UPDATE canais
SET
  ordem_tipo = 'rotativo',
  ordem_posicao = NULL
WHERE
  tipo_publico = 'empresa'
  AND nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Hospedagem');

-- Ocultar canais profissionais antigos (Motoristas, Vans, etc.); ficam ADM + Financeiro
UPDATE canais
SET
  ativo = FALSE
WHERE
  tipo_publico = 'profissional'
  AND nome NOT IN ('ADM', 'Financeiro');

CREATE TABLE IF NOT EXISTS canal_leitura_profissional (
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES canais (id) ON DELETE CASCADE,
  visto_em TIMESTAMPTZ NOT NULL DEFAULT NOW (),
  PRIMARY KEY (usuario_id, canal_id)
);

CREATE INDEX IF NOT EXISTS idx_canal_leitura_prof_usuario ON canal_leitura_profissional (usuario_id);

ALTER TABLE canal_leitura_profissional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clp select proprio" ON canal_leitura_profissional;

DROP POLICY IF EXISTS "clp insert proprio" ON canal_leitura_profissional;

DROP POLICY IF EXISTS "clp update proprio" ON canal_leitura_profissional;

DROP POLICY IF EXISTS "clp delete proprio" ON canal_leitura_profissional;

CREATE POLICY "clp select proprio" ON canal_leitura_profissional FOR
SELECT
  USING (usuario_id = auth.uid ());

CREATE POLICY "clp insert proprio" ON canal_leitura_profissional FOR INSERT
WITH CHECK (usuario_id = auth.uid ());

CREATE POLICY "clp update proprio" ON canal_leitura_profissional FOR
UPDATE
  USING (usuario_id = auth.uid ())
WITH CHECK
  (usuario_id = auth.uid ());

CREATE POLICY "clp delete proprio" ON canal_leitura_profissional FOR DELETE USING (usuario_id = auth.uid ());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canal_leitura_profissional TO authenticated;

-- Badges: mensagem de empresa mais recente que a última visualização do profissional
CREATE OR REPLACE FUNCTION public.profissional_badges_segmentos_empresa ()
RETURNS TABLE (
  canal_id UUID,
  tem_badge BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS canal_id,
    EXISTS (
      SELECT
        1
      FROM
        mensagens_canal m
        INNER JOIN usuarios ur ON ur.id = m.remetente_id
        AND ur.role = 'empresa'
      WHERE
        m.canal_id = c.id
        AND m.created_at > COALESCE(
          (
            SELECT
              l.visto_em
            FROM
              canal_leitura_profissional l
            WHERE
              l.usuario_id = auth.uid ()
              AND l.canal_id = c.id
          ),
          '-infinity'::TIMESTAMPTZ
        )
    ) AS tem_badge
  FROM
    canais c
  WHERE
    c.tipo_publico = 'empresa'
    AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Hospedagem')
    AND COALESCE (c.ativo, TRUE) = TRUE
    AND EXISTS (
      SELECT
        1
      FROM
        usuarios u
      WHERE
        u.id = auth.uid ()
        AND u.role = 'profissional'
    );
$$;

GRANT EXECUTE ON FUNCTION public.profissional_badges_segmentos_empresa () TO authenticated;

-- Profissional pode listar e ler mensagens dos canais de segmento (empresa) indicados
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
        tipo_publico = 'empresa'
        AND nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Hospedagem')
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
            c.tipo_publico = 'empresa'
            AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Hospedagem')
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
            c.tipo_publico = 'empresa'
            AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Hospedagem')
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
