-- Abas país nos canais coletivos: alinhar CHECK e dados legados com BR, AR, PY, geral (app).

ALTER TABLE public.mensagens_canal
DROP CONSTRAINT IF EXISTS mensagens_canal_pais_check;

UPDATE public.mensagens_canal
SET
  pais = CASE
    WHEN pais IS NULL OR btrim(pais) = '' THEN 'geral'
    WHEN lower(btrim(pais)) IN ('geral', 'todos', 'global', 'all') THEN 'geral'
    WHEN lower(btrim(pais)) IN ('br', 'brasil', 'brazil') THEN 'BR'
    WHEN lower(btrim(pais)) IN ('ar', 'argentina') THEN 'AR'
    WHEN lower(btrim(pais)) IN ('py', 'paraguai', 'paraguay') THEN 'PY'
    WHEN pais IN ('BR', 'AR', 'PY', 'geral') THEN pais
    ELSE 'geral'
  END
WHERE
  pais IS NULL
  OR btrim(pais) = ''
  OR pais NOT IN ('geral', 'BR', 'AR', 'PY');

ALTER TABLE public.mensagens_canal
ADD CONSTRAINT mensagens_canal_pais_check CHECK (
  pais IN ('geral', 'BR', 'AR', 'PY')
);

ALTER TABLE public.mensagens_canal
ALTER COLUMN pais SET DEFAULT 'geral';

COMMENT ON COLUMN public.mensagens_canal.pais IS 'Aba país do mensageiro coletivo: geral (Todos), BR, AR, PY';
