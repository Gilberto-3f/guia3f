-- Mensageiro ECOSSISTEMA: chat 1:1 membro ↔ ADM (iniciado pelo membro)

CREATE TABLE IF NOT EXISTS public.ecossistema_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membro_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  membro_tipo VARCHAR(20) NOT NULL CHECK (membro_tipo IN ('turista', 'profissional', 'empresa')),
  adm_responsavel_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada')),
  urgente BOOLEAN NOT NULL DEFAULT FALSE,
  alerta_urgente_visto BOOLEAN NOT NULL DEFAULT FALSE,
  assunto TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecossistema_conversa_aberta_membro
  ON public.ecossistema_conversas (membro_usuario_id)
  WHERE status = 'aberta';

CREATE INDEX IF NOT EXISTS idx_ecossistema_conversas_status
  ON public.ecossistema_conversas (status, urgente DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ecossistema_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.ecossistema_conversas (id) ON DELETE CASCADE,
  remetente_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  texto TEXT,
  anexo_url TEXT,
  anexo_tipo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecossistema_mensagens_conversa
  ON public.ecossistema_mensagens (conversa_id, created_at);

CREATE TABLE IF NOT EXISTS public.ecossistema_conversa_leitura (
  usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL REFERENCES public.ecossistema_conversas (id) ON DELETE CASCADE,
  visto_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, conversa_id)
);

ALTER TABLE public.historico_decisoes
  ADD COLUMN IF NOT EXISTS ecossistema_conversa_id UUID REFERENCES public.ecossistema_conversas (id) ON DELETE SET NULL;

ALTER TABLE public.ecossistema_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecossistema_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecossistema_conversa_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ecossistema_conversas_select ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_select ON public.ecossistema_conversas FOR SELECT TO authenticated
USING (
  membro_usuario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS ecossistema_conversas_insert_membro ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_insert_membro ON public.ecossistema_conversas FOR INSERT TO authenticated
WITH CHECK (membro_usuario_id = auth.uid());

DROP POLICY IF EXISTS ecossistema_conversas_update ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_update ON public.ecossistema_conversas FOR UPDATE TO authenticated
USING (
  membro_usuario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
)
WITH CHECK (
  membro_usuario_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS ecossistema_mensagens_select ON public.ecossistema_mensagens;
CREATE POLICY ecossistema_mensagens_select ON public.ecossistema_mensagens FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.ecossistema_conversas c
    WHERE c.id = conversa_id
      AND (
        c.membro_usuario_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS ecossistema_mensagens_insert ON public.ecossistema_mensagens;
CREATE POLICY ecossistema_mensagens_insert ON public.ecossistema_mensagens FOR INSERT TO authenticated
WITH CHECK (
  remetente_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.ecossistema_conversas c
    WHERE c.id = conversa_id
      AND c.status = 'aberta'
      AND (
        c.membro_usuario_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
      )
  )
);

DROP POLICY IF EXISTS ecossistema_leitura_own ON public.ecossistema_conversa_leitura;
CREATE POLICY ecossistema_leitura_own ON public.ecossistema_conversa_leitura FOR ALL TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

INSERT INTO public.canais (nome, tipo_publico, categoria, pais, ativo, ordem)
SELECT 'Mensageiro ECOSSISTEMA', 'admin', 'admin', 'geral', TRUE, 2
WHERE NOT EXISTS (
  SELECT 1 FROM public.canais
  WHERE upper(trim(nome)) = 'MENSAGEIRO ECOSSISTEMA' AND tipo_publico = 'admin'
);
