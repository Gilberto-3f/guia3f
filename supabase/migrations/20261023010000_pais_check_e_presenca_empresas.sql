-- 23514: CHECK legado (geral/BR/AR/PY) rejeita cidade_chave nas abas.
-- 522: GET empresas com OR de somente_anfitriao/guia/van + RLS vira seq scan e estoura o gateway.

-- ========== 1) Abas do canal: CHECK aceita cidade_chave ==========
ALTER TABLE public.mensagens_canal
DROP CONSTRAINT IF EXISTS mensagens_canal_pais_check;

UPDATE public.mensagens_canal
SET pais = 'geral'
WHERE pais IS NULL
  OR btrim(pais) = ''
  OR char_length(btrim(pais)) < 2;

ALTER TABLE public.mensagens_canal
ALTER COLUMN pais SET DEFAULT 'geral';

ALTER TABLE public.mensagens_canal
ADD CONSTRAINT mensagens_canal_pais_check CHECK (
  pais IS NOT NULL
  AND char_length(btrim(pais)) BETWEEN 2 AND 80
);

COMMENT ON COLUMN public.mensagens_canal.pais IS
  'Aba do mensageiro coletivo: geral (Todos) ou cidade_chave do bloco. BR/AR/PY legado permanece válido.';

-- ========== 2) Presença dual (anfitrião / guia / van) ==========
CREATE INDEX IF NOT EXISTS idx_empresas_presenca_dual
  ON public.empresas (id)
  WHERE docs_verificado = TRUE
    AND status IN ('aprovado', 'ativo')
    AND COALESCE(somente_modo_apresentacao, FALSE) = FALSE
    AND foto_url IS NOT NULL
    AND (
      somente_anfitriao = TRUE
      OR somente_guia = TRUE
      OR somente_van = TRUE
    );

DROP POLICY IF EXISTS "Usuários autenticados podem ver empresas" ON public.empresas;
CREATE POLICY "Usuários autenticados podem ver empresas" ON public.empresas FOR SELECT
USING (
  (SELECT auth.role()) = 'authenticated'
  AND (
    COALESCE(somente_modo_apresentacao, FALSE) = FALSE
    OR usuario_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.empresa_ids_presenca_dual()
RETURNS TABLE (empresa_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '800ms'
SET statement_timeout = '1500ms'
AS $$
BEGIN
  RETURN QUERY
  SELECT e.id
  FROM public.empresas e
  WHERE e.docs_verificado = TRUE
    AND e.status IN ('aprovado', 'ativo')
    AND COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
    AND e.foto_url IS NOT NULL
    AND (
      e.somente_anfitriao = TRUE
      OR e.somente_guia = TRUE
      OR e.somente_van = TRUE
    );
EXCEPTION
  WHEN lock_not_available THEN
    RETURN;
  WHEN query_canceled THEN
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.empresa_ids_presenca_dual() IS
  'IDs de empresas dual (anfitrião/guia/van) visíveis no guia. Timeout curto; em carga retorna vazio.';

REVOKE ALL ON FUNCTION public.empresa_ids_presenca_dual() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.empresa_ids_presenca_dual() TO authenticated;
GRANT EXECUTE ON FUNCTION public.empresa_ids_presenca_dual() TO anon;
GRANT EXECUTE ON FUNCTION public.empresa_ids_presenca_dual() TO service_role;
