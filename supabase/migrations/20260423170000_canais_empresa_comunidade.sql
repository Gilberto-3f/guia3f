-- =====================================================
-- Canais por empresa + comunidade de profissionais
-- Objetivo:
-- - Cada empresa possui um canal por comunidade (Guia, Taxista, Van, Motorista de App, Anfitriao)
-- - Profissionais veem os canais das empresas filtrados pela(s) sua(s) comunidade(s)
-- - Mantém canais globais existentes (Turismo, ADM, Financeiro, etc.)
-- =====================================================

-- 1) Estrutura: metadados do canal da empresa
ALTER TABLE canais
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas (id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS comunidade_prof TEXT,
ADD COLUMN IF NOT EXISTS empresa_categoria TEXT;

COMMENT ON COLUMN canais.empresa_id IS 'Quando preenchido: canal pertence a uma empresa (um por comunidade).';
COMMENT ON COLUMN canais.comunidade_prof IS 'Comunidade profissional alvo: Guia, Taxista, Van, Motorista de App, Anfitriao.';
COMMENT ON COLUMN canais.empresa_categoria IS 'Categoria da empresa (ex.: Restaurantes, Atrativos, Lojas, Hospedagem) para agrupar no app.';

CREATE INDEX IF NOT EXISTS idx_canais_empresa_id ON canais (empresa_id);
CREATE INDEX IF NOT EXISTS idx_canais_comunidade_prof ON canais (comunidade_prof);
CREATE INDEX IF NOT EXISTS idx_canais_empresa_categoria ON canais (empresa_categoria);

-- 2) Unicidade: canais globais continuam únicos por (nome, tipo_publico).
--    Canais de empresa passam a ser únicos por (empresa_id, comunidade_prof).
ALTER TABLE canais DROP CONSTRAINT IF EXISTS canais_nome_tipo_publico_key;

DROP INDEX IF EXISTS canais_unique_global_nome_tipo;
CREATE UNIQUE INDEX canais_unique_global_nome_tipo
ON canais (nome, tipo_publico)
WHERE empresa_id IS NULL AND comunidade_prof IS NULL;

DROP INDEX IF EXISTS canais_unique_empresa_comunidade;
CREATE UNIQUE INDEX canais_unique_empresa_comunidade
ON canais (empresa_id, comunidade_prof)
WHERE empresa_id IS NOT NULL AND tipo_publico = 'empresa';

-- 3) Função + trigger: ao inserir empresa, cria 1 canal por comunidade (idempotente).
CREATE OR REPLACE FUNCTION public.criar_canais_empresa_comunidade ()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comunidades TEXT[] := ARRAY['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao'];
  c TEXT;
BEGIN
  FOREACH c IN ARRAY comunidades LOOP
    INSERT INTO public.canais (
      nome,
      tipo_publico,
      categoria,
      pais,
      ordem_tipo,
      ordem_posicao,
      ativo,
      empresa_id,
      comunidade_prof,
      empresa_categoria
    )
    VALUES (
      NEW.nome_fantasia,
      'empresa',
      NULL,
      'geral',
      'rotativo',
      NULL,
      TRUE,
      NEW.id,
      c,
      NEW.categoria
    )
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE
    SET
      nome = EXCLUDED.nome,
      empresa_categoria = EXCLUDED.empresa_categoria,
      ativo = TRUE;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_criar_canais_comunidade ON public.empresas;
CREATE TRIGGER trg_empresas_criar_canais_comunidade
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.criar_canais_empresa_comunidade ();

-- 4) Backfill: cria canais para empresas existentes (idempotente)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, nome_fantasia, categoria FROM public.empresas LOOP
    -- simula o trigger chamando a mesma lógica via INSERT dummy (sem side-effects)
    -- preferimos chamar a função diretamente com NEW via INSERT em temp? aqui: reusa o INSERT via loop
    INSERT INTO public.canais (nome, tipo_publico, pais, ordem_tipo, ativo, empresa_id, comunidade_prof, empresa_categoria)
    VALUES (r.nome_fantasia, 'empresa', 'geral', 'rotativo', TRUE, r.id, 'Guia', r.categoria)
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE SET nome = EXCLUDED.nome, empresa_categoria = EXCLUDED.empresa_categoria, ativo = TRUE;

    INSERT INTO public.canais (nome, tipo_publico, pais, ordem_tipo, ativo, empresa_id, comunidade_prof, empresa_categoria)
    VALUES (r.nome_fantasia, 'empresa', 'geral', 'rotativo', TRUE, r.id, 'Taxista', r.categoria)
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE SET nome = EXCLUDED.nome, empresa_categoria = EXCLUDED.empresa_categoria, ativo = TRUE;

    INSERT INTO public.canais (nome, tipo_publico, pais, ordem_tipo, ativo, empresa_id, comunidade_prof, empresa_categoria)
    VALUES (r.nome_fantasia, 'empresa', 'geral', 'rotativo', TRUE, r.id, 'Van', r.categoria)
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE SET nome = EXCLUDED.nome, empresa_categoria = EXCLUDED.empresa_categoria, ativo = TRUE;

    INSERT INTO public.canais (nome, tipo_publico, pais, ordem_tipo, ativo, empresa_id, comunidade_prof, empresa_categoria)
    VALUES (r.nome_fantasia, 'empresa', 'geral', 'rotativo', TRUE, r.id, 'Motorista de App', r.categoria)
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE SET nome = EXCLUDED.nome, empresa_categoria = EXCLUDED.empresa_categoria, ativo = TRUE;

    INSERT INTO public.canais (nome, tipo_publico, pais, ordem_tipo, ativo, empresa_id, comunidade_prof, empresa_categoria)
    VALUES (r.nome_fantasia, 'empresa', 'geral', 'rotativo', TRUE, r.id, 'Anfitriao', r.categoria)
    ON CONFLICT (empresa_id, comunidade_prof) DO UPDATE SET nome = EXCLUDED.nome, empresa_categoria = EXCLUDED.empresa_categoria, ativo = TRUE;
  END LOOP;
END $$;

