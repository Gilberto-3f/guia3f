-- Coluna status em usuarios (pré-aprovação até ADM) + trigger handle_new_user passa a preencher status.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pre_aprovado';

COMMENT ON COLUMN public.usuarios.status IS
  'pre_aprovado até análise; ativo após aprovação ADM; reprovado se reprovado.';

UPDATE public.usuarios
SET
  status = 'pre_aprovado'
WHERE
  status IS NULL;

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
  'Após INSERT em auth.users: cria public.usuarios (role meta ou turista, status pre_aprovado). ON CONFLICT só atualiza email.';

REVOKE ALL ON FUNCTION public.handle_new_user () FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user ();

-- Órfãos auth sem usuarios: incluir status
INSERT INTO public.usuarios (id, email, role, created_at, status)
SELECT
  au.id,
  LOWER(TRIM(COALESCE(au.email, ''))),
  COALESCE(
    NULLIF(BTRIM(COALESCE(au.raw_user_meta_data ->> 'role', '')), ''),
    'turista'
  ),
  COALESCE(au.created_at, NOW()),
  'pre_aprovado'
FROM
  auth.users au
  LEFT JOIN public.usuarios pu ON au.id = pu.id
WHERE
  pu.id IS NULL
ON CONFLICT (id)
  DO NOTHING;
