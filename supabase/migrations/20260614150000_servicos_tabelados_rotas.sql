-- Rotas de serviços tabelados (ADM → profissionais placa vermelha + base comissões)

CREATE TABLE IF NOT EXISTS public.servicos_tabelados_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria VARCHAR(32) NOT NULL
    CHECK (categoria IN ('guia', 'van', 'taxista', 'motorista_app')),
  cidade_origem VARCHAR(32) NOT NULL
    CHECK (cidade_origem IN ('cde', 'foz', 'puerto_iguazu')),
  ponto_partida VARCHAR(120) NOT NULL,
  destino_final VARCHAR(200) NOT NULL,
  valor_rota DECIMAL(10, 2) NOT NULL CHECK (valor_rota >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por UUID NULL REFERENCES public.usuarios (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicos_tabelados_cat_cidade
  ON public.servicos_tabelados_rotas (categoria, cidade_origem)
  WHERE ativo = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_servicos_tabelados_rota_unica
  ON public.servicos_tabelados_rotas (categoria, cidade_origem, lower(destino_final))
  WHERE ativo = TRUE;

ALTER TABLE public.servicos_tabelados_rotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS servicos_tabelados_select ON public.servicos_tabelados_rotas;
CREATE POLICY servicos_tabelados_select ON public.servicos_tabelados_rotas FOR SELECT TO authenticated
USING (ativo = TRUE);

DROP POLICY IF EXISTS servicos_tabelados_admin_manage ON public.servicos_tabelados_rotas;
CREATE POLICY servicos_tabelados_admin_manage ON public.servicos_tabelados_rotas FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin')
);

GRANT SELECT ON public.servicos_tabelados_rotas TO authenticated;
