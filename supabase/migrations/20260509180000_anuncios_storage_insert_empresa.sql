-- Bucket criativos home + políticas INSERT/UPDATE em anuncios (dono da empresa)

INSERT INTO storage.buckets (id, name, public)
VALUES ('anuncios', 'anuncios', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anuncios storage leitura pública" ON storage.objects;
CREATE POLICY "anuncios storage leitura pública" ON storage.objects FOR
SELECT USING (bucket_id = 'anuncios');

DROP POLICY IF EXISTS "anuncios storage upload empresa" ON storage.objects;
CREATE POLICY "anuncios storage upload empresa" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'anuncios'
  AND (storage.foldername (name))[1] IN (
    SELECT id::text FROM empresas WHERE usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "anuncios storage delete empresa" ON storage.objects;
CREATE POLICY "anuncios storage delete empresa" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'anuncios'
  AND (storage.foldername (name))[1] IN (
    SELECT id::text FROM empresas WHERE usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "anuncios insert dono empresa" ON anuncios;
CREATE POLICY "anuncios insert dono empresa" ON anuncios FOR INSERT TO authenticated
WITH CHECK (
  empresa_id IN (
    SELECT id FROM empresas WHERE usuario_id = auth.uid ()
  )
);

DROP POLICY IF EXISTS "anuncios update dono empresa" ON anuncios;
CREATE POLICY "anuncios update dono empresa" ON anuncios FOR
UPDATE TO authenticated USING (
  empresa_id IN (
    SELECT id FROM empresas WHERE usuario_id = auth.uid ()
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT id FROM empresas WHERE usuario_id = auth.uid ()
  )
);
