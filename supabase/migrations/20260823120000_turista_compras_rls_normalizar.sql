-- Normaliza turista_compras (42501) e deixa o histórico só no service_role.
--
-- 57014 / 08006 + Auth 504 (mesmo horário): query lenta satura o pool →
-- Auth estoura deadline. Já mitigado em
-- 20260820210000_normalizar_timeouts_posts_ecossistema_stories.sql
-- e no client (JWT local, sem GET /auth/v1/user).
--
-- Causa do 42501: INSERT/UPDATE com JWT do profissional/empresa.
-- Políticas antigas: só SELECT/UPDATE da própria linha; sem INSERT.
-- cancelarPassageiroManifesto e concluirCorridaMobilidade gravavam com o
-- client autenticado → "new row violates row-level security policy".
--
-- Modelo: turista lê e marca visto; escritas do ledger só via service_role
-- (APIs). NO FORCE RLS para o service_role continuar bypassando.

ALTER TABLE public.turista_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turista_compras NO FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.turista_compras FROM PUBLIC;
REVOKE ALL ON TABLE public.turista_compras FROM anon;
REVOKE ALL ON TABLE public.turista_compras FROM authenticated;

GRANT SELECT, UPDATE ON TABLE public.turista_compras TO authenticated;
GRANT ALL ON TABLE public.turista_compras TO service_role;

DROP POLICY IF EXISTS "turista_compras select own" ON public.turista_compras;
CREATE POLICY "turista_compras select own"
  ON public.turista_compras
  FOR SELECT
  TO authenticated
  USING (turista_usuario_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "turista_compras update own" ON public.turista_compras;
CREATE POLICY "turista_compras update own"
  ON public.turista_compras
  FOR UPDATE
  TO authenticated
  USING (turista_usuario_id = (SELECT auth.uid()))
  WITH CHECK (turista_usuario_id = (SELECT auth.uid()));

-- Sem INSERT/DELETE para authenticated de propósito.
DROP POLICY IF EXISTS "turista_compras insert own" ON public.turista_compras;

COMMENT ON TABLE public.turista_compras IS
  'Ledger de compras/serviços do turista. SELECT/UPDATE próprio; INSERT só service_role.';
