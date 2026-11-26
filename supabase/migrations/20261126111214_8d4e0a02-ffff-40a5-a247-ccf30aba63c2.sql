CREATE POLICY "course_covers_creator_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-covers'
    AND (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'instructor'::public.app_role))
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "course_covers_creator_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.is_staff(auth.uid()))
  );

CREATE POLICY "course_covers_creator_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-covers'
    AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.is_staff(auth.uid()))
  );