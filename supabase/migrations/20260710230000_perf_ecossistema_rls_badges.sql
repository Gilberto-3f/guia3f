-- Mitiga 57014/503 em ecossistema + lookups de usuarios sob carga.
-- Sintoma observado: statement timeout → API Gateway 503 → Auth 504 / Storage 544.

-- Helper STABLE: evita reavaliar EXISTS em usuarios a cada linha (RLS).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'RLS helper: true se auth.uid() é admin (SECURITY DEFINER, STABLE).';

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Índice alinhado ao badge: conversa_id + created_at + filtro remetente
CREATE INDEX IF NOT EXISTS idx_ecossistema_mensagens_conversa_created_remetente
  ON public.ecossistema_mensagens (conversa_id, created_at DESC, remetente_id);

-- Políticas ecossistema: (select auth.uid()) + is_admin() (initplan + menos scans)
DROP POLICY IF EXISTS ecossistema_conversas_select ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_select ON public.ecossistema_conversas FOR SELECT TO authenticated
USING (
  membro_usuario_id = (SELECT auth.uid())
  OR public.is_admin()
);

DROP POLICY IF EXISTS ecossistema_conversas_update ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_update ON public.ecossistema_conversas FOR UPDATE TO authenticated
USING (
  membro_usuario_id = (SELECT auth.uid())
  OR public.is_admin()
)
WITH CHECK (
  membro_usuario_id = (SELECT auth.uid())
  OR public.is_admin()
);

DROP POLICY IF EXISTS ecossistema_mensagens_select ON public.ecossistema_mensagens;
CREATE POLICY ecossistema_mensagens_select ON public.ecossistema_mensagens FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ecossistema_conversas c
    WHERE c.id = conversa_id
      AND (
        c.membro_usuario_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  )
);

DROP POLICY IF EXISTS ecossistema_mensagens_insert ON public.ecossistema_mensagens;
CREATE POLICY ecossistema_mensagens_insert ON public.ecossistema_mensagens FOR INSERT TO authenticated
WITH CHECK (
  remetente_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.ecossistema_conversas c
    WHERE c.id = conversa_id
      AND c.status = 'aberta'
      AND (
        c.membro_usuario_id = (SELECT auth.uid())
        OR public.is_admin()
      )
  )
);

-- Badge ADM: conta no servidor (evita puxar todas as mensagens + round-trip usuarios)
CREATE OR REPLACE FUNCTION public.contar_ecossistema_nao_lidas_adm(p_visto_em TIMESTAMPTZ DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_desde TIMESTAMPTZ := COALESCE(p_visto_em, '-infinity'::timestamptz);
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.ecossistema_mensagens m
  INNER JOIN public.ecossistema_conversas c ON c.id = m.conversa_id
  INNER JOIN public.usuarios u ON u.id = m.remetente_id
  WHERE c.status = 'aberta'
    AND m.created_at > v_desde
    AND m.remetente_id <> v_uid
    AND u.role IN ('turista', 'profissional', 'empresa');

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.contar_ecossistema_nao_lidas_adm(TIMESTAMPTZ) IS
  'Badge Mensageiro ECOSSISTEMA (ADM): mensagens de membros após visto_em.';

GRANT EXECUTE ON FUNCTION public.contar_ecossistema_nao_lidas_adm(TIMESTAMPTZ) TO authenticated;

-- Badge membro: mensagens de ADM após última leitura
CREATE OR REPLACE FUNCTION public.contar_ecossistema_nao_lidas_membro(p_membro_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_conversa UUID;
  v_visto TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL OR p_membro_id IS NULL THEN
    RETURN 0;
  END IF;
  IF v_uid <> p_membro_id AND NOT public.is_admin() THEN
    RETURN 0;
  END IF;

  SELECT c.id INTO v_conversa
  FROM public.ecossistema_conversas c
  WHERE c.membro_usuario_id = p_membro_id
    AND c.status = 'aberta'
  LIMIT 1;

  IF v_conversa IS NULL THEN
    RETURN 0;
  END IF;

  SELECT l.visto_em INTO v_visto
  FROM public.ecossistema_conversa_leitura l
  WHERE l.usuario_id = p_membro_id
    AND l.conversa_id = v_conversa;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.ecossistema_mensagens m
  INNER JOIN public.usuarios u ON u.id = m.remetente_id
  WHERE m.conversa_id = v_conversa
    AND m.remetente_id <> p_membro_id
    AND m.created_at > COALESCE(v_visto, '-infinity'::timestamptz)
    AND u.role = 'admin';

  RETURN COALESCE(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.contar_ecossistema_nao_lidas_membro(UUID) IS
  'Badge chat ADM (membro): mensagens de admin após última leitura.';

GRANT EXECUTE ON FUNCTION public.contar_ecossistema_nao_lidas_membro(UUID) TO authenticated;
