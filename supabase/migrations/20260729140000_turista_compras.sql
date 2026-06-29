-- Histórico e notificações de compras/serviços do turista (Minhas Compras + badge menu)
CREATE TABLE IF NOT EXISTS public.turista_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turista_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  referencia_id TEXT,
  empresa_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL,
  profissional_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'registrada',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visto_pelo_turista_em TIMESTAMPTZ,
  popup_exibido_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_turista_compras_ref_unica
  ON public.turista_compras (turista_usuario_id, tipo, referencia_id)
  WHERE referencia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_turista_compras_turista ON public.turista_compras (turista_usuario_id);
CREATE INDEX IF NOT EXISTS idx_turista_compras_visto ON public.turista_compras (turista_usuario_id, visto_pelo_turista_em);

ALTER TABLE public.turista_compras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "turista_compras select own" ON public.turista_compras;
CREATE POLICY "turista_compras select own" ON public.turista_compras FOR SELECT
USING (turista_usuario_id = auth.uid ());

DROP POLICY IF EXISTS "turista_compras update own" ON public.turista_compras;
CREATE POLICY "turista_compras update own" ON public.turista_compras FOR UPDATE
USING (turista_usuario_id = auth.uid ())
WITH CHECK (turista_usuario_id = auth.uid ());

COMMENT ON TABLE public.turista_compras IS 'Compras e serviços registrados para o turista (drawer Minhas Compras + badge menu).';
COMMENT ON COLUMN public.turista_compras.popup_exibido_em IS 'Popup verde de confirmação de reserva de hospedagem já exibido ao turista.';
