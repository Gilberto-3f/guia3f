-- Ao excluir post (soft delete já feito no cliente): remove interações em todo o sistema.
-- Comentários são apagados de fato (post ainda existe com deleted_at), para sumir de "Minhas atividades" e queries diretas.
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
    OR (
      dados_extras ? 'post_id'
      AND (dados_extras->>'post_id')::uuid = p_post_id
    );

  DELETE FROM atividades
  WHERE
    tipo = 'curtiu_comentario'
    AND (
      (
        dados_extras ? 'post_id'
        AND (dados_extras->>'post_id')::uuid = p_post_id
      )
      OR alvo_id IN (
        SELECT
          id
        FROM
          comentarios
        WHERE
          post_id = p_post_id
      )
    );

  DELETE FROM atividades
  WHERE
    alvo_id IN (
      SELECT
        id
      FROM
        comentarios
      WHERE
        post_id = p_post_id
    );

  DELETE FROM curtidas
  WHERE
    post_id = p_post_id
    OR comentario_id IN (
      SELECT
        id
      FROM
        comentarios
      WHERE
        post_id = p_post_id
    );

  DELETE FROM item_salvo
  WHERE
    post_id = p_post_id;

  DELETE FROM comentarios
  WHERE
    post_id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION limpar_dados_ao_excluir_post (UUID) TO authenticated;
