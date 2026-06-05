-- Funil de conversão (dashboard empresa + ADM): tabelas, RLS e policy perfil_visitas.
-- Substitui 20260611160000 / 20260611170000 (view comissoes removida; usar tabela comissao).

-- ---------------------------------------------------------------------------
-- log_visita (legado; visitas atuais usam perfil_visitas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.log_visita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_visita_empresa ON public.log_visita (empresa_id);
CREATE INDEX IF NOT EXISTS idx_log_visita_data ON public.log_visita (created_at);

ALTER TABLE public.log_visita ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "log_visita insert autenticado" ON public.log_visita;
CREATE POLICY "log_visita insert autenticado" ON public.log_visita FOR INSERT
WITH CHECK (auth.role () = 'authenticated');

DROP POLICY IF EXISTS "log_visita select gestor empresa" ON public.log_visita;
CREATE POLICY "log_visita select gestor empresa" ON public.log_visita FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = log_visita.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "log_visita select admin" ON public.log_visita;
CREATE POLICY "log_visita select admin" ON public.log_visita FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- recomendacoes (profissional indica empresa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recomendacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recomendacoes_empresa ON public.recomendacoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_recomendacoes_profissional ON public.recomendacoes (profissional_id);
CREATE INDEX IF NOT EXISTS idx_recomendacoes_data ON public.recomendacoes (created_at);

ALTER TABLE public.recomendacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recomendacoes insert profissional" ON public.recomendacoes;
CREATE POLICY "recomendacoes insert profissional" ON public.recomendacoes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      public.profissionais p
    WHERE
      p.id = recomendacoes.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "recomendacoes select gestor empresa" ON public.recomendacoes;
CREATE POLICY "recomendacoes select gestor empresa" ON public.recomendacoes FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = recomendacoes.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "recomendacoes select profissional autor" ON public.recomendacoes;
CREATE POLICY "recomendacoes select profissional autor" ON public.recomendacoes FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.profissionais p
    WHERE
      p.id = recomendacoes.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "recomendacoes select admin" ON public.recomendacoes;
CREATE POLICY "recomendacoes select admin" ON public.recomendacoes FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- manifesto (PAX confirmados na empresa destino)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manifesto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais (id) ON DELETE CASCADE,
  empresa_destino_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'cancelado', 'finalizado')),
  pax_qtd INTEGER NOT NULL DEFAULT 1 CHECK (pax_qtd > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manifesto_empresa_destino ON public.manifesto (empresa_destino_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_profissional ON public.manifesto (profissional_id);
CREATE INDEX IF NOT EXISTS idx_manifesto_status ON public.manifesto (status);
CREATE INDEX IF NOT EXISTS idx_manifesto_data ON public.manifesto (created_at);

ALTER TABLE public.manifesto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manifesto insert profissional" ON public.manifesto;
CREATE POLICY "manifesto insert profissional" ON public.manifesto FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      public.profissionais p
    WHERE
      p.id = manifesto.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "manifesto select gestor destino" ON public.manifesto;
CREATE POLICY "manifesto select gestor destino" ON public.manifesto FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = manifesto.empresa_destino_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "manifesto select profissional autor" ON public.manifesto;
CREATE POLICY "manifesto select profissional autor" ON public.manifesto FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.profissionais p
    WHERE
      p.id = manifesto.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "manifesto update profissional" ON public.manifesto;
CREATE POLICY "manifesto update profissional" ON public.manifesto FOR UPDATE
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.profissionais p
    WHERE
      p.id = manifesto.profissional_id
      AND p.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "manifesto select admin" ON public.manifesto;
CREATE POLICY "manifesto select admin" ON public.manifesto FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- comissao (vendas / comissões registradas — empresa e ADM)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'venda_direta',
  valor DECIMAL(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comissao_empresa ON public.comissao (empresa_id);
CREATE INDEX IF NOT EXISTS idx_comissao_tipo ON public.comissao (tipo);
CREATE INDEX IF NOT EXISTS idx_comissao_data ON public.comissao (created_at);

ALTER TABLE public.comissao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comissao select gestor empresa" ON public.comissao;
CREATE POLICY "comissao select gestor empresa" ON public.comissao FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = comissao.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "comissao insert gestor empresa" ON public.comissao;
CREATE POLICY "comissao insert gestor empresa" ON public.comissao FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = comissao.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "comissao select admin" ON public.comissao;
CREATE POLICY "comissao select admin" ON public.comissao FOR SELECT
USING (
  EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role = 'admin'
  )
);

-- perfil_visitas: gestor da empresa pode contar visitas à página
DROP POLICY IF EXISTS "perfil_visitas select gestor empresa pagina" ON public.perfil_visitas;
CREATE POLICY "perfil_visitas select gestor empresa pagina" ON public.perfil_visitas FOR SELECT
USING (
  tipo_alvo = 'empresa'
  AND empresa_id IS NOT NULL
  AND EXISTS (
    SELECT
      1
    FROM
      public.empresas e
    WHERE
      e.id = perfil_visitas.empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

COMMENT ON TABLE public.log_visita IS 'Log legado de visitas à página da empresa (preferir perfil_visitas).';
COMMENT ON TABLE public.recomendacoes IS 'Indicações de profissionais a empresas (funil de conversão).';
COMMENT ON TABLE public.manifesto IS 'Manifestos / PAX enviados por profissionais a empresas destino.';
COMMENT ON TABLE public.comissao IS 'Vendas e comissões registradas (funil de conversão).';
