GRANT EXECUTE ON FUNCTION public.has_permissao_extra(uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_pode_ver_formulario(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_caso_codigo() TO authenticated;