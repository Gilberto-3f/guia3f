-- Resposta oficial do profissional à avaliação do turista (1:1, como empresa).

ALTER TABLE public.avaliacao_respostas
  ALTER COLUMN empresa_id DROP NOT NULL;

ALTER TABLE public.avaliacao_respostas
  ADD COLUMN IF NOT EXISTS profissional_id UUID REFERENCES public.profissionais (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_avaliacao_respostas_profissional
  ON public.avaliacao_respostas (profissional_id);

ALTER TABLE public.avaliacao_respostas
  DROP CONSTRAINT IF EXISTS avaliacao_respostas_alvo_chk;

ALTER TABLE public.avaliacao_respostas
  ADD CONSTRAINT avaliacao_respostas_alvo_chk CHECK (
    (
      empresa_id IS NOT NULL
      AND profissional_id IS NULL
    )
    OR (
      empresa_id IS NULL
      AND profissional_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Dono do profissional pode criar resposta" ON public.avaliacao_respostas;
DROP POLICY IF EXISTS "Dono do profissional pode atualizar resposta" ON public.avaliacao_respostas;

CREATE POLICY "Dono do profissional pode criar resposta" ON public.avaliacao_respostas FOR INSERT
WITH
  CHECK (
    auth.role () = 'authenticated'
    AND autor_usuario_id = auth.uid ()
    AND profissional_id IS NOT NULL
    AND empresa_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE
        p.id = profissional_id
        AND p.usuario_id = auth.uid ()
    )
  );

CREATE POLICY "Dono do profissional pode atualizar resposta" ON public.avaliacao_respostas FOR UPDATE USING (
  autor_usuario_id = auth.uid ()
  AND profissional_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profissionais p
    WHERE
      p.id = profissional_id
      AND p.usuario_id = auth.uid ()
  )
)
WITH
  CHECK (
    autor_usuario_id = auth.uid ()
    AND profissional_id IS NOT NULL
    AND empresa_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profissionais p
      WHERE
        p.id = profissional_id
        AND p.usuario_id = auth.uid ()
    )
  );
