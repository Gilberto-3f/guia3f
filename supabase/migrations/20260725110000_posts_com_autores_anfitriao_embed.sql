-- Feed: não embutir empresa `somente_anfitriao` em posts sociais do profissional.
-- Só inclui a empresa de hospedagem quando o post foi publicado com autor_tipo = 'empresa'.

CREATE OR REPLACE VIEW public.posts_com_autores
WITH
  (security_invoker = TRUE) AS
SELECT
  p.*,
  jsonb_build_object(
    'id',
    u.id,
    'email',
    u.email,
    'role',
    u.role,
    'turistas',
    CASE
      WHEN t.id IS NOT NULL THEN
        jsonb_build_object(
          'nome_completo',
          t.nome_completo,
          'nome_usuario',
          t.nome_usuario,
          'foto_perfil_url',
          t.foto_perfil_url,
          'foto_url',
          t.foto_url
        )
      ELSE NULL
    END,
    'profissionais',
    CASE
      WHEN pr.id IS NOT NULL THEN
        jsonb_build_object(
          'nome_completo',
          pr.nome_completo,
          'nome_usuario',
          pr.nome_usuario,
          'foto_perfil_url',
          pr.foto_perfil_url,
          'foto_url',
          pr.foto_url,
          'docs_verificado',
          pr.docs_verificado,
          'status',
          pr.status
        )
      ELSE NULL
    END,
    'empresas',
    CASE
      WHEN e.id IS NOT NULL THEN
        jsonb_build_object(
          'id',
          e.id,
          'nome_fantasia',
          e.nome_fantasia,
          'nome_usuario',
          e.nome_usuario,
          'foto_url',
          e.foto_url,
          'docs_verificado',
          e.docs_verificado,
          'status',
          e.status,
          'somente_anfitriao',
          e.somente_anfitriao
        )
      ELSE NULL
    END
  ) AS usuarios
FROM
  public.posts p
  INNER JOIN public.usuarios u ON p.autor_id = u.id
  LEFT JOIN public.turistas t ON u.id = t.usuario_id
  LEFT JOIN public.profissionais pr ON u.id = pr.usuario_id
    AND COALESCE(pr.somente_modo_apresentacao, FALSE) = FALSE
  LEFT JOIN public.empresas e ON u.id = e.usuario_id
    AND COALESCE(e.somente_modo_apresentacao, FALSE) = FALSE
    AND (
      COALESCE(e.somente_anfitriao, FALSE) = FALSE
      OR COALESCE(p.autor_tipo, '') = 'empresa'
    )
WHERE
  p.deleted_at IS NULL;

COMMENT ON VIEW public.posts_com_autores IS 'Posts com autor; empresa somente_anfitriao só quando autor_tipo=empresa.';

GRANT SELECT ON public.posts_com_autores TO authenticated;
