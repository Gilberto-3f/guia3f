-- =====================================================
-- FASE 4.3 - SISTEMA DE INFRACOES E ADVERTENCIAS
-- =====================================================

CREATE TABLE IF NOT EXISTS infracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('leve', 'media', 'grave', 'gravissima')),
  categoria VARCHAR(20) NOT NULL CHECK (categoria IN ('profissional', 'empresa', 'turista', 'todos')),
  descricao VARCHAR(100) NOT NULL,
  penalidade_padrao VARCHAR(20) NOT NULL CHECK (penalidade_padrao IN ('advertencia', 'suspensao', 'banimento')),
  dias_suspensao_padrao INTEGER,
  alerta_preventivo BOOLEAN DEFAULT false,
  horas_alerta INTEGER DEFAULT 24,
  restricao_especifica JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_infracao_tipo_categoria_desc UNIQUE (tipo, categoria, descricao)
);

CREATE OR REPLACE FUNCTION update_infracoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_infracoes_updated_at ON infracoes;
CREATE TRIGGER trigger_infracoes_updated_at
BEFORE UPDATE ON infracoes
FOR EACH ROW
EXECUTE FUNCTION update_infracoes_updated_at();

INSERT INTO infracoes (tipo, categoria, descricao, penalidade_padrao, alerta_preventivo, horas_alerta) VALUES
('leve', 'profissional', 'Atraso sem justificativa (até 15min)', 'advertencia', true, 24),
('leve', 'profissional', 'Cancelamento de última hora (<10min)', 'advertencia', true, 24),
('leve', 'profissional', 'Veículo com aparência descuidada', 'advertencia', true, 24),
('leve', 'profissional', 'Ar condicionado não funcionando', 'advertencia', true, 24),
('leve', 'profissional', 'Atendimento pouco cordial', 'advertencia', true, 24),
('leve', 'profissional', 'Recusa de corrida curta', 'advertencia', true, 24),
('leve', 'profissional', 'Não atualizou status online/offline', 'advertencia', true, 24),
('leve', 'empresa', 'Horário de funcionamento desatualizado', 'advertencia', true, 24),
('leve', 'empresa', 'Fotos antigas ou desatualizadas', 'advertencia', true, 24),
('leve', 'empresa', 'Demora para responder reservas (>24h)', 'advertencia', true, 24),
('leve', 'empresa', 'Publicação com segmentação errada', 'advertencia', true, 24),
('leve', 'empresa', 'Preço informado incorretamente', 'advertencia', true, 24),
('leve', 'empresa', 'Descrição incompleta', 'advertencia', true, 24),
('leve', 'empresa', 'Não renovar/atualizar produtos Compras Paraguai', 'advertencia', true, 24),
('leve', 'turista', 'Não comparecimento sem aviso', 'advertencia', true, 24),
('leve', 'turista', 'Avaliação injusta ou exagerada', 'advertencia', true, 24),
('leve', 'turista', 'Linguagem inadequada no chat', 'advertencia', true, 24),
('leve', 'turista', 'Tentativa de negociar preço após contratação', 'advertencia', true, 24),
('leve', 'turista', 'Informações incorretas no cadastro', 'advertencia', true, 24),
('leve', 'turista', 'Danos ao veículo por negligência', 'advertencia', true, 24),
('media', 'todos', 'Reincidência em infrações leves (3+ vezes)', 'suspensao', false, 24),
('media', 'turista', 'Comentário ofensivo em avaliação', 'suspensao', false, 24),
('media', 'profissional', 'Descumprimento de rota combinada', 'suspensao', false, 24),
('media', 'profissional', 'Cobrança de valor maior que o combinado', 'suspensao', false, 24),
('media', 'profissional', 'Indicação falsa de parceiro', 'suspensao', false, 24),
('media', 'profissional', 'Exercício ilegal da profissão', 'suspensao', false, 24),
('media', 'profissional', 'Documento vencido ou desatualizado', 'advertencia', false, 24),
('media', 'empresa', 'Publicidade enganosa (diferença pequena)', 'advertencia', false, 24),
('media', 'empresa', 'Reservas confirmadas não honradas', 'suspensao', false, 24),
('grave', 'todos', 'Assédio verbal ou moral', 'suspensao', false, 24),
('grave', 'todos', 'Tentativa de golpe (pequeno valor)', 'suspensao', false, 24),
('grave', 'profissional', 'Uso de documentos falsos', 'suspensao', false, 24),
('grave', 'empresa', 'Uso de documentos falsos', 'suspensao', false, 24),
('grave', 'profissional', 'Dirigir embriagado ou sob efeito de drogas', 'suspensao', false, 24),
('grave', 'profissional', 'Extravio de pertences sem providências', 'suspensao', false, 24),
('grave', 'todos', 'Furto de pequeno valor', 'suspensao', false, 24),
('grave', 'todos', 'Violação de políticas de privacidade', 'suspensao', false, 24),
('gravissima', 'todos', 'Discriminação/preconceito', 'banimento', false, 24),
('gravissima', 'todos', 'Violência física', 'banimento', false, 24),
('gravissima', 'todos', 'Assédio sexual', 'banimento', false, 24),
('gravissima', 'todos', 'Furto de alto valor', 'banimento', false, 24),
('gravissima', 'todos', 'Uso da plataforma para tráfico', 'banimento', false, 24),
('gravissima', 'todos', 'Documento falso com dolo', 'banimento', false, 24),
('gravissima', 'todos', 'Reincidência em suspensões graves', 'banimento', false, 24),
('gravissima', 'todos', 'Criar múltiplas contas para burlar bloqueio', 'banimento', false, 24)
ON CONFLICT (tipo, categoria, descricao) DO NOTHING;

