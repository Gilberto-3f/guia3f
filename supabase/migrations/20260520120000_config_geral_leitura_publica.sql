-- Leitura pública dos textos institucionais (regras, termos, privacidade) no app.

ALTER TABLE public.config_geral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_geral_select_autenticado ON public.config_geral;
CREATE POLICY config_geral_select_autenticado ON public.config_geral
FOR SELECT
TO authenticated
USING (true);
