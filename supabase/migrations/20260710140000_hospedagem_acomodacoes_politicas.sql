-- Acomodações e políticas de hospedagem (botão dinâmico — etapa 1)

-- ---------------------------------------------------------------------------
-- Acomodações (N por empresa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospedagem_acomodacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  categoria_imovel TEXT NOT NULL,
  categoria_particular TEXT,
  opcao_compartilhada TEXT,
  capacidade_pessoas INTEGER NOT NULL CHECK (capacidade_pessoas >= 1),
  valor_diaria NUMERIC(12, 2) NOT NULL CHECK (valor_diaria >= 0),
  fotos TEXT[] NOT NULL DEFAULT '{}',
  comodidades_padrao JSONB NOT NULL DEFAULT '{}'::jsonb,
  comodidades_extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hospedagem_acomodacoes_fotos_len CHECK (cardinality(fotos) <= 5)
);

CREATE INDEX IF NOT EXISTS idx_hospedagem_acomodacoes_empresa
  ON public.hospedagem_acomodacoes (empresa_id);

COMMENT ON TABLE public.hospedagem_acomodacoes IS
  'Unidades de acomodação cadastradas no botão dinâmico de hospedagem.';

-- ---------------------------------------------------------------------------
-- Políticas + formas de pagamento (1 por empresa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hospedagem_politicas (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas (id) ON DELETE CASCADE,
  checkin_hora TIME NOT NULL,
  checkout_hora TIME NOT NULL,
  caucao_exige BOOLEAN NOT NULL DEFAULT FALSE,
  caucao_diarias INTEGER CHECK (caucao_diarias IS NULL OR caucao_diarias >= 1),
  cancelamento_gratuito BOOLEAN NOT NULL DEFAULT FALSE,
  cancelamento_dias_antes INTEGER CHECK (
    cancelamento_dias_antes IS NULL
    OR cancelamento_dias_antes >= 0
  ),
  cancelamento_descricao TEXT NOT NULL DEFAULT '',
  restricao_idade BOOLEAN NOT NULL DEFAULT FALSE,
  restricao_idade_obs TEXT,
  formas_pagamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hospedagem_politicas IS
  'Políticas da casa e formas de pagamento (globais por empresa de hospedagem).';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_hospedagem_acomodacoes_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hospedagem_acomodacoes_updated_at ON public.hospedagem_acomodacoes;
CREATE TRIGGER trg_hospedagem_acomodacoes_updated_at
BEFORE UPDATE ON public.hospedagem_acomodacoes
FOR EACH ROW
EXECUTE FUNCTION public.set_hospedagem_acomodacoes_updated_at ();

CREATE OR REPLACE FUNCTION public.set_hospedagem_politicas_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hospedagem_politicas_updated_at ON public.hospedagem_politicas;
CREATE TRIGGER trg_hospedagem_politicas_updated_at
BEFORE UPDATE ON public.hospedagem_politicas
FOR EACH ROW
EXECUTE FUNCTION public.set_hospedagem_politicas_updated_at ();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.hospedagem_acomodacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospedagem_politicas ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado (drawers/guia na etapa 2)
DROP POLICY IF EXISTS "Leitura acomodacoes hospedagem" ON public.hospedagem_acomodacoes;
CREATE POLICY "Leitura acomodacoes hospedagem"
  ON public.hospedagem_acomodacoes
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Leitura politicas hospedagem" ON public.hospedagem_politicas;
CREATE POLICY "Leitura politicas hospedagem"
  ON public.hospedagem_politicas
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Escrita: dono da empresa (usuario_id = auth.uid), inclui anfitrião dual mode
DROP POLICY IF EXISTS "Dono insere acomodacoes" ON public.hospedagem_acomodacoes;
CREATE POLICY "Dono insere acomodacoes"
  ON public.hospedagem_acomodacoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "Dono atualiza acomodacoes" ON public.hospedagem_acomodacoes;
CREATE POLICY "Dono atualiza acomodacoes"
  ON public.hospedagem_acomodacoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "Dono deleta acomodacoes" ON public.hospedagem_acomodacoes;
CREATE POLICY "Dono deleta acomodacoes"
  ON public.hospedagem_acomodacoes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

DROP POLICY IF EXISTS "Dono upsert politicas" ON public.hospedagem_politicas;
CREATE POLICY "Dono upsert politicas"
  ON public.hospedagem_politicas
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.empresas e
      WHERE e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );
