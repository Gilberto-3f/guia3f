-- RLS: admins autenticados leem e gravam logs de auditoria (aba Configurações > Auditoria)

ALTER TABLE public.logs_verificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logs_verificacao_select_admin ON public.logs_verificacao;
CREATE POLICY logs_verificacao_select_admin ON public.logs_verificacao
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

DROP POLICY IF EXISTS logs_verificacao_insert_admin ON public.logs_verificacao;
CREATE POLICY logs_verificacao_insert_admin ON public.logs_verificacao
FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
    )
  );
