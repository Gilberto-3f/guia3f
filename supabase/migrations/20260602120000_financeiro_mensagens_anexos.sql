-- Anexos (áudio, imagem, documento) no mensageiro financeiro ADM ↔ profissional/empresa

ALTER TABLE public.financeiro_mensagens
  ADD COLUMN IF NOT EXISTS anexo_url TEXT,
  ADD COLUMN IF NOT EXISTS anexo_tipo TEXT;

ALTER TABLE public.financeiro_mensagens
  ALTER COLUMN texto DROP NOT NULL;

ALTER TABLE public.financeiro_mensagens
  DROP CONSTRAINT IF EXISTS financeiro_mensagens_conteudo_check;

ALTER TABLE public.financeiro_mensagens
  ADD CONSTRAINT financeiro_mensagens_conteudo_check CHECK (
    (texto IS NOT NULL AND TRIM(texto) <> '')
    OR (anexo_url IS NOT NULL AND TRIM(anexo_url) <> '')
  );

DROP POLICY IF EXISTS "financeiro_mensagens membro insert aberta" ON public.financeiro_mensagens;

CREATE POLICY "financeiro_mensagens membro insert aberta" ON public.financeiro_mensagens FOR INSERT
WITH CHECK (
  remetente_id = auth.uid()
  AND (
    (texto IS NOT NULL AND TRIM(texto) <> '')
    OR (anexo_url IS NOT NULL AND TRIM(anexo_url) <> '')
  )
  AND EXISTS (
    SELECT 1
    FROM public.financeiro_conversas c
    WHERE c.id = financeiro_mensagens.conversa_id
      AND c.status = 'aberta'
      AND (c.adm_usuario_id = auth.uid() OR c.alvo_usuario_id = auth.uid())
  )
);
