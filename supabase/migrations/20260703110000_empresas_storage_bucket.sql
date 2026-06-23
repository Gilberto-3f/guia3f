-- Bucket de mídia da empresa (foto de perfil, galeria 360°) — leitura pública + upload do dono

INSERT INTO storage.buckets (id, name, public)
VALUES ('empresas', 'empresas', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "empresas storage leitura pública" ON storage.objects;
CREATE POLICY "empresas storage leitura pública" ON storage.objects FOR
SELECT USING (bucket_id = 'empresas');

DROP POLICY IF EXISTS "empresas storage upload dono" ON storage.objects;
CREATE POLICY "empresas storage upload dono" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'empresas'
  AND (
    (
      (storage.foldername (name))[1] = 'empresas'
      AND (storage.foldername (name))[2] IN (
        SELECT id::text FROM public.empresas WHERE usuario_id = auth.uid()
      )
    )
    OR (
      (storage.foldername (name))[1] = '360'
      AND (storage.foldername (name))[2] IN (
        SELECT id::text FROM public.empresas WHERE usuario_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
);

DROP POLICY IF EXISTS "empresas storage update dono" ON storage.objects;
CREATE POLICY "empresas storage update dono" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'empresas'
  AND (
    (
      (storage.foldername (name))[1] = 'empresas'
      AND (storage.foldername (name))[2] IN (
        SELECT id::text FROM public.empresas WHERE usuario_id = auth.uid()
      )
    )
    OR (
      (storage.foldername (name))[1] = '360'
      AND (storage.foldername (name))[2] IN (
        SELECT id::text FROM public.empresas WHERE usuario_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
);

DROP POLICY IF EXISTS "empresas storage delete dono" ON storage.objects;
CREATE POLICY "empresas storage delete dono" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'empresas'
  AND (
    (
      (storage.foldername (name))[1] = 'empresas'
      AND (storage.foldername (name))[2] IN (
        SELECT id::text FROM public.empresas WHERE usuario_id = auth.uid()
      )
    )
    OR (
      (storage.foldername (name))[1] = '360'
      AND (storage.foldername (name))[2] IN (
        SELECT id::text FROM public.empresas WHERE usuario_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
);
