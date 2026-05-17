-- Tour virtual 360°: cenas, hotspots e cena inicial (Pannellum multiscene)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tour_config JSONB DEFAULT '{"firstScene": null, "cenas": []}'::jsonb;

COMMENT ON COLUMN public.empresas.tour_config IS 'Tour virtual 360: cenas (url), hotspots (pitch/yaw/sceneId) e firstScene';
