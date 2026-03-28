-- Validacoes finais da Fase 1

-- 1) Coluna e indice
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND column_name = 'admin_permissoes';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'usuarios'
  AND indexname = 'idx_usuarios_admin_permissoes';

-- 2) Admins em auth.users
SELECT
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE lower(email) IN (
  'admin.geral@guia3f.com.br',
  'moderador.guias@guia3f.com.br',
  'moderador.taxistas@guia3f.com.br',
  'moderador.apps@guia3f.com.br',
  'moderador.vans@guia3f.com.br',
  'moderador.anfitrioes@guia3f.com.br',
  'financeiro@guia3f.com.br',
  'suporte@guia3f.com.br',
  'grupocaciquebr@gmail.com'
)
ORDER BY email;

-- 3) Admins em usuarios
SELECT
  id,
  email,
  role,
  admin_level,
  admin_permissoes
FROM usuarios
WHERE role = 'admin'
ORDER BY admin_level, email;

-- 4) Integridade auth x usuarios
SELECT
  u.email,
  u.id AS usuarios_id,
  au.id AS auth_id,
  (u.id = au.id) AS ids_iguais
FROM usuarios u
LEFT JOIN auth.users au
  ON lower(au.email) = lower(u.email)
WHERE u.role = 'admin'
ORDER BY u.email;

-- 5) Confirmar promocao do usuario existente
SELECT
  id,
  email,
  role,
  admin_level,
  admin_permissoes
FROM usuarios
WHERE lower(email) = lower('grupocaciquebr@gmail.com');

-- 6) Volume de dados de teste
SELECT 'turistas' AS tabela, COUNT(*) AS total FROM turistas
UNION ALL
SELECT 'profissionais', COUNT(*) FROM profissionais
UNION ALL
SELECT 'empresas', COUNT(*) FROM empresas
UNION ALL
SELECT 'usuarios_admin', COUNT(*) FROM usuarios WHERE role = 'admin';

