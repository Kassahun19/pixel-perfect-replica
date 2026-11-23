-- 1. Receipt file attached to a payment
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_path text;
ALTER TABLE public.payments ADD CONSTRAINT payments_receipt_path_len CHECK (receipt_path IS NULL OR char_length(receipt_path) <= 500);

-- 2. Storage rules for the private payment-receipts bucket
CREATE POLICY "receipts_upload_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipts_read_own_or_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())));

CREATE POLICY "receipts_delete_own_or_staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())));

-- 3. Replace dead placeholder lesson videos with working sample videos
UPDATE public.lesson_media lm
SET video_url = CASE WHEN l.position % 2 = 1
  THEN 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
  ELSE 'https://www.w3schools.com/html/mov_bbb.mp4' END
FROM public.lessons l
WHERE l.id = lm.lesson_id
  AND lm.video_url LIKE 'https://commondatastorage.googleapis.com/%';