-- Fase 1: perfis admin + dados de teste
-- Pré-requisito: contas admin já criadas em auth.users

WITH admin_targets AS (
  SELECT *
  FROM (
    VALUES
      (
        'admin.geral@guia3f.com.br',
        1,
        '{
          "nivel": 1,
          "cargo": "ADM_GERAL",
          "modulos": ["*"],
          "recursos": ["*"],
          "comunidade": null
        }'::jsonb
      ),
      (
        'moderador.guias@guia3f.com.br',
        2,
        '{
          "nivel": 2,
          "cargo": "MODERADOR",
          "modulos": ["visao_geral","verificacao_turistas","verificacao_profissionais","denuncias_turistas","denuncias_profissionais","espaco_graficos","espaco_empresas","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar"],
          "comunidade": "guias"
        }'::jsonb
      ),
      (
        'moderador.taxistas@guia3f.com.br',
        2,
        '{
          "nivel": 2,
          "cargo": "MODERADOR",
          "modulos": ["visao_geral","verificacao_turistas","verificacao_profissionais","denuncias_turistas","denuncias_profissionais","espaco_graficos","espaco_empresas","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar"],
          "comunidade": "taxistas"
        }'::jsonb
      ),
      (
        'moderador.apps@guia3f.com.br',
        2,
        '{
          "nivel": 2,
          "cargo": "MODERADOR",
          "modulos": ["visao_geral","verificacao_turistas","verificacao_profissionais","denuncias_turistas","denuncias_profissionais","espaco_graficos","espaco_empresas","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar"],
          "comunidade": "apps"
        }'::jsonb
      ),
      (
        'moderador.vans@guia3f.com.br',
        2,
        '{
          "nivel": 2,
          "cargo": "MODERADOR",
          "modulos": ["visao_geral","verificacao_turistas","verificacao_profissionais","denuncias_turistas","denuncias_profissionais","espaco_graficos","espaco_empresas","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar"],
          "comunidade": "vans"
        }'::jsonb
      ),
      (
        'moderador.anfitrioes@guia3f.com.br',
        2,
        '{
          "nivel": 2,
          "cargo": "MODERADOR",
          "modulos": ["visao_geral","verificacao_turistas","verificacao_profissionais","denuncias_turistas","denuncias_profissionais","espaco_graficos","espaco_empresas","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar"],
          "comunidade": "anfitrioes"
        }'::jsonb
      ),
      (
        'financeiro@guia3f.com.br',
        3,
        '{
          "nivel": 3,
          "cargo": "FINANCEIRO",
          "modulos": ["visao_geral","verificacao_turistas","verificacao_empresas","denuncias_empresas","espaco_graficos","espaco_empresas","espaco_financeiro","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar","editar_planos","editar_comissoes","exportar_logs"],
          "comunidade": null
        }'::jsonb
      ),
      (
        'suporte@guia3f.com.br',
        4,
        '{
          "nivel": 4,
          "cargo": "SUPORTE",
          "modulos": ["visao_geral","verificacao_turistas","denuncias_turistas","espaco_graficos","espaco_empresas","config_logs"],
          "recursos": ["aprovar","reprovar","resolver","advertir","suspender","banir","arquivar"],
          "comunidade": null
        }'::jsonb
      )
  ) t(email, admin_level, admin_permissoes)
)
INSERT INTO usuarios (id, email, role, admin_level, admin_permissoes, status)
SELECT
  au.id,
  at.email,
  'admin',
  at.admin_level,
  at.admin_permissoes,
  'ativo'
FROM admin_targets at
JOIN auth.users au
  ON lower(au.email) = lower(at.email)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  admin_level = EXCLUDED.admin_level,
  admin_permissoes = EXCLUDED.admin_permissoes,
  status = 'ativo';

