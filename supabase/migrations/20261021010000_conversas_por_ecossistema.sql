-- Etapa 5: mensageiro 1:1 por bloco + RLS ADM 2/4 + abas de cidade (mensagens_canal.pais).

ALTER TABLE public.financeiro_conversas
  ADD COLUMN IF NOT EXISTS ecossistema_id uuid REFERENCES public.ecossistemas (id) ON DELETE RESTRICT;

ALTER TABLE public.ecossistema_conversas
  ADD COLUMN IF NOT EXISTS ecossistema_id uuid REFERENCES public.ecossistemas (id) ON DELETE RESTRICT;

UPDATE public.financeiro_conversas f
SET ecossistema_id = e.id
FROM public.ecossistemas e
WHERE f.ecossistema_id IS NULL
  AND e.padrao IS TRUE;

UPDATE public.ecossistema_conversas c
SET ecossistema_id = e.id
FROM public.ecossistemas e
WHERE c.ecossistema_id IS NULL
  AND e.padrao IS TRUE;

UPDATE public.financeiro_conversas
SET ecossistema_id = (
  SELECT id FROM public.ecossistemas ORDER BY padrao DESC, ordem ASC, nome ASC LIMIT 1
)
WHERE ecossistema_id IS NULL;

UPDATE public.ecossistema_conversas
SET ecossistema_id = (
  SELECT id FROM public.ecossistemas ORDER BY padrao DESC, ordem ASC, nome ASC LIMIT 1
)
WHERE ecossistema_id IS NULL;

ALTER TABLE public.financeiro_conversas
  ALTER COLUMN ecossistema_id SET NOT NULL;

ALTER TABLE public.ecossistema_conversas
  ALTER COLUMN ecossistema_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_conversas_eco
  ON public.financeiro_conversas (ecossistema_id, status);

CREATE INDEX IF NOT EXISTS idx_ecossistema_conversas_eco
  ON public.ecossistema_conversas (ecossistema_id, status);

DROP INDEX IF EXISTS idx_financeiro_conversas_aberta_par;
CREATE UNIQUE INDEX idx_financeiro_conversas_aberta_par
  ON public.financeiro_conversas (adm_usuario_id, alvo_usuario_id, ecossistema_id)
  WHERE status = 'aberta';

DROP INDEX IF EXISTS idx_ecossistema_conversa_aberta_membro;
CREATE UNIQUE INDEX idx_ecossistema_conversa_aberta_membro
  ON public.ecossistema_conversas (membro_usuario_id, ecossistema_id)
  WHERE status = 'aberta';

COMMENT ON COLUMN public.financeiro_conversas.ecossistema_id IS
  'Bloco do mensageiro 1:1 ADM ↔ profissional/empresa.';
COMMENT ON COLUMN public.ecossistema_conversas.ecossistema_id IS
  'Bloco do Mensageiro ECOSSISTEMA (um chat aberto por membro por bloco).';

-- CHECK legado só aceitava geral/BR/AR/PY; abas passam a usar cidade_chave.
ALTER TABLE public.mensagens_canal
DROP CONSTRAINT IF EXISTS mensagens_canal_pais_check;

-- País legado (BR/AR/PY) → cidade_chave do bloco (região). Cidade avulsa → geral.
UPDATE public.mensagens_canal m
SET pais = cid.cidade_chave
FROM public.canais ch
JOIN public.ecossistemas e ON e.id = ch.ecossistema_id
JOIN public.ecossistema_cidades cid ON cid.ecossistema_id = e.id
WHERE m.canal_id = ch.id
  AND e.tipo = 'regiao'
  AND upper(btrim(COALESCE(m.pais, ''))) IN ('BR', 'AR', 'PY')
  AND upper(btrim(COALESCE(cid.pais, ''))) = upper(btrim(m.pais))
  AND (
    SELECT count(*) FROM public.ecossistema_cidades x
    WHERE x.ecossistema_id = e.id
      AND upper(btrim(COALESCE(x.pais, ''))) = upper(btrim(m.pais))
  ) = 1;

UPDATE public.mensagens_canal m
SET pais = (
  SELECT cid.cidade_chave
  FROM public.canais ch
  JOIN public.ecossistemas e ON e.id = ch.ecossistema_id
  JOIN public.ecossistema_cidades cid ON cid.ecossistema_id = e.id
  WHERE ch.id = m.canal_id
    AND e.tipo = 'regiao'
    AND upper(btrim(COALESCE(cid.pais, ''))) = upper(btrim(m.pais))
  ORDER BY cid.cidade_chave
  LIMIT 1
)
WHERE upper(btrim(COALESCE(m.pais, ''))) IN ('BR', 'AR', 'PY')
  AND EXISTS (
    SELECT 1
    FROM public.canais ch
    JOIN public.ecossistemas e ON e.id = ch.ecossistema_id
    WHERE ch.id = m.canal_id
      AND e.tipo = 'regiao'
  );

