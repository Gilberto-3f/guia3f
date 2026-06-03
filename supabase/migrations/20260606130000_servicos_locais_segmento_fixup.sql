-- Fix: Serviços Locais — canal global (índice parcial canais_unique_global_nome_tipo)
-- Use este arquivo se 20260606120000 falhou no INSERT com ON CONFLICT (nome, tipo_publico).
-- Idempotente: pode rodar mesmo que as funções já tenham sido criadas.

INSERT INTO public.canais (
  nome,
  tipo_publico,
  categoria,
  pais,
  ordem_tipo,
  ordem_posicao,
  ativo,
  empresa_id,
  comunidade_prof
)
VALUES (
  'Serviços Locais',
  'empresa',
  'servicos_locais',
  'geral',
  'rotativo',
  NULL,
  TRUE,
  NULL,
  NULL
)
ON CONFLICT (nome, tipo_publico)
  WHERE empresa_id IS NULL AND comunidade_prof IS NULL
DO UPDATE SET
  categoria = EXCLUDED.categoria,
  ativo = TRUE,
  ordem_tipo = 'rotativo';

CREATE OR REPLACE FUNCTION public.eh_canal_segmento_empresa_guia(p_nome TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_nome, '') IN (
    'Gastronomia',
    'Lojas',
    'Atrativos',
    'Passeios',
    'Hospedagem',
    'Serviços Locais',
    'Mensageiro'
  );
$$;

COMMENT ON FUNCTION public.eh_canal_segmento_empresa_guia (TEXT) IS
  'Canais globais de segmento comercial (guia turístico + serviços locais).';

CREATE OR REPLACE FUNCTION public.profissional_badges_segmentos_empresa ()
RETURNS TABLE (
  canal_id UUID,
  tem_badge BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id AS canal_id,
    EXISTS (
      SELECT 1
      FROM mensagens_canal m
      INNER JOIN usuarios ur ON ur.id = m.remetente_id AND ur.role = 'empresa'
      WHERE m.canal_id = c.id
        AND m.created_at > COALESCE(
          (
            SELECT l.visto_em
            FROM canal_leitura_profissional l
            WHERE l.usuario_id = auth.uid()
              AND l.canal_id = c.id
          ),
          '-infinity'::TIMESTAMPTZ
        )
    ) AS tem_badge
  FROM canais c
  WHERE c.tipo_publico = 'empresa'
    AND public.eh_canal_segmento_empresa_guia(c.nome)
    AND COALESCE(c.ativo, TRUE) = TRUE
    AND EXISTS (
      SELECT 1
      FROM usuarios u
      WHERE u.id = auth.uid()
        AND u.role = 'profissional'
    );
$$;

GRANT EXECUTE ON FUNCTION public.profissional_badges_segmentos_empresa () TO authenticated;

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
        EXISTS (
          SELECT 1
          FROM usuarios u
          WHERE u.id = auth.uid()
            AND u.role = 'admin'
        )
        OR (
          c.tipo_publico = 'turista'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'turista'
          )
        )
        OR (
          c.tipo_publico = 'profissional'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'profissional'
          )
        )
        OR (
          c.tipo_publico = 'empresa'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'empresa'
              AND (
                c.empresa_id IS NULL
                OR EXISTS (
                  SELECT 1
                  FROM empresas e
                  WHERE e.id = c.empresa_id
                    AND e.usuario_id = auth.uid()
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
            WHERE u.id = auth.uid()
              AND u.role = 'profissional'
              AND COALESCE(u.status, 'ativo') = 'ativo'
          )
          AND public.profissional_acessa_canal_empresa_comunidade(auth.uid(), c.comunidade_prof)
        )
        OR (
          c.tipo_publico = 'empresa'
          AND public.eh_canal_segmento_empresa_guia(c.nome)
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
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
            WHERE u.id = auth.uid()
              AND u.role = 'empresa'
          )
        )
        OR (
          c.tipo_publico = 'admin'
          AND EXISTS (
            SELECT 1
            FROM usuarios u
            WHERE u.id = auth.uid()
              AND u.role = 'admin'
          )
        )
      )
  );
$$;
