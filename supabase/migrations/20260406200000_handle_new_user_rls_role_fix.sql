-- Corrige falhas no signup (Auth: "Database error saving new user") quando:
-- - raw_user_meta_data->>'role' traz valor fora do conjunto aceito pela base.
-- Não usar SET LOCAL row_security aqui: em alguns papéis o Postgres negam e o trigger quebra o signup inteiro.

CREATE OR REPLACE FUNCTION public.handle_new_user ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_role text;
BEGIN
  v_role := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'role', '')), '');

  IF v_role IS NULL OR v_role NOT IN ('turista', 'profissional', 'empresa', 'admin') THEN
    v_role := 'turista';
  END IF;

  INSERT INTO public.usuarios (id, email, role, created_at, status)
  VALUES (
    NEW.id,
    LOWER(TRIM(COALESCE(NEW.email, ''))),
    v_role,
    COALESCE(NEW.created_at, NOW()),
    'pre_aprovado'
  )
  ON CONFLICT (id)
    DO UPDATE SET
      email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'Após INSERT em auth.users: cria public.usuarios (role válida ou turista; status pre_aprovado).';

REVOKE ALL ON FUNCTION public.handle_new_user () FROM PUBLIC;
