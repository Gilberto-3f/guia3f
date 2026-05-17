-- Fallback + trigger: ao descurtir, remove TODAS as atividades curtiu_post do par (autor_id, alvo_id).
-- Corrige acúmulo quando o trigger antigo falhava ou só apagava por curtida_id.

CREATE OR REPLACE FUNCTION public.limpar_atividades_apos_descurtir (
  p_post_id UUID DEFAULT NULL,
  p_comentario_id UUID DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER := 0;
BEGIN
  IF p_usuario_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_post_id IS NOT NULL THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'curtiu_post'
      AND autor_id = p_usuario_id
      AND alvo_id = p_post_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
  END IF;

  IF p_comentario_id IS NOT NULL THEN
    DELETE FROM public.atividades
    WHERE
      tipo = 'curtiu_comentario'
      AND autor_id = p_usuario_id
      AND alvo_id = p_comentario_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN v_n;
  END IF;

  RETURN 0;
END;
$$;

COMMENT ON FUNCTION public.limpar_atividades_apos_descurtir IS
'Chamado pelo app após DELETE em curtidas: remove linhas órfãs em atividades (autor + alvo).';

GRANT EXECUTE ON FUNCTION public.limpar_atividades_apos_descurtir (UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_limpar_atividades_apos_curtida_apagada ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.post_id IS NOT NULL AND OLD.usuario_id IS NOT NULL THEN
    PERFORM public.limpar_atividades_apos_descurtir(OLD.post_id, NULL, OLD.usuario_id);
  END IF;

  IF OLD.comentario_id IS NOT NULL AND OLD.usuario_id IS NOT NULL THEN
    PERFORM public.limpar_atividades_apos_descurtir(NULL, OLD.comentario_id, OLD.usuario_id);
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_limpar_atividades_curtida_apagada ON public.curtidas;

CREATE TRIGGER trg_limpar_atividades_curtida_apagada
AFTER DELETE ON public.curtidas FOR EACH ROW
EXECUTE FUNCTION public.trg_limpar_atividades_apos_curtida_apagada ();

-- Limpa notificações órfãs (sem curtida correspondente no banco).
DELETE FROM public.atividades AS a
WHERE
  a.tipo = 'curtiu_post'
  AND NOT EXISTS (
    SELECT 1
    FROM public.curtidas AS c
    WHERE
      c.post_id = a.alvo_id
      AND c.usuario_id = a.autor_id
  );

DELETE FROM public.atividades AS a
WHERE
  a.tipo = 'curtiu_comentario'
  AND NOT EXISTS (
    SELECT 1
    FROM public.curtidas AS c
    WHERE
      c.comentario_id = a.alvo_id
      AND c.usuario_id = a.autor_id
  );
