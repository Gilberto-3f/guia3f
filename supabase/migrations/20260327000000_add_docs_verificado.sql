ALTER TABLE turistas ADD COLUMN IF NOT EXISTS docs_verificado BOOLEAN DEFAULT false;
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS docs_verificado BOOLEAN DEFAULT false;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS docs_verificado BOOLEAN DEFAULT false;

ALTER TABLE turistas ADD COLUMN IF NOT EXISTS docs_verificado_por UUID REFERENCES usuarios(id);
ALTER TABLE turistas ADD COLUMN IF NOT EXISTS docs_verificado_em TIMESTAMPTZ;

ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS docs_verificado_por UUID REFERENCES usuarios(id);
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS docs_verificado_em TIMESTAMPTZ;

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS docs_verificado_por UUID REFERENCES usuarios(id);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS docs_verificado_em TIMESTAMPTZ;

