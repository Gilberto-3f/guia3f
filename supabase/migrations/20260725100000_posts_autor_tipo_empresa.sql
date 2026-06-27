-- Posts: distinguir publicação social (profissional) vs página empresa (hospedagem)

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS autor_tipo TEXT,
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_empresa_id ON public.posts (empresa_id)
WHERE
  empresa_id IS NOT NULL;

COMMENT ON COLUMN public.posts.autor_tipo IS 'Perfil de origem: profissional, turista, empresa, etc.';
COMMENT ON COLUMN public.posts.empresa_id IS 'Preenchido quando autor_tipo = empresa (modo Hospedagem do anfitrião).';