-- Promover usuario existente para ADM GERAL
WITH target_auth AS (
  SELECT id, email
  FROM auth.users
  WHERE lower(email) = lower('grupocaciquebr@gmail.com')
  LIMIT 1
)
INSERT INTO usuarios (id, email, role, admin_level, admin_permissoes, status)
SELECT
  ta.id,
  ta.email,
  'admin',
  1,
  '{
    "nivel": 1,
    "cargo": "ADM_GERAL",
    "modulos": ["*"],
    "recursos": ["*"],
    "comunidade": null
  }'::jsonb,
  'ativo'
FROM target_auth ta
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = 'admin',
  admin_level = 1,
  admin_permissoes = EXCLUDED.admin_permissoes,
  status = 'ativo';

-- Turistas de teste
DO $$
DECLARE
  i INTEGER;
  user_id UUID;
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO usuarios (id, email, role, created_at)
    VALUES (
      gen_random_uuid(),
      'turista' || i || '@exemplo.com',
      'turista',
      NOW() - (random() * 365) * INTERVAL '1 day'
    )
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO user_id FROM usuarios WHERE email = 'turista' || i || '@exemplo.com' LIMIT 1;

    IF user_id IS NOT NULL THEN
      INSERT INTO turistas (id, usuario_id, nome_completo, nome_usuario, created_at)
      VALUES (
        gen_random_uuid(),
        user_id,
        'Turista ' || i,
        'turista' || i,
        NOW() - (random() * 365) * INTERVAL '1 day'
      )
      ON CONFLICT (usuario_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Profissionais de teste
DO $$
DECLARE
  i INTEGER;
  user_id UUID;
  categorias TEXT[] := ARRAY['guias', 'taxistas', 'apps', 'vans', 'anfitrioes'];
  categoria TEXT;
  placa_vermelha BOOLEAN;
BEGIN
  FOR i IN 1..50 LOOP
    categoria := categorias[1 + floor(random() * array_length(categorias, 1))];
    placa_vermelha := categoria IN ('guias', 'taxistas', 'vans');

    INSERT INTO usuarios (id, email, role, created_at)
    VALUES (
      gen_random_uuid(),
      'profissional' || i || '@exemplo.com',
      'profissional',
      NOW() - (random() * 365) * INTERVAL '1 day'
    )
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO user_id FROM usuarios WHERE email = 'profissional' || i || '@exemplo.com' LIMIT 1;

    IF user_id IS NOT NULL THEN
      INSERT INTO profissionais (id, usuario_id, nome_completo, nome_usuario, categorias, placa_vermelha, created_at)
      VALUES (
        gen_random_uuid(),
        user_id,
        'Profissional ' || i,
        'profissional' || i,
        jsonb_build_array(categoria),
        placa_vermelha,
        NOW() - (random() * 365) * INTERVAL '1 day'
      )
      ON CONFLICT (usuario_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Empresas de teste
DO $$
DECLARE
  i INTEGER;
  user_id UUID;
  categorias TEXT[] := ARRAY['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem', 'Compras Paraguai'];
  cidades TEXT[] := ARRAY['Foz do Iguacu', 'Ciudad del Este', 'Puerto Iguazu'];
BEGIN
  FOR i IN 1..30 LOOP
    INSERT INTO usuarios (id, email, role, created_at)
    VALUES (
      gen_random_uuid(),
      'empresa' || i || '@exemplo.com',
      'empresa',
      NOW() - (random() * 365) * INTERVAL '1 day'
    )
    ON CONFLICT (email) DO NOTHING;

    SELECT id INTO user_id FROM usuarios WHERE email = 'empresa' || i || '@exemplo.com' LIMIT 1;

    IF user_id IS NOT NULL THEN
      INSERT INTO empresas (id, usuario_id, nome_fantasia, nome_usuario, categoria, cidade, endereco, descricao_curta, created_at)
      VALUES (
        gen_random_uuid(),
        user_id,
        'Empresa ' || i,
        'empresa' || i,
        categorias[1 + floor(random() * array_length(categorias, 1))],
        cidades[1 + floor(random() * array_length(cidades, 1))],
        'Endereco teste ' || i,
        'Descricao de teste da empresa ' || i,
        NOW() - (random() * 365) * INTERVAL '1 day'
      )
      ON CONFLICT (usuario_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

