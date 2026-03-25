-- =====================================================
-- BLOCO 1 - Foto de perfil (turistas e profissionais)
-- =====================================================

ALTER TABLE turistas
ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT;

ALTER TABLE profissionais
ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT;

COMMENT ON COLUMN turistas.foto_perfil_url IS 'URL da foto de perfil do turista (upload para Supabase Storage)';

COMMENT ON COLUMN profissionais.foto_perfil_url IS 'URL da foto de perfil do profissional (upload para Supabase Storage)';

-- =====================================================
-- BLOCO 2 - Migração segura avaliacoes: turista_id → usuario_id
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE
      schemaname = 'public'
      AND tablename = 'avaliacoes'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE
        table_schema = 'public'
        AND table_name = 'avaliacoes'
        AND column_name = 'turista_id'
    ) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
          table_schema = 'public'
          AND table_name = 'avaliacoes'
          AND column_name = 'usuario_id'
      ) THEN
        ALTER TABLE avaliacoes
        ADD COLUMN usuario_id UUID REFERENCES usuarios (id) ON DELETE CASCADE;

        UPDATE avaliacoes
        SET
          usuario_id = turista_id
        WHERE
          usuario_id IS NULL
          AND turista_id IS NOT NULL;

        ALTER TABLE avaliacoes ALTER COLUMN usuario_id SET NOT NULL;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE
            conname = 'avaliacoes_empresa_usuario_unique'
        ) THEN
          ALTER TABLE avaliacoes
          ADD CONSTRAINT avaliacoes_empresa_usuario_unique UNIQUE (empresa_id, usuario_id);
        END IF;

        RAISE NOTICE 'Migração concluída: turista_id → usuario_id';
      ELSE
        RAISE NOTICE 'Coluna usuario_id já existe, pulando migração turista_id';
      END IF;
    ELSE
      RAISE NOTICE 'Coluna turista_id não existe, pulando migração';
    END IF;
  ELSE
    RAISE NOTICE 'Tabela avaliacoes não existe, pulando migração';
  END IF;
END $$;

-- =====================================================
-- BLOCO 3 - RLS (idempotente: DROP + CREATE)
-- =====================================================

-- ----- favoritos -----
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver seus próprios favoritos" ON favoritos;
DROP POLICY IF EXISTS "Autenticados veem favoritos de empresas para seguidores" ON favoritos;
DROP POLICY IF EXISTS "Usuários podem criar favoritos" ON favoritos;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios favoritos" ON favoritos;

CREATE POLICY "Usuários podem ver seus próprios favoritos" ON favoritos FOR
SELECT
  USING (auth.role () = 'authenticated' AND usuario_id = auth.uid ());

-- Necessário para listar seguidores de uma empresa (PopupSeguidores, contagem).
CREATE POLICY "Autenticados veem favoritos de empresas para seguidores" ON favoritos FOR
SELECT
  USING (auth.role () = 'authenticated' AND empresa_id IS NOT NULL);

CREATE POLICY "Usuários podem criar favoritos" ON favoritos FOR INSERT
WITH
  CHECK (
    auth.role () = 'authenticated'
    AND usuario_id = auth.uid ()
    AND (
      (
        empresa_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM empresas
          WHERE
            id = empresa_id
        )
      )
      OR (
        produto_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM produtos
          WHERE
            id = produto_id
        )
      )
    )
  );

CREATE POLICY "Usuários podem deletar seus próprios favoritos" ON favoritos FOR DELETE USING (usuario_id = auth.uid ());

-- ----- empresas -----
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver empresas" ON empresas;
DROP POLICY IF EXISTS "Empresas podem editar seus próprios dados" ON empresas;
DROP POLICY IF EXISTS "Usuários podem cadastrar empresa própria" ON empresas;

CREATE POLICY "Usuários autenticados podem ver empresas" ON empresas FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Empresas podem editar seus próprios dados" ON empresas FOR UPDATE
USING (auth.uid () = usuario_id)
WITH
  CHECK (auth.uid () = usuario_id);

CREATE POLICY "Usuários podem cadastrar empresa própria" ON empresas FOR INSERT
WITH
  CHECK (auth.role () = 'authenticated' AND usuario_id = auth.uid ());

-- ----- usuarios -----
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver dados básicos de outros" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem inserir próprio registro" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio registro" ON usuarios;

CREATE POLICY "Usuários podem ver dados básicos de outros" ON usuarios FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Usuários podem inserir próprio registro" ON usuarios FOR INSERT
WITH
  CHECK (auth.role () = 'authenticated' AND id = auth.uid ());

CREATE POLICY "Usuários podem atualizar próprio registro" ON usuarios FOR UPDATE
USING (auth.uid () = id)
WITH
  CHECK (auth.uid () = id);

-- ----- turistas -----
ALTER TABLE turistas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver turistas" ON turistas;
DROP POLICY IF EXISTS "Turistas podem editar seus próprios dados" ON turistas;
DROP POLICY IF EXISTS "Turistas podem criar próprio perfil" ON turistas;

CREATE POLICY "Usuários autenticados podem ver turistas" ON turistas FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Turistas podem editar seus próprios dados" ON turistas FOR UPDATE
USING (auth.uid () = usuario_id)
WITH
  CHECK (auth.uid () = usuario_id);

CREATE POLICY "Turistas podem criar próprio perfil" ON turistas FOR INSERT
WITH
  CHECK (auth.role () = 'authenticated' AND auth.uid () = usuario_id);

-- ----- profissionais -----
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver profissionais" ON profissionais;
DROP POLICY IF EXISTS "Profissionais podem editar seus próprios dados" ON profissionais;
DROP POLICY IF EXISTS "Profissionais podem criar próprio perfil" ON profissionais;

CREATE POLICY "Usuários autenticados podem ver profissionais" ON profissionais FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Profissionais podem editar seus próprios dados" ON profissionais FOR UPDATE
USING (auth.uid () = usuario_id)
WITH
  CHECK (auth.uid () = usuario_id);

CREATE POLICY "Profissionais podem criar próprio perfil" ON profissionais FOR INSERT
WITH
  CHECK (auth.role () = 'authenticated' AND auth.uid () = usuario_id);

-- =====================================================
-- BLOCO 4 - Triggers com EXECUTE FUNCTION + updated_at (avaliacoes)
-- =====================================================

DROP TRIGGER IF EXISTS trigger_set_avaliador_tipo ON avaliacoes;

CREATE TRIGGER trigger_set_avaliador_tipo
BEFORE INSERT ON avaliacoes
FOR EACH ROW
EXECUTE FUNCTION set_avaliador_tipo ();

DROP TRIGGER IF EXISTS trigger_atualizar_media_empresa ON avaliacoes;

CREATE TRIGGER trigger_atualizar_media_empresa
AFTER INSERT
OR
UPDATE
OR DELETE ON avaliacoes FOR EACH ROW
EXECUTE FUNCTION atualizar_media_empresa ();

DROP TRIGGER IF EXISTS trigger_atualizar_seguidores ON favoritos;

CREATE TRIGGER trigger_atualizar_seguidores
AFTER INSERT
OR DELETE ON favoritos FOR EACH ROW
EXECUTE FUNCTION atualizar_total_seguidores ();

CREATE OR REPLACE FUNCTION update_updated_at_column ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_updated_at ON avaliacoes;

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON avaliacoes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();
