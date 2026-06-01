-- Visitas a perfil social (usuário) e página da empresa

CREATE TABLE IF NOT EXISTS public.perfil_visitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dono_usuario_id UUID NOT NULL REFERENCES public.usuarios (id) ON DELETE CASCADE,
  visitante_usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  tipo_alvo TEXT NOT NULL CHECK (tipo_alvo IN ('perfil', 'empresa')),
  empresa_id UUID REFERENCES public.empresas (id) ON DELETE CASCADE,
  visitado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visto_pelo_dono_em TIMESTAMPTZ,
  CONSTRAINT perfil_visitas_empresa_coerente CHECK (
    (tipo_alvo = 'empresa' AND empresa_id IS NOT NULL)
    OR (tipo_alvo = 'perfil' AND empresa_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_perfil_visitas_dono_pendente
  ON public.perfil_visitas (dono_usuario_id, visto_pelo_dono_em)
  WHERE visto_pelo_dono_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_perfil_visitas_dono_data
  ON public.perfil_visitas (dono_usuario_id, visitado_em DESC);

ALTER TABLE public.perfil_visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfil_visitas insert visitante" ON public.perfil_visitas;

CREATE POLICY "perfil_visitas insert visitante" ON public.perfil_visitas FOR INSERT
WITH CHECK (
  visitante_usuario_id = auth.uid()
  AND dono_usuario_id <> auth.uid()
);

DROP POLICY IF EXISTS "perfil_visitas select dono" ON public.perfil_visitas;

CREATE POLICY "perfil_visitas select dono" ON public.perfil_visitas FOR SELECT
USING (dono_usuario_id = auth.uid());

DROP POLICY IF EXISTS "perfil_visitas update dono" ON public.perfil_visitas;

CREATE POLICY "perfil_visitas update dono" ON public.perfil_visitas FOR UPDATE
USING (dono_usuario_id = auth.uid())
WITH CHECK (dono_usuario_id = auth.uid());

COMMENT ON TABLE public.perfil_visitas IS 'Registo de visitas ao perfil social ou página da empresa; pendentes até o dono abrir a lista.';
