-- Garante canal global Financeiro (empresa) na pasta Administração, idempotente.
INSERT INTO public.canais (nome, tipo_publico, categoria, pais, ordem_tipo, ordem_posicao, ativo, empresa_id, comunidade_prof)
SELECT 'Financeiro', 'empresa', NULL, 'geral', 'fixo', 2, true, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.canais c
  WHERE
    c.tipo_publico = 'empresa'
    AND c.empresa_id IS NULL
    AND c.comunidade_prof IS NULL
    AND upper(trim(c.nome)) = 'FINANCEIRO'
);
