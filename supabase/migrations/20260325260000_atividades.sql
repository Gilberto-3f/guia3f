-- Feed de atividades / notificações
-- usuario_id = destinatário (MINHA CONTA); ator_id = quem fez a ação (AMIGOS)

CREATE TABLE IF NOT EXISTS atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  ator_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  tipo VARCHAR (30) NOT NULL,
  alvo_id UUID NOT NULL,
  alvo_tipo VARCHAR (20) NOT NULL,
  dados_extras JSONB DEFAULT '{}'::jsonb,
  agrupador VARCHAR (50),
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW ()
);

CREATE INDEX IF NOT EXISTS idx_atividades_destinatario ON atividades (usuario_id);

CREATE INDEX IF NOT EXISTS idx_atividades_ator ON atividades (ator_id);

CREATE INDEX IF NOT EXISTS idx_atividades_created ON atividades (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atividades_dest_lida ON atividades (usuario_id, lida)
WHERE
  lida = FALSE;

-- Curtida em post
CREATE OR REPLACE FUNCTION trg_atividade_curtida_post ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor UUID;
BEGIN
  IF NEW.post_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    autor_id INTO v_autor
  FROM
    posts
  WHERE
    id = NEW.post_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO atividades (usuario_id, ator_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor,
    NEW.usuario_id,
    'curtiu_post',
    NEW.post_id,
    'post',
    jsonb_build_object('post_id', NEW.post_id, 'curtida_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_curtida_post ON curtidas;

CREATE TRIGGER trg_atividades_curtida_post
AFTER INSERT ON curtidas FOR EACH ROW
WHEN (NEW.post_id IS NOT NULL)
EXECUTE FUNCTION trg_atividade_curtida_post ();

-- Curtida em comentário
CREATE OR REPLACE FUNCTION trg_atividade_curtida_comentario ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor_com UUID;
  v_post UUID;
  v_texto TEXT;
BEGIN
  IF NEW.comentario_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    autor_id,
    post_id,
    texto INTO v_autor_com,
    v_post,
    v_texto
  FROM
    comentarios
  WHERE
    id = NEW.comentario_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor_com IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor_com = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO atividades (usuario_id, ator_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor_com,
    NEW.usuario_id,
    'curtiu_comentario',
    NEW.comentario_id,
    'comentario',
    jsonb_build_object(
      'comentario_id',
      NEW.comentario_id,
      'post_id',
      v_post,
      'curtida_id',
      NEW.id,
      'texto',
      v_texto
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_curtida_comentario ON curtidas;

CREATE TRIGGER trg_atividades_curtida_comentario
AFTER INSERT ON curtidas FOR EACH ROW
WHEN (NEW.comentario_id IS NOT NULL)
EXECUTE FUNCTION trg_atividade_curtida_comentario ();

-- Novo comentário em post
CREATE OR REPLACE FUNCTION trg_atividade_comentario ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor UUID;
BEGIN
  SELECT
    autor_id INTO v_autor
  FROM
    posts
  WHERE
    id = NEW.post_id
    AND deleted_at IS NULL;

  IF NOT FOUND OR v_autor IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_autor = NEW.autor_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO atividades (usuario_id, ator_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_autor,
    NEW.autor_id,
    'comentou',
    NEW.post_id,
    'post',
    jsonb_build_object('post_id', NEW.post_id, 'comentario_id', NEW.id, 'texto', NEW.texto)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_comentario ON comentarios;

CREATE TRIGGER trg_atividades_comentario
AFTER INSERT ON comentarios FOR EACH ROW
EXECUTE FUNCTION trg_atividade_comentario ();

-- Seguir usuário
CREATE OR REPLACE FUNCTION trg_atividade_seguir ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO atividades (usuario_id, ator_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    NEW.seguido_id,
    NEW.seguidor_id,
    'seguiu',
    NEW.seguidor_id,
    'usuario',
    jsonb_build_object('seguidor_id', NEW.seguidor_id, 'seguido_id', NEW.seguido_id, 'seguido_tipo', NEW.seguido_tipo)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_seguir ON redecontatos;

CREATE TRIGGER trg_atividades_seguir
AFTER INSERT ON redecontatos FOR EACH ROW
EXECUTE FUNCTION trg_atividade_seguir ();

-- Nova avaliação (notifica gestor da empresa)
CREATE OR REPLACE FUNCTION trg_atividade_avaliacao ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor UUID;
BEGIN
  SELECT
    usuario_id INTO v_gestor
  FROM
    empresas
  WHERE
    id = NEW.empresa_id;

  IF NOT FOUND OR v_gestor IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_gestor = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO atividades (usuario_id, ator_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_gestor,
    NEW.usuario_id,
    'avaliou',
    NEW.empresa_id,
    'empresa',
    jsonb_build_object('empresa_id', NEW.empresa_id, 'nota', NEW.nota, 'comentario', NEW.comentario, 'avaliacao_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_avaliacao ON avaliacoes;

CREATE TRIGGER trg_atividades_avaliacao
AFTER INSERT ON avaliacoes FOR EACH ROW
EXECUTE FUNCTION trg_atividade_avaliacao ();

ALTER TABLE atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atividades select destinatario" ON atividades;

DROP POLICY IF EXISTS "atividades select amigos" ON atividades;

CREATE POLICY "atividades select destinatario" ON atividades FOR
SELECT
  USING (usuario_id = auth.uid ());

CREATE POLICY "atividades select amigos" ON atividades FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        redecontatos r
      WHERE
        r.seguidor_id = auth.uid ()
        AND r.seguido_id = atividades.ator_id
    )
  );

DROP POLICY IF EXISTS "atividades update destinatario" ON atividades;

CREATE POLICY "atividades update destinatario" ON atividades FOR
UPDATE
  USING (usuario_id = auth.uid ())
  WITH CHECK (usuario_id = auth.uid ());
