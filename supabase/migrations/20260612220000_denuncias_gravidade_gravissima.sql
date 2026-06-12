-- Nível Gravíssima em denúncias

ALTER TABLE public.denuncias DROP CONSTRAINT IF EXISTS denuncias_gravidade_check;
ALTER TABLE public.denuncias ADD CONSTRAINT denuncias_gravidade_check
  CHECK (gravidade IS NULL OR gravidade IN ('leve', 'media', 'grave', 'gravissima'));
