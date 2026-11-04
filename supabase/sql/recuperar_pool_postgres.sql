-- Cole o bloco INTEIRO. Sem ANALYZE, ALTER, INDEX.
-- terminate em superuser (supabase_admin / Realtime) falha com 42501 —
-- este script ignora esses pids e só mata o que a role postgres consegue.

-- ========== 1) Diagnóstico ==========
SELECT
  count(*) AS conexoes,
  (SELECT setting FROM pg_settings WHERE name = 'max_connections')::int AS max_connections
FROM pg_stat_activity;

SELECT state, usename, application_name, count(*) AS n
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, usename, application_name
ORDER BY n DESC;

SELECT
  pid,
  usename,
  application_name,
  backend_type,
  state,
  wait_event_type,
  wait_event,
  now() - query_start AS duracao,
  left(query, 160) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND coalesce(state, '') <> 'idle'
ORDER BY query_start NULLS LAST;

-- ========== 2) Encerrar só backends que esta role pode matar ==========
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT a.pid
    FROM pg_stat_activity a
    LEFT JOIN pg_roles rol ON rol.rolname = a.usename
    WHERE a.datname = current_database()
      AND a.pid <> pg_backend_pid()
      AND a.backend_type = 'client backend'
      AND coalesce(rol.rolsuper, false) = false
      AND (
        a.state IN ('active', 'idle in transaction', 'idle in transaction (aborted)')
        OR (a.state = 'idle' AND a.state_change < now() - interval '20 seconds')
      )
      AND coalesce(a.query, '') NOT ILIKE '%pg_stat_activity%'
      AND coalesce(a.query, '') NOT ILIKE '%pg_terminate_backend%'
  LOOP
    BEGIN
      PERFORM pg_terminate_backend(r.pid);
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END $$;
