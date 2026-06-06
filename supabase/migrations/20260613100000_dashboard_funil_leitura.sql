-- Leitura do funil da dashboard empresa (badges de recomendações, PAX e vendas)

CREATE TABLE IF NOT EXISTS dashboard_funil_leitura (
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  recomendacoes_visto_em TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  pax_visto_em TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  vendas_visto_em TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  PRIMARY KEY (empresa_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_funil_leitura_usuario ON dashboard_funil_leitura (usuario_id);

ALTER TABLE dashboard_funil_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dfl select proprio" ON dashboard_funil_leitura;
DROP POLICY IF EXISTS "dfl insert proprio" ON dashboard_funil_leitura;
DROP POLICY IF EXISTS "dfl update proprio" ON dashboard_funil_leitura;

CREATE POLICY "dfl select proprio" ON dashboard_funil_leitura FOR
SELECT
  USING (usuario_id = auth.uid ());

CREATE POLICY "dfl insert proprio" ON dashboard_funil_leitura FOR INSERT
WITH CHECK (usuario_id = auth.uid ());

CREATE POLICY "dfl update proprio" ON dashboard_funil_leitura FOR
UPDATE
  USING (usuario_id = auth.uid ())
WITH CHECK (usuario_id = auth.uid ());

GRANT SELECT, INSERT, UPDATE ON public.dashboard_funil_leitura TO authenticated;
