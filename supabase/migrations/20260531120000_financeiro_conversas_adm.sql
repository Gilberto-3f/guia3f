-- Canal Financeiro ADM: conversas 1:1 (mensageiro) + histórico de auditoria

CREATE TABLE IF NOT EXISTS public.financeiro_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adm_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  alvo_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  alvo_tipo TEXT NOT NULL CHECK (alvo_tipo IN ('profissional', 'empresa')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada')),
  iniciada_por_adm BOOLEAN NOT NULL DEFAULT TRUE,
  assunto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ,
  CONSTRAINT financeiro_conversas_adm_alvo_distinto CHECK (adm_usuario_id <> alvo_usuario_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_conversas_aberta_par
  ON public.financeiro_conversas (adm_usuario_id, alvo_usuario_id)
  WHERE status = 'aberta';

CREATE INDEX IF NOT EXISTS idx_financeiro_conversas_historico
  ON public.financeiro_conversas (adm_usuario_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financeiro_conversas_alvo
  ON public.financeiro_conversas (alvo_usuario_id, status);

CREATE TABLE IF NOT EXISTS public.financeiro_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.financeiro_conversas (id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_mensagens_conversa
  ON public.financeiro_mensagens (conversa_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.financeiro_conversas_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_conversas_updated ON public.financeiro_conversas;

CREATE TRIGGER trg_financeiro_conversas_updated
BEFORE UPDATE ON public.financeiro_conversas FOR EACH ROW
EXECUTE FUNCTION public.financeiro_conversas_touch_updated_at();

ALTER TABLE public.financeiro_conversas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.financeiro_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_conversas admin" ON public.financeiro_conversas;

CREATE POLICY "financeiro_conversas admin" ON public.financeiro_conversas FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "financeiro_conversas alvo select" ON public.financeiro_conversas;

CREATE POLICY "financeiro_conversas alvo select" ON public.financeiro_conversas FOR SELECT
USING (alvo_usuario_id = auth.uid());

DROP POLICY IF EXISTS "financeiro_mensagens membro select" ON public.financeiro_mensagens;

CREATE POLICY "financeiro_mensagens membro select" ON public.financeiro_mensagens FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.financeiro_conversas c
    WHERE c.id = financeiro_mensagens.conversa_id
      AND (c.adm_usuario_id = auth.uid() OR c.alvo_usuario_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "financeiro_mensagens membro insert aberta" ON public.financeiro_mensagens;

CREATE POLICY "financeiro_mensagens membro insert aberta" ON public.financeiro_mensagens FOR INSERT
WITH CHECK (
  remetente_id = auth.uid()
  AND texto IS NOT NULL
  AND TRIM(texto) <> ''
  AND EXISTS (
    SELECT 1
    FROM public.financeiro_conversas c
    WHERE c.id = financeiro_mensagens.conversa_id
      AND c.status = 'aberta'
      AND (c.adm_usuario_id = auth.uid() OR c.alvo_usuario_id = auth.uid())
  )
);

COMMENT ON TABLE public.financeiro_conversas IS 'Mensageiro 1:1 ADM ↔ profissional/empresa (canal financeiro).';

COMMENT ON TABLE public.financeiro_mensagens IS 'Mensagens do mensageiro financeiro ADM.';
