-- Toggle atômico de curtida (post ou comentário), evita duplicate key em double-tap.
-- Triggers existentes (`trg_atividade_curtida_post`, `trg_limpar_atividades_apos_curtida_apagada`) mantêm atividades.

CREATE OR REPLACE FUNCTION public.toggle_curtida_social (
  p_post_id uuid DEFAULT NULL,
  p_comentario_id uuid DEFAULT NULL,
  p_empresa_interator_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid;
  v_existing_id uuid;
  v_new_id uuid;
BEGIN
  v_uid := auth.uid ();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (p_post_id IS NULL) = (p_comentario_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  SELECT
    id INTO v_existing_id
  FROM
    public.curtidas
  WHERE
    usuario_id = v_uid
    AND (
      (
        p_post_id IS NOT NULL
        AND post_id = p_post_id
        AND comentario_id IS NULL
      )
      OR (
        p_comentario_id IS NOT NULL
        AND comentario_id = p_comentario_id
        AND post_id IS NULL
      )
    )
    AND (
      (
        p_empresa_interator_id IS NULL
        AND empresa_interator_id IS NULL
      )
      OR empresa_interator_id = p_empresa_interator_id
    )
  LIMIT 1
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    DELETE FROM public.curtidas
    WHERE id = v_existing_id;

    RETURN jsonb_build_object('liked', FALSE);
  END IF;

  BEGIN
    INSERT INTO public.curtidas (post_id, comentario_id, usuario_id, empresa_interator_id)
      VALUES (p_post_id, p_comentario_id, v_uid, p_empresa_interator_id)
    RETURNING
      id INTO v_new_id;

    RETURN jsonb_build_object('liked', TRUE, 'curtida_id', v_new_id);
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('liked', TRUE);
  END;
END;
$$;

ALTER FUNCTION public.toggle_curtida_social (uuid, uuid, uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.toggle_curtida_social (uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.toggle_curtida_social IS
'Curtir/descurtir post ou comentário no modo atual (anfitrião vs hospedagem). Idempotente em corrida.';
