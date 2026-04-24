-- Respostas oficiais da empresa às avaliações (1:1 com avaliacoes)

CREATE TABLE IF NOT EXISTS avaliacao_respostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  avaliacao_id UUID NOT NULL REFERENCES avaliacoes (id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas (id) ON DELETE CASCADE,
  autor_usuario_id UUID NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT avaliacao_respostas_avaliacao_id_key UNIQUE (avaliacao_id)
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_empresa ON avaliacao_respostas (empresa_id);

CREATE OR REPLACE FUNCTION update_avaliacao_respostas_updated_at ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_avaliacao_respostas_updated_at ON avaliacao_respostas;

CREATE TRIGGER trigger_avaliacao_respostas_updated_at
BEFORE UPDATE ON avaliacao_respostas FOR EACH ROW
EXECUTE FUNCTION update_avaliacao_respostas_updated_at ();

ALTER TABLE avaliacao_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ver respostas a avaliacoes" ON avaliacao_respostas;
DROP POLICY IF EXISTS "Dono da empresa pode criar resposta" ON avaliacao_respostas;
DROP POLICY IF EXISTS "Dono da empresa pode atualizar resposta" ON avaliacao_respostas;

CREATE POLICY "Autenticados podem ver respostas a avaliacoes" ON avaliacao_respostas FOR
SELECT
  USING (auth.role () = 'authenticated');

CREATE POLICY "Dono da empresa pode criar resposta" ON avaliacao_respostas FOR INSERT
WITH
  CHECK (
    auth.role () = 'authenticated'
    AND autor_usuario_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM empresas e
      WHERE
        e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );

CREATE POLICY "Dono da empresa pode atualizar resposta" ON avaliacao_respostas FOR UPDATE USING (
  autor_usuario_id = auth.uid ()
  AND EXISTS (
    SELECT 1
    FROM empresas e
    WHERE
      e.id = empresa_id
      AND e.usuario_id = auth.uid ()
  )
)
WITH
  CHECK (
    autor_usuario_id = auth.uid ()
    AND EXISTS (
      SELECT 1
      FROM empresas e
      WHERE
        e.id = empresa_id
        AND e.usuario_id = auth.uid ()
    )
  );
