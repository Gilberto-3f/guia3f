-- Fixup Advisor: usuarios, config_geral, config_apis
-- Reativa RLS e garante policies mínimas onde faltavam.

-- ---------------------------------------------------------------------------
-- usuarios (policies já existem em migrations anteriores)
-- ---------------------------------------------------------------------------
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- config_geral (leitura autenticada + escrita ADM GERAL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.config_geral ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_geral_select_autenticado ON public.config_geral;
CREATE POLICY config_geral_select_autenticado ON public.config_geral
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS config_geral_insert_admin_geral ON public.config_geral;
CREATE POLICY config_geral_insert_admin_geral ON public.config_geral
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND COALESCE(u.admin_level, 0) = 1
  )
);

DROP POLICY IF EXISTS config_geral_update_admin_geral ON public.config_geral;
CREATE POLICY config_geral_update_admin_geral ON public.config_geral
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND COALESCE(u.admin_level, 0) = 1
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND COALESCE(u.admin_level, 0) = 1
  )
);

-- ---------------------------------------------------------------------------
-- config_apis (somente ADM GERAL ou ADM Financeiro — contém chaves secretas)
-- ---------------------------------------------------------------------------
ALTER TABLE public.config_apis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_apis_admin_select ON public.config_apis;
CREATE POLICY config_apis_admin_select ON public.config_apis
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
);

DROP POLICY IF EXISTS config_apis_admin_insert ON public.config_apis;
CREATE POLICY config_apis_admin_insert ON public.config_apis
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
);

DROP POLICY IF EXISTS config_apis_admin_update ON public.config_apis;
CREATE POLICY config_apis_admin_update ON public.config_apis
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND (
        COALESCE(u.admin_level, 0) = 1
        OR COALESCE(u.admin_level, 0) = 3
        OR COALESCE(u.admin_permissoes ->> 'cargo', '') = 'FINANCEIRO'
      )
  )
);
