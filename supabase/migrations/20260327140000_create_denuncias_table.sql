-- =====================================================
-- FASE 4 - GESTAO DE DENUNCIAS
-- =====================================================

CREATE TABLE IF NOT EXISTS denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denunciante_id UUID NOT NULL REFERENCES usuarios(id),
  denunciado_id UUID NOT NULL,
  denunciado_tipo VARCHAR(20) NOT NULL CHECK (denunciado_tipo IN ('turista', 'profissional', 'empresa')),
  motivo VARCHAR(100) NOT NULL,
  descricao TEXT,
  evidencias JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_investigacao', 'encerrada', 'arquivada')),
  gravidade VARCHAR(10) CHECK (gravidade IN ('leve', 'media', 'grave')),
  responsavel_id UUID REFERENCES usuarios(id),
  analisado_em TIMESTAMPTZ,
  analisado_por UUID REFERENCES usuarios(id),
  penalidade_aplicada VARCHAR(20) CHECK (penalidade_aplicada IN ('advertencia', 'suspensao', 'banimento')),
  penalidade_detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_denuncias_denunciado ON denuncias (denunciado_id, denunciado_tipo);
CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias (status);
CREATE INDEX IF NOT EXISTS idx_denuncias_created_at ON denuncias (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_denuncias_responsavel ON denuncias (responsavel_id);

CREATE OR REPLACE FUNCTION update_denuncias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_denuncias_updated_at ON denuncias;
CREATE TRIGGER trigger_denuncias_updated_at
BEFORE UPDATE ON denuncias
FOR EACH ROW
EXECUTE FUNCTION update_denuncias_updated_at();

CREATE OR REPLACE FUNCTION calcular_gravidade_denuncia(p_denunciado_id UUID, p_denunciado_tipo VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_total_denuncias INTEGER;
  v_tem_conteudo_grave BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_total_denuncias
  FROM denuncias
  WHERE denunciado_id = p_denunciado_id
    AND denunciado_tipo = p_denunciado_tipo
    AND status <> 'arquivada';

  v_tem_conteudo_grave := FALSE;

  IF v_tem_conteudo_grave THEN
    RETURN 'grave';
  ELSIF v_total_denuncias >= 4 THEN
    RETURN 'grave';
  ELSIF v_total_denuncias >= 2 THEN
    RETURN 'media';
  ELSE
    RETURN 'leve';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3 dias uteis aproximados para SLA operacional (segunda a sexta)
CREATE OR REPLACE FUNCTION add_business_days(p_start TIMESTAMPTZ, p_days INTEGER)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_date TIMESTAMPTZ := p_start;
  v_added INTEGER := 0;
BEGIN
  WHILE v_added < p_days LOOP
    v_date := v_date + INTERVAL '1 day';
    IF EXTRACT(ISODOW FROM v_date) BETWEEN 1 AND 5 THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reatribuir_denuncias_expiradas()
RETURNS INTEGER AS $$
DECLARE
  v_admin_geral UUID;
  v_count INTEGER := 0;
BEGIN
  SELECT id INTO v_admin_geral
  FROM usuarios
  WHERE role = 'admin' AND admin_level = 1
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_geral IS NULL THEN
    RETURN 0;
  END IF;

  WITH moved AS (
    UPDATE denuncias
    SET responsavel_id = v_admin_geral
    WHERE status = 'em_investigacao'
      AND add_business_days(created_at, 3) < NOW()
      AND (responsavel_id IS NULL OR responsavel_id <> v_admin_geral)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM moved;

  IF v_count > 0 THEN
    INSERT INTO logs_verificacao (tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, detalhes)
    VALUES (
      'sistema',
      gen_random_uuid(),
      'reatribuicao_denuncias_expiradas',
      v_admin_geral,
      'sistema@guia3f.com.br',
      0,
      jsonb_build_object('quantidade', v_count)
    );
  END IF;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE denuncias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS denuncias_admin_geral ON denuncias;
CREATE POLICY denuncias_admin_geral ON denuncias
FOR ALL USING (auth.uid() IN (SELECT id FROM usuarios WHERE admin_level = 1));

DROP POLICY IF EXISTS denuncias_moderador ON denuncias;
CREATE POLICY denuncias_moderador ON denuncias
FOR ALL USING (
  auth.uid() IN (
    SELECT id
    FROM usuarios
    WHERE admin_level = 2
      AND admin_permissoes->>'comunidade' IS NOT NULL
  )
  AND denunciado_tipo = 'profissional'
);

DROP POLICY IF EXISTS denuncias_financeiro ON denuncias;
CREATE POLICY denuncias_financeiro ON denuncias
FOR ALL USING (
  auth.uid() IN (SELECT id FROM usuarios WHERE admin_level = 3)
  AND denunciado_tipo = 'empresa'
);

DROP POLICY IF EXISTS denuncias_suporte ON denuncias;
CREATE POLICY denuncias_suporte ON denuncias
FOR ALL USING (
  auth.uid() IN (SELECT id FROM usuarios WHERE admin_level = 4)
  AND denunciado_tipo = 'turista'
);
