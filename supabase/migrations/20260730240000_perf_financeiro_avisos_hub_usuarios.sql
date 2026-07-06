-- Performance: evita timeout 57014 / 503 em financeiro_avisos_adm_hub e carga em usuarios

-- Índices para leitura ordenada e filtros por arrays
CREATE INDEX IF NOT EXISTS idx_financeiro_avisos_adm_hub_lido_por
  ON public.financeiro_avisos_adm_hub USING GIN (lido_por);

CREATE INDEX IF NOT EXISTS idx_financeiro_avisos_adm_hub_visivel_para
  ON public.financeiro_avisos_adm_hub USING GIN (visivel_para);

-- created_at DESC já existe (idx_financeiro_avisos_adm_hub_created); reforço idempotente
CREATE INDEX IF NOT EXISTS idx_financeiro_avisos_adm_hub_created_at
  ON public.financeiro_avisos_adm_hub (created_at DESC);

-- usuarios: políticas RLS e lookups por role/admin
CREATE INDEX IF NOT EXISTS idx_usuarios_role
  ON public.usuarios (role);

CREATE INDEX IF NOT EXISTS idx_usuarios_admin_level
  ON public.usuarios (admin_level)
  WHERE admin_level IS NOT NULL;

-- Contagem de não lidos em uma única query (evita SELECT+RLS linha a linha no cliente)
CREATE OR REPLACE FUNCTION public.contar_financeiro_avisos_hub_nao_lidos(p_limite INTEGER DEFAULT 50)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_nivel INTEGER;
  v_cargo TEXT;
  v_lim INTEGER := GREATEST(1, LEAST(COALESCE(p_limite, 50), 80));
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(u.admin_level, 0), COALESCE(u.admin_permissoes ->> 'cargo', '')
  INTO v_nivel, v_cargo
  FROM public.usuarios u
  WHERE u.id = v_uid;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF NOT (v_nivel = 1 OR v_nivel = 3 OR v_cargo = 'FINANCEIRO') THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM (
    SELECT a.lido_por, a.visivel_para
    FROM public.financeiro_avisos_adm_hub a
    ORDER BY a.created_at DESC
    LIMIT v_lim
  ) recentes
  WHERE (
    (v_nivel = 1 AND 'adm_geral' = ANY (recentes.visivel_para))
    OR (
      (v_nivel = 3 OR v_cargo = 'FINANCEIRO')
      AND 'adm_financeiro' = ANY (recentes.visivel_para)
    )
  )
  AND NOT v_uid = ANY (recentes.lido_por);

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.contar_financeiro_avisos_hub_nao_lidos(INTEGER) IS
  'Badge Canal Financeiro ADM: conta avisos não lidos nos últimos N cards (sem varrer tabela via RLS no cliente).';

GRANT EXECUTE ON FUNCTION public.contar_financeiro_avisos_hub_nao_lidos(INTEGER) TO authenticated;
