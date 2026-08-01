-- Índices para aliviar timeouts do mapa de mobilidade (57014 / 503).
-- Pins: empresas com coords + elegíveis no Guia
CREATE INDEX IF NOT EXISTS idx_empresas_mapa_pins
  ON public.empresas (nota_media DESC NULLS LAST)
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND foto_url IS NOT NULL
    AND docs_verificado = true
    AND status IN ('aprovado', 'ativo');

CREATE INDEX IF NOT EXISTS idx_empresas_lat_lng
  ON public.empresas (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_empresa_degustacoes_ativa_expira
  ON public.empresa_degustacoes (status, expira_em)
  WHERE status = 'ativa';

CREATE INDEX IF NOT EXISTS idx_profissionais_mobilidade_online
  ON public.profissionais (mobilidade_status)
  WHERE mobilidade_status IN ('online', 'em_atendimento')
    AND mobilidade_lat IS NOT NULL
    AND mobilidade_lng IS NOT NULL;
