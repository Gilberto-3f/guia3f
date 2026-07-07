-- Fixup Advisor: "Policy Exists · RLS Disabled"
-- Policies já criadas em migrations anteriores; reativa RLS em produção.

ALTER TABLE public.anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;
