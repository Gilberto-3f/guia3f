-- Após 20260406220000: se o signUp ainda retorna 500 "Database error saving new user",
-- o INSERT do trigger pode estar a correr como outro papel (ex.: postgres) ou sem GRANT explícito.
-- Esta migration: GRANT INSERT + policy de INSERT para papéis internos conhecidos + owner da função = postgres.

DO $$
DECLARE
  r text;
  roles text[] := ARRAY['supabase_auth_admin', 'postgres', 'supabase_admin'];
BEGIN
  FOREACH r IN ARRAY roles
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
      EXECUTE format('GRANT INSERT ON TABLE public.usuarios TO %I', r);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.usuarios', 'rls_ins_' || r);
      EXECUTE format(
        'CREATE POLICY %I ON public.usuarios FOR INSERT TO %I WITH CHECK (true)',
        'rls_ins_' || r,
        r
      );
    END IF;
  END LOOP;
END
$$;

DO $$
BEGIN
  ALTER FUNCTION public.handle_new_user () OWNER TO postgres;
EXCEPTION
  WHEN insufficient_privilege OR undefined_function THEN
    NULL;
END
$$;
