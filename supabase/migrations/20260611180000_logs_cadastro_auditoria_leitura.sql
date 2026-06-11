-- Log de acesso de ADMs às verificações arquivadas (Cadastros > Auditoria)

CREATE TABLE IF NOT EXISTS public.logs_cadastro_auditoria_leitura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id UUID NOT NULL REFERENCES public.logs_verificacao (id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  admin_handle TEXT NOT NULL,
  acessado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_cadastro_auditoria_leitura_log
  ON public.logs_cadastro_auditoria_leitura (log_id, acessado_em DESC);

CREATE INDEX IF NOT EXISTS idx_logs_cadastro_auditoria_leitura_admin
  ON public.logs_cadastro_auditoria_leitura (admin_id, acessado_em DESC);

ALTER TABLE public.logs_cadastro_auditoria_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logs_cadastro_auditoria_leitura_select_admin ON public.logs_cadastro_auditoria_leitura;
CREATE POLICY logs_cadastro_auditoria_leitura_select_admin ON public.logs_cadastro_auditoria_leitura
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

DROP POLICY IF EXISTS logs_cadastro_auditoria_leitura_insert_admin ON public.logs_cadastro_auditoria_leitura;
CREATE POLICY logs_cadastro_auditoria_leitura_insert_admin ON public.logs_cadastro_auditoria_leitura
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

COMMENT ON TABLE public.logs_cadastro_auditoria_leitura IS
  'Rastreia ADMs que abriram verificações de cadastro arquivadas (Cadastros > Auditoria).';
