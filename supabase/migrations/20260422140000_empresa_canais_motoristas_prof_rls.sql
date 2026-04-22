-- Empresa: falar nos canais profissionais (motoristas, taxistas, etc.) + canal Mensageiro
-- Reativa canais profissionais desativados na migração anterior (só a lista profissional os oculta)

UPDATE canais
SET
  ativo = TRUE
WHERE
  tipo_publico = 'profissional'
  AND nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões');

INSERT INTO
  canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao)
VALUES
  ('Mensageiro', 'empresa', NULL, 'geral', 'fixo', 3)
ON CONFLICT (nome, tipo_publico) DO NOTHING;

-- Empresa pode listar canais profissionais usados para comunicação com motoristas / guias / etc.
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
        tipo_publico = 'profissional'
        AND nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões')
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
            c.tipo_publico = 'profissional'
            AND c.nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões')
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
            c.tipo_publico = 'profissional'
            AND c.nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões')
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
