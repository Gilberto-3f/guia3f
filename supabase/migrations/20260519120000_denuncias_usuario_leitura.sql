-- Permite que turistas/profissionais vejam denúncias recebidas contra a própria conta
-- e que gestores de empresa vejam denúncias contra a empresa vinculada.

DROP POLICY IF EXISTS denuncias_select_denunciado ON public.denuncias;
DROP POLICY IF EXISTS denuncias_select_denunciado_turista ON public.denuncias;
CREATE POLICY denuncias_select_denunciado_turista ON public.denuncias
FOR SELECT
USING (
  denunciado_tipo = 'turista'
  AND denunciado_id IN (SELECT t.id FROM public.turistas t WHERE t.usuario_id = auth.uid())
);

DROP POLICY IF EXISTS denuncias_select_denunciado_profissional ON public.denuncias;
CREATE POLICY denuncias_select_denunciado_profissional ON public.denuncias
FOR SELECT
USING (
  denunciado_tipo = 'profissional'
  AND denunciado_id IN (SELECT p.id FROM public.profissionais p WHERE p.usuario_id = auth.uid())
);

DROP POLICY IF EXISTS denuncias_select_empresa_gestor ON public.denuncias;
CREATE POLICY denuncias_select_empresa_gestor ON public.denuncias
FOR SELECT
USING (
  denunciado_tipo = 'empresa'
  AND denunciado_id IN (
    SELECT e.id FROM public.empresas e WHERE e.usuario_id = auth.uid()
  )
);
