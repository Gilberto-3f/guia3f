-- Coluna legada `recursos` (alguns ambientes criaram `planos` sem ela).

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS recursos JSONB DEFAULT '{}'::jsonb;

UPDATE public.planos
SET
  recursos = jsonb_build_object(
    'servicos', COALESCE(servicos, '[]'::jsonb),
    'cor', COALESCE(cor, 'azul'),
    'descricao', COALESCE(descricao, ''),
    'precos', jsonb_build_object(
      'mensal', COALESCE(preco_mensal, valor, 0),
      'trimestral', COALESCE(preco_trimestral, 0),
      'anual', COALESCE(preco_anual, 0)
    )
  )
WHERE recursos IS NULL OR recursos = '{}'::jsonb;
