-- Suporte menu lateral / comissões / flags de perfil
-- Ordem: após empresas base (20260324000000) e antes de migrações 2510+

ALTER TABLE turistas
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE profissionais
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE profissionais
ADD COLUMN IF NOT EXISTS placa_vermelha BOOLEAN DEFAULT FALSE;

ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS admin_level INTEGER DEFAULT 0;

COMMENT ON COLUMN usuarios.admin_level IS '0 = não admin; 1 = admin geral (modo apresentação, etc.)';

COMMENT ON COLUMN profissionais.placa_vermelha IS 'Profissional credenciado turismo (submenu especial)';

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS redes_sociais JSONB DEFAULT '{}'::jsonb;

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS descricao_curta TEXT;

CREATE TABLE IF NOT EXISTS comissao_oferta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  categoria_profissional VARCHAR (50) NOT NULL,
  beneficios JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_validade DATE NOT NULL,
  status VARCHAR (20) DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW ()
);

CREATE INDEX IF NOT EXISTS idx_comissao_oferta_empresa ON comissao_oferta (empresa_id);

CREATE INDEX IF NOT EXISTS idx_comissao_oferta_status ON comissao_oferta (status);

ALTER TABLE comissao_oferta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comissao_oferta select dono empresa" ON comissao_oferta;

DROP POLICY IF EXISTS "comissao_oferta insert dono empresa" ON comissao_oferta;

DROP POLICY IF EXISTS "comissao_oferta select aprovada profissionais" ON comissao_oferta;

CREATE POLICY "comissao_oferta select dono empresa" ON comissao_oferta FOR
SELECT
  USING (
    EXISTS (
      SELECT
        1
      FROM
        empresas e
      WHERE
        e.id = comissao_oferta.empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

CREATE POLICY "comissao_oferta insert dono empresa" ON comissao_oferta FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT
      1
    FROM
      empresas e
    WHERE
      e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
);

CREATE POLICY "comissao_oferta select aprovada profissionais" ON comissao_oferta FOR
SELECT
  TO authenticated
  USING (status = 'aprovada');
