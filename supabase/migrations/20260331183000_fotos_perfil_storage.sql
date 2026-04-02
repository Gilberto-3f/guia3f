-- Bucket e políticas para upload de foto de perfil
INSERT INTO
  storage.buckets (id, name, public)
VALUES
  ('fotos-perfil', 'fotos-perfil', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fotos-perfil leitura pública" ON storage.objects;

DROP POLICY IF EXISTS "fotos-perfil upload pasta do usuário" ON storage.objects;

DROP POLICY IF EXISTS "fotos-perfil update pasta do usuário" ON storage.objects;

DROP POLICY IF EXISTS "fotos-perfil delete pasta do usuário" ON storage.objects;

CREATE POLICY "fotos-perfil leitura pública" ON storage.objects FOR
SELECT
  USING (bucket_id = 'fotos-perfil');

CREATE POLICY "fotos-perfil upload pasta do usuário" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'fotos-perfil'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);

CREATE POLICY "fotos-perfil update pasta do usuário" ON storage.objects FOR
UPDATE
  TO authenticated USING (
    bucket_id = 'fotos-perfil'
    AND (storage.foldername (name))[1] = auth.uid ()::text
  )
  WITH CHECK (
    bucket_id = 'fotos-perfil'
    AND (storage.foldername (name))[1] = auth.uid ()::text
  );

CREATE POLICY "fotos-perfil delete pasta do usuário" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'fotos-perfil'
  AND (storage.foldername (name))[1] = auth.uid ()::text
);
