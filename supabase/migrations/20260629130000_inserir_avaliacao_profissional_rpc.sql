-- Avaliação de profissional: RPC contorna trigger legado `trg_atividade_avaliacao`
-- que ainda tenta INSERT em `atividades` (tipo avaliou / empresa_id null) e quebra o INSERT.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'avaliacoes'
      AND NOT t.tgisinternal
      AND p.proname = 'trg_atividade_avaliacao'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.avaliacoes', r.tgname);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_atividades_avaliacao ON public.avaliacoes;

CREATE OR REPLACE FUNCTION public.trg_atividade_avaliacao ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.inserir_avaliacao_profissional (
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
  v_avaliador_tipo text;
  v_avaliacao_id uuid;
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

  SELECT role INTO v_role
  FROM public.usuarios
  WHERE id = v_uid;

  IF v_role = 'profissional' THEN
    v_avaliador_tipo := 'profissional';
  ELSIF v_role = 'empresa' THEN
    v_avaliador_tipo := 'empresa';
  ELSIF v_role = 'turista' THEN
    v_avaliador_tipo := 'turista';
  ELSE
    RAISE EXCEPTION 'role_nao_pode_avaliar';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.avaliacoes a
    WHERE
      a.usuario_id = v_uid
      AND a.alvo_tipo = 'profissional'
      AND (
        a.alvo_id = p_alvo_id
        OR a.alvo_id IN (
          SELECT pr.usuario_id
          FROM public.profissionais pr
          WHERE pr.id = p_alvo_id
        )
        OR a.alvo_id IN (
          SELECT pr.id
          FROM public.profissionais pr
          WHERE pr.usuario_id = p_alvo_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'ja_avaliou';
  END IF;

  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO public.avaliacoes (
    usuario_id,
    empresa_id,
    alvo_id,
    alvo_tipo,
    nota,
    feedback,
    avaliador_tipo
  )
  VALUES (
    v_uid,
    NULL,
    p_alvo_id,
    'profissional',
    p_nota,
    NULLIF(BTRIM(COALESCE(p_feedback, '')), ''),
    v_avaliador_tipo
  )
  RETURNING id INTO v_avaliacao_id;

  PERFORM set_config('session_replication_role', 'origin', true);

  RETURN v_avaliacao_id;
EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('session_replication_role', 'origin', true);
    RAISE;
END;
$$;

ALTER FUNCTION public.inserir_avaliacao_profissional (uuid, integer, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.inserir_avaliacao_profissional (uuid, integer, text) TO authenticated;

COMMENT ON FUNCTION public.inserir_avaliacao_profissional (uuid, integer, text) IS
  'Insere avaliação de profissional (alvo_tipo=profissional) sem disparar trigger legado de atividades.';
