-- Notifica, em Minha Conta, cada usuário marcado na publicação de um story.

CREATE OR REPLACE FUNCTION public.trg_atividade_marcacao_story ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marcado_id UUID;
  v_autor_username TEXT;
BEGIN
  IF NEW.autor_id IS NULL OR jsonb_typeof(NEW.marcacoes) <> 'array' THEN
    RETURN NEW;
  END IF;

  IF jsonb_array_length(NEW.marcacoes) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(p.username), ''), 'usuario') INTO v_autor_username
  FROM public.perfis_para_busca p
  WHERE p.usuario_id = NEW.autor_id
  LIMIT 1;

  v_autor_username := COALESCE(v_autor_username, 'usuario');

  FOR v_marcado_id IN
    SELECT DISTINCT (m.item ->> 'usuario_id')::UUID
    FROM jsonb_array_elements(NEW.marcacoes) AS m(item)
    WHERE
      COALESCE(m.item ->> 'usuario_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND (m.item ->> 'usuario_id')::UUID <> NEW.autor_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.usuarios u
      WHERE u.id = v_marcado_id
    ) THEN
      CONTINUE;
    END IF;

    IF public.deve_bloquear_atividade_entre_empresas (v_marcado_id, NEW.autor_id) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.atividades (
      usuario_id,
      autor_id,
      tipo,
      alvo_id,
      alvo_tipo,
      dados_extras,
      created_at
    )
    VALUES (
      v_marcado_id,
      NEW.autor_id,
      'marcou_em_story',
      NEW.id,
      'story',
      jsonb_build_object(
        'story_id', NEW.id::TEXT,
        'autor_id', NEW.autor_id::TEXT,
        'autor_username', v_autor_username,
        'autor_tipo', NEW.autor_tipo,
        'conteudo_url', NEW.conteudo_url,
        'expira_em', NEW.expira_em
      ),
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_atividade_marcacao_story () IS
  'Após INSERT de story, cria uma atividade Minha Conta para cada usuário marcado.';

DROP TRIGGER IF EXISTS trg_atividades_marcacao_story ON public.stories;

CREATE TRIGGER trg_atividades_marcacao_story
AFTER INSERT ON public.stories FOR EACH ROW
WHEN (NEW.marcacoes IS NOT NULL)
EXECUTE FUNCTION public.trg_atividade_marcacao_story ();

-- Inclui stories ainda ativos publicados antes desta correção, sem duplicar atividades.
WITH marcacoes_ativas AS (
  SELECT DISTINCT
    s.id AS story_id,
    s.autor_id,
    s.autor_tipo,
    s.conteudo_url,
    s.expira_em,
    (m.item ->> 'usuario_id')::UUID AS marcado_id
  FROM public.stories s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(s.marcacoes) = 'array' THEN s.marcacoes
      ELSE '[]'::JSONB
    END
  ) AS m(item)
  WHERE
    s.expira_em > NOW()
    AND jsonb_typeof(s.marcacoes) = 'array'
    AND COALESCE(m.item ->> 'usuario_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND (m.item ->> 'usuario_id')::UUID <> s.autor_id
)
INSERT INTO public.atividades (
  usuario_id,
  autor_id,
  tipo,
  alvo_id,
  alvo_tipo,
  dados_extras,
  created_at
)
SELECT
  ma.marcado_id,
  ma.autor_id,
  'marcou_em_story',
  ma.story_id,
  'story',
  jsonb_build_object(
    'story_id', ma.story_id::TEXT,
    'autor_id', ma.autor_id::TEXT,
    'autor_username',
      COALESCE(
        (
          SELECT NULLIF(TRIM(p.username), '')
          FROM public.perfis_para_busca p
          WHERE p.usuario_id = ma.autor_id
          LIMIT 1
        ),
        'usuario'
      ),
    'autor_tipo', ma.autor_tipo,
    'conteudo_url', ma.conteudo_url,
    'expira_em', ma.expira_em
  ),
  NOW()
FROM marcacoes_ativas ma
JOIN public.usuarios u ON u.id = ma.marcado_id
WHERE
  NOT public.deve_bloquear_atividade_entre_empresas (ma.marcado_id, ma.autor_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.atividades a
    WHERE
      a.tipo = 'marcou_em_story'
      AND a.usuario_id = ma.marcado_id
      AND (
        a.alvo_id = ma.story_id
        OR (a.dados_extras ->> 'story_id') = ma.story_id::TEXT
      )
  );

CREATE OR REPLACE FUNCTION public.trg_atividade_limpar_marcacao_story ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.atividades
  WHERE
    tipo = 'marcou_em_story'
    AND (
      alvo_id = OLD.id
      OR (dados_extras ->> 'story_id') = OLD.id::TEXT
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_atividades_limpar_marcacao_story ON public.stories;

CREATE TRIGGER trg_atividades_limpar_marcacao_story
AFTER DELETE ON public.stories FOR EACH ROW
EXECUTE FUNCTION public.trg_atividade_limpar_marcacao_story ();
