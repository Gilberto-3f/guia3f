-- Planos empresa: campos para editor ADM e exibição no menu Planos e Assinaturas

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS cor VARCHAR(20) DEFAULT 'azul',
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS servicos JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preco_mensal DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS preco_trimestral DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS preco_anual DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

ALTER TABLE public.planos ALTER COLUMN nome TYPE VARCHAR(80);

UPDATE public.planos
SET
  titulo = COALESCE(
    titulo,
    CASE nome
      WHEN 'BASICO' THEN 'Básico'
      WHEN 'PREMIUM' THEN 'Premium'
      WHEN 'ENTERPRISE' THEN 'Enterprise'
      ELSE nome
    END
  ),
  cor = COALESCE(cor, 'azul'),
  preco_mensal = COALESCE(preco_mensal, valor),
  preco_trimestral = COALESCE(preco_trimestral, ROUND(valor * 3, 2)),
  preco_anual = COALESCE(preco_anual, ROUND(valor * 12, 2)),
  servicos = COALESCE(NULLIF(servicos, '[]'::jsonb), '["pagina_rede_social"]'::jsonb)
WHERE titulo IS NULL OR preco_mensal IS NULL;

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planos_select_ativos ON public.planos;
CREATE POLICY planos_select_ativos ON public.planos FOR SELECT TO authenticated
USING (ativo = true);

DROP POLICY IF EXISTS planos_admin_manage ON public.planos;
CREATE POLICY planos_admin_manage ON public.planos FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

GRANT SELECT ON public.planos TO authenticated;
