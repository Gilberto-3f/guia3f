-- Reações em mensagens de canal: toggle atómico e visível a todos (JSONB `reacoes`).

CREATE OR REPLACE FUNCTION public.usuario_pode_ver_canal_mensagem (p_canal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM canais c
    WHERE c.id = p_canal_id
      AND COALESCE(c.ativo, TRUE) = TRUE
      AND (
        EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
        OR (
          c.tipo_publico = 'turista'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'turista'
          )
        )
        OR (
          c.tipo_publico = 'profissional'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'profissional'
          )
        )
        OR (
          c.tipo_publico = 'empresa'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'empresa'
              AND (
                c.empresa_id IS NULL
                OR EXISTS (
                  SELECT 1
                  FROM empresas e
                  WHERE e.id = c.empresa_id
                    AND e.usuario_id = auth.uid()
                )
              )
          )
        )
        OR (
          c.tipo_publico = 'empresa'
          AND c.empresa_id IS NOT NULL
          AND c.comunidade_prof IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'profissional'
              AND u.status = 'ativo'
          )
          AND EXISTS (
            SELECT 1
            FROM profissionais p
            WHERE p.usuario_id = auth.uid()
              AND c.comunidade_prof = ANY (p.categorias)
          )
        )
        OR (
          c.tipo_publico = 'empresa'
          AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Passeios', 'Hospedagem', 'Mensageiro')
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'profissional'
          )
        )
        OR (
          c.tipo_publico = 'profissional'
          AND c.nome IN ('Motoristas App', 'Vans', 'Táxis', 'Guias', 'Anfitriões', 'Motorista de App', 'Van', 'Taxistas', 'Guia', 'Anfitriao', 'Anfitrião')
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'empresa'
          )
        )
        OR (
          c.tipo_publico = 'admin'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'admin'
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.toggle_reacao_mensagem_canal (
  p_mensagem_id uuid,
  p_emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_canal_id uuid;
  v_arr jsonb := '[]'::jsonb;
  v_new jsonb;
  v_has boolean := false;
  elem jsonb;
  v_emoji text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_emoji := NULLIF(TRIM(p_emoji), '');
  IF v_emoji IS NULL THEN
    RAISE EXCEPTION 'emoji_invalido';
  END IF;

  SELECT m.canal_id, COALESCE(m.reacoes, '[]'::jsonb)
  INTO v_canal_id, v_arr
  FROM mensagens_canal m
  WHERE m.id = p_mensagem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mensagem_nao_encontrada';
  END IF;

  IF NOT public.usuario_pode_ver_canal_mensagem(v_canal_id) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  IF jsonb_typeof(v_arr) <> 'array' THEN
    v_arr := '[]'::jsonb;
  END IF;

  FOR elem IN
  SELECT *
  FROM jsonb_array_elements(v_arr) LOOP
    IF (elem ->> 'usuario_id') = v_uid::text AND (elem ->> 'tipo') = v_emoji THEN
      v_has := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_has THEN
    SELECT COALESCE(
      (
        SELECT jsonb_agg(e)
        FROM jsonb_array_elements(v_arr) AS e
        WHERE NOT (
          (e ->> 'usuario_id') = v_uid::text
          AND (e ->> 'tipo') = v_emoji
        )
      ),
      '[]'::jsonb
    ) INTO v_new;
  ELSE
    v_new := v_arr || jsonb_build_array(
      jsonb_build_object('usuario_id', v_uid::text, 'tipo', v_emoji)
    );
  END IF;

  UPDATE mensagens_canal
  SET reacoes = v_new
  WHERE id = p_mensagem_id;

  RETURN jsonb_build_object('reacoes', v_new);
END;
$$;

GRANT EXECUTE ON FUNCTION public.usuario_pode_ver_canal_mensagem (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.toggle_reacao_mensagem_canal (uuid, text) TO authenticated;
