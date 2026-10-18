-- Etapa 2: vínculo N:N empresa/profissional ↔ blocos de ecossistema.
-- Exige a migration 20261017010000_ecossistemas_blocos.sql.
-- Cadastros já existentes entram na Tríplice Fronteira.

CREATE TABLE IF NOT EXISTS public.empresa_ecossistemas (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  ecossistema_id uuid NOT NULL REFERENCES public.ecossistemas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, ecossistema_id)
);

CREATE INDEX IF NOT EXISTS empresa_ecossistemas_eco_idx
  ON public.empresa_ecossistemas (ecossistema_id);

CREATE TABLE IF NOT EXISTS public.profissional_ecossistemas (
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  ecossistema_id uuid NOT NULL REFERENCES public.ecossistemas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profissional_id, ecossistema_id)
);

CREATE INDEX IF NOT EXISTS profissional_ecossistemas_eco_idx
  ON public.profissional_ecossistemas (ecossistema_id);

COMMENT ON TABLE public.empresa_ecossistemas IS
  'Blocos (cidade ou região) em que a empresa atua.';
COMMENT ON TABLE public.profissional_ecossistemas IS
  'Blocos (cidade ou região) em que o profissional atua.';

ALTER TABLE public.empresa_ecossistemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profissional_ecossistemas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_ecossistemas_select ON public.empresa_ecossistemas;
CREATE POLICY empresa_ecossistemas_select ON public.empresa_ecossistemas
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS profissional_ecossistemas_select ON public.profissional_ecossistemas;
CREATE POLICY profissional_ecossistemas_select ON public.profissional_ecossistemas
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Usuários podem inserir vínculo da própria empresa" ON public.empresa_ecossistemas;
CREATE POLICY "Usuários podem inserir vínculo da própria empresa"
ON public.empresa_ecossistemas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem remover vínculo da própria empresa" ON public.empresa_ecossistemas;
CREATE POLICY "Usuários podem remover vínculo da própria empresa"
ON public.empresa_ecossistemas FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_id AND e.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem inserir vínculo do próprio profissional" ON public.profissional_ecossistemas;
CREATE POLICY "Usuários podem inserir vínculo do próprio profissional"
ON public.profissional_ecossistemas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = profissional_id AND p.usuario_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Usuários podem remover vínculo do próprio profissional" ON public.profissional_ecossistemas;
CREATE POLICY "Usuários podem remover vínculo do próprio profissional"
ON public.profissional_ecossistemas FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profissionais p
    WHERE p.id = profissional_id AND p.usuario_id = auth.uid()
  )
);

GRANT SELECT ON public.empresa_ecossistemas TO anon, authenticated;
GRANT SELECT ON public.profissional_ecossistemas TO anon, authenticated;
GRANT INSERT, DELETE ON public.empresa_ecossistemas TO authenticated;
GRANT INSERT, DELETE ON public.profissional_ecossistemas TO authenticated;

INSERT INTO public.empresa_ecossistemas (empresa_id, ecossistema_id)
SELECT e.id, eco.id
FROM public.empresas e
CROSS JOIN public.ecossistemas eco
WHERE eco.slug = 'triplice-fronteira'
ON CONFLICT DO NOTHING;

INSERT INTO public.profissional_ecossistemas (profissional_id, ecossistema_id)
SELECT p.id, eco.id
FROM public.profissionais p
CROSS JOIN public.ecossistemas eco
WHERE eco.slug = 'triplice-fronteira'
ON CONFLICT DO NOTHING;
