-- Favoritos: policies SELECT (próprios + seguidores) + trigger sem empresa_id.
-- Cole isto no SQL Editor se a página /favoritos vier vazia com estrela marcada.

ALTER TABLE public.favoritos ADD COLUMN IF NOT EXISTS alvo_id UUID;
ALTER TABLE public.favoritos ADD COLUMN IF NOT EXISTS alvo_tipo TEXT;

-- Garante leitura dos PRÓPRIOS favoritos (empresa, acomodacao, produto, ticket)
DROP POLICY IF EXISTS "Usuários podem ver seus próprios favoritos" ON public.favoritos;
CREATE POLICY "Usuários podem ver seus próprios favoritos" ON public.favoritos
FOR SELECT
USING (auth.role () = 'authenticated' AND usuario_id = auth.uid ());

DROP POLICY IF EXISTS "Autenticados veem favoritos de empresas para seguidores" ON public.favoritos;
CREATE POLICY "Autenticados veem favoritos de empresas para seguidores" ON public.favoritos
FOR SELECT
USING (
  auth.role () = 'authenticated'
  AND COALESCE(alvo_tipo, '') = 'empresa'
  AND alvo_id IS NOT NULL
);

DROP POLICY IF EXISTS "Usuários podem criar favoritos" ON public.favoritos;
CREATE POLICY "Usuários podem criar favoritos" ON public.favoritos
FOR INSERT
WITH CHECK (
  auth.role () = 'authenticated'
  AND usuario_id = auth.uid ()
  AND alvo_id IS NOT NULL
  AND alvo_tipo IN ('empresa', 'acomodacao', 'produto', 'ticket')
);

DROP POLICY IF EXISTS "Usuários podem deletar seus próprios favoritos" ON public.favoritos;
CREATE POLICY "Usuários podem deletar seus próprios favoritos" ON public.favoritos
FOR DELETE
USING (usuario_id = auth.uid ());

CREATE UNIQUE INDEX IF NOT EXISTS idx_favoritos_usuario_alvo_unique
ON public.favoritos (usuario_id, alvo_tipo, alvo_id)
WHERE alvo_id IS NOT NULL AND alvo_tipo IS NOT NULL;

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
      UPDATE public.empresas
      SET total_seguidores = COALESCE(total_seguidores, 0) + 1
      WHERE id = eid;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF COALESCE(OLD.alvo_tipo, '') = 'empresa' AND OLD.alvo_id IS NOT NULL THEN
      eid := OLD.alvo_id;
      UPDATE public.empresas
      SET total_seguidores = GREATEST(0, COALESCE(total_seguidores, 0) - 1)
      WHERE id = eid;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_seguidores ON public.favoritos;
CREATE TRIGGER trigger_atualizar_seguidores
AFTER INSERT OR DELETE ON public.favoritos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_total_seguidores ();

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

DROP TRIGGER IF EXISTS trg_atividades_favorito_empresa ON public.favoritos;
