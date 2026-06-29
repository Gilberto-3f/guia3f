-- Convites admin: vínculo por usuário + status recusado
ALTER TABLE public.convites_admin
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES public.usuarios (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_convites_admin_usuario ON public.convites_admin (usuario_id, status);

ALTER TABLE public.convites_admin DROP CONSTRAINT IF EXISTS convites_admin_status_check;

ALTER TABLE public.convites_admin
ADD CONSTRAINT convites_admin_status_check CHECK (
  status IN ('pendente', 'aceito', 'expirado', 'recusado')
);

ALTER TABLE public.convites_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "convites_admin select convidado ou geral" ON public.convites_admin;
CREATE POLICY "convites_admin select convidado ou geral" ON public.convites_admin FOR SELECT
USING (
  usuario_id = auth.uid ()
  OR EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid () AND u.admin_level = 1
  )
);

COMMENT ON COLUMN public.convites_admin.usuario_id IS 'Usuário convidado (localizado por username).';
