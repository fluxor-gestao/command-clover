CREATE OR REPLACE FUNCTION public.list_users_with_roles()
 RETURNS TABLE(id uuid, email text, last_sign_in_at timestamp with time zone, created_at timestamp with time zone, role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = auth.uid() AND ur2.role = 'admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.last_sign_in_at,
    u.created_at,
    ur.role
  FROM auth.users u
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$function$;