-- Alinha schema remoto quando `planos` já existia sem auditoria ou `config_comissoes` não foi criada.

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS atualizado_por UUID REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.config_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao INTEGER NOT NULL DEFAULT 1,
  dados JSONB NOT NULL,
  criado_por UUID REFERENCES public.usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_config_comissoes_versao ON public.config_comissoes (versao);
CREATE INDEX IF NOT EXISTS idx_config_comissoes_ativo ON public.config_comissoes (ativo);

CREATE TABLE IF NOT EXISTS public.historico_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  config_anterior JSONB,
  config_nova JSONB NOT NULL,
  alterado_por UUID REFERENCES public.usuarios(id),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.config_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_comissoes_admin_all ON public.config_comissoes;
CREATE POLICY config_comissoes_admin_all ON public.config_comissoes FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS historico_comissoes_admin_insert ON public.historico_comissoes;
CREATE POLICY historico_comissoes_admin_insert ON public.historico_comissoes FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS historico_comissoes_admin_select ON public.historico_comissoes;
CREATE POLICY historico_comissoes_admin_select ON public.historico_comissoes FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_comissoes TO authenticated;
GRANT SELECT, INSERT ON public.historico_comissoes TO authenticated;

COMMENT ON TABLE public.config_comissoes IS 'Versões ativas das regras de comissão (editor Financeiro ADM).';
COMMENT ON TABLE public.historico_comissoes IS 'Histórico de alterações nas configurações de comissão.';
