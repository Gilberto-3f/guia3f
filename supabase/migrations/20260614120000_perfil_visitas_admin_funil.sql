-- Funil de conversão (ADM): mesma leitura de visitas que a dashboard da empresa
DROP POLICY IF EXISTS "perfil_visitas select admin" ON public.perfil_visitas;
CREATE POLICY "perfil_visitas select admin" ON public.perfil_visitas FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);
