-- Impede que o próprio profissional altere campos de aprovação/verificação via client.
-- Liberação continua apenas pelo ADM (API service role / policy admin).

CREATE OR REPLACE FUNCTION public.profissionais_bloquear_self_verificacao ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_eh_admin BOOLEAN;
BEGIN
  IF auth.uid () IS NULL OR auth.uid () IS DISTINCT FROM NEW.usuario_id THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid () AND u.role = 'admin'
  ) INTO v_eh_admin;

  IF v_eh_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.docs_verificado IS DISTINCT FROM OLD.docs_verificado THEN
    NEW.docs_verificado := OLD.docs_verificado;
    NEW.docs_verificado_por := OLD.docs_verificado_por;
    NEW.docs_verificado_em := OLD.docs_verificado_em;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND lower(trim(NEW.status)) = 'aprovado' THEN
    NEW.status := OLD.status;
    NEW.aprovado_por := OLD.aprovado_por;
    NEW.aprovado_em := OLD.aprovado_em;
  END IF;

  IF NEW.proxima_revisao_docs_em IS DISTINCT FROM OLD.proxima_revisao_docs_em THEN
    NEW.proxima_revisao_docs_em := OLD.proxima_revisao_docs_em;
  END IF;

  IF NEW.ultima_revisao_docs_em IS DISTINCT FROM OLD.ultima_revisao_docs_em THEN
    NEW.ultima_revisao_docs_em := OLD.ultima_revisao_docs_em;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profissionais_bloquear_self_verificacao () IS
  'BEFORE UPDATE: profissional não pode auto-aprovar (docs_verificado, status aprovado, prazos de revisão).';

DROP TRIGGER IF EXISTS trg_profissionais_bloquear_self_verificacao ON public.profissionais;

CREATE TRIGGER trg_profissionais_bloquear_self_verificacao
  BEFORE UPDATE ON public.profissionais
  FOR EACH ROW
  EXECUTE FUNCTION public.profissionais_bloquear_self_verificacao ();
