-- Avaliações de profissionais usam alvo_id/alvo_tipo; empresa_id fica NULL.
-- Corrige: null value in column "empresa_id" violates not-null constraint

ALTER TABLE public.avaliacoes
  ADD COLUMN IF NOT EXISTS alvo_id UUID,
  ADD COLUMN IF NOT EXISTS alvo_tipo TEXT;

-- Backfill linhas antigas de empresa
UPDATE public.avaliacoes
SET
  alvo_id = COALESCE(alvo_id, empresa_id),
  alvo_tipo = COALESCE(NULLIF(TRIM(alvo_tipo), ''), 'empresa')
WHERE
  empresa_id IS NOT NULL
  AND (alvo_id IS NULL OR alvo_tipo IS NULL OR TRIM(alvo_tipo) = '');

ALTER TABLE public.avaliacoes
  ALTER COLUMN empresa_id DROP NOT NULL;

-- Índice único legado (empresa_id, usuario_id) impede várias avaliações profissionais com empresa_id NULL
ALTER TABLE public.avaliacoes
  DROP CONSTRAINT IF EXISTS avaliacoes_empresa_usuario_unique;

CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_empresa_usuario_unique
  ON public.avaliacoes (empresa_id, usuario_id)
  WHERE alvo_tipo = 'empresa' AND empresa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_profissional_usuario_unique
  ON public.avaliacoes (alvo_id, usuario_id)
  WHERE alvo_tipo = 'profissional' AND alvo_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_alvo ON public.avaliacoes (alvo_tipo, alvo_id);

-- Média da empresa: ignorar avaliações de profissionais (sem empresa_id)
CREATE OR REPLACE FUNCTION public.atualizar_media_empresa ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  eid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    eid := OLD.empresa_id;
  ELSE
    eid := NEW.empresa_id;
  END IF;

  IF eid IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.empresas
  SET
    nota_media = COALESCE(
      (
        SELECT AVG(nota::numeric)
        FROM public.avaliacoes
        WHERE
          empresa_id = eid
          AND COALESCE(alvo_tipo, 'empresa') = 'empresa'
      ),
      0
    ),
    total_avaliacoes = (
      SELECT COUNT(*)::integer
      FROM public.avaliacoes
      WHERE
        empresa_id = eid
        AND COALESCE(alvo_tipo, 'empresa') = 'empresa'
    )
  WHERE
    id = eid;

  RETURN NULL;
END;
$$;

-- avaliador_tipo: respeitar valor enviado quando alvo é profissional; manter regra legada para empresa
CREATE OR REPLACE FUNCTION public.set_avaliador_tipo ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF COALESCE(NEW.alvo_tipo, '') = 'profissional' THEN
    IF NEW.avaliador_tipo IS NOT NULL AND TRIM(NEW.avaliador_tipo) <> '' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT role INTO user_role
  FROM public.usuarios
  WHERE id = NEW.usuario_id;

  IF user_role = 'turista' THEN
    NEW.avaliador_tipo := 'turista';
  ELSIF user_role = 'profissional' THEN
    NEW.avaliador_tipo := 'profissional';
  ELSIF user_role = 'empresa' THEN
    NEW.avaliador_tipo := 'empresa';
  ELSE
    RAISE EXCEPTION 'Tipo de usuário não pode avaliar';
  END IF;

  RETURN NEW;
END;
$$;
