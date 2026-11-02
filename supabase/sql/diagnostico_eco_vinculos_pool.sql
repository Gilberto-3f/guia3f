-- Só leitura. Cole no SQL Editor. NÃO executa regravar_vinculos_eco_canais.
-- NÃO rode 20261028010000 / 20261029220000 / 20261030140000 (recriam o trigger).

-- 1) Trigger tem que voltar 0 linhas
SELECT t.tgname, n.nspname AS schema, c.relname AS tabela
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal
  AND (
    t.tgname ILIKE '%regrava%'
    OR t.tgname ILIKE '%vinculos_eco%'
  );

-- 2) Função: a definição NÃO pode ter DELETE FROM empresa_ecossistemas sem WHERE
SELECT pg_get_functiondef(p.oid) AS definicao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'regravar_vinculos_eco_canais';

-- 3) Na próxima queda (antes de cancelar backends): o que está preso
SELECT
  pid,
  now() - query_start AS duracao,
  state,
  wait_event_type,
  wait_event,
  left(query, 180) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state <> 'idle'
ORDER BY query_start NULLS LAST;
