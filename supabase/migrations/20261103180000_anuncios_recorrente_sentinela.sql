-- Vigência recorrente: 9999-12-31 em vez de NULL, para o carrossel usar
-- idx_anuncios_home_veiculacao (tipo, status, periodo_inicio, periodo_fim).

UPDATE public.anuncios
SET periodo_fim = DATE '9999-12-31'
WHERE periodo_fim IS NULL;
