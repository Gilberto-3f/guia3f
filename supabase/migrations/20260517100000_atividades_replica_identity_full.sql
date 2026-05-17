-- Realtime DELETE: envia `old` completo (ex.: id) para remoção imediata na aba Atividades.
ALTER TABLE public.atividades REPLICA IDENTITY FULL;
