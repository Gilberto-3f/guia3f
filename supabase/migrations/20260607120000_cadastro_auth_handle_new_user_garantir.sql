-- Garante que signup (turista / profissional / empresa) não falhe com
-- "Database error creating new user" por RLS no trigger handle_new_user.

ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

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
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'Após INSERT em auth.users: cria public.usuarios (role em user_metadata; status pre_aprovado).';

REVOKE ALL ON FUNCTION public.handle_new_user () FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user ();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'DROP POLICY IF EXISTS "allow_supabase_auth_admin_insert_usuarios" ON public.usuarios';
    EXECUTE $policy$
      CREATE POLICY "allow_supabase_auth_admin_insert_usuarios"
      ON public.usuarios
      FOR INSERT
      TO supabase_auth_admin
      WITH CHECK (true)
    $policy$;
  END IF;
END
$$;
