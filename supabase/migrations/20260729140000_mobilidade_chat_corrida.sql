-- Chat temporário da corrida (fora dos canais do ecossistema).

CREATE TABLE IF NOT EXISTS public.mobilidade_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL UNIQUE REFERENCES public.solicitacao_mobilidade (id) ON DELETE CASCADE,
  turista_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  profissional_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ,
  CONSTRAINT mobilidade_conversas_pares_distintos CHECK (turista_usuario_id <> profissional_usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_mobilidade_conversas_turista
  ON public.mobilidade_conversas (turista_usuario_id, status);

CREATE INDEX IF NOT EXISTS idx_mobilidade_conversas_prof
  ON public.mobilidade_conversas (profissional_usuario_id, status);

CREATE TABLE IF NOT EXISTS public.mobilidade_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.mobilidade_conversas (id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobilidade_mensagens_conversa
  ON public.mobilidade_mensagens (conversa_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.mobilidade_conversas_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mobilidade_conversas_updated ON public.mobilidade_conversas;
CREATE TRIGGER trg_mobilidade_conversas_updated
BEFORE UPDATE ON public.mobilidade_conversas FOR EACH ROW
EXECUTE FUNCTION public.mobilidade_conversas_touch_updated_at();

ALTER TABLE public.mobilidade_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobilidade_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mobilidade_conversas participantes select" ON public.mobilidade_conversas;
CREATE POLICY "mobilidade_conversas participantes select" ON public.mobilidade_conversas FOR SELECT
USING (
  auth.uid() = turista_usuario_id
  OR auth.uid() = profissional_usuario_id
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS "mobilidade_mensagens participantes select" ON public.mobilidade_mensagens;
CREATE POLICY "mobilidade_mensagens participantes select" ON public.mobilidade_mensagens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.mobilidade_conversas c
    WHERE c.id = conversa_id
      AND (
        c.turista_usuario_id = auth.uid()
        OR c.profissional_usuario_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS "mobilidade_mensagens participantes insert" ON public.mobilidade_mensagens;
CREATE POLICY "mobilidade_mensagens participantes insert" ON public.mobilidade_mensagens FOR INSERT
WITH CHECK (
  remetente_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.mobilidade_conversas c
    WHERE c.id = conversa_id
      AND c.status = 'aberta'
      AND (c.turista_usuario_id = auth.uid() OR c.profissional_usuario_id = auth.uid())
  )
);

COMMENT ON TABLE public.mobilidade_conversas IS 'Chat 1:1 temporário da corrida (turista ↔ profissional).';
