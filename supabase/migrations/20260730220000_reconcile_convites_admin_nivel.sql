-- Reconcilia convites_admin em prod (schema legado com funcao/convidado_email) com o código do repo (nivel INTEGER).

ALTER TABLE public.convites_admin
  ADD COLUMN IF NOT EXISTS nivel INTEGER,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS permissoes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS convidado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aceito_em TIMESTAMPTZ;

-- Backfill a partir de nomes legados (só se as colunas existirem).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'convites_admin'
      AND column_name = 'convidado_email'
  ) THEN
    UPDATE public.convites_admin
    SET email = COALESCE(NULLIF(trim(email), ''), NULLIF(trim(convidado_email), ''))
    WHERE email IS NULL OR trim(email) = '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'convites_admin'
      AND column_name = 'criado_em'
  ) THEN
    UPDATE public.convites_admin
    SET convidado_em = COALESCE(convidado_em, criado_em)
    WHERE convidado_em IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'convites_admin'
      AND column_name = 'respondido_em'
  ) THEN
    UPDATE public.convites_admin
    SET aceito_em = COALESCE(aceito_em, respondido_em)
    WHERE aceito_em IS NULL AND upper(coalesce(status, '')) = 'ACEITO';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'convites_admin'
      AND column_name = 'funcao'
  ) THEN
    UPDATE public.convites_admin
    SET
      nivel = COALESCE(
        nivel,
        CASE upper(trim(funcao))
          WHEN '2' THEN 2
          WHEN '3' THEN 3
          WHEN '4' THEN 4
          WHEN 'MODERADOR' THEN 2
          WHEN 'FINANCEIRO' THEN 3
          WHEN 'ADM FINANCEIRO' THEN 3
          WHEN 'ADM_FINANCEIRO' THEN 3
          WHEN 'AUXILIAR_ADM' THEN 4
          WHEN 'AUXILIAR ADM' THEN 4
          WHEN 'AUXILIAR' THEN 4
          ELSE NULL
        END
      )
    WHERE nivel IS NULL AND funcao IS NOT NULL AND trim(funcao) <> '';
  END IF;
END;
$$;

-- Defaults para linhas ainda incompletas (convites pendentes legados).
UPDATE public.convites_admin
SET
  convidado_em = COALESCE(convidado_em, NOW()),
  expira_em = COALESCE(expira_em, convidado_em + INTERVAL '7 days', NOW() + INTERVAL '7 days'),
  permissoes = COALESCE(permissoes, '{}'::jsonb)
WHERE convidado_em IS NULL OR expira_em IS NULL OR permissoes IS NULL;

ALTER TABLE public.convites_admin DROP CONSTRAINT IF EXISTS convites_admin_nivel_check;

ALTER TABLE public.convites_admin
ADD CONSTRAINT convites_admin_nivel_check CHECK (
  nivel IS NULL OR nivel IN (2, 3, 4)
);

COMMENT ON COLUMN public.convites_admin.nivel IS
'Nível admin (2=Moderador, 3=Financeiro, 4=Auxiliar). Fonte da verdade para o app; funcao legado pode coexistir em prod.';
