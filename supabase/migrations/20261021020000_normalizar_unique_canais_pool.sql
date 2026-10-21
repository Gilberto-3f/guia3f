-- Normaliza 23505 (idx_canais_global_unique) + 57014/503 em cascata na home.
--
-- 23505: unique legado (nome, tipo_publico) impede clonar a árvore por bloco.
-- 57014 → API Gateway 503 → Auth 504 / Realtime pool down: uma query segura o
-- pool e lookups simples (profissionais, anuncios, degustações) caem juntos.

-- ========== 1) Unique de canais globais por bloco ==========
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.relname AS index_name
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index i ON i.indrelid = t.oid
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'canais'
      AND i.indisunique
      AND NOT i.indisprimary
      AND pg_get_indexdef(i.indexrelid) ~* 'nome'
      AND pg_get_indexdef(i.indexrelid) ~* 'tipo_publico'
      AND pg_get_indexdef(i.indexrelid) !~* 'ecossistema_id'
  LOOP
    EXECUTE format('ALTER TABLE public.canais DROP CONSTRAINT IF EXISTS %I', rec.index_name);
    EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.index_name);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.idx_canais_global_unique;
DROP INDEX IF EXISTS public.canais_unique_global_nome_tipo;
ALTER TABLE public.canais DROP CONSTRAINT IF EXISTS idx_canais_global_unique;
ALTER TABLE public.canais DROP CONSTRAINT IF EXISTS canais_nome_tipo_publico_key;

CREATE UNIQUE INDEX canais_unique_global_nome_tipo
  ON public.canais (nome, tipo_publico, ecossistema_id)
  WHERE empresa_id IS NULL AND comunidade_prof IS NULL;

