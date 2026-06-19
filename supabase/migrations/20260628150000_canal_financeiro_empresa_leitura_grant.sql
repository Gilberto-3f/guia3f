-- Garante que empresas autenticadas possam marcar avisos do canal financeiro como lidos.
GRANT SELECT, UPDATE ON public.canal_financeiro TO authenticated;
