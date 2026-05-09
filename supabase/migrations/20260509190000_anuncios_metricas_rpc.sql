-- Incrementos públicos de impressões/cliques (home ativa no período), via SECURITY DEFINER.
-- RLS da tabela não permite UPDATE anónimo; as RPCs aplicam só estes campos neste escopo.

CREATE OR REPLACE FUNCTION public.registrar_impressao_anuncio_home (p_anuncio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE anuncios
  SET
    impressoes_exibidas = COALESCE(impressoes_exibidas, 0) + 1
  WHERE
    id = p_anuncio_id
    AND tipo = 'home'
    AND status = 'ativo'
    AND periodo_inicio <= CURRENT_DATE
    AND periodo_fim >= CURRENT_DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_clique_anuncio_home (p_anuncio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE anuncios
  SET
    cliques = COALESCE(cliques, 0) + 1
  WHERE
    id = p_anuncio_id
    AND tipo = 'home'
    AND status = 'ativo'
    AND periodo_inicio <= CURRENT_DATE
    AND periodo_fim >= CURRENT_DATE
    AND link_url IS NOT NULL
    AND TRIM(link_url) <> '';
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_impressao_anuncio_home (uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.registrar_clique_anuncio_home (uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.registrar_impressao_anuncio_home (uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.registrar_impressao_anuncio_home (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.registrar_clique_anuncio_home (uuid) TO anon;

GRANT EXECUTE ON FUNCTION public.registrar_clique_anuncio_home (uuid) TO authenticated;
