-- Reações e leitura em canais empresa↔profissional: match por slug de categoria (Guia, Motorista de App, etc.)

CREATE OR REPLACE FUNCTION public.slug_categoria_profissional(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '';
  END IF;
  v := lower(btrim(raw));
  v := translate(
    v,
    'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ',
    'aaaaeeiooouucAAAAEEIOOOUUC'
  );
  IF v IN ('motorista de app', 'motorista de aplicativo', 'motoristas app', 'motoristas_app') THEN
    RETURN 'motorista_app';
  END IF;
  IF v IN ('guia', 'guia de turismo', 'guias') THEN
    RETURN 'guia';
  END IF;
  IF v IN ('taxista', 'taxistas', 'taxis', 'táxis') THEN
    RETURN 'taxista';
  END IF;
  IF v IN ('van', 'vans') THEN
    RETURN 'van';
  END IF;
  IF v IN ('anfitriao', 'anfitrião', 'anfitrioes', 'anfitriões') THEN
    RETURN 'anfitriao';
  END IF;
  v := regexp_replace(v, '\s+', '_', 'g');
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.profissional_tem_slug_categoria(p_usuario_id uuid, p_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_slug IS NOT NULL
    AND btrim(p_slug) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.usuario_id = p_usuario_id
        AND p.categorias IS NOT NULL
        AND (
          (
            jsonb_typeof(p.categorias) = 'array'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(p.categorias) AS elem(val)
              WHERE public.slug_categoria_profissional(elem.val) = p_slug
            )
          )
          OR (
            jsonb_typeof(p.categorias) = 'string'
            AND public.slug_categoria_profissional(p.categorias #>> '{}') = p_slug
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.profissional_acessa_canal_empresa_comunidade(
  p_usuario_id uuid,
  p_comunidade_prof text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profissional_tem_slug_categoria(
    p_usuario_id,
    public.slug_categoria_profissional(p_comunidade_prof)
  );
$$;

CREATE OR REPLACE FUNCTION public.usuario_pode_ver_canal_mensagem(p_canal_id uuid)
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
              AND COALESCE(u.status, 'ativo') = 'ativo'
          )
          AND public.profissional_acessa_canal_empresa_comunidade(auth.uid(), c.comunidade_prof)
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
          AND c.nome IN (
            'Motoristas App',
            'Vans',
            'Táxis',
            'Guias',
            'Anfitriões',
            'Motorista de App',
            'Van',
            'Taxistas',
            'Guia',
            'Anfitriao',
            'Anfitrião'
          )
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

DROP POLICY IF EXISTS "mensagens update quem vê o canal" ON mensagens_canal;

CREATE POLICY "mensagens update quem vê o canal" ON mensagens_canal FOR
UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM canais c
      WHERE c.id = mensagens_canal.canal_id
        AND COALESCE(c.ativo, TRUE) = TRUE
        AND (
          EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
          OR (
            c.tipo_publico = 'turista'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'turista')
          )
          OR (
            c.tipo_publico = 'profissional'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'profissional')
          )
          OR (
            c.tipo_publico = 'empresa'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'empresa')
            AND (
              c.empresa_id IS NULL
              OR EXISTS (SELECT 1 FROM empresas e WHERE e.id = c.empresa_id AND e.usuario_id = auth.uid())
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
                AND COALESCE(u.status, 'ativo') = 'ativo'
            )
            AND public.profissional_acessa_canal_empresa_comunidade(auth.uid(), c.comunidade_prof)
          )
          OR (
            c.tipo_publico = 'empresa'
            AND c.nome IN ('Gastronomia', 'Lojas', 'Atrativos', 'Passeios', 'Hospedagem', 'Mensageiro')
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'profissional')
          )
          OR (
            c.tipo_publico = 'profissional'
            AND c.nome IN (
              'Motoristas App',
              'Vans',
              'Táxis',
              'Guias',
              'Anfitriões',
              'Motorista de App',
              'Van',
              'Taxistas',
              'Guia',
              'Anfitriao',
              'Anfitrião'
            )
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'empresa')
          )
          OR (
            c.tipo_publico = 'admin'
            AND EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
          )
        )
    )
  )
WITH CHECK (EXISTS (SELECT 1 FROM canais c WHERE c.id = mensagens_canal.canal_id));

GRANT EXECUTE ON FUNCTION public.slug_categoria_profissional(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profissional_tem_slug_categoria(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profissional_acessa_canal_empresa_comunidade(uuid, text) TO authenticated;
