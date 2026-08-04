-- Chegada no ponto de partida (no_local) e início da viagem até o destino (em_viagem).
ALTER TABLE public.solicitacao_mobilidade
  DROP CONSTRAINT IF EXISTS solicitacao_mobilidade_status_check;

ALTER TABLE public.solicitacao_mobilidade
  ADD CONSTRAINT solicitacao_mobilidade_status_check CHECK (
    status IN (
      'pendente',
      'buscando',
      'oferecida',
      'aceita',
      'a_caminho',
      'no_local',
      'em_viagem',
      'concluida',
      'cancelada',
      'sem_profissional',
      'agendada',
      'aguardando_confirmacao'
    )
  );

COMMENT ON CONSTRAINT solicitacao_mobilidade_status_check ON public.solicitacao_mobilidade IS
  'no_local = profissional no ponto de partida; em_viagem = turista recebido, rota até o destino.';
