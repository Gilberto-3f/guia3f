-- Leitura pública dos anúncios da home ativos (carrossel) + leitura pelo dono da empresa (painel)

ALTER TABLE anuncios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anuncios_select_home_publico_ativo" ON anuncios;
CREATE POLICY "anuncios_select_home_publico_ativo" ON anuncios FOR
SELECT TO anon,
authenticated USING (
  tipo = 'home'
  AND status = 'ativo'
  AND periodo_inicio <= CURRENT_DATE
  AND periodo_fim >= CURRENT_DATE
);

DROP POLICY IF EXISTS "anuncios_select_empresa_dono" ON anuncios;
CREATE POLICY "anuncios_select_empresa_dono" ON anuncios FOR
SELECT TO authenticated USING (
  empresa_id IN (
    SELECT id
    FROM empresas
    WHERE usuario_id = auth.uid ()
  )
);
