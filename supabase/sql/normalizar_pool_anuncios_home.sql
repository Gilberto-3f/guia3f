-- Cole no SQL Editor (produção). Sem ANALYZE, sem CREATE INDEX, sem ALTER.
-- Logs 03/11 02:22: REST 504 em ecossistemas + Auth, Postgres 57014, Realtime queue_timeout.
-- Causa: lock de DDL em anuncios + filtro OR (periodo_fim IS NULL) que não usa
-- idx_anuncios_home_veiculacao. Auth/Realtime/ecossistemas são sintoma.
-- Recorrente passa a ser 9999-12-31 (o índice de veiculação volta a valer).

SELECT pg_cancel_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state <> 'idle'
  AND query_start < now() - interval '8 seconds'
  AND query NOT ILIKE '%pg_stat_activity%';

UPDATE public.anuncios
SET periodo_fim = DATE '9999-12-31'
WHERE periodo_fim IS NULL;

DROP TRIGGER IF EXISTS trg_ecossistema_cidades_regrava_vinculos ON public.ecossistema_cidades;
