-- Experiências (tickets) e políticas de atrativos / passeios (botão dinâmico)

CREATE TABLE IF NOT EXISTS public.atrativos_experiencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES public.empresas (id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  fotos TEXT[] NOT NULL DEFAULT '{}',
  oferece_inteira BOOLEAN NOT NULL DEFAULT TRUE,
  preco_inteira NUMERIC(12, 2),
  oferece_meia BOOLEAN NOT NULL DEFAULT FALSE,
  preco_meia NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT atrativos_experiencias_titulo_len CHECK (char_length(trim(titulo)) >= 1),
  CONSTRAINT atrativos_experiencias_descricao_len CHECK (char_length(descricao) <= 250),
  CONSTRAINT atrativos_experiencias_fotos_len CHECK (cardinality(fotos) <= 3),
  CONSTRAINT atrativos_experiencias_tipo_check CHECK (oferece_inteira OR oferece_meia),
  CONSTRAINT atrativos_experiencias_preco_inteira_check CHECK (
    NOT oferece_inteira
    OR (preco_inteira IS NOT NULL AND preco_inteira >= 0)
  ),
  CONSTRAINT atrativos_experiencias_preco_meia_check CHECK (
    NOT oferece_meia
    OR (preco_meia IS NOT NULL AND preco_meia >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_atrativos_experiencias_empresa
  ON public.atrativos_experiencias (empresa_id);

COMMENT ON TABLE public.atrativos_experiencias IS
  'Experiências / tickets cadastrados no botão dinâmico de atrativos.';

CREATE TABLE IF NOT EXISTS public.atrativos_politicas (
  empresa_id UUID PRIMARY KEY REFERENCES public.empresas (id) ON DELETE CASCADE,
  formas_pagamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  regras_meia_entrada TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.atrativos_politicas IS
  'Formas de pagamento e regras de meia-entrada (globais por empresa de atrativos).';

CREATE OR REPLACE FUNCTION public.set_atrativos_experiencias_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atrativos_experiencias_updated_at ON public.atrativos_experiencias;
CREATE TRIGGER trg_atrativos_experiencias_updated_at
BEFORE UPDATE ON public.atrativos_experiencias
FOR EACH ROW
EXECUTE FUNCTION public.set_atrativos_experiencias_updated_at ();

CREATE OR REPLACE FUNCTION public.set_atrativos_politicas_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atrativos_politicas_updated_at ON public.atrativos_politicas;
CREATE TRIGGER trg_atrativos_politicas_updated_at
BEFORE UPDATE ON public.atrativos_politicas
FOR EACH ROW
EXECUTE FUNCTION public.set_atrativos_politicas_updated_at ();

ALTER TABLE public.atrativos_experiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atrativos_politicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura atrativos experiencias" ON public.atrativos_experiencias;
CREATE POLICY "Leitura atrativos experiencias"
  ON public.atrativos_experiencias
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Leitura atrativos politicas" ON public.atrativos_politicas;
CREATE POLICY "Leitura atrativos politicas"
  ON public.atrativos_politicas
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "Dono insere atrativos experiencias" ON public.atrativos_experiencias;
CREATE POLICY "Dono insere atrativos experiencias"
  ON public.atrativos_experiencias
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

DROP POLICY IF EXISTS "Dono atualiza atrativos experiencias" ON public.atrativos_experiencias;
CREATE POLICY "Dono atualiza atrativos experiencias"
  ON public.atrativos_experiencias
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

DROP POLICY IF EXISTS "Dono deleta atrativos experiencias" ON public.atrativos_experiencias;
CREATE POLICY "Dono deleta atrativos experiencias"
  ON public.atrativos_experiencias
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

DROP POLICY IF EXISTS "Dono upsert atrativos politicas" ON public.atrativos_politicas;
CREATE POLICY "Dono upsert atrativos politicas"
  ON public.atrativos_politicas
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
