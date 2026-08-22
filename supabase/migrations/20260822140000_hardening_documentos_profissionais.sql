-- Hardening: bucket documentos privado + SELECT de profissionais sem dump de cadastros pendentes.

-- ---------------------------------------------------------------------------
-- 1) Bucket `documentos` privado (IDs, comprovantes). ADM usa URL assinada (service role).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

DROP POLICY IF EXISTS "documentos storage leitura pública" ON storage.objects;
DROP POLICY IF EXISTS "documentos storage leitura dono" ON storage.objects;
DROP POLICY IF EXISTS "documentos storage upload dono" ON storage.objects;
DROP POLICY IF EXISTS "documentos storage update dono" ON storage.objects;
DROP POLICY IF EXISTS "documentos storage delete dono" ON storage.objects;

-- Path real: documentos/{userId}/arquivo  (prefixo extra) ou {userId}/arquivo
CREATE POLICY "documentos storage leitura dono" ON storage.objects FOR
SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    (storage.foldername (name))[1] = auth.uid ()::text
    OR (
      (storage.foldername (name))[1] = 'documentos'
      AND (storage.foldername (name))[2] = auth.uid ()::text
    )
  )
);

CREATE POLICY "documentos storage upload dono" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    (storage.foldername (name))[1] = auth.uid ()::text
    OR (
      (storage.foldername (name))[1] = 'documentos'
      AND (storage.foldername (name))[2] = auth.uid ()::text
    )
  )
);

CREATE POLICY "documentos storage update dono" ON storage.objects FOR
UPDATE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    (storage.foldername (name))[1] = auth.uid ()::text
    OR (
      (storage.foldername (name))[1] = 'documentos'
      AND (storage.foldername (name))[2] = auth.uid ()::text
    )
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    (storage.foldername (name))[1] = auth.uid ()::text
    OR (
      (storage.foldername (name))[1] = 'documentos'
      AND (storage.foldername (name))[2] = auth.uid ()::text
    )
  )
);

CREATE POLICY "documentos storage delete dono" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    (storage.foldername (name))[1] = auth.uid ()::text
    OR (
      (storage.foldername (name))[1] = 'documentos'
      AND (storage.foldername (name))[2] = auth.uid ()::text
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2) profissionais: outros usuários não leem cadastro pendente/reprovado.
--    Dono e ADM continuam vendo a linha completa (docs/placa no próprio fluxo).
--    URLs de documento de aprovados não baixam arquivo (bucket privado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_autenticado_eh_admin ()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid ()
      AND u.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_autenticado_eh_admin () FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_autenticado_eh_admin () TO authenticated;

COMMENT ON FUNCTION public.usuario_autenticado_eh_admin () IS
  'True se auth.uid() é admin. SECURITY DEFINER para policies RLS.';

DROP POLICY IF EXISTS "Usuários autenticados podem ver profissionais" ON public.profissionais;
CREATE POLICY "Usuários autenticados podem ver profissionais" ON public.profissionais FOR
SELECT TO authenticated
USING (
  usuario_id = auth.uid ()
  OR public.usuario_autenticado_eh_admin ()
  OR (
    COALESCE(somente_modo_apresentacao, FALSE) = FALSE
    AND lower(COALESCE(status, 'aprovado')) NOT IN (
      'aguardando_analise',
      'aguardando_aprovacao',
      'reprovado',
      'rejeitado',
      'recusado',
      'bloqueado',
      'suspenso'
    )
  )
);