CREATE OR REPLACE FUNCTION public.inserir_canal_global_ecossistema (
  p_eco uuid,
  p_nome text,
  p_tipo text,
  p_categoria text,
  p_ordem_tipo text,
  p_ordem int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.canais (
    nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo,
    empresa_id, comunidade_prof, ecossistema_id
  ) VALUES (
    p_nome, p_tipo, p_categoria, 'geral', p_ordem_tipo, p_ordem, TRUE,
    NULL, NULL, p_eco
  );
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.garantir_canais_ecossistema (p_ecossistema_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF p_ecossistema_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'admin'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) IN ('MENSAGEIRO ECOSSISTEMA', 'MENSAGEIRO ADM')
  ) THEN
    PERFORM public.inserir_canal_global_ecossistema(
      p_ecossistema_id, 'Mensageiro ECOSSISTEMA', 'admin', 'admin', 'fixo', 1
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'profissional'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'ADM'
  ) THEN
    PERFORM public.inserir_canal_global_ecossistema(
      p_ecossistema_id, 'ADM', 'profissional', 'admin', 'fixo', 1
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'profissional'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'FINANCEIRO'
  ) THEN
    PERFORM public.inserir_canal_global_ecossistema(
      p_ecossistema_id, 'Financeiro', 'profissional', NULL, 'fixo', 2
    );
  END IF;

  FOR r IN
    SELECT * FROM (
      VALUES
        ('Motoristas App'::text, 'motorista_app'::text, 3),
        ('Vans', 'van', 4),
        ('Táxis', 'taxista', 5),
        ('Guias', 'guia', 6),
        ('Anfitriões', 'anfitriao', 7)
    ) AS t(nome, categoria, pos)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.canais c
      WHERE c.ecossistema_id = p_ecossistema_id
        AND c.tipo_publico = 'profissional'
        AND c.empresa_id IS NULL
        AND lower(btrim(coalesce(c.categoria, ''))) = r.categoria
    ) THEN
      PERFORM public.inserir_canal_global_ecossistema(
        p_ecossistema_id, r.nome, 'profissional', r.categoria, 'fixo', r.pos
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'empresa'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'ADM'
  ) THEN
    PERFORM public.inserir_canal_global_ecossistema(
      p_ecossistema_id, 'ADM', 'empresa', NULL, 'fixo', 1
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'empresa'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'FINANCEIRO'
  ) THEN
    PERFORM public.inserir_canal_global_ecossistema(
      p_ecossistema_id, 'Financeiro', 'empresa', NULL, 'fixo', 2
    );
  END IF;

  FOR r IN
    SELECT * FROM (
      VALUES
        ('Gastronomia'::text, 'gastronomia'::text, 'fixo'::text, 3),
        ('Lojas', 'lojas', 'fixo', 4),
        ('Passeios', 'passeios', 'fixo', 5),
        ('Serviços Locais', 'servicos_locais', 'rotativo', NULL)
    ) AS t(nome, categoria, ordem_tipo, pos)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.canais c
      WHERE c.ecossistema_id = p_ecossistema_id
        AND c.tipo_publico = 'empresa'
        AND c.empresa_id IS NULL
        AND lower(btrim(coalesce(c.categoria, ''))) = r.categoria
    ) THEN
      PERFORM public.inserir_canal_global_ecossistema(
        p_ecossistema_id, r.nome, 'empresa', r.categoria, r.ordem_tipo, r.pos
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.inserir_canal_global_ecossistema (uuid, text, text, text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inserir_canal_global_ecossistema (uuid, text, text, text, text, int) TO service_role;

SELECT public.garantir_canais_ecossistema(id)
FROM public.ecossistemas;

-- ========== 2) Índices alinhados aos 503 da home ==========
CREATE INDEX IF NOT EXISTS idx_empresa_assinaturas_presenca
  ON public.empresa_assinaturas (empresa_id, vencimento_em DESC NULLS LAST)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_servicos_tabelados_origem_ativa
  ON public.servicos_tabelados_rotas (cidade_origem)
  WHERE ativo = TRUE;

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_turista_concluida
  ON public.solicitacao_mobilidade (turista_id, created_at DESC)
  WHERE status = 'concluida';

CREATE INDEX IF NOT EXISTS idx_solicitacao_mobilidade_pro_concluida
  ON public.solicitacao_mobilidade (profissional_id, created_at DESC)
  WHERE status = 'concluida';

-- ========== 3) RPC de presença: falha rápido, não segura o pool ==========
CREATE OR REPLACE FUNCTION public.empresa_assinaturas_presenca_publica (
  p_empresa_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  empresa_id UUID,
  plano_id UUID,
  status TEXT,
  vencimento_em TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
SET lock_timeout = '800ms'
SET statement_timeout = '1500ms'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (a.empresa_id)
    a.empresa_id,
    a.plano_id,
    a.status,
    a.vencimento_em
  FROM public.empresa_assinaturas a
  WHERE
    a.status = 'ativo'
    AND (
      a.vencimento_em IS NULL
      OR a.vencimento_em >= NOW()
    )
    AND (
      p_empresa_ids IS NULL
      OR cardinality(p_empresa_ids) = 0
      OR a.empresa_id = ANY (p_empresa_ids)
    )
  ORDER BY
    a.empresa_id,
    a.vencimento_em DESC NULLS LAST;
EXCEPTION
  WHEN lock_not_available THEN
    RETURN;
  WHEN query_canceled THEN
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.empresa_assinaturas_presenca_publica (UUID[]) TO service_role;

-- ========== 4) RLS de mensagens: initplan em auth.uid() ==========
CREATE OR REPLACE FUNCTION public.usuario_pode_ver_canal_mensagem(p_canal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM canais c
    WHERE c.id = p_canal_id
      AND COALESCE(c.ativo, TRUE) = TRUE
      AND (
        public.is_admin()
        OR (
          c.tipo_publico = 'turista'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = (SELECT auth.uid())
              AND u.role = 'turista'
          )
        )
        OR (
          c.tipo_publico = 'profissional'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = (SELECT auth.uid())
              AND u.role = 'profissional'
          )
        )
        OR (
          c.tipo_publico = 'empresa'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = (SELECT auth.uid())
              AND u.role = 'empresa'
              AND (
                c.empresa_id IS NULL
                OR EXISTS (
                  SELECT 1
                  FROM empresas e
                  WHERE e.id = c.empresa_id
                    AND e.usuario_id = (SELECT auth.uid())
                )
              )
          )
        )
        OR (
          c.tipo_publico = 'empresa'
          AND c.empresa_id IS NOT NULL
          AND c.comunidade_prof IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = (SELECT auth.uid())
              AND u.role = 'profissional'
              AND COALESCE(u.status, 'ativo') = 'ativo'
          )
          AND public.profissional_acessa_canal_empresa_comunidade((SELECT auth.uid()), c.comunidade_prof)
        )
        OR (
          c.tipo_publico = 'empresa'
          AND public.eh_canal_segmento_empresa_guia(c.nome)
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = (SELECT auth.uid())
              AND u.role = 'profissional'
          )
        )
        OR (
          c.tipo_publico = 'profissional'
          AND c.nome IN (
            'Motoristas App',
            'Vans',
            'Táxis',
            'Guias',
            'Anfitriões',
            'Motorista de App',
            'Van',
            'Taxistas',
            'Guia',
            'Anfitriao',
            'Anfitrião'
          )
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = (SELECT auth.uid())
              AND u.role = 'empresa'
          )
        )
        OR (
          c.tipo_publico = 'admin'
          AND public.is_admin()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.usuario_pode_ver_canal_mensagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.garantir_canais_ecossistema(uuid) TO service_role;
