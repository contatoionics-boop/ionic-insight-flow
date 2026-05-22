-- Trigger: bloqueia alteração de permissoes_extras / ativo / email / id pelo próprio usuário
-- Super admin contorna pois roda na policy de super_admin (mas como o trigger roda sempre,
-- precisamos permitir quando o autor é super_admin).
CREATE OR REPLACE FUNCTION public.profiles_block_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for super_admin executando, permite tudo
  IF public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Caso contrário (usuário editando o próprio perfil), apenas 'nome' pode mudar
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.ativo IS DISTINCT FROM OLD.ativo
     OR NEW.permissoes_extras IS DISTINCT FROM OLD.permissoes_extras THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar email, ativo, permissoes_extras ou id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_block_self_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_block_self_privilege_escalation();