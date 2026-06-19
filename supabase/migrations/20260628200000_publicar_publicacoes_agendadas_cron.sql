-- Publica publicações agendadas vencidas no servidor (feed + stories), sem depender do app aberto.

CREATE OR REPLACE FUNCTION public.texto_sobreposto_padrao_agendado (p_texto TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
SELECT
  jsonb_build_object(
    'texto',
    NULLIF(trim(COALESCE(p_texto, '')), ''),
    'posicao_x',
    50,
    'posicao_y',
    70,
    'link_posicao_x',
    50,
    'link_posicao_y',
    82,
    'fundo_fit',
    'contain',
    'fundo_scale',
    1,
    'fundo_pan_x_pct',
    0,
    'fundo_pan_y_pct',
    0,
    'texto_scale',
    1
  );
$$;

CREATE OR REPLACE FUNCTION public.processar_publicacoes_agendadas_vencidas ()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_url TEXT;
  v_tipo TEXT;
  v_meta JSONB;
  v_processadas INT := 0;
  v_erros INT := 0;
BEGIN
  FOR r IN
    SELECT *
    FROM public.publicacoes_agendadas
    WHERE
      status = 'pendente'
      AND agendado_para <= NOW()
    ORDER BY agendado_para ASC
    LIMIT 50
  LOOP
    BEGIN
      v_url := NULLIF(trim(COALESCE(r.conteudo_url, r.foto_url, '')), '');

      IF r.tipo_conteudo = 'story' THEN
        IF v_url IS NULL THEN
          RAISE EXCEPTION 'Story sem arquivo de mídia.';
        END IF;

        v_meta := COALESCE(r.story_meta, '{}'::jsonb);

        INSERT INTO public.stories (
          autor_id,
          autor_tipo,
          tipo,
          conteudo_url,
          texto_sobreposto,
          link,
          marcacoes,
          expira_em,
          duracao_segundos,
          created_at
        )
        VALUES (
          r.usuario_id,
          COALESCE(r.autor_tipo, 'empresa'),
          'foto',
          v_url,
          COALESCE(v_meta -> 'texto_sobreposto', public.texto_sobreposto_padrao_agendado(r.texto)),
          CASE
            WHEN jsonb_typeof(v_meta -> 'link') = 'string' THEN v_meta ->> 'link'
            ELSE NULL
          END,
          CASE
            WHEN jsonb_typeof(v_meta -> 'marcacoes') = 'array' THEN v_meta -> 'marcacoes'
            ELSE '[]'::jsonb
          END,
          NOW() + INTERVAL '24 hours',
          60,
          r.agendado_para
        );
      ELSE
        IF r.tipo_conteudo = 'texto' THEN
          v_tipo := 'texto';
        ELSIF v_url IS NOT NULL AND NULLIF(trim(COALESCE(r.texto, '')), '') IS NOT NULL THEN
          v_tipo := 'misto';
        ELSIF v_url IS NOT NULL THEN
          v_tipo := 'foto';
        ELSE
          v_tipo := 'texto';
        END IF;

        IF v_tipo <> 'texto' AND v_url IS NULL THEN
          RAISE EXCEPTION 'Publicação de foto sem imagem.';
        END IF;

        IF v_tipo = 'texto' AND NULLIF(trim(COALESCE(r.texto, '')), '') IS NULL THEN
          RAISE EXCEPTION 'Publicação de texto vazia.';
        END IF;

        INSERT INTO public.posts (autor_id, texto, foto_url, conteudo_url, tipo, created_at)
        VALUES (
          r.usuario_id,
          CASE
            WHEN v_tipo = 'texto' OR NULLIF(trim(COALESCE(r.texto, '')), '') IS NOT NULL THEN NULLIF(trim(r.texto), '')
            ELSE NULL
          END,
          v_url,
          v_url,
          v_tipo,
          r.agendado_para
        );
      END IF;

      UPDATE public.publicacoes_agendadas
      SET
        status = 'publicado',
        publicado_em = NOW(),
        erro_msg = NULL
      WHERE
        id = r.id
        AND status = 'pendente';

      v_processadas := v_processadas + 1;
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.publicacoes_agendadas
        SET
          status = 'erro',
          erro_msg = SQLERRM
        WHERE
          id = r.id;

        v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('processadas', v_processadas, 'erros', v_erros);
END;
$$;

COMMENT ON FUNCTION public.processar_publicacoes_agendadas_vencidas () IS
  'Publica linhas pendentes de publicacoes_agendadas em posts/stories (service/cron).';

GRANT EXECUTE ON FUNCTION public.processar_publicacoes_agendadas_vencidas () TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'processar-publicacoes-agendadas';

    PERFORM cron.schedule(
      'processar-publicacoes-agendadas',
      '* * * * *',
      $$SELECT public.processar_publicacoes_agendadas_vencidas();$$
    );
  END IF;
END;
$$;
