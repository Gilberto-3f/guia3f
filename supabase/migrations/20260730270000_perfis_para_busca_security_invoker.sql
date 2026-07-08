-- Fix Advisor 0010: view perfis_para_busca em security_invoker (respeita RLS do caller).

CREATE OR REPLACE VIEW public.perfis_para_busca
WITH (security_invoker = TRUE) AS
SELECT
  u.id AS usuario_id,
  u.email,
  u.role,
  COALESCE(u.username, t.nome_usuario) AS username,
  t.nome_completo AS nome,
  t.nome_usuario,
  t.foto_perfil_url AS foto_url,
  'turista'::text AS tipo,
  NULL::uuid AS empresa_id
FROM
  public.usuarios u
  INNER JOIN public.turistas t ON u.id = t.usuario_id
UNION ALL
SELECT
  u.id AS usuario_id,
  u.email,
  u.role,
  COALESCE(u.username, pr.nome_usuario) AS username,
  pr.nome_completo AS nome,
  pr.nome_usuario,
  pr.foto_perfil_url AS foto_url,
  'profissional'::text AS tipo,
  NULL::uuid AS empresa_id
FROM
  public.usuarios u
  INNER JOIN public.profissionais pr ON u.id = pr.usuario_id
UNION ALL
SELECT
  u.id AS usuario_id,
  u.email,
  u.role,
  COALESCE(u.username, e.nome_usuario) AS username,
  e.nome_fantasia AS nome,
  e.nome_usuario,
  e.foto_url,
  'empresa'::text AS tipo,
  e.id AS empresa_id
FROM
  public.usuarios u
  INNER JOIN public.empresas e ON u.id = e.usuario_id;

COMMENT ON VIEW public.perfis_para_busca IS 'Perfis unificados (turista/profissional/empresa) para busca e menções; security_invoker respeita RLS.';

GRANT SELECT ON public.perfis_para_busca TO authenticated;
