-- Empresa pode marcar oferta como removida (permanece no histórico; profissionais deixam de ver).

UPDATE public.comissao_oferta
SET status = 'pendente'
WHERE status IS NULL
   OR status NOT IN ('pendente', 'aprovada', 'reprovada', 'removido');

ALTER TABLE public.comissao_oferta
  DROP CONSTRAINT IF EXISTS comissao_oferta_status_check;

ALTER TABLE public.comissao_oferta
  ADD CONSTRAINT comissao_oferta_status_check CHECK (
    status IN ('pendente', 'aprovada', 'reprovada', 'removido')
  );

DROP POLICY IF EXISTS "comissao_oferta update dono empresa remover" ON public.comissao_oferta;

CREATE POLICY "comissao_oferta update dono empresa remover" ON public.comissao_oferta
FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = comissao_oferta.empresa_id
        AND e.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'removido'
    AND EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid()
    )
  );
