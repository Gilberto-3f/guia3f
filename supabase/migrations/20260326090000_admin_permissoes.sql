-- Dashboard Admin: permissões granulares em JSONB
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usuarios'
          AND column_name = 'admin_permissoes'
    ) THEN
        ALTER TABLE usuarios
        ADD COLUMN admin_permissoes JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN usuarios.admin_permissoes IS
'Permissões granulares do admin em JSONB. Ex.: {"nivel":1,"cargo":"ADM_GERAL","modulos":["*"],"recursos":["*"]}';

CREATE INDEX IF NOT EXISTS idx_usuarios_admin_permissoes
ON usuarios
USING gin (admin_permissoes);