CREATE TABLE IF NOT EXISTS advertencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE advertencias ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days';
ALTER TABLE advertencias ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ativa' CHECK (status IN ('ativa', 'expirada', 'cumprida'));
ALTER TABLE advertencias ADD COLUMN IF NOT EXISTS alerta_preventivo_aplicado BOOLEAN DEFAULT false;
ALTER TABLE advertencias ADD COLUMN IF NOT EXISTS alerta_enviado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS banimentos_confirmacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  denuncia_id UUID REFERENCES denuncias(id),
  solicitado_por UUID NOT NULL REFERENCES usuarios(id),
  confirmado_por UUID REFERENCES usuarios(id),
  confirmado_em TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'recusado')),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_decisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  tipo VARCHAR(20) NOT NULL,
  infracao_id UUID REFERENCES infracoes(id),
  titulo VARCHAR(100) NOT NULL,
  descricao TEXT,
  penalidade_aplicada VARCHAR(20),
  duracao_dias INTEGER,
  data_aplicacao TIMESTAMPTZ DEFAULT NOW(),
  data_expiracao TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'ativo',
  justificativa TEXT,
  recurso_interposto BOOLEAN DEFAULT false,
  recurso_status VARCHAR(20),
  visualizado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION aplicar_alerta_preventivo(
  p_usuario_id UUID,
  p_infracao_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_infracao RECORD;
BEGIN
  SELECT * INTO v_infracao FROM infracoes WHERE id = p_infracao_id;
  IF v_infracao.id IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Infracao nao encontrada');
  END IF;
  IF NOT v_infracao.alerta_preventivo THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Infracao nao permite alerta preventivo');
  END IF;

  IF EXISTS (
    SELECT 1 FROM historico_decisoes
    WHERE usuario_id = p_usuario_id
      AND tipo = 'alerta_preventivo'
      AND status = 'ativo'
      AND data_expiracao > NOW()
  ) THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Alerta preventivo ja existe');
  END IF;

  INSERT INTO historico_decisoes (
    usuario_id, tipo, infracao_id, titulo, descricao, data_expiracao, status
  ) VALUES (
    p_usuario_id,
    'alerta_preventivo',
    p_infracao_id,
    'Alerta Preventivo: ' || v_infracao.descricao,
    'Voce tem ' || v_infracao.horas_alerta || ' horas para corrigir esta situacao antes de receber uma advertencia.',
    NOW() + (v_infracao.horas_alerta || ' hours')::INTERVAL,
    'ativo'
  );

  INSERT INTO logs_verificacao (tipo, perfil_id, acao, admin_id, admin_email, admin_nivel, detalhes)
  VALUES (
    'alerta_preventivo',
    p_usuario_id,
    'aplicado_alerta',
    NULL,
    'sistema@guia3f.com.br',
    0,
    jsonb_build_object('infracao', v_infracao.descricao)
  );

  RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Alerta preventivo aplicado com sucesso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expirar_advertencias()
RETURNS INTEGER AS $$
DECLARE
  v_quantidade INTEGER;
BEGIN
  UPDATE advertencias
  SET status = 'expirada'
  WHERE expira_em < NOW()
    AND status = 'ativa';

  GET DIAGNOSTICS v_quantidade = ROW_COUNT;
  RETURN v_quantidade;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION escalonar_penalidade(
  p_usuario_id UUID,
  p_tipo_usuario VARCHAR,
  p_infracao_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_quantidade_advertencias INTEGER;
  v_infracao RECORD;
  v_penalidade VARCHAR;
  v_dias INTEGER;
BEGIN
  SELECT * INTO v_infracao FROM infracoes WHERE id = p_infracao_id;
  IF v_infracao.id IS NULL THEN
    RETURN jsonb_build_object('penalidade', NULL, 'dias', NULL);
  END IF;

  SELECT COUNT(*) INTO v_quantidade_advertencias
  FROM advertencias
  WHERE usuario_id = p_usuario_id
    AND status = 'ativa';

  IF v_infracao.tipo = 'leve' THEN
    IF v_quantidade_advertencias = 0 THEN
      v_penalidade := 'advertencia';
    ELSIF v_quantidade_advertencias = 1 THEN
      v_penalidade := 'advertencia_restricao';
    ELSE
      v_penalidade := 'suspensao';
      v_dias := 7;
    END IF;
  ELSIF v_infracao.tipo = 'media' THEN
    IF v_quantidade_advertencias = 0 THEN
      v_penalidade := 'advertencia_restricao';
    ELSIF v_quantidade_advertencias = 1 THEN
      v_penalidade := 'suspensao';
      v_dias := 15;
    ELSE
      v_penalidade := 'banimento';
    END IF;
  ELSIF v_infracao.tipo = 'grave' THEN
    v_penalidade := 'suspensao';
    v_dias := COALESCE(v_infracao.dias_suspensao_padrao, 30);
  ELSE
    v_penalidade := 'banimento';
  END IF;

  RETURN jsonb_build_object('penalidade', v_penalidade, 'dias', v_dias);
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_historico_decisoes_usuario ON historico_decisoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_historico_decisoes_status ON historico_decisoes (status);
CREATE INDEX IF NOT EXISTS idx_advertencias_usuario ON advertencias (usuario_id);
CREATE INDEX IF NOT EXISTS idx_advertencias_expira ON advertencias (expira_em);
CREATE INDEX IF NOT EXISTS idx_banimentos_confirmacao_status ON banimentos_confirmacao (status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('expirar-advertencias', '0 0 * * *', 'SELECT expirar_advertencias();');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
