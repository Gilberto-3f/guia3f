-- Perfil social (turista/profissional): bio, capa
-- Timestamp após feed/redecontatos para não quebrar ordem em instalações novas.

ALTER TABLE turistas
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS foto_capa_url TEXT;

ALTER TABLE profissionais
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS foto_capa_url TEXT;

COMMENT ON COLUMN turistas.bio IS 'Bio curta do perfil (ex.: máx. 170 caracteres no app)';
COMMENT ON COLUMN turistas.foto_capa_url IS 'URL pública da foto de capa';
COMMENT ON COLUMN profissionais.bio IS 'Bio curta do perfil';
COMMENT ON COLUMN profissionais.foto_capa_url IS 'URL pública da foto de capa';

-- Índices redecontatos (idempotente; podem já existir)
CREATE INDEX IF NOT EXISTS idx_redecontatos_seguido ON redecontatos (seguido_id);

CREATE INDEX IF NOT EXISTS idx_redecontatos_seguidor ON redecontatos (seguidor_id);

-- Leitura global para perfis (lista de seguidores/seguindo de qualquer usuário autenticado)
DROP POLICY IF EXISTS "redecontatos select global perfil" ON redecontatos;

CREATE POLICY "redecontatos select global perfil" ON redecontatos FOR
SELECT
  TO authenticated
  USING (TRUE);
