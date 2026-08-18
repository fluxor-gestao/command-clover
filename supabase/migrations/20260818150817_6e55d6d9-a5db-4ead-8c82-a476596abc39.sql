-- Ensure RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy to allow admins to manage roles
-- We use a subquery to avoid recursion issues IF the has_role function is not already stable
CREATE POLICY "Admins can manage all roles" ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Policy to allow users to see their own roles
CREATE POLICY "Users can see own roles" ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Security Definer function to list users with roles (bypass auth schema restrictions)
CREATE OR REPLACE FUNCTION public.list_users_with_roles()
RETURNS TABLE (
  id uuid,
  email text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  role public.app_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Only admins can call this
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
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
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  ORDER BY u.created_at DESC;
END;
$$;

-- Grant execute to authenticated users (internal check handles role validation)
GRANT EXECUTE ON FUNCTION public.list_users_with_roles() TO authenticated;
