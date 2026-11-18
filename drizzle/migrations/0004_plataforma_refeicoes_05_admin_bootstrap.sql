-- =====================================================================
-- Plataforma de refeições por assinatura — 05: bootstrap do admin.
--
-- O papel de admin da plataforma vive só em platform_user_roles. A
-- migration 01 promoveu quem já era admin na tabela antiga user_roles
-- na hora em que rodou; contas criadas depois só ganham 'cliente' no
-- cadastro, e os demais papéis só um admin concede em /op/usuarios.
-- Sem nenhum admin, ninguém consegue abrir essa tela — por isso o
-- primeiro admin entra aqui, por e-mail, de forma idempotente: rodar
-- de novo não duplica nada e não mexe em nenhum outro papel.
-- =====================================================================

INSERT INTO public.platform_user_roles (user_id, role)
SELECT id, 'admin'::public.platform_role
  FROM auth.users
 WHERE email = 'gestao@fluxorbi.com'
ON CONFLICT DO NOTHING;
