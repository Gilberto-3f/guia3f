-- =====================================================
-- FASE 3.4 - EXECUCAO MANUAL DE LIMPEZA
-- =====================================================

CREATE OR REPLACE FUNCTION executar_limpeza_acessos_expirados()
RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_admin_email TEXT;
  v_admin_nivel INTEGER;
  v_antes INTEGER;
  v_depois INTEGER;
  v_novos INTEGER;
  v_detalhes JSONB;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida';
  END IF;

  SELECT admin_level, COALESCE(email, username || '@guia3f.local')
    INTO v_admin_nivel, v_admin_email
  FROM usuarios
  WHERE id = v_admin_id;

  IF v_admin_nivel IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Apenas ADM GERAL pode executar a limpeza manual';
  END IF;

  SELECT COUNT(*) INTO v_antes
  FROM solicitacoes_acesso_docs
  WHERE status = 'expirado';

  PERFORM limpar_acessos_expirados();

  SELECT COUNT(*) INTO v_depois
  FROM solicitacoes_acesso_docs
  WHERE status = 'expirado';

  v_novos := GREATEST(v_depois - v_antes, 0);

  v_detalhes := jsonb_build_object(
    'quantidade_expirados', v_novos,
    'total_expirados', v_depois,
    'executado_em', NOW(),
    'executado_por', v_admin_id
  );

  INSERT INTO logs_verificacao (
    tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, detalhes
  ) VALUES (
    'sistema',
    gen_random_uuid(),
    'executado_limpeza_expirados',
    v_admin_id,
    v_admin_email,
    v_admin_nivel,
    v_detalhes
  );

  RETURN v_detalhes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
