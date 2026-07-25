-- Recomendações de ticket/atrativo (espelho recomendacoes_servico / prato)
-- Data: 2026-07-25

CREATE TABLE IF NOT EXISTS public.recomendacoes_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  experiencia_id UUID NOT NULL REFERENCES public.atrativos_experiencias (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_id UUID REFERENCES public.atrativos_categorias (id) ON DELETE SET NULL,
  turista_canal TEXT,
  turista_email_prefix TEXT,
  turista_whatsapp_final TEXT,
  turista_whatsapp_ddd TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_ticket_experiencia ON public.recomendacoes_ticket (experiencia_id);
CREATE INDEX IF NOT EXISTS idx_rec_ticket_empresa ON public.recomendacoes_ticket (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rec_ticket_profissional ON public.recomendacoes_ticket (profissional_id);
CREATE INDEX IF NOT EXISTS idx_rec_ticket_created ON public.recomendacoes_ticket (created_at DESC);

ALTER TABLE public.recomendacoes_ticket ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recomendacoes_ticket insert autenticado" ON public.recomendacoes_ticket;
CREATE POLICY "recomendacoes_ticket insert autenticado" ON public.recomendacoes_ticket FOR INSERT TO authenticated
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "recomendacoes_ticket leitura" ON public.recomendacoes_ticket;
CREATE POLICY "recomendacoes_ticket leitura" ON public.recomendacoes_ticket FOR
SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = recomendacoes_ticket.empresa_id AND e.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = recomendacoes_ticket.profissional_id AND p.usuario_id = auth.uid ()
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = auth.uid () AND u.role = 'admin'
    )
  );

GRANT SELECT, INSERT ON public.recomendacoes_ticket TO authenticated;
