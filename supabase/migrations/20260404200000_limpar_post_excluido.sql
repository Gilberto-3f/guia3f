-- Remove curtidas, vínculos salvos e notificações ligadas ao post quando o autor o exclui (soft delete já aplicado na linha).
CREATE OR REPLACE FUNCTION limpar_dados_ao_excluir_post (p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      posts
    WHERE
      id = p_post_id
      AND autor_id = auth.uid ()
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  DELETE FROM atividades
  WHERE
    alvo_id = p_post_id
    AND alvo_tipo = 'post';

  DELETE FROM atividades
  WHERE
    tipo = 'curtiu_comentario'
    AND (dados_extras->>'post_id')::uuid = p_post_id;

  DELETE FROM curtidas
  WHERE
    post_id = p_post_id;

  DELETE FROM item_salvo
  WHERE
    post_id = p_post_id;

  UPDATE comentarios
  SET
    deleted_at = COALESCE(deleted_at, NOW())
  WHERE
    post_id = p_post_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION limpar_dados_ao_excluir_post (UUID) TO authenticated;
