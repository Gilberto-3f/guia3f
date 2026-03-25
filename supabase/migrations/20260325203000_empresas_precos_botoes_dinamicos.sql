-- =====================================================
-- Preços para botões dinâmicos (tickets, diária)
-- =====================================================

ALTER TABLE empresas
ADD COLUMN IF NOT EXISTS preco_ticket_inteira DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_ticket_meia DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_diaria DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN empresas.preco_ticket_inteira IS 'Preço do ticket inteiro para passeios/atrativos';

COMMENT ON COLUMN empresas.preco_ticket_meia IS 'Preço do ticket meia para passeios/atrativos';

COMMENT ON COLUMN empresas.preco_diaria IS 'Preço da diária para hospedagem';
