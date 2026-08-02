-- Modelo e ano do veículo (perfil Mobilidade).
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS veiculo_modelo text,
  ADD COLUMN IF NOT EXISTS veiculo_ano integer;

COMMENT ON COLUMN public.profissionais.veiculo_modelo IS
  'Modelo do veículo cadastrado para mobilidade.';
COMMENT ON COLUMN public.profissionais.veiculo_ano IS
  'Ano do veículo cadastrado para mobilidade.';

ALTER TABLE public.profissionais
  DROP CONSTRAINT IF EXISTS profissionais_veiculo_ano_check;
ALTER TABLE public.profissionais
  ADD CONSTRAINT profissionais_veiculo_ano_check
  CHECK (
    veiculo_ano IS NULL
    OR (veiculo_ano >= 1980 AND veiculo_ano <= 2100)
  );
