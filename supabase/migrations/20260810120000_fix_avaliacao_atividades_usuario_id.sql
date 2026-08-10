-- Corrige: null value in column "usuario_id" of relation "atividades"
-- ao inserir em public.avaliacoes (trigger legado trg_atividade_avaliacao).
-- Avaliação de mobilidade (pro↔turista) NÃO deve gerar linha em atividades.

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
  -- No-op permanente: avaliações não geram atividade social.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_avaliacao () IS
  'No-op: evita INSERT em atividades com usuario_id null (avaliações pro/turista/empresa).';

-- Insert service-role seguro (desliga triggers USER) para pós-corrida mobilidade.
CREATE OR REPLACE FUNCTION public.svc_inserir_avaliacao (
  p_usuario_id uuid,
  p_alvo_id uuid,
  p_alvo_tipo text,
  p_nota integer,
  p_feedback text DEFAULT NULL,
  p_avaliador_tipo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_avaliador text;
BEGIN
  IF p_usuario_id IS NULL OR p_alvo_id IS NULL THEN
    RAISE EXCEPTION 'parametros_invalidos';
  END IF;
  IF p_nota IS NULL OR p_nota < 1 OR p_nota > 5 THEN
    RAISE EXCEPTION 'nota_invalida';
  END IF;
  IF COALESCE(p_alvo_tipo, '') NOT IN ('profissional', 'turista', 'empresa') THEN
    RAISE EXCEPTION 'alvo_tipo_invalido';
  END IF;

  v_avaliador := NULLIF(BTRIM(COALESCE(p_avaliador_tipo, '')), '');
  IF v_avaliador IS NULL THEN
    SELECT role INTO v_avaliador FROM public.usuarios WHERE id = p_usuario_id;
  END IF;
  v_avaliador := COALESCE(v_avaliador, 'turista');

  ALTER TABLE public.avaliacoes DISABLE TRIGGER USER;

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
    p_usuario_id,
    NULL,
    p_alvo_id,
    p_alvo_tipo,
    p_nota,
    NULLIF(BTRIM(COALESCE(p_feedback, '')), ''),
    v_avaliador
  )
  RETURNING id INTO v_id;

  ALTER TABLE public.avaliacoes ENABLE TRIGGER USER;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    ALTER TABLE public.avaliacoes ENABLE TRIGGER USER;
    RAISE;
END;
$$;

ALTER FUNCTION public.svc_inserir_avaliacao (uuid, uuid, text, integer, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.svc_inserir_avaliacao (uuid, uuid, text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.svc_inserir_avaliacao (uuid, uuid, text, integer, text, text) TO service_role;

COMMENT ON FUNCTION public.svc_inserir_avaliacao (uuid, uuid, text, integer, text, text) IS
  'Service-role: insere avaliação sem disparar triggers USER (evita atividades.usuario_id null).';
