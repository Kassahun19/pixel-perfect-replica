DROP POLICY IF EXISTS "categories_public_read" ON public.categories;

CREATE POLICY "categories_public_published_read"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.courses c
    WHERE c.category_id = categories.id
      AND c.status = 'published'::public.course_status
  )
);

CREATE POLICY "categories_instructor_read"
ON public.categories
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'instructor'::public.app_role));

DROP POLICY IF EXISTS "settings_public_read" ON public.academy_settings;
REVOKE SELECT ON public.academy_settings FROM anon;

CREATE POLICY "settings_staff_read"
ON public.academy_settings
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.public_academy_profile()
RETURNS TABLE (
  name text,
  tagline text,
  description text,
  email text,
  address text,
  website text,
  facebook text,
  telegram text,
  youtube text,
  linkedin text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.name,
    s.tagline,
    s.description,
    s.email,
    s.address,
    s.website,
    s.facebook,
    s.telegram,
    s.youtube,
    s.linkedin
  FROM public.academy_settings s
  WHERE s.id = 1
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.public_academy_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_academy_profile() TO anon, authenticated, service_role;