-- O trigger não pode abortar o INSERT em auth.users (senão signup retorna 500/503).
-- Em falha de INSERT em usuarios, registra WARNING e a API corrige via service role.

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

  BEGIN
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
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: falha ao inserir usuarios para % (%): %',
        NEW.id, v_role, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'Após INSERT em auth.users: tenta criar public.usuarios; falhas não revertem o signup.';

REVOKE ALL ON FUNCTION public.handle_new_user () FROM PUBLIC;

DO $$
DECLARE
  r text;
  roles text[] := ARRAY['supabase_auth_admin', 'postgres', 'supabase_admin', 'service_role'];
BEGIN
  FOREACH r IN ARRAY roles
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', r);
      EXECUTE format('GRANT INSERT, UPDATE ON TABLE public.usuarios TO %I', r);
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
  WHEN OTHERS THEN
    NULL;
END
$$;
