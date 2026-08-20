-- Evita 500 / 57014 em registrar_impressao_anuncio_home (e clique).
-- O UPDATE do contador na mesma linha de `anuncios` vira hot row com muitos
-- visitantes na home: a fila de locks estoura statement_timeout do PostgREST.
-- lock_timeout curto + swallow: métrica best-effort, a API não cai.

CREATE OR REPLACE FUNCTION public.registrar_impressao_anuncio_home (p_anuncio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '200ms'
SET statement_timeout = '1s'
AS $$
BEGIN
  IF p_anuncio_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.anuncios
  SET
    impressoes_exibidas = COALESCE(impressoes_exibidas, 0) + 1
  WHERE
    id = p_anuncio_id
    AND tipo = 'home'
    AND status = 'ativo'
    AND periodo_inicio <= CURRENT_DATE
    AND periodo_fim >= CURRENT_DATE;
EXCEPTION
  WHEN lock_not_available THEN
    NULL;
  WHEN query_canceled THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_clique_anuncio_home (p_anuncio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '200ms'
SET statement_timeout = '1s'
AS $$
BEGIN
  IF p_anuncio_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.anuncios
  SET
    cliques = COALESCE(cliques, 0) + 1
  WHERE
    id = p_anuncio_id
    AND tipo = 'home'
    AND status = 'ativo'
    AND periodo_inicio <= CURRENT_DATE
    AND periodo_fim >= CURRENT_DATE;
EXCEPTION
  WHEN lock_not_available THEN
    NULL;
  WHEN query_canceled THEN
    NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_impressao_anuncio_home (uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_clique_anuncio_home (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.registrar_impressao_anuncio_home (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_impressao_anuncio_home (uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_clique_anuncio_home (uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.registrar_clique_anuncio_home (uuid) TO authenticated;
