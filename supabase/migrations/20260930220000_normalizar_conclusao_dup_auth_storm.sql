-- Normaliza conclusão simultânea (dois aparelhos, mesmo profissional)
-- e corta recibos duplicados que saturaram Auth/REST (504/522).
--
-- Sintoma 30/09/2026:
--   GET /auth/v1/user + GET profissionais?usuario_id= em cascata (node)
--   Auth: context deadline exceeded / Session not found
--   Realtime: query_canceled (57014)
-- Causa: dois celulares concluíram o mesmo atendimento ao mesmo tempo;
--        o 2º POST reliquidava + os polls continuavam batendo no GoTrue.

-- ========== Recibos duplicados (mesma solicitação + kind + papel) ==========
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        profissional_id,
        comprovante_detalhes->>'solicitacao_id',
        COALESCE(comprovante_detalhes->>'kind', ''),
        COALESCE(comprovante_detalhes->>'papel', '')
      ORDER BY id ASC
    ) AS rn
  FROM public.canal_financeiro
  WHERE COALESCE(comprovante_detalhes->>'solicitacao_id', '') <> ''
)
DELETE FROM public.canal_financeiro
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_canal_fin_solicitacao_kind_papel
  ON public.canal_financeiro (
    profissional_id,
    (comprovante_detalhes->>'solicitacao_id'),
    COALESCE(comprovante_detalhes->>'kind', ''),
    COALESCE(comprovante_detalhes->>'papel', '')
  )
  WHERE COALESCE(comprovante_detalhes->>'solicitacao_id', '') <> '';

-- ========== Corridas já receptadas no manifesto, ainda "vivas" ==========
UPDATE public.solicitacao_mobilidade s
SET
  status = 'concluida',
  metadata = COALESCE(s.metadata, '{}'::jsonb) || jsonb_build_object(
    'concluido_em', COALESCE(s.metadata->>'concluido_em', now()::text),
    'normalizado_dup_finish_em', now()::text
  )
WHERE s.status IN ('aceita', 'a_caminho', 'no_local', 'em_viagem')
  AND EXISTS (
    SELECT 1
    FROM public.manifesto_passageiros p
    WHERE p.solicitacao_id = s.id
      AND p.status IN ('recebido', 'cancelado')
  );

-- ========== Manifesto sem passageiro pendente ==========
UPDATE public.manifesto_diario md
SET
  status = 'concluido',
  concluido_em = COALESCE(md.concluido_em, now()),
  updated_at = now()
WHERE md.status IN ('em_andamento', 'confirmado', 'rascunho')
  AND md.lista_iniciada_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.manifesto_passageiros p
    WHERE p.manifesto_id = md.id
      AND COALESCE(p.status, 'pendente') = 'pendente'
  );

-- ========== Profissional preso em atendimento sem corrida ativa ==========
UPDATE public.profissionais p
SET
  mobilidade_status = 'online',
  mobilidade_status_em = now()
WHERE p.mobilidade_status = 'em_atendimento'
  AND NOT EXISTS (
    SELECT 1
    FROM public.solicitacao_mobilidade s
    WHERE s.profissional_id = p.id
      AND s.status IN ('aceita', 'a_caminho', 'no_local', 'em_viagem')
  );
