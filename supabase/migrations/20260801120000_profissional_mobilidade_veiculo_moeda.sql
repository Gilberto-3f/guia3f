-- Dados de veículo + preferência de moeda (perfil Mobilidade, placa vermelha).
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS veiculo_fotos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS veiculo_placa text,
  ADD COLUMN IF NOT EXISTS veiculo_lugares integer,
  ADD COLUMN IF NOT EXISTS moeda_modo text NOT NULL DEFAULT 'todas',
  ADD COLUMN IF NOT EXISTS moedas_preferencia text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profissionais.veiculo_fotos IS
  'URLs das fotos do veículo (mobilidade placa vermelha).';
COMMENT ON COLUMN public.profissionais.veiculo_placa IS
  'Placa do veículo cadastrado para mobilidade.';
COMMENT ON COLUMN public.profissionais.veiculo_lugares IS
  'Capacidade de passageiros do veículo (filtro do matching).';
COMMENT ON COLUMN public.profissionais.moeda_modo IS
  'todas = aceita qualquer moeda; prioridade = usa moedas_preferencia (soft-rank).';
COMMENT ON COLUMN public.profissionais.moedas_preferencia IS
  'Códigos: real, guarani, peso, dolar, euro — quando moeda_modo = prioridade.';

ALTER TABLE public.profissionais
  DROP CONSTRAINT IF EXISTS profissionais_moeda_modo_check;
ALTER TABLE public.profissionais
  ADD CONSTRAINT profissionais_moeda_modo_check
  CHECK (moeda_modo IN ('todas', 'prioridade'));

ALTER TABLE public.profissionais
  DROP CONSTRAINT IF EXISTS profissionais_veiculo_lugares_check;
ALTER TABLE public.profissionais
  ADD CONSTRAINT profissionais_veiculo_lugares_check
  CHECK (veiculo_lugares IS NULL OR (veiculo_lugares >= 1 AND veiculo_lugares <= 50));

-- Metadata da solicitação já guarda extras; colunas opcionais para filtro futuro
ALTER TABLE public.solicitacao_mobilidade
  ADD COLUMN IF NOT EXISTS idioma_preferido text,
  ADD COLUMN IF NOT EXISTS moedas_dinheiro text[] NOT NULL DEFAULT '{}';
