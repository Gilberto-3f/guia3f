-- Janela de 48h para turistas (status ativo provisório) + flag de validação ADM permanente.
-- Empresas já publicadas sem status explícito passam a 'aprovado' para continuar no Guia.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS documentacao_validada_adm BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS turista_janela_48h_inicio TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.usuarios.documentacao_validada_adm IS
  'TRUE quando o ADM aprovou documentação do turista; mantém ativo após expirar janela de 48h.';

COMMENT ON COLUMN public.usuarios.turista_janela_48h_inicio IS
  'Início da janela de acesso pleno (48h) para novo turista; usado com status ativo + documentacao_validada_adm=false.';

-- Turistas já ativos antes desta migração: considerar validados (não rebaixar após 48h).
UPDATE public.usuarios
SET
  documentacao_validada_adm = TRUE
WHERE
  role = 'turista'
  AND COALESCE(status, '') = 'ativo';

-- Empresas legadas sem status: publicadas no Guia.
UPDATE public.empresas
SET
  status = 'aprovado'
WHERE
  status IS NULL;

-- Rebaixa turistas que ficaram "ativo" só pela janela e já passaram 48h sem validação ADM.
CREATE OR REPLACE FUNCTION public.expirar_acesso_turista_48h ()
  RETURNS INTEGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE public.usuarios u
  SET
    status = 'pre_aprovado'
  WHERE
    u.role = 'turista'
    AND COALESCE(u.status, '') = 'ativo'
    AND COALESCE(u.documentacao_validada_adm, FALSE) = FALSE
    AND u.turista_janela_48h_inicio IS NOT NULL
    AND u.turista_janela_48h_inicio <= (NOW() - INTERVAL '48 hours');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.expirar_acesso_turista_48h () IS
  'Agendamento diário sugerido: rebaixa turistas em janela de 48h não validados pelo ADM. Retorna linhas afetadas.';

REVOKE ALL ON FUNCTION public.expirar_acesso_turista_48h () FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.expirar_acesso_turista_48h () TO service_role;
