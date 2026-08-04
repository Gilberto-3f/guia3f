-- Corrida aceita: profissional a caminho do ponto de partida do turista.
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
      'concluida',
      'cancelada',
      'sem_profissional',
      'agendada',
      'aguardando_confirmacao'
    )
  );

COMMENT ON CONSTRAINT solicitacao_mobilidade_status_check ON public.solicitacao_mobilidade IS
  'a_caminho = profissional aceitou e segue até o ponto de partida do turista.';
