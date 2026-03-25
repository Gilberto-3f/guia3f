-- 1.1 Foto principal da empresa + índice composto
ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS foto_url TEXT;

CREATE INDEX IF NOT EXISTS idx_empresas_cidade_categoria ON empresas (cidade, categoria);

-- 1.2 Localização do usuário (ordenar por proximidade no app)
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS ultima_localizacao JSONB, -- ex.: { "lat": number, "lng": number }
ADD COLUMN IF NOT EXISTS localizacao_atualizada_em TIMESTAMPTZ;

-- Opcional (PostGIS): descomente se a extensão estiver disponível no projeto
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS localizacao_geo GEOGRAPHY (POINT);
-- CREATE INDEX IF NOT EXISTS idx_usuarios_localizacao_geo ON usuarios USING GIST (localizacao_geo);
