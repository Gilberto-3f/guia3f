-- Garante linha em public.usuarios para todo novo usuário em auth.users (magic link, email/senha, OAuth).
-- Role padrão: turista; raw_user_meta_data->>'role' pode antecipar o papel quando enviado no signup.
-- SECURITY DEFINER + search_path fixo: bypassa RLS de forma controlada.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user ();

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
  IF v_role IS NULL THEN
    v_role := 'turista';
  END IF;

  INSERT INTO public.usuarios (id, email, role, created_at)
  VALUES (
    NEW.id,
    LOWER(TRIM(COALESCE(NEW.email, ''))),
    v_role,
    COALESCE(NEW.created_at, NOW())
  )
  ON CONFLICT (id)
    DO UPDATE SET
      email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user () IS
  'Disparado após INSERT em auth.users; cria/atualiza public.usuarios (email). Role inicial: meta role ou turista.';

REVOKE ALL ON FUNCTION public.handle_new_user () FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user ();

-- Backfill idempotente: auth sem linha correspondente em public.usuarios
INSERT INTO public.usuarios (id, email, role, created_at)
SELECT
  au.id,
  LOWER(TRIM(COALESCE(au.email, ''))),
  COALESCE(
    NULLIF(BTRIM(COALESCE(au.raw_user_meta_data ->> 'role', '')), ''),
    'turista'
  ),
  COALESCE(au.created_at, NOW())
FROM
  auth.users au
  LEFT JOIN public.usuarios pu ON au.id = pu.id
WHERE
  pu.id IS NULL
ON CONFLICT (id)
  DO NOTHING;
