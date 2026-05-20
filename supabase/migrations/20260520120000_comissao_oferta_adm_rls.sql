-- ADM: visualizar e aprovar/reprovar ofertas de comissão (pré-análise antes dos profissionais)

DROP POLICY IF EXISTS "comissao_oferta select admin" ON public.comissao_oferta;
CREATE POLICY "comissao_oferta select admin" ON public.comissao_oferta
FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "comissao_oferta update admin" ON public.comissao_oferta;
CREATE POLICY "comissao_oferta update admin" ON public.comissao_oferta
FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  );