UPDATE public.mensagens_canal m
SET pais = 'geral'
FROM public.canais ch
JOIN public.ecossistemas e ON e.id = ch.ecossistema_id
WHERE m.canal_id = ch.id
  AND e.tipo = 'cidade'
  AND upper(btrim(COALESCE(m.pais, ''))) IN ('BR', 'AR', 'PY');

ALTER TABLE public.mensagens_canal
ADD CONSTRAINT mensagens_canal_pais_check CHECK (
  pais IS NOT NULL
  AND char_length(btrim(pais)) BETWEEN 2 AND 80
);

COMMENT ON COLUMN public.mensagens_canal.pais IS
  'Aba do mensageiro coletivo: geral (Todos) ou cidade_chave do bloco. BR/AR/PY legado permanece válido.';

CREATE OR REPLACE FUNCTION public.admin_acessa_ecossistema(p_eco uuid)
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
      AND (
        COALESCE(u.admin_level, 0) NOT IN (2, 4)
        OR u.ecossistema_id IS NULL
        OR u.ecossistema_id = p_eco
      )
  );
$$;

COMMENT ON FUNCTION public.admin_acessa_ecossistema(uuid) IS
  'ADM 1/3 vê todos os blocos; 2/4 só o vínculo fixo.';

GRANT EXECUTE ON FUNCTION public.admin_acessa_ecossistema(uuid) TO authenticated;

DROP POLICY IF EXISTS ecossistema_conversas_select ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_select ON public.ecossistema_conversas FOR SELECT TO authenticated
USING (
  membro_usuario_id = (SELECT auth.uid())
  OR public.admin_acessa_ecossistema(ecossistema_id)
);

DROP POLICY IF EXISTS ecossistema_conversas_update ON public.ecossistema_conversas;
CREATE POLICY ecossistema_conversas_update ON public.ecossistema_conversas FOR UPDATE TO authenticated
USING (
  membro_usuario_id = (SELECT auth.uid())
  OR public.admin_acessa_ecossistema(ecossistema_id)
)
WITH CHECK (
  membro_usuario_id = (SELECT auth.uid())
  OR public.admin_acessa_ecossistema(ecossistema_id)
);

DROP POLICY IF EXISTS "financeiro_conversas admin" ON public.financeiro_conversas;
CREATE POLICY "financeiro_conversas admin" ON public.financeiro_conversas FOR ALL
USING (public.admin_acessa_ecossistema(ecossistema_id))
WITH CHECK (public.admin_acessa_ecossistema(ecossistema_id));

DROP FUNCTION IF EXISTS public.contar_ecossistema_nao_lidas_adm(TIMESTAMPTZ);
CREATE FUNCTION public.contar_ecossistema_nao_lidas_adm(
  p_visto_em TIMESTAMPTZ DEFAULT NULL,
  p_ecossistema_id UUID DEFAULT NULL
)
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
    AND u.role IN ('turista', 'profissional', 'empresa')
    AND (p_ecossistema_id IS NULL OR c.ecossistema_id = p_ecossistema_id)
    AND public.admin_acessa_ecossistema(c.ecossistema_id);

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contar_ecossistema_nao_lidas_adm(TIMESTAMPTZ, UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.contar_ecossistema_nao_lidas_membro(UUID);
CREATE FUNCTION public.contar_ecossistema_nao_lidas_membro(
  p_membro_id UUID,
  p_ecossistema_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_visto TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF v_uid IS NULL OR p_membro_id IS NULL THEN
    RETURN 0;
  END IF;
  IF v_uid <> p_membro_id AND NOT public.is_admin() THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(MAX(l.visto_em), '-infinity'::timestamptz) INTO v_visto
  FROM public.ecossistema_conversa_leitura l
  INNER JOIN public.ecossistema_conversas c ON c.id = l.conversa_id
  WHERE l.usuario_id = p_membro_id
    AND c.membro_usuario_id = p_membro_id
    AND (p_ecossistema_id IS NULL OR c.ecossistema_id = p_ecossistema_id);

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.ecossistema_mensagens m
  INNER JOIN public.ecossistema_conversas c ON c.id = m.conversa_id
  INNER JOIN public.usuarios u ON u.id = m.remetente_id
  WHERE c.membro_usuario_id = p_membro_id
    AND c.status = 'aberta'
    AND (p_ecossistema_id IS NULL OR c.ecossistema_id = p_ecossistema_id)
    AND m.created_at > COALESCE(v_visto, '-infinity'::timestamptz)
    AND m.remetente_id <> p_membro_id
    AND u.role = 'admin';

  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contar_ecossistema_nao_lidas_membro(UUID, UUID) TO authenticated;
