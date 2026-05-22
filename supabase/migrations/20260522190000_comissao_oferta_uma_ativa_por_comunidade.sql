-- Uma oferta ativa (pendente ou aprovada) por empresa + comunidade.

CREATE UNIQUE INDEX IF NOT EXISTS idx_comissao_oferta_uma_ativa_por_comunidade
  ON public.comissao_oferta (empresa_id, categoria_profissional)
  WHERE status IN ('pendente', 'aprovada');
