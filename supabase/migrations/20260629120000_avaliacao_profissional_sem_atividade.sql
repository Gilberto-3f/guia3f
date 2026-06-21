-- Avaliação de profissional: não gerar linha em `atividades` (tipo `avaliou` / alvo empresa).
-- Corrige: null value in column "usuario_id" of relation "atividades" violates not-null constraint

DROP TRIGGER IF EXISTS trg_atividades_avaliacao ON public.avaliacoes;

CREATE OR REPLACE FUNCTION public.trg_atividade_avaliacao ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Feedback a profissional: só persiste em `avaliacoes` (popup do perfil social).
  IF COALESCE(NEW.alvo_tipo, '') = 'profissional' THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Política do produto: empresas não recebem notificação "avaliou" em atividades.
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_avaliacao () IS
  'Desativado: avaliações não geram atividade social. Mantido para compatibilidade se o trigger for recriado.';
