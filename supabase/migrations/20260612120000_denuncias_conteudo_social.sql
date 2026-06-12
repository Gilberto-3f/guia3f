-- Denúncias de conteúdo social (feed, comentários, stories, avaliações)

ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS conteudo_tipo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS conteudo_id UUID,
  ADD COLUMN IF NOT EXISTS denunciado_usuario_id UUID REFERENCES public.usuarios (id),
  ADD COLUMN IF NOT EXISTS medida_aplicada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS medida_tipo VARCHAR(30);

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_conteudo_tipo_check;
ALTER TABLE public.denuncias ADD CONSTRAINT denuncias_conteudo_tipo_check
  CHECK (
    conteudo_tipo IS NULL
    OR conteudo_tipo IN ('post', 'comentario', 'story', 'avaliacao')
  );

CREATE INDEX IF NOT EXISTS idx_denuncias_conteudo ON public.denuncias (conteudo_tipo, conteudo_id);
CREATE INDEX IF NOT EXISTS idx_denuncias_denunciado_usuario ON public.denuncias (denunciado_usuario_id);

-- INSERT: denúncias de conteúdo social por utilizadores autenticados
DROP POLICY IF EXISTS denuncias_insert_reporter_conteudo ON public.denuncias;
CREATE POLICY denuncias_insert_reporter_conteudo ON public.denuncias
  FOR INSERT TO authenticated
  WITH CHECK (
    denunciante_id = auth.uid()
    AND conteudo_tipo IS NOT NULL
    AND conteudo_id IS NOT NULL
    AND denunciado_usuario_id IS NOT NULL
    AND denunciado_usuario_id IS DISTINCT FROM auth.uid()
    AND denunciado_tipo IN ('turista', 'profissional', 'empresa')
  );

-- Log de leitura ADM (auditoria de denúncias arquivadas)
CREATE TABLE IF NOT EXISTS public.logs_denuncia_auditoria_leitura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id UUID NOT NULL REFERENCES public.denuncias (id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  admin_handle TEXT NOT NULL,
  acessado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_denuncia_auditoria_leitura_denuncia
  ON public.logs_denuncia_auditoria_leitura (denuncia_id, acessado_em DESC);

ALTER TABLE public.logs_denuncia_auditoria_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logs_denuncia_auditoria_leitura_select_admin ON public.logs_denuncia_auditoria_leitura;
CREATE POLICY logs_denuncia_auditoria_leitura_select_admin ON public.logs_denuncia_auditoria_leitura
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

DROP POLICY IF EXISTS logs_denuncia_auditoria_leitura_insert_admin ON public.logs_denuncia_auditoria_leitura;
CREATE POLICY logs_denuncia_auditoria_leitura_insert_admin ON public.logs_denuncia_auditoria_leitura
FOR INSERT TO authenticated
WITH CHECK (
  admin_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

COMMENT ON TABLE public.logs_denuncia_auditoria_leitura IS
  'Rastreia ADMs que abriram denúncias arquivadas (Denúncias > Auditoria).';
