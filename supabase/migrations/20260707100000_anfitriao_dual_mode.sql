-- Anfitrião profissional: vínculo com empresa Hospedagem (modo dual)

ALTER TABLE public.profissionais
ADD COLUMN IF NOT EXISTS empresa_hospedagem_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL;

ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS somente_anfitriao BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS profissional_vinculado_id UUID REFERENCES public.profissionais (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profissionais_empresa_hospedagem
  ON public.profissionais (empresa_hospedagem_id)
  WHERE empresa_hospedagem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_somente_anfitriao
  ON public.empresas (somente_anfitriao)
  WHERE somente_anfitriao = TRUE;

COMMENT ON COLUMN public.profissionais.empresa_hospedagem_id IS 'Empresa Hospedagem vinculada ao anfitrião (mesmo usuario_id).';
COMMENT ON COLUMN public.empresas.somente_anfitriao IS 'TRUE: hospedagem exclusiva de profissional anfitrião (não comercial no guia).';
COMMENT ON COLUMN public.empresas.profissional_vinculado_id IS 'Profissional anfitrião dono do negócio de hospedagem.';

-- Anfitrião verificado pode criar/atualizar sua empresa hospedagem
DROP POLICY IF EXISTS "Anfitrião insere empresa hospedagem" ON public.empresas;
CREATE POLICY "Anfitrião insere empresa hospedagem"
  ON public.empresas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    somente_anfitriao = TRUE
    AND categoria = 'Hospedagem'
    AND usuario_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.usuario_id = auth.uid ()
        AND (
          'Anfitriao' = ANY (p.categorias)
          OR 'anfitriao' = ANY (p.categorias)
          OR 'Anfitrião' = ANY (p.categorias)
        )
    )
  );

DROP POLICY IF EXISTS "Anfitrião atualiza empresa hospedagem" ON public.empresas;
CREATE POLICY "Anfitrião atualiza empresa hospedagem"
  ON public.empresas
  FOR UPDATE
  TO authenticated
  USING (
    somente_anfitriao = TRUE
    AND usuario_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.usuario_id = auth.uid ()
        AND p.empresa_hospedagem_id = empresas.id
    )
  )
  WITH CHECK (
    somente_anfitriao = TRUE
    AND categoria = 'Hospedagem'
    AND usuario_id = auth.uid ()
  );

DROP POLICY IF EXISTS "Anfitrião lê empresa hospedagem" ON public.empresas;
CREATE POLICY "Anfitrião lê empresa hospedagem"
  ON public.empresas
  FOR SELECT
  TO authenticated
  USING (
    somente_anfitriao = TRUE
    AND usuario_id = auth.uid ()
  );

DROP POLICY IF EXISTS "Anfitrião atualiza vínculo hospedagem" ON public.profissionais;
CREATE POLICY "Anfitrião atualiza vínculo hospedagem"
  ON public.profissionais
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid ())
  WITH CHECK (usuario_id = auth.uid ());
