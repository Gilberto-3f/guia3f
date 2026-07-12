-- Favoritos do turista: tipos polimórficos (empresa, acomodacao, produto, ticket).
ALTER TABLE public.favoritos
  ADD COLUMN IF NOT EXISTS alvo_id UUID,
  ADD COLUMN IF NOT EXISTS alvo_tipo TEXT;

UPDATE public.favoritos
SET
  alvo_id = COALESCE(alvo_id, empresa_id, produto_id),
  alvo_tipo = CASE
    WHEN COALESCE(alvo_tipo, '') <> '' THEN alvo_tipo
    WHEN empresa_id IS NOT NULL THEN 'empresa'
    WHEN produto_id IS NOT NULL THEN 'produto'
    ELSE alvo_tipo
  END
WHERE
  alvo_id IS NULL
  OR COALESCE(alvo_tipo, '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_favoritos_usuario_alvo_unique
ON public.favoritos (usuario_id, alvo_tipo, alvo_id)
WHERE
  alvo_id IS NOT NULL
  AND alvo_tipo IS NOT NULL;

DROP POLICY IF EXISTS "Usuários podem criar favoritos" ON public.favoritos;

CREATE POLICY "Usuários podem criar favoritos" ON public.favoritos FOR INSERT
WITH
  CHECK (
    auth.role () = 'authenticated'
    AND usuario_id = auth.uid ()
    AND (
      (
        alvo_id IS NOT NULL
        AND alvo_tipo IN ('empresa', 'acomodacao', 'produto', 'ticket')
      )
      OR (
        empresa_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM empresas
          WHERE
            id = empresa_id
        )
      )
      OR (
        produto_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM produtos
          WHERE
            id = produto_id
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.atualizar_total_seguidores ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  eid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    eid := COALESCE(
      NEW.empresa_id,
      CASE WHEN NEW.alvo_tipo = 'empresa' THEN NEW.alvo_id ELSE NULL END
    );
    IF eid IS NOT NULL THEN
      UPDATE empresas
      SET
        total_seguidores = total_seguidores + 1
      WHERE
        id = eid;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    eid := COALESCE(
      OLD.empresa_id,
      CASE WHEN OLD.alvo_tipo = 'empresa' THEN OLD.alvo_id ELSE NULL END
    );
    IF eid IS NOT NULL THEN
      UPDATE empresas
      SET
        total_seguidores = GREATEST(0, total_seguidores - 1)
      WHERE
        id = eid;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
