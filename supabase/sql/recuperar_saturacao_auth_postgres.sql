-- Cole no SQL Editor do Supabase (uma seção de cada vez).
-- NÃO rode as 3 seções na mesma transação se for encerrar backends.
--
-- O que os logs de 21/08 12:50 significam:
--   Auth 504 "dial tcp [::1]:5432" = GoTrue não conseguiu falar com o Postgres
--   REST 401 = JWT ausente porque o Auth timeoutou
--   REST 503 / Postgres 57014 = pool saturado / statement timeout
-- Isso NÃO é o check da van (ida_volta). Não reexecute 10000/11000.

-- ========== 1) Diagnóstico (só leitura) ==========
SELECT
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS duracao,
  left(query, 180) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
ORDER BY query_start NULLS LAST;

-- Conexões por estado
SELECT state, count(*) AS n
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY n DESC;

-- ========== 2) Encerrar queries presas (rode SÓ se a seção 1 mostrar queries > 20s) ==========
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
--   AND pid <> pg_backend_pid()
--   AND state <> 'idle'
--   AND query_start < now() - interval '20 seconds'
--   AND query NOT ILIKE '%pg_stat_activity%';

-- ========== 3) Schema van (idempotente) — só se ida_volta ainda não existir ==========
-- Prefira o arquivo:
--   supabase/migrations/20260821120000_normalizar_rotas_tabeladas_duracao.sql
-- Rode ELE SOZINHO, não junto com CREATE INDEX pesado.
