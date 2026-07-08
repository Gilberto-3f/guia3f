-- Restaura leitura/atualização em `usuarios` após ENABLE RLS sem policies de SELECT em produção.
-- Sem estas policies, perfil social, canais, feed e barra inferiores falham silenciosamente (RLS → 0 linhas).

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver dados básicos de outros" ON public.usuarios;
CREATE POLICY "Usuários podem ver dados básicos de outros" ON public.usuarios
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Usuários podem inserir próprio registro" ON public.usuarios;
CREATE POLICY "Usuários podem inserir próprio registro" ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated' AND id = auth.uid());

DROP POLICY IF EXISTS "Usuários podem atualizar próprio registro" ON public.usuarios;
CREATE POLICY "Usuários podem atualizar próprio registro" ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "usuarios update admin status" ON public.usuarios;
CREATE POLICY "usuarios update admin status" ON public.usuarios
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = auth.uid()
      AND u.role = 'admin'
  )
);
