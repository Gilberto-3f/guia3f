-- Mensagens salvas por utilizador + denúncias de mensagem/canal

CREATE TABLE IF NOT EXISTS public.mensagens_canal_salvas (
  usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  mensagem_id UUID NOT NULL REFERENCES public.mensagens_canal (id) ON DELETE CASCADE,
  canal_id UUID NOT NULL REFERENCES public.canais (id) ON DELETE CASCADE,
  salvo_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, mensagem_id)
);

CREATE INDEX IF NOT EXISTS idx_mensagens_canal_salvas_usuario ON public.mensagens_canal_salvas (usuario_id, salvo_em DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_canal_salvas_canal ON public.mensagens_canal_salvas (usuario_id, canal_id);

COMMENT ON TABLE public.mensagens_canal_salvas IS 'Mensagens de canal guardadas pelo utilizador (drawer Salvos).';

CREATE TABLE IF NOT EXISTS public.denuncias_mensagem_canal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id UUID NOT NULL REFERENCES public.canais (id) ON DELETE CASCADE,
  mensagem_id UUID REFERENCES public.mensagens_canal (id) ON DELETE SET NULL,
  denunciante_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('mensagem', 'canal')),
  motivo VARCHAR(100) NOT NULL,
  descricao TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (
    status IN ('pendente', 'em_investigacao', 'resolvida', 'arquivada')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_denuncias_mensagem_canal_canal ON public.denuncias_mensagem_canal (canal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_denuncias_mensagem_canal_denunciante ON public.denuncias_mensagem_canal (denunciante_id, canal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_denuncias_mensagem_canal_status ON public.denuncias_mensagem_canal (status, created_at DESC);

COMMENT ON TABLE public.denuncias_mensagem_canal IS 'Denúncias de mensagens ou do canal; aguardam moderação ADM.';

DROP TRIGGER IF EXISTS trg_denuncias_mensagem_canal_updated ON public.denuncias_mensagem_canal;

CREATE OR REPLACE FUNCTION public.update_denuncias_mensagem_canal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_denuncias_mensagem_canal_updated
BEFORE UPDATE ON public.denuncias_mensagem_canal
FOR EACH ROW
EXECUTE FUNCTION public.update_denuncias_mensagem_canal_updated_at();

ALTER TABLE public.mensagens_canal_salvas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.denuncias_mensagem_canal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mensagens_canal_salvas_select_own ON public.mensagens_canal_salvas;

CREATE POLICY mensagens_canal_salvas_select_own ON public.mensagens_canal_salvas FOR
SELECT TO authenticated USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS mensagens_canal_salvas_insert_own ON public.mensagens_canal_salvas;

CREATE POLICY mensagens_canal_salvas_insert_own ON public.mensagens_canal_salvas FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.mensagens_canal m
    WHERE m.id = mensagem_id
      AND m.canal_id = mensagens_canal_salvas.canal_id
  )
);

DROP POLICY IF EXISTS mensagens_canal_salvas_delete_own ON public.mensagens_canal_salvas;

CREATE POLICY mensagens_canal_salvas_delete_own ON public.mensagens_canal_salvas FOR DELETE TO authenticated USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS denuncias_mensagem_canal_select_own ON public.denuncias_mensagem_canal;

CREATE POLICY denuncias_mensagem_canal_select_own ON public.denuncias_mensagem_canal FOR
SELECT TO authenticated USING (denunciante_id = auth.uid());

DROP POLICY IF EXISTS denuncias_mensagem_canal_select_admin ON public.denuncias_mensagem_canal;

CREATE POLICY denuncias_mensagem_canal_select_admin ON public.denuncias_mensagem_canal FOR
SELECT TO authenticated USING (
  auth.uid() IN (SELECT id FROM public.usuarios WHERE role = 'admin')
);

DROP POLICY IF EXISTS denuncias_mensagem_canal_insert_reporter ON public.denuncias_mensagem_canal;

CREATE POLICY denuncias_mensagem_canal_insert_reporter ON public.denuncias_mensagem_canal FOR INSERT TO authenticated
WITH CHECK (
  denunciante_id = auth.uid()
  AND (
    tipo = 'canal'
    OR (
      tipo = 'mensagem'
      AND mensagem_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.mensagens_canal m
        WHERE m.id = mensagem_id
          AND m.canal_id = denuncias_mensagem_canal.canal_id
          AND m.remetente_id IS DISTINCT FROM auth.uid()
      )
    )
  )
);
