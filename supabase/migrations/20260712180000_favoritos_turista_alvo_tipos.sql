-- Favoritos do turista: tipos polimórficos (empresa, acomodacao, produto, ticket).
-- Schema remoto já usa alvo_id / alvo_tipo (sem empresa_id / produto_id).

ALTER TABLE public.favoritos
  ADD COLUMN IF NOT EXISTS alvo_id UUID,
  ADD COLUMN IF NOT EXISTS alvo_tipo TEXT;

-- Normaliza tipos legados vazios (só empresa, se houver alvo_id sem tipo).
UPDATE public.favoritos
SET
  alvo_tipo = 'empresa'
WHERE
  alvo_id IS NOT NULL
  AND (alvo_tipo IS NULL OR TRIM(alvo_tipo) = '');

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
    AND alvo_id IS NOT NULL
    AND alvo_tipo IN ('empresa', 'acomodacao', 'produto', 'ticket')
  );

CREATE OR REPLACE FUNCTION public.atualizar_total_seguidores ()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  eid UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.alvo_tipo, '') = 'empresa' AND NEW.alvo_id IS NOT NULL THEN
      eid := NEW.alvo_id;
      UPDATE empresas
      SET
        total_seguidores = total_seguidores + 1
      WHERE
        id = eid;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.alvo_tipo, '') = 'empresa' AND OLD.alvo_id IS NOT NULL THEN
      eid := OLD.alvo_id;
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
