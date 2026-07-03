-- Aba Seguindo: todos os usuários autenticados podem ler interações outbound
-- de gestores de empresas aprovadas no guia (mesmo critério do feed/stories).

CREATE OR REPLACE FUNCTION public.autor_atividade_eh_empresa_guia_publico (p_autor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresas e
    WHERE e.usuario_id = p_autor_id
      AND e.docs_verificado = TRUE
      AND lower(coalesce(e.status::text, '')) IN ('aprovado', 'ativo')
      AND e.foto_url IS NOT NULL
      AND trim(coalesce(e.foto_url, '')) <> ''
      AND COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
  );
$$;

COMMENT ON FUNCTION public.autor_atividade_eh_empresa_guia_publico (UUID) IS
'Gestor de empresa elegível no guia público — interações visíveis na aba Seguindo para todos.';

DROP POLICY IF EXISTS "atividades select amigos" ON public.atividades;

CREATE POLICY "atividades select amigos" ON public.atividades FOR
SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.redecontatos r
      WHERE r.seguidor_id = auth.uid()
        AND r.seguido_id = atividades.autor_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.favoritos f
      INNER JOIN public.empresas e ON (
        (f.alvo_tipo = 'empresa' AND e.id = f.alvo_id)
        OR (f.empresa_id IS NOT NULL AND e.id = f.empresa_id)
      )
      WHERE f.usuario_id = auth.uid()
        AND e.usuario_id = atividades.autor_id
    )
    OR public.autor_atividade_eh_empresa_guia_publico(atividades.autor_id)
  );

COMMENT ON POLICY "atividades select amigos" ON public.atividades IS
'Leitura social: seguidos, empresas favoritadas ou gestor de empresa aprovada no guia público.';
