-- Lista triggers em public.posts e funções que inserem em atividades.
-- Executar no SQL Editor do Supabase (produção ou local).

-- 1) Triggers na tabela posts
SELECT
  t.tgname AS trigger_name,
  CASE t.tgtype::integer & 1
    WHEN 1 THEN 'ROW'
    ELSE 'STATEMENT'
  END AS level,
  CASE t.tgtype::integer & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END AS timing,
  CASE
    WHEN t.tgtype::integer & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype::integer & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype::integer & 16 = 16 THEN 'UPDATE'
    ELSE 'OTHER'
  END AS event,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid, TRUE) AS trigger_def
FROM
  pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_proc p ON p.oid = t.tgfoid
WHERE
  n.nspname = 'public'
  AND c.relname = 'posts'
  AND NOT t.tgisinternal
ORDER BY
  t.tgname;

-- 2) Funções que mencionam INSERT em atividades (possíveis culpadas do 23502)
SELECT
  p.proname AS function_name,
  LEFT(p.prosrc, 400) AS source_preview
FROM
  pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE
  n.nspname = 'public'
  AND p.prosrc ILIKE '%insert%atividades%'
ORDER BY
  p.proname;

-- 3) Corpo completo de funções ligadas a repost (ajuste o nome se necessário)
SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS definition
FROM
  pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE
  n.nspname = 'public'
  AND (
    p.proname ILIKE '%repost%'
    OR p.prosrc ILIKE '%post_original_id%'
  )
ORDER BY
  p.proname;
