-- Módulo Manifesto Diário: evolução do manifesto legado (1 turista/linha) para roteiro diário.

-- ---------------------------------------------------------------------------
-- manifesto_diario
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manifesto_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  data_manifesto DATE NOT NULL DEFAULT (CURRENT_DATE),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (
    status IN ('rascunho', 'confirmado', 'em_andamento', 'concluido', 'cancelado')
  ),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manifesto_diario_profissional ON public.manifesto_diario (profissional_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_diario_data ON public.manifesto_diario (data_manifesto);
CREATE INDEX IF NOT EXISTS idx_manifesto_diario_status ON public.manifesto_diario (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_manifesto_diario_prof_data
  ON public.manifesto_diario (profissional_id, data_manifesto)
  WHERE status NOT IN ('cancelado', 'concluido');

-- ---------------------------------------------------------------------------
-- manifesto_passageiros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manifesto_passageiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifesto_id UUID NOT NULL REFERENCES public.manifesto_diario (id) ON DELETE CASCADE,
  turista_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  nome TEXT NOT NULL DEFAULT '',
  documento TEXT,
  contratacao_tipo TEXT NOT NULL DEFAULT 'indicacao' CHECK (
    contratacao_tipo IN ('indicacao', 'contratacao_direta', 'agendamento', 'algoritmo')
  ),
  profissional_indireto_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL,
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  legacy_manifesto_id UUID REFERENCES public.manifesto (id) ON DELETE SET NULL,
  username TEXT
);

CREATE INDEX IF NOT EXISTS idx_manifesto_passageiros_manifesto ON public.manifesto_passageiros (manifesto_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_passageiros_turista ON public.manifesto_passageiros (turista_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_passageiros_indireto ON public.manifesto_passageiros (profissional_indireto_id);

-- ---------------------------------------------------------------------------
-- manifesto_atrativos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manifesto_atrativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifesto_id UUID NOT NULL REFERENCES public.manifesto_diario (id) ON DELETE CASCADE,
  turista_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  selecionado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visitado BOOLEAN NOT NULL DEFAULT FALSE,
  visitado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_manifesto_atrativos_manifesto ON public.manifesto_atrativos (manifesto_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_atrativos_empresa ON public.manifesto_atrativos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_atrativos_turista ON public.manifesto_atrativos (turista_id);

-- ---------------------------------------------------------------------------
-- manifesto_checkins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manifesto_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifesto_id UUID NOT NULL REFERENCES public.manifesto_diario (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  turista_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  horario_chegada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'contestado')),
  confirmado_em TIMESTAMPTZ,
  metodo_validacao TEXT CHECK (metodo_validacao IS NULL OR metodo_validacao IN ('gps', 'qr_code', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_manifesto_checkins_manifesto ON public.manifesto_checkins (manifesto_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_checkins_empresa ON public.manifesto_checkins (empresa_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.manifesto_diario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifesto_passageiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifesto_atrativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manifesto_checkins ENABLE ROW LEVEL SECURITY;

-- manifesto_diario: profissional dono CRUD
DROP POLICY IF EXISTS "manifesto_diario select dono" ON public.manifesto_diario;
CREATE POLICY "manifesto_diario select dono" ON public.manifesto_diario FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = manifesto_diario.profissional_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_diario insert dono" ON public.manifesto_diario;
CREATE POLICY "manifesto_diario insert dono" ON public.manifesto_diario FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = manifesto_diario.profissional_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_diario update dono" ON public.manifesto_diario;
CREATE POLICY "manifesto_diario update dono" ON public.manifesto_diario FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = manifesto_diario.profissional_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_diario delete dono" ON public.manifesto_diario;
CREATE POLICY "manifesto_diario delete dono" ON public.manifesto_diario FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = manifesto_diario.profissional_id AND p.usuario_id = auth.uid()
      AND manifesto_diario.status = 'rascunho'
  )
);

-- manifesto_passageiros: dono via manifesto + turista vê próprio
DROP POLICY IF EXISTS "manifesto_passageiros select dono" ON public.manifesto_passageiros;
CREATE POLICY "manifesto_passageiros select dono" ON public.manifesto_passageiros FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_passageiros.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR manifesto_passageiros.turista_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profissionais pi
    WHERE pi.id = manifesto_passageiros.profissional_indireto_id AND pi.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_passageiros insert dono" ON public.manifesto_passageiros;
CREATE POLICY "manifesto_passageiros insert dono" ON public.manifesto_passageiros FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_passageiros.manifesto_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_passageiros update dono" ON public.manifesto_passageiros;
CREATE POLICY "manifesto_passageiros update dono" ON public.manifesto_passageiros FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_passageiros.manifesto_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_passageiros delete dono" ON public.manifesto_passageiros;
CREATE POLICY "manifesto_passageiros delete dono" ON public.manifesto_passageiros FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_passageiros.manifesto_id AND p.usuario_id = auth.uid()
      AND md.status = 'rascunho'
  )
);

-- manifesto_atrativos
DROP POLICY IF EXISTS "manifesto_atrativos select" ON public.manifesto_atrativos;
CREATE POLICY "manifesto_atrativos select" ON public.manifesto_atrativos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_atrativos.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR manifesto_atrativos.turista_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = manifesto_atrativos.empresa_id AND e.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.manifesto_passageiros mp
    JOIN public.profissionais pi ON pi.id = mp.profissional_indireto_id
    WHERE mp.manifesto_id = manifesto_atrativos.manifesto_id
      AND mp.turista_id IS NOT DISTINCT FROM manifesto_atrativos.turista_id
      AND pi.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_atrativos insert dono" ON public.manifesto_atrativos;
CREATE POLICY "manifesto_atrativos insert dono" ON public.manifesto_atrativos FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_atrativos.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR manifesto_atrativos.turista_id = auth.uid()
);

DROP POLICY IF EXISTS "manifesto_atrativos update dono" ON public.manifesto_atrativos;
CREATE POLICY "manifesto_atrativos update dono" ON public.manifesto_atrativos FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_atrativos.manifesto_id AND p.usuario_id = auth.uid()
  )
);

