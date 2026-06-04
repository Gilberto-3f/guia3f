-- Pré-liberação turista (24h) via profissional verificado + auditoria para ADM.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS turista_pre_liberado_ate TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS turista_pre_liberado_por UUID NULL REFERENCES public.usuarios (id);

COMMENT ON COLUMN public.usuarios.turista_pre_liberado_ate IS
  'Fim da janela de compras/reservas com pré-liberação profissional (24h).';
COMMENT ON COLUMN public.usuarios.turista_pre_liberado_por IS
  'Profissional (usuario_id) que autorizou a pré-liberação vigente.';

ALTER TABLE public.canal_financeiro
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.canal_financeiro.metadata IS
  'Dados extras (ex.: solicitação de pré-liberação turista).';

CREATE TABLE IF NOT EXISTS public.turista_pre_liberacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turista_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  profissional_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  prof_username TEXT NOT NULL,
  turista_username TEXT NULL,
  turista_nome TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'recusada', 'expirada')),
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_em TIMESTAMPTZ NULL,
  expira_em TIMESTAMPTZ NULL,
  canal_financeiro_id UUID NULL REFERENCES public.canal_financeiro (id) ON DELETE SET NULL,
  contratacoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turista_pre_lib_turista ON public.turista_pre_liberacoes (turista_usuario_id);
CREATE INDEX IF NOT EXISTS idx_turista_pre_lib_prof ON public.turista_pre_liberacoes (profissional_usuario_id);
CREATE INDEX IF NOT EXISTS idx_turista_pre_lib_status ON public.turista_pre_liberacoes (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_turista_pre_lib_pendente_unico
  ON public.turista_pre_liberacoes (turista_usuario_id, profissional_usuario_id)
  WHERE status = 'pendente';

ALTER TABLE public.turista_pre_liberacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tpl select turista proprio" ON public.turista_pre_liberacoes;
CREATE POLICY "tpl select turista proprio" ON public.turista_pre_liberacoes FOR SELECT
  USING (turista_usuario_id = auth.uid ());

DROP POLICY IF EXISTS "tpl select profissional" ON public.turista_pre_liberacoes;
CREATE POLICY "tpl select profissional" ON public.turista_pre_liberacoes FOR SELECT
  USING (profissional_usuario_id = auth.uid ());

DROP POLICY IF EXISTS "tpl select admin" ON public.turista_pre_liberacoes;
CREATE POLICY "tpl select admin" ON public.turista_pre_liberacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid () AND u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "tpl update profissional" ON public.turista_pre_liberacoes;
CREATE POLICY "tpl update profissional" ON public.turista_pre_liberacoes FOR UPDATE
  USING (profissional_usuario_id = auth.uid ())
  WITH CHECK (profissional_usuario_id = auth.uid ());

GRANT SELECT, UPDATE ON public.turista_pre_liberacoes TO authenticated;
