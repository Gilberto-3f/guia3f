-- Solicitação de exclusão definitiva de cadastro (double-check ADM GERAL).

CREATE TABLE IF NOT EXISTS public.solicitacoes_exclusao_cadastro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('turistas', 'profissionais', 'empresas')),
  perfil_id UUID NOT NULL,
  usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  solicitado_por UUID NOT NULL REFERENCES public.usuarios (id),
  confirmado_por UUID REFERENCES public.usuarios (id),
  confirmado_em TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'recusado')),
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exclusao_cadastro_status
  ON public.solicitacoes_exclusao_cadastro (status);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_exclusao_cadastro_perfil
  ON public.solicitacoes_exclusao_cadastro (tipo, perfil_id);

ALTER TABLE public.solicitacoes_exclusao_cadastro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS solicitacoes_exclusao_cadastro_select_admin ON public.solicitacoes_exclusao_cadastro;
CREATE POLICY solicitacoes_exclusao_cadastro_select_admin ON public.solicitacoes_exclusao_cadastro
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.admin_level >= 1)
  )
);

DROP POLICY IF EXISTS solicitacoes_exclusao_cadastro_insert_admin ON public.solicitacoes_exclusao_cadastro;
CREATE POLICY solicitacoes_exclusao_cadastro_insert_admin ON public.solicitacoes_exclusao_cadastro
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.admin_level >= 1)
  )
);

COMMENT ON TABLE public.solicitacoes_exclusao_cadastro IS
  'Pedidos de exclusão definitiva de cadastro; ADM GERAL confirma e remove conta + perfil.';
