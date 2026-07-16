-- Atualiza rótulos das categorias Compras CDE (Botão Dinâmico)
UPDATE public.produto_categorias
SET
  nome = 'Brinquedos e Colecionáveis'
WHERE
  slug = 'brinquedos';

UPDATE public.produto_categorias
SET
  nome = 'Farmácia e Suplementos'
WHERE
  slug = 'produtos-farmaceuticos';
