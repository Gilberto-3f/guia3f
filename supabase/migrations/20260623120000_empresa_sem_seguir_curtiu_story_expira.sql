-- Empresas do guia deixam de gerar atividades ao serem favoritadas/seguidas.
-- Curtidas em story expiram com o ciclo de 24h do story.

DROP TRIGGER IF EXISTS trg_atividades_favorito_empresa ON public.favoritos;

CREATE OR REPLACE FUNCTION public.trg_atividade_favorito_empresa ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_favorito_empresa () IS
  'Legado: favoritar empresa não gera mais atividade de seguir (empresas são visíveis para todos).';

CREATE OR REPLACE FUNCTION public.trg_atividade_limpar_curtiu_story ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades a
  WHERE
    a.tipo = 'curtiu_story'
    AND (
      a.alvo_id = OLD.id
      OR (a.dados_extras ->> 'story_id') = OLD.id::text
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_limpar_curtiu_story ON public.stories;

CREATE TRIGGER trg_atividades_limpar_curtiu_story
AFTER DELETE ON public.stories FOR EACH ROW
EXECUTE FUNCTION public.trg_atividade_limpar_curtiu_story ();

CREATE OR REPLACE FUNCTION public.limpar_atividades_curtiu_story_expiradas ()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades a
  WHERE
    a.tipo = 'curtiu_story'
    AND (
      EXISTS (
        SELECT 1
        FROM public.stories s
        WHERE s.id = a.alvo_id
          AND s.expira_em <= NOW()
      )
      OR NOT EXISTS (
        SELECT 1
        FROM public.stories s
        WHERE s.id = a.alvo_id
      )
    );
END;
$$;

COMMENT ON FUNCTION public.limpar_atividades_curtiu_story_expiradas () IS
  'Remove notificações de curtida em story após expiração (24h).';
