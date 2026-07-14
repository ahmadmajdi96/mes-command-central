
-- ============ ORDER FEEDBACK ============
CREATE TABLE IF NOT EXISTS public.order_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  category text NOT NULL DEFAULT 'general',
  comment text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_feedback TO authenticated;
GRANT ALL ON public.order_feedback TO service_role;
ALTER TABLE public.order_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_feedback authed read" ON public.order_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "order_feedback authed write" ON public.order_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER order_feedback_updated BEFORE UPDATE ON public.order_feedback FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS order_feedback_order_idx ON public.order_feedback(order_id);

-- ============ DYNAMIC ROLES ============
CREATE TABLE IF NOT EXISTS public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_roles read authed" ON public.app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_roles write admin" ON public.app_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER app_roles_updated BEFORE UPDATE ON public.app_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.app_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.app_roles(id) ON DELETE CASCADE,
  resource text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, resource)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_role_permissions TO authenticated;
GRANT ALL ON public.app_role_permissions TO service_role;
ALTER TABLE public.app_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_role_permissions read authed" ON public.app_role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_role_permissions write admin" ON public.app_role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER app_role_permissions_updated BEFORE UPDATE ON public.app_role_permissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.user_app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.app_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_app_roles TO authenticated;
GRANT ALL ON public.user_app_roles TO service_role;
ALTER TABLE public.user_app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_app_roles read authed" ON public.user_app_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_app_roles write admin" ON public.user_app_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES additions ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;

-- Backfill email + display_name from auth.users so admin listing works
UPDATE public.profiles p SET email = u.email
FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;

-- Extend new-user trigger to store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'operator')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- ============ PERMISSION CHECK FN ============
CREATE OR REPLACE FUNCTION public.has_permission(_user uuid, _resource text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_app_roles uar
      JOIN public.app_role_permissions p ON p.role_id = uar.role_id
      WHERE uar.user_id = _user
        AND p.resource = _resource
        AND (
          (_action = 'read'   AND p.can_read)   OR
          (_action = 'create' AND p.can_create) OR
          (_action = 'update' AND p.can_update) OR
          (_action = 'delete' AND p.can_delete)
        )
    );
$$;
