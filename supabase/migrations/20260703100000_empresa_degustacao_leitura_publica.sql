-- Degustação ativa: leitura para qualquer usuário autenticado (página no guia, serviços e canais)

DROP POLICY IF EXISTS empresa_degustacoes_select ON public.empresa_degustacoes;

CREATE POLICY empresa_degustacoes_select ON public.empresa_degustacoes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = empresa_degustacoes.empresa_id AND e.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id = auth.uid() AND u.role = 'admin'
  )
  OR (
    status = 'ativa'
    AND expira_em IS NOT NULL
    AND expira_em > NOW()
  )
);

COMMENT ON POLICY empresa_degustacoes_select ON public.empresa_degustacoes IS
  'Dono/ADM veem todas; demais usuários autenticados veem apenas degustação ativa (serviços públicos no guia).';
