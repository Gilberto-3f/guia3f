-- Normaliza categoria/cidade legadas em empresas (cadastro vs guia turístico).

UPDATE public.empresas
SET cidade = 'Foz do Iguaçu'
WHERE lower(
  translate(cidade, 'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'aaaaeeiooouucAAAAEEIOOOUUC')
) = 'foz do iguacu'
  AND cidade IS DISTINCT FROM 'Foz do Iguaçu';

UPDATE public.empresas
SET categoria = 'Restaurantes'
WHERE lower(btrim(categoria)) IN ('gastronomia', 'restaurante', 'restaurantes')
  AND categoria IS DISTINCT FROM 'Restaurantes';

UPDATE public.empresas
SET categoria = 'Atrativos'
WHERE lower(btrim(categoria)) IN ('passeios', 'passeio', 'atrativos', 'atracao', 'atracoes')
  AND categoria IS DISTINCT FROM 'Atrativos';

UPDATE public.empresas
SET categoria = 'Lojas'
WHERE lower(btrim(categoria)) IN ('loja', 'lojas')
  AND categoria IS DISTINCT FROM 'Lojas';

UPDATE public.empresas
SET categoria = 'Serviços Locais'
WHERE lower(btrim(categoria)) IN ('servicos_locais', 'servicos locais', 'servicos')
  AND categoria IS DISTINCT FROM 'Serviços Locais';

-- Puerto Iguazú: unificar grafias (cadastro vs edição de perfil)
UPDATE public.empresas
SET cidade = 'Puerto Iguazu'
WHERE lower(
  translate(cidade, 'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'aaaaeeiooouucAAAAEEIOOOUUC')
) = 'puerto iguazu'
  AND cidade IS DISTINCT FROM 'Puerto Iguazu';
