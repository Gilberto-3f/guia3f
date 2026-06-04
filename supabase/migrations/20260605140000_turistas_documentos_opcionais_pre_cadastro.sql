-- Pré-cadastro turista: documentos são enviados depois em Menu → Usuário → Anexar Documentos.

ALTER TABLE public.turistas
  ALTER COLUMN documento_frente_url DROP NOT NULL,
  ALTER COLUMN documento_verso_url DROP NOT NULL;

COMMENT ON COLUMN public.turistas.documento_frente_url IS 'RG/CNH frente — preenchido em Anexar Documentos (pode ser NULL no pré-cadastro).';
COMMENT ON COLUMN public.turistas.documento_verso_url IS 'RG/CNH verso — preenchido em Anexar Documentos (pode ser NULL no pré-cadastro).';
