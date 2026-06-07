-- Marca quando o texto de uma mensagem de canal foi editado (adm/empresa).
ALTER TABLE mensagens_canal
ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ;

COMMENT ON COLUMN mensagens_canal.editado_em IS 'Preenchido quando adm ou empresa edita o texto da mensagem.';
