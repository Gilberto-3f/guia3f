-- Home boot: popup de reserva + carrossel. CREATE INDEX IF NOT EXISTS não trava se já existir.
-- Não rodar ANALYZE aqui (I/O pesado satura o pool e derruba Auth).

CREATE INDEX IF NOT EXISTS idx_turista_compras_popup_hospedagem
  ON public.turista_compras (turista_usuario_id, registrado_em DESC)
  WHERE tipo = 'reserva_hospedagem'
    AND status = 'confirmada'
    AND popup_exibido_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_anuncios_home_veiculacao
  ON public.anuncios (tipo, status, periodo_inicio, periodo_fim, created_at)
  WHERE tipo = 'home' AND status = 'ativo';
