-- Solicitações de Auxiliar ADM (empresa contrata plano com serviço auxiliar_adm).

CREATE TABLE IF NOT EXISTS public.empresa_auxiliar_adm_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  assinatura_id UUID REFERENCES public.empresa_assinaturas (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'atribuido', 'cancelado')),
  moderador_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  atribuido_por UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  atribuido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_empresa_auxiliar_adm_empresa ON public.empresa_auxiliar_adm_solicitacoes (empresa_id);

CREATE INDEX IF NOT EXISTS idx_empresa_auxiliar_adm_pendentes ON public.empresa_auxiliar_adm_solicitacoes (created_at DESC)
WHERE
  status = 'pendente';

COMMENT ON TABLE public.empresa_auxiliar_adm_solicitacoes IS 'Empresa com plano auxiliar_adm: ADM Geral atribui moderador (admin_level 2).';

ALTER TABLE public.empresa_auxiliar_adm_solicitacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_auxiliar_adm_select ON public.empresa_auxiliar_adm_solicitacoes;

CREATE POLICY empresa_auxiliar_adm_select ON public.empresa_auxiliar_adm_solicitacoes FOR
SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE
        e.id = empresa_auxiliar_adm_solicitacoes.empresa_id
        AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE
        u.id = auth.uid ()
        AND u.role = 'admin'
    )
  );

GRANT SELECT ON public.empresa_auxiliar_adm_solicitacoes TO authenticated;
