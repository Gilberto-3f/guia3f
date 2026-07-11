-- Remove o canal global de segmento "Hospedagem" (pasta EMPRESAS do ADM).
-- Anfitriões usam a comunidade profissional (dual mode Anfitrião/Hospedagem);
-- o canal de empresa ficou redundante.

DELETE FROM public.canais
WHERE tipo_publico = 'empresa'
  AND empresa_id IS NULL
  AND (comunidade_prof IS NULL OR btrim(comunidade_prof::text) = '')
  AND (
    lower(btrim(coalesce(categoria, ''))) = 'hospedagem'
    OR lower(btrim(coalesce(empresa_categoria, ''))) = 'hospedagem'
    OR lower(btrim(coalesce(nome, ''))) = 'hospedagem'
  );
