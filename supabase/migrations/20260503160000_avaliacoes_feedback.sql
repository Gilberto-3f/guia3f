-- Texto da avaliação: coluna unificada `feedback` (substitui `comentario` onde ainda existir).
-- Atualiza trigger de atividades que serializava NEW.comentario.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'comentario'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'feedback'
  ) THEN
    ALTER TABLE public.avaliacoes RENAME COLUMN comentario TO feedback;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'feedback'
  ) THEN
    ALTER TABLE public.avaliacoes ADD COLUMN feedback TEXT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'comentario'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'avaliacoes'
      AND column_name = 'feedback'
  ) THEN
    UPDATE public.avaliacoes
    SET
      feedback = COALESCE(feedback, comentario)
    WHERE
      feedback IS NULL
      AND comentario IS NOT NULL;

    ALTER TABLE public.avaliacoes DROP COLUMN comentario;
  END IF;
END $$;

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

  INSERT INTO atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_gestor,
    NEW.usuario_id,
    'avaliou',
    NEW.empresa_id,
    'empresa',
    jsonb_build_object('empresa_id', NEW.empresa_id, 'nota', NEW.nota, 'feedback', NEW.feedback, 'avaliacao_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
