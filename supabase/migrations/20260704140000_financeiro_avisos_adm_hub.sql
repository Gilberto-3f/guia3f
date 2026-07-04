-- Cards informativos no hub Canal Financeiro ADM (visíveis só a ADM GERAL e ADM Financeiro)
CREATE TABLE IF NOT EXISTS public.financeiro_avisos_adm_hub (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  visivel_para TEXT[] NOT NULL DEFAULT ARRAY['adm_geral', 'adm_financeiro'],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  lido_por UUID[] NOT NULL DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financeiro_avisos_adm_hub_created
  ON public.financeiro_avisos_adm_hub (created_at DESC);

COMMENT ON TABLE public.financeiro_avisos_adm_hub IS
  'Avisos informativos no Canal Financeiro ADM (hub). Filtrados por perfil admin.';

CREATE OR REPLACE FUNCTION public.admin_pode_ver_aviso_financeiro_hub(p_visivel_para TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR COALESCE(u.admin_level, 0) >= 1)
      AND (
        (u.admin_level = 1 AND 'adm_geral' = ANY (p_visivel_para))
        OR (
          (
            u.admin_level = 3
            OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
          )
          AND 'adm_financeiro' = ANY (p_visivel_para)
        )
      )
  );
$$;

ALTER TABLE public.financeiro_avisos_adm_hub ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financeiro_avisos_adm_hub select" ON public.financeiro_avisos_adm_hub;

CREATE POLICY "financeiro_avisos_adm_hub select" ON public.financeiro_avisos_adm_hub FOR SELECT
  USING (public.admin_pode_ver_aviso_financeiro_hub(visivel_para));

DROP POLICY IF EXISTS "financeiro_avisos_adm_hub update leitura" ON public.financeiro_avisos_adm_hub;

CREATE POLICY "financeiro_avisos_adm_hub update leitura" ON public.financeiro_avisos_adm_hub FOR UPDATE
  USING (public.admin_pode_ver_aviso_financeiro_hub(visivel_para))
  WITH CHECK (public.admin_pode_ver_aviso_financeiro_hub(visivel_para));

GRANT SELECT, UPDATE ON public.financeiro_avisos_adm_hub TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'financeiro_avisos_adm_hub'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.financeiro_avisos_adm_hub;
    END IF;
  END IF;
END $$;
