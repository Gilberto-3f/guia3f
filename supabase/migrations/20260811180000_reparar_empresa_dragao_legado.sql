-- ============================================================================
-- Reparo pontual: @dragao (loja CDE) — coords duplicadas
-- ============================================================================
-- Diagnóstico (prod): a conta JÁ está no modelo atual:
--   docs_verificado, status aprovado, foto, assinatura ativa até 2026-10-07.
-- Problema real: latitude/longitude IDÊNTICAS às de elite.importados
--   (-25.51095, -54.610287) → pins HTML do Mapbox empilham; só um pin
--   (foto "CDE IMPORTADOS") aparece. "Chamar corrida" centra no mesmo ponto.
--
-- Escopo: APENAS nome_usuario = dragao.
-- Não altera cadastro de contas novas nem presença/assinatura.
-- Idempotente.
-- ============================================================================

DO $$
DECLARE
  v_emp_id UUID;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_outra UUID;
  v_off_lat DOUBLE PRECISION;
  v_off_lng DOUBLE PRECISION;
BEGIN
  SELECT e.id, e.latitude::float8, e.longitude::float8
  INTO v_emp_id, v_lat, v_lng
  FROM public.empresas e
  WHERE lower(regexp_replace(coalesce(e.nome_usuario, ''), '^@+', '')) = 'dragao'
  ORDER BY e.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_emp_id IS NULL THEN
    RAISE NOTICE '[reparar_dragao] empresa @dragao não encontrada — skip';
    RETURN;
  END IF;

  -- Garante flags públicas (no-op se já ok)
  UPDATE public.empresas e
  SET
    docs_verificado = true,
    status = CASE
      WHEN lower(coalesce(e.status, '')) IN ('aprovado', 'ativo') THEN e.status
      ELSE 'aprovado'
    END,
    somente_modo_apresentacao = false
  WHERE e.id = v_emp_id;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    -- Sem coords: fallback CDE + offset do id
    UPDATE public.empresas e
    SET
      latitude = -25.5097 + ((abs(hashtext(e.id::text)) % 200) - 100) * 0.00008,
      longitude = -54.6111 + ((abs(hashtext(e.id::text || ':lng')) % 200) - 100) * 0.00008
    WHERE e.id = v_emp_id;
    RAISE NOTICE '[reparar_dragao] coords nulas → fallback CDE com offset';
    RETURN;
  END IF;

  -- Outra empresa com as MESMAS coords (causa do pin “sumido”)?
  SELECT e.id
  INTO v_outra
  FROM public.empresas e
  WHERE e.id <> v_emp_id
    AND e.latitude IS NOT NULL
    AND e.longitude IS NOT NULL
    AND abs(e.latitude::float8 - v_lat) < 0.000001
    AND abs(e.longitude::float8 - v_lng) < 0.000001
  LIMIT 1;

  IF v_outra IS NULL THEN
    RAISE NOTICE '[reparar_dragao] coords únicas — nada a deslocar (lat=% lng=%)', v_lat, v_lng;
    RETURN;
  END IF;

  -- Desloca ~80–160 m (determinístico pelo id) para o pin ficar visível ao lado
  v_off_lat := ((abs(hashtext(v_emp_id::text)) % 100) + 50) * 0.00001;  -- ~55–150 m N/S
  v_off_lng := ((abs(hashtext(v_emp_id::text || ':lng')) % 100) + 50) * 0.00001;

  UPDATE public.empresas
  SET
    latitude = v_lat + v_off_lat,
    longitude = v_lng + v_off_lng
  WHERE id = v_emp_id;

  RAISE NOTICE
    '[reparar_dragao] coords duplicadas com % → deslocado de (%, %) para (%, %)',
    v_outra,
    v_lat,
    v_lng,
    v_lat + v_off_lat,
    v_lng + v_off_lng;
END $$;
