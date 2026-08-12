-- Exclusão de conta (LGPD): identidade/UGC somem (CASCADE);
-- registros legais/operacionais ficam anonimizados (ON DELETE SET NULL).
-- RPC só via service_role (API autentica senha antes).

-- ---------------------------------------------------------------------------
-- Auditoria mínima (sem PII)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contas_excluidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  excluido_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  perfil_tipo TEXT NOT NULL CHECK (perfil_tipo IN ('turista', 'profissional', 'empresa', 'desconhecido'))
);

ALTER TABLE public.contas_excluidas ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.contas_excluidas IS
  'Prova de exclusão LGPD: data e tipo de perfil, sem e-mail/nome/id.';

-- ---------------------------------------------------------------------------
-- FKs para public.usuarios sem CASCADE/SET NULL → SET NULL (e drop NOT NULL)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      con.conname,
      n.nspname AS sch,
      rel.relname AS tbl,
      att.attname AS col,
      att.attnotnull,
      con.confdeltype
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS ck (attnum, ord) ON TRUE
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ck.attnum
    WHERE
      con.contype = 'f'
      AND con.confrelid = 'public.usuarios'::regclass
      AND n.nspname = 'public'
      AND array_length(con.conkey, 1) = 1
      AND rel.relname NOT IN ('turistas', 'profissionais', 'empresas')
      AND con.confdeltype NOT IN ('c', 'n') -- não CASCADE nem SET NULL
  LOOP
    IF rec.attnotnull THEN
      EXECUTE format(
        'ALTER TABLE %I.%I ALTER COLUMN %I DROP NOT NULL',
        rec.sch,
        rec.tbl,
        rec.col
      );
    END IF;
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      rec.sch,
      rec.tbl,
      rec.conname
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.usuarios (id) ON DELETE SET NULL',
      rec.sch,
      rec.tbl,
      rec.conname,
      rec.col
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- RPC: checagens + cancelamentos leves + DELETE usuarios
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.excluir_conta_usuario (p_uid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_admin_level INTEGER;
  v_perfil TEXT := 'desconhecido';
  v_prof_id UUID;
  v_empresa_id UUID;
BEGIN
  IF p_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;

  SELECT u.role, COALESCE(u.admin_level, 0)
    INTO v_role, v_admin_level
  FROM public.usuarios u
  WHERE u.id = p_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_role = 'admin' OR v_admin_level >= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_forbidden');
  END IF;

  IF EXISTS (SELECT 1 FROM public.empresas e WHERE e.usuario_id = p_uid) THEN
    v_perfil := 'empresa';
  ELSIF EXISTS (SELECT 1 FROM public.profissionais p WHERE p.usuario_id = p_uid) THEN
    v_perfil := 'profissional';
  ELSIF EXISTS (SELECT 1 FROM public.turistas t WHERE t.usuario_id = p_uid) THEN
    v_perfil := 'turista';
  ELSIF v_role IN ('turista', 'profissional', 'empresa') THEN
    v_perfil := v_role;
  END IF;

  SELECT p.id INTO v_prof_id
  FROM public.profissionais p
  WHERE p.usuario_id = p_uid
  LIMIT 1;

  SELECT e.id INTO v_empresa_id
  FROM public.empresas e
  WHERE e.usuario_id = p_uid
  LIMIT 1;

  -- Corridas ainda não atribuídas: cancela em vez de bloquear.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'solicitacao_mobilidade'
  ) THEN
    UPDATE public.solicitacao_mobilidade
    SET status = 'cancelada'
    WHERE turista_id = p_uid
      AND status IN ('pendente', 'buscando', 'oferecida', 'sem_profissional');

    IF v_prof_id IS NOT NULL THEN
      UPDATE public.solicitacao_mobilidade
      SET status = 'cancelada'
      WHERE profissional_id = v_prof_id
        AND status IN ('pendente', 'buscando', 'oferecida');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.solicitacao_mobilidade sm
      WHERE sm.status IN (
        'aceita',
        'a_caminho',
        'no_local',
        'em_viagem',
        'agendada',
        'aguardando_confirmacao'
      )
        AND (
          sm.turista_id = p_uid
          OR (v_prof_id IS NOT NULL AND sm.profissional_id = v_prof_id)
        )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'active_ride');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reservas_hospedagem'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.reservas_hospedagem r
      WHERE r.turista_usuario_id = p_uid
        AND r.status IN ('pendente', 'confirmada')
        AND r.data_checkout >= CURRENT_DATE
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'active_reservation');
    END IF;

    IF v_empresa_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.reservas_hospedagem r
      WHERE r.empresa_id = v_empresa_id
        AND r.status IN ('pendente', 'confirmada')
        AND r.data_checkout >= CURRENT_DATE
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'active_reservation');
    END IF;
  END IF;

  IF v_prof_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'manifesto_diario'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.manifesto_diario m
      WHERE m.profissional_id = v_prof_id
        AND m.status IN ('confirmado', 'em_andamento')
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'active_manifesto');
    END IF;
  END IF;

  INSERT INTO public.contas_excluidas (perfil_tipo) VALUES (v_perfil);

  BEGIN
    DELETE FROM public.turistas WHERE usuario_id = p_uid;
    DELETE FROM public.profissionais WHERE usuario_id = p_uid;
    DELETE FROM public.empresas WHERE usuario_id = p_uid;
    DELETE FROM public.usuarios WHERE id = p_uid;
  EXCEPTION
    WHEN foreign_key_violation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'fk_blocked',
        'detail', SQLERRM
      );
  END;

  RETURN jsonb_build_object('ok', true, 'perfil', v_perfil);
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_conta_usuario (UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_conta_usuario (UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.excluir_conta_usuario (UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.excluir_conta_usuario (UUID) TO service_role;

COMMENT ON FUNCTION public.excluir_conta_usuario (UUID) IS
  'Exclui a conta (UGC via CASCADE) e anonimiza FKs legais (SET NULL). Só service_role.';
