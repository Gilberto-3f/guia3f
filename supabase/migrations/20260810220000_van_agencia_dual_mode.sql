-- Motorista de van: vínculo com empresa Serviços Locais (modo dual Agência)

ALTER TABLE public.profissionais
ADD COLUMN IF NOT EXISTS empresa_agencia_van_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL;

ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS somente_van BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profissionais_empresa_agencia_van
  ON public.profissionais (empresa_agencia_van_id)
  WHERE empresa_agencia_van_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_somente_van
  ON public.empresas (somente_van)
  WHERE somente_van = TRUE;

COMMENT ON COLUMN public.profissionais.empresa_agencia_van_id IS 'Empresa Serviços Locais (agência) vinculada ao motorista de van (mesmo usuario_id).';
COMMENT ON COLUMN public.empresas.somente_van IS 'TRUE: agência exclusiva de profissional motorista de van (não comercial puro).';

-- Van pode criar/atualizar sua empresa agência
DROP POLICY IF EXISTS "Van insere empresa agencia" ON public.empresas;
CREATE POLICY "Van insere empresa agencia"
  ON public.empresas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    somente_van = TRUE
    AND categoria = 'Serviços Locais'
    AND usuario_id = auth.uid ()
    AND public.profissional_tem_slug_categoria(auth.uid(), 'van')
  );

DROP POLICY IF EXISTS "Van atualiza empresa agencia" ON public.empresas;
CREATE POLICY "Van atualiza empresa agencia"
  ON public.empresas
  FOR UPDATE
  TO authenticated
  USING (
    somente_van = TRUE
    AND usuario_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.usuario_id = auth.uid ()
        AND p.empresa_agencia_van_id = empresas.id
    )
  )
  WITH CHECK (
    somente_van = TRUE
    AND categoria = 'Serviços Locais'
    AND usuario_id = auth.uid ()
  );

DROP POLICY IF EXISTS "Van lê empresa agencia" ON public.empresas;
CREATE POLICY "Van lê empresa agencia"
  ON public.empresas
  FOR SELECT
  TO authenticated
  USING (
    somente_van = TRUE
    AND usuario_id = auth.uid ()
  );

DROP POLICY IF EXISTS "Van atualiza vínculo agencia" ON public.profissionais;
CREATE POLICY "Van atualiza vínculo agencia"
  ON public.profissionais
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid ())
  WITH CHECK (usuario_id = auth.uid ());
