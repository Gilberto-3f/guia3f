-- Etapa 10: avaliação de turista + índices.

ALTER TABLE public.avaliacoes
  DROP CONSTRAINT IF EXISTS avaliacoes_alvo_tipo_check;

ALTER TABLE public.avaliacoes
  ADD CONSTRAINT avaliacoes_alvo_tipo_check CHECK (
    alvo_tipo IS NULL
    OR alvo_tipo IN ('empresa', 'profissional', 'turista')
  );

CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_turista_usuario_unique
  ON public.avaliacoes (alvo_id, usuario_id)
  WHERE alvo_tipo = 'turista' AND alvo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_avaliador_tipo ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF COALESCE(NEW.alvo_tipo, '') IN ('profissional', 'turista') THEN
    IF NEW.avaliador_tipo IS NOT NULL AND TRIM(NEW.avaliador_tipo) <> '' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT role INTO user_role
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  IF user_role = 'turista' THEN
    NEW.avaliador_tipo := 'turista';
  ELSIF user_role = 'profissional' THEN
    NEW.avaliador_tipo := 'profissional';
  ELSIF user_role = 'empresa' THEN
    NEW.avaliador_tipo := 'empresa';
  ELSE
    NEW.avaliador_tipo := COALESCE(NEW.avaliador_tipo, 'turista');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.inserir_avaliacao_turista (
  p_alvo_id uuid,
  p_nota integer,
  p_feedback text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_role text;
  v_avaliacao_id uuid;
  v_turista_usuario uuid;
BEGIN
  v_uid := auth.uid ();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_nota IS NULL OR p_nota < 1 OR p_nota > 5 THEN
    RAISE EXCEPTION 'nota_invalida';
  END IF;

  IF p_alvo_id IS NULL THEN
    RAISE EXCEPTION 'alvo_invalido';
  END IF;

  SELECT role INTO v_role FROM public.usuarios WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'profissional' AND v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'role_nao_pode_avaliar';
  END IF;

  -- Aceita turistas.id ou usuarios.id
  SELECT t.usuario_id INTO v_turista_usuario
  FROM public.turistas t
  WHERE t.id = p_alvo_id OR t.usuario_id = p_alvo_id
  LIMIT 1;

  IF v_turista_usuario IS NULL THEN
    -- se já for usuario_id de role turista
    IF EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = p_alvo_id AND u.role = 'turista') THEN
      v_turista_usuario := p_alvo_id;
    ELSE
      RAISE EXCEPTION 'alvo_invalido';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.avaliacoes a
    WHERE a.usuario_id = v_uid
      AND a.alvo_tipo = 'turista'
      AND a.alvo_id = v_turista_usuario
  ) THEN
    RAISE EXCEPTION 'ja_avaliou';
  END IF;

  ALTER TABLE public.avaliacoes DISABLE TRIGGER USER;

  INSERT INTO public.avaliacoes (
    usuario_id, empresa_id, alvo_id, alvo_tipo, nota, feedback, avaliador_tipo
  ) VALUES (
    v_uid,
    NULL,
    v_turista_usuario,
    'turista',
    p_nota,
    NULLIF(BTRIM(COALESCE(p_feedback, '')), ''),
    'profissional'
  )
  RETURNING id INTO v_avaliacao_id;

  ALTER TABLE public.avaliacoes ENABLE TRIGGER USER;
  RETURN v_avaliacao_id;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE public.avaliacoes ENABLE TRIGGER USER;
    RAISE;
END;
$$;

ALTER FUNCTION public.inserir_avaliacao_turista (uuid, integer, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.inserir_avaliacao_turista (uuid, integer, text) TO authenticated;

COMMENT ON FUNCTION public.inserir_avaliacao_turista IS
  'Profissional avalia turista (alvo_tipo=turista). Usado pós-corrida de mobilidade.';
