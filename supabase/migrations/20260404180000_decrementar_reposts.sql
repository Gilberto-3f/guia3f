-- Permite desfazer republicação (toggle) mantendo total_reposts coerente
CREATE OR REPLACE FUNCTION decrementar_reposts (post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts
  SET
    total_reposts = GREATEST(COALESCE(total_reposts, 0) - 1, 0)
  WHERE
    id = post_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION decrementar_reposts (UUID) TO authenticated;
