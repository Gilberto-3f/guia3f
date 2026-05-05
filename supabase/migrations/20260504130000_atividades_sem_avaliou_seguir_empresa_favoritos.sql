-- Deixa de notificar "avaliou empresa" em atividades (avaliação continua no feed se partilhada).
DROP TRIGGER IF EXISTS trg_atividades_avaliacao ON public.avaliacoes;

-- Seguir empresa (favoritos): mesma forma que redecontatos — notifica o gestor da empresa.
CREATE OR REPLACE FUNCTION public.trg_atividade_favorito_empresa ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gestor UUID;
BEGIN
  IF NEW.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    e.usuario_id INTO v_gestor
  FROM
    public.empresas e
  WHERE
    e.id = NEW.empresa_id;

  IF NOT FOUND OR v_gestor IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_gestor = NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.atividades (usuario_id, autor_id, tipo, alvo_id, alvo_tipo, dados_extras)
  VALUES (
    v_gestor,
    NEW.usuario_id,
    'seguiu',
    NEW.usuario_id,
    'usuario',
    jsonb_build_object(
      'seguidor_id',
      NEW.usuario_id,
      'seguido_id',
      v_gestor,
      'seguido_tipo',
      'empresa'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_favorito_empresa ON public.favoritos;

CREATE TRIGGER trg_atividades_favorito_empresa
AFTER INSERT ON public.favoritos FOR EACH ROW
WHEN (NEW.empresa_id IS NOT NULL)
EXECUTE FUNCTION public.trg_atividade_favorito_empresa ();
