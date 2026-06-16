-- Publicações agendadas (feed + story) — usuário empresa
CREATE TABLE IF NOT EXISTS public.publicacoes_agendadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL,
  tipo_conteudo TEXT NOT NULL CHECK (tipo_conteudo IN ('story', 'foto', 'texto')),
  texto TEXT,
  foto_url TEXT,
  conteudo_url TEXT,
  story_meta JSONB,
  autor_tipo TEXT DEFAULT 'empresa',
  agendado_para TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'publicado', 'erro', 'cancelado')),
  publicado_em TIMESTAMPTZ,
  erro_msg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_publicacoes_agendadas_usuario ON public.publicacoes_agendadas (usuario_id);

CREATE INDEX IF NOT EXISTS idx_publicacoes_agendadas_pendentes ON public.publicacoes_agendadas (agendado_para)
WHERE
  status = 'pendente';

ALTER TABLE public.publicacoes_agendadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publicacoes_agendadas select proprio" ON public.publicacoes_agendadas;

DROP POLICY IF EXISTS "publicacoes_agendadas insert proprio" ON public.publicacoes_agendadas;

DROP POLICY IF EXISTS "publicacoes_agendadas update proprio" ON public.publicacoes_agendadas;

DROP POLICY IF EXISTS "publicacoes_agendadas delete proprio" ON public.publicacoes_agendadas;

CREATE POLICY "publicacoes_agendadas select proprio" ON public.publicacoes_agendadas FOR
SELECT
  USING (auth.uid () = usuario_id);

CREATE POLICY "publicacoes_agendadas insert proprio" ON public.publicacoes_agendadas FOR INSERT
WITH CHECK (auth.uid () = usuario_id);

CREATE POLICY "publicacoes_agendadas update proprio" ON public.publicacoes_agendadas FOR
UPDATE
  USING (auth.uid () = usuario_id)
  WITH CHECK (auth.uid () = usuario_id);

CREATE POLICY "publicacoes_agendadas delete proprio" ON public.publicacoes_agendadas FOR DELETE USING (auth.uid () = usuario_id);

COMMENT ON TABLE public.publicacoes_agendadas IS 'Fila de publicações programadas no feed/story (empresa).';
