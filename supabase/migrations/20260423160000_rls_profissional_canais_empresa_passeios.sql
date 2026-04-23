-- =====================================================
-- RLS: profissional pode ler canais de empresas (inclui Passeios)
-- Motivo: alinhar nomes (Passeios vs Atrativos) e garantir acesso dos profissionais
-- aos canais públicos de empresas usados para comunicação.
-- =====================================================

-- Atualiza política de SELECT em canais para incluir:
-- - profissional vendo canais de empresa por nome (inclui 'Passeios' e 'Mensageiro')
-- Mantém exceção já existente:
-- - empresa vendo canais profissionais de comunidades específicas.

DROP POLICY IF EXISTS "canais select por papel" ON canais;

CREATE POLICY "canais select por papel" ON canais FOR
SELECT
  USING (
    auth.role () = 'authenticated'
    AND COALESCE (ativo, TRUE) = TRUE
    AND (
      -- admin vê tudo
      EXISTS (
        SELECT 1
        FROM usuarios u
        WHERE u.id = auth.uid () AND u.role = 'admin'
      )
      -- turista vê canal turista
      OR (
        tipo_publico = 'turista'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'turista'
        )
      )
      -- profissional vê canais profissionais
      OR (
        tipo_publico = 'profissional'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'profissional'
        )
      )
      -- empresa vê canais empresa
      OR (
        tipo_publico = 'empresa'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'empresa'
        )
      )
      -- profissional vê canais de empresas (broadcast / comunicação)
      OR (
        tipo_publico = 'empresa'
        AND nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Passeios', 'Hospedagem', 'Mensageiro')
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'profissional'
        )
      )
      -- empresa vê canais profissionais de comunidades específicas
      OR (
        tipo_publico = 'profissional'
        AND nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões')
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'empresa'
        )
      )
      -- admin vê canal admin
      OR (
        tipo_publico = 'admin'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'admin'
        )
      )
    )
  );

-- Mensagens: leitura conforme canal acessível
DROP POLICY IF EXISTS "mensagens select se canal acessível" ON mensagens_canal;

CREATE POLICY "mensagens select se canal acessível" ON mensagens_canal FOR
SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM canais c
      WHERE
        c.id = mensagens_canal.canal_id
        AND COALESCE (c.ativo, TRUE) = TRUE
        AND (
          EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid () AND u.role = 'admin'
          )
          OR (
            c.tipo_publico = 'turista'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'turista')
          )
          OR (
            c.tipo_publico = 'profissional'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'profissional')
          )
          OR (
            c.tipo_publico = 'empresa'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'empresa')
          )
          OR (
            c.tipo_publico = 'empresa'
            AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Passeios', 'Hospedagem', 'Mensageiro')
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'profissional')
          )
          OR (
            c.tipo_publico = 'profissional'
            AND c.nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões')
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'empresa')
          )
          OR (
            c.tipo_publico = 'admin'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin')
          )
        )
    )
  );

-- Mensagens: update (reacoes/lida_por etc) conforme canal acessível
DROP POLICY IF EXISTS "mensagens update quem vê o canal" ON mensagens_canal;

CREATE POLICY "mensagens update quem vê o canal" ON mensagens_canal FOR
UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM canais c
      WHERE
        c.id = mensagens_canal.canal_id
        AND COALESCE (c.ativo, TRUE) = TRUE
        AND (
          EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin')
          OR (c.tipo_publico = 'turista' AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'turista'))
          OR (c.tipo_publico = 'profissional' AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'profissional'))
          OR (c.tipo_publico = 'empresa' AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'empresa'))
          OR (
            c.tipo_publico = 'empresa'
            AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Passeios', 'Hospedagem', 'Mensageiro')
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'profissional')
          )
          OR (
            c.tipo_publico = 'profissional'
            AND c.nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões')
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'empresa')
          )
          OR (c.tipo_publico = 'admin' AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'))
        )
    )
  )
WITH CHECK (EXISTS (SELECT 1 FROM canais c WHERE c.id = mensagens_canal.canal_id));

