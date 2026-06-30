-- Uma solicitação pendente por turista/empresa (período completo, não por diária).

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, turista_usuario_id
      ORDER BY
        COALESCE(noites, (data_checkout::date - data_checkin::date)) DESC,
        created_at DESC
    ) AS rn
  FROM public.reservas_hospedagem
  WHERE status = 'pendente'
    AND turista_usuario_id IS NOT NULL
)
UPDATE public.reservas_hospedagem r
SET
  status = 'cancelada',
  motivo_recusa = 'Consolidada: uma solicitação por período de hospedagem.',
  respondido_em = NOW()
FROM ranked
WHERE r.id = ranked.id
  AND ranked.rn > 1;

DELETE FROM public.canal_financeiro cf
WHERE cf.tipo = 'reserva_hospedagem'
  AND COALESCE(cf.metadata ->> 'respondido', '') = ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.reservas_hospedagem rh
    WHERE rh.status = 'pendente'
      AND rh.canal_financeiro_id = cf.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_hospedagem_pendente_unico_turista_empresa
  ON public.reservas_hospedagem (empresa_id, turista_usuario_id)
  WHERE status = 'pendente' AND turista_usuario_id IS NOT NULL;

COMMENT ON INDEX idx_reservas_hospedagem_pendente_unico_turista_empresa IS
  'Garante uma única solicitação pendente por turista em cada hospedagem.';
