-- Atividade "seguiu empresa": feed social (amigos do seguidor), não notificação para o gestor.
-- usuario_id = autor_id = quem favoritou a empresa; lida=true (não conta como alerta em Minha conta).

CREATE OR REPLACE FUNCTION public.trg_atividade_favorito_empresa ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor UUID;
  v_emp_nu TEXT;
  v_seg_nu TEXT;
  v_role TEXT;
BEGIN
  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    e.usuario_id,
    NULLIF(trim(e.nome_usuario::text), '') INTO v_gestor,
    v_emp_nu
  FROM
    public.empresas e
  WHERE
    e.id = NEW.empresa_id;

  IF NOT FOUND OR v_gestor IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_gestor = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT
    u.role::text INTO v_role
  FROM
    public.usuarios u
  WHERE
    u.id = NEW.usuario_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_seg_nu := NULL;

  IF v_role = 'turista' THEN
    SELECT
      NULLIF(trim(t.nome_usuario::text), '') INTO v_seg_nu
    FROM
      public.turistas t
    WHERE
      t.usuario_id = NEW.usuario_id;
  ELSIF v_role = 'profissional' THEN
    SELECT
      NULLIF(trim(p.nome_usuario::text), '') INTO v_seg_nu
    FROM
      public.profissionais p
    WHERE
      p.usuario_id = NEW.usuario_id;
  ELSIF v_role = 'empresa' THEN
    SELECT
      NULLIF(trim(e2.nome_usuario::text), '') INTO v_seg_nu
    FROM
      public.empresas e2
    WHERE
      e2.usuario_id = NEW.usuario_id
    LIMIT 1;
  ELSIF v_role = 'admin' THEN
    SELECT
      COALESCE(
        (
          SELECT
            NULLIF(trim(p.nome_usuario::text), '')
          FROM
            public.profissionais p
          WHERE
            p.usuario_id = NEW.usuario_id
        ),
        (
          SELECT
            NULLIF(trim(t.nome_usuario::text), '')
          FROM
            public.turistas t
          WHERE
            t.usuario_id = NEW.usuario_id
        )
      ) INTO v_seg_nu;
  END IF;

  IF v_seg_nu IS NULL OR v_seg_nu = '' THEN
    SELECT
      COALESCE(
        NULLIF(trim(u.username::text), ''),
        NULLIF(trim(split_part(u.email::text, '@', 1)), '')
      ) INTO v_seg_nu
    FROM
      public.usuarios u
    WHERE
      u.id = NEW.usuario_id;
  END IF;

  IF v_seg_nu IS NULL OR v_seg_nu = '' THEN
    v_seg_nu := 'usuario';
  END IF;

  IF v_emp_nu IS NULL OR v_emp_nu = '' THEN
    v_emp_nu := 'empresa';
  END IF;

  INSERT INTO public.atividades (
    usuario_id,
    autor_id,
    tipo,
    alvo_id,
    alvo_tipo,
    dados_extras,
    lida
  )
  VALUES (
    NEW.usuario_id,
    NEW.usuario_id,
    'seguiu_empresa',
    NEW.empresa_id,
    'empresa',
    jsonb_build_object(
      'seguidor_username',
      v_seg_nu,
      'empresa_username',
      v_emp_nu,
      'seguidor_id',
      NEW.usuario_id,
      'empresa_id',
      NEW.empresa_id
    ),
    TRUE
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_favorito_empresa () IS
'Após favoritar empresa: atividade tipo seguiu_empresa para feed de amigos (autor=usuario=seguidor). lida=true para não poluir contagem de não lidas.';