-- manifesto_checkins
DROP POLICY IF EXISTS "manifesto_checkins select" ON public.manifesto_checkins;
CREATE POLICY "manifesto_checkins select" ON public.manifesto_checkins FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_checkins.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR manifesto_checkins.turista_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = manifesto_checkins.empresa_id AND e.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_checkins insert dono" ON public.manifesto_checkins;
CREATE POLICY "manifesto_checkins insert dono" ON public.manifesto_checkins FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_checkins.manifesto_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "manifesto_checkins update" ON public.manifesto_checkins;
CREATE POLICY "manifesto_checkins update" ON public.manifesto_checkins FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.manifesto_diario md
    JOIN public.profissionais p ON p.id = md.profissional_id
    WHERE md.id = manifesto_checkins.manifesto_id AND p.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = manifesto_checkins.empresa_id AND e.usuario_id = auth.uid()
  )
);

-- Admin read (service role bypasses RLS)
DROP POLICY IF EXISTS "manifesto_diario select admin" ON public.manifesto_diario;
CREATE POLICY "manifesto_diario select admin" ON public.manifesto_diario FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- ---------------------------------------------------------------------------
-- Migrar dados legados (manifesto → manifesto_diario + passageiros)
-- ---------------------------------------------------------------------------
INSERT INTO public.manifesto_diario (profissional_id, data_manifesto, status, criado_em, confirmado_em, concluido_em)
SELECT
  m.profissional_id,
  (m.created_at AT TIME ZONE 'UTC')::date,
  CASE
    WHEN bool_or(m.status = 'finalizado') THEN 'concluido'
    WHEN bool_or(m.status = 'cancelado') THEN 'cancelado'
    WHEN bool_or(m.status = 'confirmado') THEN 'confirmado'
    ELSE 'em_andamento'
  END,
  min(m.created_at),
  max(CASE WHEN m.status IN ('confirmado', 'finalizado') THEN m.updated_at END),
  max(CASE WHEN m.status = 'finalizado' THEN m.updated_at END)
FROM public.manifesto m
WHERE m.turista_usuario_id IS NOT NULL
GROUP BY m.profissional_id, (m.created_at AT TIME ZONE 'UTC')::date
HAVING NOT EXISTS (
  SELECT 1
  FROM public.manifesto_diario md
  WHERE md.profissional_id = m.profissional_id
    AND md.data_manifesto = (m.created_at AT TIME ZONE 'UTC')::date
    AND md.status NOT IN ('cancelado', 'concluido')
);

INSERT INTO public.manifesto_passageiros (
  manifesto_id,
  turista_id,
  nome,
  documento,
  contratacao_tipo,
  profissional_indireto_id,
  entrou_em,
  legacy_manifesto_id,
  username
)
SELECT
  md.id,
  m.turista_usuario_id,
  COALESCE(m.dados_atendimento ->> 'nome_completo', 'Turista'),
  m.dados_atendimento ->> 'documento',
  CASE WHEN m.recomendacao_id IS NOT NULL THEN 'indicacao' ELSE 'contratacao_direta' END,
  m.profissional_indicador_id,
  m.created_at,
  m.id,
  m.dados_atendimento ->> 'username'
FROM public.manifesto m
JOIN public.manifesto_diario md
  ON md.profissional_id = m.profissional_id
  AND md.data_manifesto = (m.created_at AT TIME ZONE 'UTC')::date
WHERE m.turista_usuario_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.manifesto_passageiros mp WHERE mp.legacy_manifesto_id = m.id
  );

-- Atrativos legados (UUIDs em dados_atendimento.atrativos)
INSERT INTO public.manifesto_atrativos (manifesto_id, turista_id, empresa_id, selecionado_em)
SELECT
  mp.manifesto_id,
  mp.turista_id,
  (elem #>> '{}')::uuid,
  mp.entrou_em
FROM public.manifesto_passageiros mp
JOIN public.manifesto m ON m.id = mp.legacy_manifesto_id
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(m.dados_atendimento -> 'atrativos') = 'array'
      THEN m.dados_atendimento -> 'atrativos'
    ELSE '[]'::jsonb
  END
) AS elem
WHERE mp.legacy_manifesto_id IS NOT NULL
  AND mp.turista_id IS NOT NULL
  AND (elem #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.manifesto_atrativos ma
    WHERE ma.manifesto_id = mp.manifesto_id
      AND ma.turista_id = mp.turista_id
      AND ma.empresa_id = (elem #>> '{}')::uuid
  );

COMMENT ON TABLE public.manifesto_diario IS 'Roteiro diário do profissional (Guia/Van).';
COMMENT ON TABLE public.manifesto_passageiros IS 'Passageiros vinculados ao manifesto diário.';
COMMENT ON TABLE public.manifesto_atrativos IS 'Atrativos selecionados por turista no manifesto.';
COMMENT ON TABLE public.manifesto_checkins IS 'Check-ins confirmados em empresas/atrativos.';
