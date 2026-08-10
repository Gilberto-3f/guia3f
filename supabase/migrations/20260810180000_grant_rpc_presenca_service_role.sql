-- Mapa da mobilidade usa service_role (admin). A RPC de presença pública
-- só tinha GRANT para authenticated/anon — assinantes regulares sumiam do mapa.

GRANT EXECUTE ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) TO service_role;
