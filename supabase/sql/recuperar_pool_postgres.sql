-- Cole no SQL Editor. Seção 1 só lê. Seção 2 encerra backends presos
-- (cancel não bastou em 03/11 16:18: 522 em ecossistemas, Auth 504, Realtime CDC).
-- NÃO rode ANALYZE. NÃO rode ALTER/CREATE INDEX.

-- ========== 1) Diagnóstico ==========
SELECT state, count(*) AS n
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY n DESC;

SELECT
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS duracao,
  left(query, 160) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state <> 'idle'
ORDER BY query_start NULLS LAST;

SELECT tgname
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname ILIKE '%regrava%';

-- ========== 2) Encerrar o que segura o pool (rode se a seção 1 mostrar active/idle-in-xact > 12s) ==========
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state IN ('active', 'idle in transaction')
  AND (
    query_start < now() - interval '12 seconds'
    OR (state = 'idle in transaction' AND xact_start < now() - interval '12 seconds')
  )
  AND coalesce(query, '') NOT ILIKE '%pg_stat_activity%'
  AND coalesce(query, '') NOT ILIKE '%pg_terminate_backend%';
