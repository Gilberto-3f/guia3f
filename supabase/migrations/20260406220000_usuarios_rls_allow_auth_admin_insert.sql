-- Evidência (debug-521857.log): signUp → AuthApiError unexpected_failure 500, "Database error saving new user".
-- O trigger handle_new_user insere em public.usuarios com RLS ativo; no Supabase hospedado o papel
-- supabase_auth_admin precisa de policy explícita de INSERT.

DO $$
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM
      pg_roles
    WHERE
      rolname = 'supabase_auth_admin'
  ) THEN
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
