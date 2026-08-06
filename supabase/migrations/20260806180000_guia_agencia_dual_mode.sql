-- Guia de turismo: vínculo com empresa Serviços Locais (modo dual Agência)

ALTER TABLE public.profissionais
ADD COLUMN IF NOT EXISTS empresa_agencia_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL;

ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS somente_guia BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profissionais_empresa_agencia
  ON public.profissionais (empresa_agencia_id)
  WHERE empresa_agencia_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empresas_somente_guia
  ON public.empresas (somente_guia)
  WHERE somente_guia = TRUE;

COMMENT ON COLUMN public.profissionais.empresa_agencia_id IS 'Empresa Serviços Locais (agência) vinculada ao guia (mesmo usuario_id).';
COMMENT ON COLUMN public.empresas.somente_guia IS 'TRUE: agência exclusiva de profissional guia (não comercial puro no guia).';

-- Guia pode criar/atualizar sua empresa agência
DROP POLICY IF EXISTS "Guia insere empresa agencia" ON public.empresas;
CREATE POLICY "Guia insere empresa agencia"
  ON public.empresas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    somente_guia = TRUE
    AND categoria = 'Serviços Locais'
    AND usuario_id = auth.uid ()
    AND public.profissional_tem_slug_categoria(auth.uid(), 'guia')
  );

DROP POLICY IF EXISTS "Guia atualiza empresa agencia" ON public.empresas;
CREATE POLICY "Guia atualiza empresa agencia"
  ON public.empresas
  FOR UPDATE
  TO authenticated
  USING (
    somente_guia = TRUE
    AND usuario_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE p.usuario_id = auth.uid ()
        AND p.empresa_agencia_id = empresas.id
    )
  )
  WITH CHECK (
    somente_guia = TRUE
    AND categoria = 'Serviços Locais'
    AND usuario_id = auth.uid ()
  );

DROP POLICY IF EXISTS "Guia lê empresa agencia" ON public.empresas;
CREATE POLICY "Guia lê empresa agencia"
  ON public.empresas
  FOR SELECT
  TO authenticated
  USING (
    somente_guia = TRUE
    AND usuario_id = auth.uid ()
  );

DROP POLICY IF EXISTS "Guia atualiza vínculo agencia" ON public.profissionais;
CREATE POLICY "Guia atualiza vínculo agencia"
  ON public.profissionais
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid ())
  WITH CHECK (usuario_id = auth.uid ());
