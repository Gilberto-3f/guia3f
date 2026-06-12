-- Denúncias enviadas pelo usuário + notificações de decisão em historico_decisoes

-- Denunciante pode ver as próprias denúncias (aba Denúncias do menu lateral)
DROP POLICY IF EXISTS denuncias_select_denunciante ON public.denuncias;
CREATE POLICY denuncias_select_denunciante ON public.denuncias
FOR SELECT TO authenticated
USING (denunciante_id = auth.uid());

ALTER TABLE public.historico_decisoes
  ADD COLUMN IF NOT EXISTS denuncia_id UUID REFERENCES public.denuncias (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_historico_decisoes_denuncia ON public.historico_decisoes (denuncia_id);
CREATE INDEX IF NOT EXISTS idx_historico_decisoes_data_conclusao ON public.historico_decisoes (data_conclusao DESC NULLS LAST);

ALTER TABLE public.historico_decisoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historico_decisoes_select_own ON public.historico_decisoes;
CREATE POLICY historico_decisoes_select_own ON public.historico_decisoes
FOR SELECT TO authenticated
USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS historico_decisoes_update_own ON public.historico_decisoes;
CREATE POLICY historico_decisoes_update_own ON public.historico_decisoes
FOR UPDATE TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS historico_decisoes_insert_admin ON public.historico_decisoes;
CREATE POLICY historico_decisoes_insert_admin ON public.historico_decisoes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);
