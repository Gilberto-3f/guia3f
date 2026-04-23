-- =====================================================
-- RLS: canais por empresa + comunidade
-- Regras desejadas:
-- - Profissional (validado/ativo) vê canais de empresas cuja comunidade_prof ∈ profissionais.categorias
-- - Empresa vê seus próprios canais (empresa_id) + canais globais de empresa (ADM/Financeiro/segmentos globais se existirem)
-- - Admin vê tudo
-- =====================================================

-- Canais: SELECT
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
      -- profissional vê canais profissionais (ex.: ADM/Financeiro)
      OR (
        tipo_publico = 'profissional'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'profissional'
        )
      )
      -- empresa vê canais globais de empresa (empresa_id NULL) e seus próprios canais (empresa_id = sua empresa)
      OR (
        tipo_publico = 'empresa'
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'empresa'
        )
        AND (
          empresa_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM empresas e
            WHERE e.id = canais.empresa_id AND e.usuario_id = auth.uid ()
          )
        )
      )
      -- profissional (ativo) vê canais de empresas segmentados por comunidade
      OR (
        tipo_publico = 'empresa'
        AND empresa_id IS NOT NULL
        AND comunidade_prof IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid () AND u.role = 'profissional' AND u.status = 'ativo'
        )
        AND EXISTS (
          SELECT 1
          FROM profissionais p
          WHERE p.usuario_id = auth.uid ()
            AND comunidade_prof = ANY (p.categorias)
        )
      )
      -- admin canal admin (redundante, mas mantém simetria)
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

-- Mensagens: SELECT conforme canal acessível
DROP POLICY IF EXISTS "mensagens select se canal acessível" ON mensagens_canal;

CREATE POLICY "mensagens select se canal acessível" ON mensagens_canal FOR
SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM canais c
      WHERE c.id = mensagens_canal.canal_id
        AND COALESCE (c.ativo, TRUE) = TRUE
        AND (
          EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin')
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
            AND (
              c.empresa_id IS NULL
              OR EXISTS (SELECT 1 FROM empresas e WHERE e.id = c.empresa_id AND e.usuario_id = auth.uid ())
            )
          )
          OR (
            c.tipo_publico = 'empresa'
            AND c.empresa_id IS NOT NULL
            AND c.comunidade_prof IS NOT NULL
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'profissional' AND u.status = 'ativo')
            AND EXISTS (
              SELECT 1
              FROM profissionais p
              WHERE p.usuario_id = auth.uid ()
                AND c.comunidade_prof = ANY (p.categorias)
            )
          )
          OR (
            c.tipo_publico = 'admin'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin')
          )
        )
    )
  );

-- Mensagens: UPDATE (reacoes/lida_por) conforme canal acessível
DROP POLICY IF EXISTS "mensagens update quem vê o canal" ON mensagens_canal;

CREATE POLICY "mensagens update quem vê o canal" ON mensagens_canal FOR
UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM canais c
      WHERE c.id = mensagens_canal.canal_id
        AND COALESCE (c.ativo, TRUE) = TRUE
        AND (
          EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin')
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
            AND (
              c.empresa_id IS NULL
              OR EXISTS (SELECT 1 FROM empresas e WHERE e.id = c.empresa_id AND e.usuario_id = auth.uid ())
            )
          )
          OR (
            c.tipo_publico = 'empresa'
            AND c.empresa_id IS NOT NULL
            AND c.comunidade_prof IS NOT NULL
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'profissional' AND u.status = 'ativo')
            AND EXISTS (
              SELECT 1
              FROM profissionais p
              WHERE p.usuario_id = auth.uid ()
                AND c.comunidade_prof = ANY (p.categorias)
            )
          )
          OR (
            c.tipo_publico = 'admin'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid () AND u.role = 'admin')
          )
        )
    )
  )
WITH CHECK (EXISTS (SELECT 1 FROM canais c WHERE c.id = mensagens_canal.canal_id));

