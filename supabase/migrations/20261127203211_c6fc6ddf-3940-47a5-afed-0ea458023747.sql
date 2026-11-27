DROP FUNCTION IF EXISTS public.public_academy_profile();

DROP POLICY IF EXISTS "categories_instructor_read" ON public.categories;
CREATE POLICY "categories_instructor_read"
ON public.categories
FOR SELECT
TO authenticated
USING (public.has_role((select auth.uid()), 'instructor'::public.app_role));

DROP POLICY IF EXISTS "settings_staff_read" ON public.academy_settings;
CREATE POLICY "settings_staff_read"
ON public.academy_settings
FOR SELECT
TO authenticated
USING (public.is_staff((select auth.uid())));