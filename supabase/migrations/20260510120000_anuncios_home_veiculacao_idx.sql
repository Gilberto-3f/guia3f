-- Consulta pública do carrossel Home: tipo + status + janela de vigência + ordenação por created_at.
CREATE INDEX IF NOT EXISTS idx_anuncios_home_veiculacao
ON public.anuncios (tipo, status, periodo_inicio, periodo_fim, created_at)
WHERE tipo = 'home' AND status = 'ativo';
