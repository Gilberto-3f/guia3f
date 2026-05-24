-- Canal financeiro: avisos ADM só para empresa (profissional_id opcional)
-- Mensageiro ADM: turista/profissional/empresa podem enviar

ALTER TABLE public.canal_financeiro
ALTER COLUMN profissional_id DROP NOT NULL;

COMMENT ON COLUMN public.canal_financeiro.profissional_id IS 'Opcional: null em avisos exclusivos do ADM à empresa.';

-- Segmentos globais empresa (broadcast ADM → Canal ADM inbox)
UPDATE public.canais
SET
  categoria = 'gastronomia',
  ativo = TRUE
WHERE
  tipo_publico = 'empresa'
  AND empresa_id IS NULL
  AND nome IN ('Gastronomia', 'gastronomia');

UPDATE public.canais
SET
  categoria = 'lojas',
  ativo = TRUE
WHERE
  tipo_publico = 'empresa'
  AND empresa_id IS NULL
  AND nome IN ('Lojas', 'lojas');

UPDATE public.canais
SET
  categoria = 'passeios',
  ativo = TRUE
WHERE
  tipo_publico = 'empresa'
  AND empresa_id IS NULL
  AND nome IN ('Passeios', 'passeios', 'Atrativos');

UPDATE public.canais
SET
  categoria = 'hospedagem',
  ativo = TRUE
WHERE
  tipo_publico = 'empresa'
  AND empresa_id IS NULL
  AND nome IN ('Hospedagem', 'hospedagem');

UPDATE public.canais
SET
  ativo = TRUE
WHERE
  tipo_publico = 'empresa'
  AND empresa_id IS NULL
  AND UPPER(TRIM(nome)) = 'ADM';

DROP POLICY IF EXISTS "mensagens insert usuario em mensageiro adm" ON public.mensagens_canal;

CREATE POLICY "mensagens insert usuario em mensageiro adm" ON public.mensagens_canal FOR INSERT
WITH CHECK (
  remetente_id = auth.uid ()
  AND EXISTS (
    SELECT
      1
    FROM
      public.canais c
    WHERE
      c.id = canal_id
      AND c.tipo_publico = 'admin'
      AND (
        UPPER(TRIM(c.nome)) = 'MENSAGEIRO ADM'
        OR TRIM(c.nome) = 'Mensageiro ADM'
      )
  )
  AND EXISTS (
    SELECT
      1
    FROM
      public.usuarios u
    WHERE
      u.id = auth.uid ()
      AND u.role IN ('turista', 'profissional', 'empresa')
  )
);
