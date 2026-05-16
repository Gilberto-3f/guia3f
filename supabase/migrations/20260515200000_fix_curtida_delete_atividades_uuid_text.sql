-- Corrige erro 42883 ao DELETE em curtidas: operator does not exist: uuid = text
-- Causa: função do trigger comparava tipos de forma ambígua no OR (limpeza de atividades).
-- Solução: dois DELETE separados + comparações uuid via ::text (seguro para qualquer drift).

CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_curtida_apagada ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.post_id IS NOT NULL THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'curtiu_post'
      AND (
        coalesce(dados_extras->>'curtida_id', '') = OLD.id::text
        OR (
          alvo_id::text = OLD.post_id::text
          AND autor_id::text = OLD.usuario_id::text
        )
      );
  END IF;

  IF OLD.comentario_id IS NOT NULL THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'curtiu_comentario'
      AND (
        coalesce(dados_extras->>'curtida_id', '') = OLD.id::text
        OR (
          alvo_id::text = OLD.comentario_id::text
          AND autor_id::text = OLD.usuario_id::text
        )
      );
  END IF;

  RETURN OLD;
END;
$$;
