-- =====================================================
-- Expansão empresas + avaliacoes + triggers + RLS
-- (idempotente onde possível; revisar se ja existir avaliacoes com turista_id)
-- =====================================================

-- 1. Empresas
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS descricao_longa TEXT,
  ADD COLUMN IF NOT EXISTS horarios JSONB DEFAULT '{
    "segunda": {"abre": "09:00", "fecha": "18:00", "fechado": false},
    "terca": {"abre": "09:00", "fecha": "18:00", "fechado": false},
    "quarta": {"abre": "09:00", "fecha": "18:00", "fechado": false},
    "quinta": {"abre": "09:00", "fecha": "18:00", "fechado": false},
    "sexta": {"abre": "09:00", "fecha": "18:00", "fechado": false},
    "sabado": {"abre": "09:00", "fecha": "18:00", "fechado": false},
    "domingo": {"abre": "09:00", "fecha": "18:00", "fechado": true}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS fotos_url JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fotos_360_url JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_seguidores INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_empresas_localizacao ON empresas (latitude, longitude);

-- 2. Tabela avaliacoes (nova instalação)
CREATE TABLE IF NOT EXISTS avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  nota INTEGER NOT NULL CHECK (
    nota >= 1
    AND nota <= 5
  ),
  comentario TEXT,
  avaliador_tipo TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, usuario_id)
);

-- Migração leve: se existir coluna antiga turista_id, copiar para usuario_id (execute uma vez se aplicável)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'turista_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE
      table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'usuario_id'
  ) THEN
    UPDATE avaliacoes
    SET
      usuario_id = turista_id
    WHERE
      usuario_id IS NULL
      AND turista_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_empresa ON avaliacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_usuario ON avaliacoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_tipo ON avaliacoes (avaliador_tipo);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_nota ON avaliacoes (nota);

-- 3. Trigger avaliador_tipo
CREATE OR REPLACE FUNCTION set_avaliador_tipo ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM usuarios
  WHERE
    id = NEW.usuario_id;

  IF user_role = 'turista' THEN
    NEW.avaliador_tipo := 'turista';
  ELSIF user_role = 'profissional' THEN
    NEW.avaliador_tipo := 'profissional';
  ELSE
    RAISE EXCEPTION 'Apenas turistas e profissionais podem avaliar';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_avaliador_tipo ON avaliacoes;

CREATE TRIGGER trigger_set_avaliador_tipo
BEFORE INSERT ON avaliacoes
FOR EACH ROW
EXECUTE PROCEDURE set_avaliador_tipo ();

-- 4. Atualizar média e total na empresa
CREATE OR REPLACE FUNCTION atualizar_media_empresa ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  eid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    eid := OLD.empresa_id;
  ELSE
    eid := NEW.empresa_id;
  END IF;

  UPDATE empresas
  SET
    nota_media = COALESCE(
      (
        SELECT AVG(nota::numeric)
        FROM avaliacoes
        WHERE
          empresa_id = eid
      ),
      0
    ),
    total_avaliacoes = (
      SELECT COUNT(*)::integer
      FROM avaliacoes
      WHERE
        empresa_id = eid
    )
  WHERE
    id = eid;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_media_empresa ON avaliacoes;

CREATE TRIGGER trigger_atualizar_media_empresa
AFTER INSERT
OR
UPDATE
OR DELETE ON avaliacoes FOR EACH ROW
EXECUTE PROCEDURE atualizar_media_empresa ();

-- 5. total_seguidores via favoritos
CREATE OR REPLACE FUNCTION atualizar_total_seguidores ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.empresa_id IS NOT NULL THEN
      UPDATE empresas
      SET
        total_seguidores = total_seguidores + 1
      WHERE
        id = NEW.empresa_id;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.empresa_id IS NOT NULL THEN
      UPDATE empresas
      SET
        total_seguidores = GREATEST(0, total_seguidores - 1)
      WHERE
        id = OLD.empresa_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_seguidores ON favoritos;

CREATE TRIGGER trigger_atualizar_seguidores
AFTER INSERT
OR DELETE ON favoritos FOR EACH ROW
EXECUTE PROCEDURE atualizar_total_seguidores ();

-- 6. RLS avaliacoes
ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver avaliações" ON avaliacoes;
DROP POLICY IF EXISTS "Turistas e profissionais podem criar avaliações" ON avaliacoes;
DROP POLICY IF EXISTS "Usuários podem editar suas próprias avaliações" ON avaliacoes;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias avaliações" ON avaliacoes;

CREATE POLICY "Usuários autenticados podem ver avaliações" ON avaliacoes FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Turistas e profissionais podem criar avaliações" ON avaliacoes FOR INSERT
WITH
  CHECK (
    auth.role () = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM usuarios
      WHERE
        id = auth.uid ()
        AND role IN ('turista', 'profissional')
    )
  );

CREATE POLICY "Usuários podem editar suas próprias avaliações" ON avaliacoes FOR UPDATE
USING (usuario_id = auth.uid ())
WITH
  CHECK (usuario_id = auth.uid ());

CREATE POLICY "Usuários podem deletar suas próprias avaliações" ON avaliacoes FOR DELETE USING (usuario_id = auth.uid ());
