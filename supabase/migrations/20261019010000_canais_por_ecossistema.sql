-- Etapa 1: cada bloco de ecossistema tem a própria árvore de canais globais.
-- Canais existentes (sem empresa_id) ficam na Tríplice. Novos blocos nascem com a pasta vazia.
-- Abas cidade/país (região) continuam em mensagens_canal; não duplicam linhas em canais.

ALTER TABLE public.canais
  ADD COLUMN IF NOT EXISTS ecossistema_id uuid REFERENCES public.ecossistemas(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.canais.ecossistema_id IS
  'Bloco (cidade ou região) do canal global. Canais de empresa (empresa_id) podem ficar nulos até a etapa de vínculo.';

CREATE INDEX IF NOT EXISTS idx_canais_ecossistema_id
  ON public.canais (ecossistema_id);

-- Backfill: catálogo global atual pertence ao bloco padrão (Tríplice Fronteira).
UPDATE public.canais c
SET ecossistema_id = e.id
FROM (
  SELECT id
  FROM public.ecossistemas
  WHERE padrao IS TRUE
  ORDER BY created_at ASC
  LIMIT 1
) e
WHERE c.empresa_id IS NULL
  AND c.ecossistema_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.canais
    WHERE empresa_id IS NULL
      AND ecossistema_id IS NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM public.ecossistemas WHERE padrao IS TRUE
  ) THEN
    RAISE EXCEPTION
      'canais.ecossistema_id: nenhum ecossistema padrão para backfill';
  END IF;
END $$;

ALTER TABLE public.canais
  DROP CONSTRAINT IF EXISTS canais_global_exige_ecossistema;

ALTER TABLE public.canais
  ADD CONSTRAINT canais_global_exige_ecossistema
  CHECK (empresa_id IS NOT NULL OR ecossistema_id IS NOT NULL);

-- Produção ainda força um único canal global por (nome, tipo_publico)
-- (idx_canais_global_unique / canais_nome_tipo_publico_key). Sem dropar,
-- o seed do 2.º bloco estoura 23505 ao inserir "Mensageiro ECOSSISTEMA".
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
      AND (
        c.relname IN (
          'idx_canais_global_unique',
          'canais_unique_global_nome_tipo',
          'canais_nome_tipo_publico_key'
        )
        OR (
          pg_get_indexdef(i.indexrelid) ~* '\(nome,\s*tipo_publico\)'
          AND pg_get_indexdef(i.indexrelid) !~* 'ecossistema_id'
        )
      )
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
    INSERT INTO public.canais (
      nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
    ) VALUES (
      'Mensageiro ECOSSISTEMA', 'admin', 'admin', 'geral', 'fixo', 1, TRUE, NULL, NULL, p_ecossistema_id
    )
    ON CONFLICT (nome, tipo_publico, ecossistema_id)
      WHERE empresa_id IS NULL AND comunidade_prof IS NULL
    DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'profissional'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'ADM'
  ) THEN
    INSERT INTO public.canais (
      nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
    ) VALUES (
      'ADM', 'profissional', 'admin', 'geral', 'fixo', 1, TRUE, NULL, NULL, p_ecossistema_id
    )
    ON CONFLICT (nome, tipo_publico, ecossistema_id)
      WHERE empresa_id IS NULL AND comunidade_prof IS NULL
    DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'profissional'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'FINANCEIRO'
  ) THEN
    INSERT INTO public.canais (
      nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
    ) VALUES (
      'Financeiro', 'profissional', NULL, 'geral', 'fixo', 2, TRUE, NULL, NULL, p_ecossistema_id
    )
    ON CONFLICT (nome, tipo_publico, ecossistema_id)
      WHERE empresa_id IS NULL AND comunidade_prof IS NULL
    DO NOTHING;
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
      INSERT INTO public.canais (
        nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
      ) VALUES (
        r.nome, 'profissional', r.categoria, 'geral', 'fixo', r.pos, TRUE, NULL, NULL, p_ecossistema_id
      )
      ON CONFLICT (nome, tipo_publico, ecossistema_id)
        WHERE empresa_id IS NULL AND comunidade_prof IS NULL
      DO NOTHING;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'empresa'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'ADM'
  ) THEN
    INSERT INTO public.canais (
      nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
    ) VALUES (
      'ADM', 'empresa', NULL, 'geral', 'fixo', 1, TRUE, NULL, NULL, p_ecossistema_id
    )
    ON CONFLICT (nome, tipo_publico, ecossistema_id)
      WHERE empresa_id IS NULL AND comunidade_prof IS NULL
    DO NOTHING;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canais c
    WHERE c.ecossistema_id = p_ecossistema_id
      AND c.tipo_publico = 'empresa'
      AND c.empresa_id IS NULL
      AND upper(btrim(c.nome)) = 'FINANCEIRO'
  ) THEN
    INSERT INTO public.canais (
      nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
    ) VALUES (
      'Financeiro', 'empresa', NULL, 'geral', 'fixo', 2, TRUE, NULL, NULL, p_ecossistema_id
    )
    ON CONFLICT (nome, tipo_publico, ecossistema_id)
      WHERE empresa_id IS NULL AND comunidade_prof IS NULL
    DO NOTHING;
  END IF;

  -- 4 segmentos globais atuais (Hospedagem empresa foi retirada; anfitrião cobre dual mode).
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
      INSERT INTO public.canais (
        nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof, ecossistema_id
      ) VALUES (
        r.nome, 'empresa', r.categoria, 'geral', r.ordem_tipo, r.pos, TRUE, NULL, NULL, p_ecossistema_id
      )
      ON CONFLICT (nome, tipo_publico, ecossistema_id)
        WHERE empresa_id IS NULL AND comunidade_prof IS NULL
      DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.garantir_canais_ecossistema (uuid) IS
  'Cria a árvore de canais globais do bloco (ADM, Financeiro, 5 comunidades, segmentos empresa). Idempotente.';

REVOKE ALL ON FUNCTION public.garantir_canais_ecossistema (uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garantir_canais_ecossistema (uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_ecossistemas_seed_canais ()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.garantir_canais_ecossistema(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ecossistemas_seed_canais ON public.ecossistemas;
CREATE TRIGGER trg_ecossistemas_seed_canais
AFTER INSERT ON public.ecossistemas
FOR EACH ROW
EXECUTE FUNCTION public.trg_ecossistemas_seed_canais();

-- Blocos já cadastrados (ex.: Londrina) recebem a árvore vazia agora.
SELECT public.garantir_canais_ecossistema(id)
FROM public.ecossistemas;
