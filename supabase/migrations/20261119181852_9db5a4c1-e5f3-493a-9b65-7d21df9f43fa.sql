-- Enums
CREATE TYPE public.app_role AS ENUM ('owner','admin','instructor','student','parent');
CREATE TYPE public.account_status AS ENUM ('active','inactive','suspended');
CREATE TYPE public.course_status AS ENUM ('draft','published','archived');
CREATE TYPE public.payment_status AS ENUM ('pending','approved','rejected');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  bio text,
  status public.account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','admin'))
$$;

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- COURSES
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  instructor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'Beginner',
  duration_hours integer NOT NULL DEFAULT 0,
  objectives text[] NOT NULL DEFAULT '{}',
  status public.course_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- LESSONS
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 1,
  duration_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lessons_course_idx ON public.lessons(course_id, position);
GRANT SELECT ON public.lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lesson_media (
  lesson_id uuid PRIMARY KEY REFERENCES public.lessons(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_media TO authenticated;
GRANT ALL ON public.lesson_media TO service_role;
ALTER TABLE public.lesson_media ENABLE ROW LEVEL SECURITY;

-- ENROLLMENTS
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- LESSON PROGRESS
CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, DELETE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_progress TO service_role;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- PAYMENTS (fixed ETB 218 per course)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 218 CHECK (amount = 218),
  currency text NOT NULL DEFAULT 'ETB' CHECK (currency = 'ETB'),
  method text NOT NULL,
  reference text NOT NULL,
  note text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payments_one_open_per_course ON public.payments(user_id, course_id) WHERE status IN ('pending','approved');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- PARENT LINKS
CREATE TABLE public.parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text NOT NULL DEFAULT 'Parent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.parent_links TO authenticated;
GRANT ALL ON public.parent_links TO service_role;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

-- CONTACT MESSAGES
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  subject text NOT NULL DEFAULT '' CHECK (char_length(subject) <= 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- ANNOUNCEMENTS
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audience public.app_role,
  published boolean NOT NULL DEFAULT true,
  publish_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ACADEMY SETTINGS (single row)
CREATE TABLE public.academy_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Ezana Academy',
  tagline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  website text,
  facebook text,
  telegram text,
  youtube text,
  linkedin text,
  payment_instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academy_settings TO anon;
GRANT SELECT, UPDATE ON public.academy_settings TO authenticated;
GRANT ALL ON public.academy_settings TO service_role;
ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;

-- Helper access functions
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent uuid, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.parent_links WHERE parent_id = _parent AND student_id = _student)
$$;

CREATE OR REPLACE FUNCTION public.is_course_instructor(_user uuid, _course uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.courses WHERE id = _course AND instructor_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.teaches_student(_instructor uuid, _student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id
    WHERE e.user_id = _student AND c.instructor_id = _instructor)
$$;

CREATE OR REPLACE FUNCTION public.has_course_unlocked(_user uuid, _course uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.payments WHERE user_id = _user AND course_id = _course AND status = 'approved')
$$;

-- First 5 lessons (by position) of every course are free for signed-in users
CREATE OR REPLACE FUNCTION public.can_access_lesson(_user uuid, _lesson uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = _lesson AND (
      (SELECT count(*) FROM public.lessons l2
        WHERE l2.course_id = l.course_id
          AND (l2.position < l.position OR (l2.position = l.position AND l2.id < l.id))) < 5
      OR public.has_course_unlocked(_user, l.course_id)
      OR public.is_staff(_user)
      OR public.is_course_instructor(_user, l.course_id)
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.instructor_directory()
RETURNS TABLE (id uuid, full_name text, avatar_url text, bio text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, trim(p.first_name || ' ' || p.last_name), p.avatar_url, p.bio
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('instructor','owner','admin'))
$$;
GRANT EXECUTE ON FUNCTION public.instructor_directory() TO anon, authenticated;

-- POLICIES: profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()) OR public.is_parent_of(auth.uid(), id)
         OR public.teaches_student(auth.uid(), id) OR public.is_parent_of(id, auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_staff_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "profiles_owner_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND id <> auth.uid());

-- Non-staff can't change their own status
CREATE OR REPLACE FUNCTION public.guard_profile_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
      RAISE EXCEPTION 'Only staff can change account status';
    END IF;
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'account_status_changed', 'profile', NEW.id::text,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'email', NEW.email));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_guard_status BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_status();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: user_roles
CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "roles_owner_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE POLICY "roles_admin_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND role IN ('instructor','student','parent'));
CREATE POLICY "roles_owner_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'owner') AND NOT (user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND role IN ('instructor','student','parent'));

CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'role_granted', 'user_role', NEW.user_id::text, jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'role_revoked', 'user_role', OLD.user_id::text, jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER user_roles_audit AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_change();

-- POLICIES: categories
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_staff_write" ON public.categories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: courses
CREATE POLICY "courses_public_read" ON public.courses FOR SELECT TO anon, authenticated
  USING (status = 'published');
CREATE POLICY "courses_staff_all" ON public.courses FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "courses_instructor_read" ON public.courses FOR SELECT TO authenticated
  USING (instructor_id = auth.uid());
CREATE POLICY "courses_instructor_insert" ON public.courses FOR INSERT TO authenticated
  WITH CHECK (instructor_id = auth.uid() AND public.has_role(auth.uid(), 'instructor'));
CREATE POLICY "courses_instructor_update" ON public.courses FOR UPDATE TO authenticated
  USING (instructor_id = auth.uid()) WITH CHECK (instructor_id = auth.uid());
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: lessons
CREATE POLICY "lessons_public_read" ON public.lessons FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'));
CREATE POLICY "lessons_manage" ON public.lessons FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_course_instructor(auth.uid(), course_id))
  WITH CHECK (public.is_staff(auth.uid()) OR public.is_course_instructor(auth.uid(), course_id));
CREATE TRIGGER lessons_updated_at BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: lesson_media
CREATE POLICY "media_read_if_access" ON public.lesson_media FOR SELECT TO authenticated
  USING (public.can_access_lesson(auth.uid(), lesson_id));
CREATE POLICY "media_manage" ON public.lesson_media FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND public.is_course_instructor(auth.uid(), l.course_id)))
  WITH CHECK (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = lesson_id AND public.is_course_instructor(auth.uid(), l.course_id)));
CREATE TRIGGER lesson_media_updated_at BEFORE UPDATE ON public.lesson_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: enrollments
CREATE POLICY "enroll_read" ON public.enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR public.is_parent_of(auth.uid(), user_id)
         OR public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY "enroll_self_insert" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "enroll_delete" ON public.enrollments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- POLICIES: lesson_progress
CREATE POLICY "progress_read" ON public.lesson_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR public.is_parent_of(auth.uid(), user_id)
         OR public.is_course_instructor(auth.uid(), course_id));
CREATE POLICY "progress_self_insert" ON public.lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_lesson(auth.uid(), lesson_id));
CREATE POLICY "progress_self_delete" ON public.lesson_progress FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- POLICIES: payments
CREATE POLICY "payments_read" ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()) OR public.is_parent_of(auth.uid(), user_id));
CREATE POLICY "payments_request" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (status = 'pending' AND reviewed_by IS NULL
    AND (user_id = auth.uid() OR public.is_parent_of(auth.uid(), user_id)));
CREATE POLICY "payments_staff_update" ON public.payments FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "payments_staff_delete" ON public.payments FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "payments_cancel_own_pending" ON public.payments FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending');

CREATE OR REPLACE FUNCTION public.audit_payment_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'payment_' || NEW.status::text, 'payment', NEW.id::text,
      jsonb_build_object('user_id', NEW.user_id, 'course_id', NEW.course_id, 'amount', NEW.amount, 'reference', NEW.reference));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER payments_review BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payment_review();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: parent_links
CREATE POLICY "links_read" ON public.parent_links FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR student_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "links_staff_insert" ON public.parent_links FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "links_staff_delete" ON public.parent_links FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- POLICIES: contact_messages
CREATE POLICY "contact_anyone_insert" ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'open' AND reply IS NULL);
CREATE POLICY "contact_staff_read" ON public.contact_messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "contact_staff_update" ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "contact_staff_delete" ON public.contact_messages FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER contact_updated_at BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: announcements
CREATE POLICY "ann_read" ON public.announcements FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid())
    OR (published AND publish_at <= now() AND (audience IS NULL OR public.has_role(auth.uid(), audience))));
CREATE POLICY "ann_staff_write" ON public.announcements FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER ann_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: audit_logs
CREATE POLICY "audit_staff_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "audit_self_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- POLICIES: academy_settings
CREATE POLICY "settings_public_read" ON public.academy_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_owner_update" ON public.academy_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.academy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New user: profile + role (first user becomes owner)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.email, ''));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lock down security definer functions from direct anon calls where not needed
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_role_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_payment_review() FROM PUBLIC, anon, authenticated;

-- SEED DATA
INSERT INTO public.academy_settings (id, name, tagline, description, email, phone, address, website, telegram, payment_instructions)
VALUES (1, 'Ezana Academy', 'Learn without limits. Rise like Aksum.',
  'Ezana Academy is an Ethiopian online academy offering practical, high-quality courses in technology, data, design, mathematics, business and languages, taught by experienced instructors.',
  'hello@ezanaacademy.et', '+251 911 000 218', 'Bole Road, Addis Ababa, Ethiopia', 'https://ezanaacademy.et', 'https://t.me/ezanaacademy',
  'Send ETB 218 via Telebirr to 0911 000 218 or to CBE account 1000 2180 0000 (Ezana Academy). Then enter your transaction reference below.');

INSERT INTO public.categories (name, slug, description) VALUES
 ('Technology', 'technology', 'Programming, web and software development'),
 ('Data & AI', 'data-ai', 'Data analysis, machine learning and AI'),
 ('Design', 'design', 'UI/UX, graphic and product design'),
 ('Mathematics', 'mathematics', 'Algebra, calculus, statistics and more'),
 ('Business', 'business', 'Entrepreneurship, marketing and management'),
 ('Languages', 'languages', 'English and communication skills');

INSERT INTO public.courses (title, slug, short_description, description, image_url, category_id, level, duration_hours, objectives, status)
SELECT v.title, v.slug, v.short_d, v.descr, v.img, c.id, v.lvl, v.hrs, v.obj, 'published'
FROM (VALUES
 ('Full-Stack Web Development', 'full-stack-web-development', 'Build modern websites and web apps from scratch.',
  'Go from zero to job-ready. Learn HTML, CSS, JavaScript, React and backend fundamentals by building real projects for Ethiopian businesses.',
  '/__l5e/assets-v1/2e71e2fe-b00b-498a-a344-0d3e02eb7786/ezana-web.jpg', 'technology', 'Beginner', 42,
  ARRAY['Build responsive websites with HTML & CSS','Write modern JavaScript','Create React applications','Connect apps to a database and API']),
 ('Data Science & AI Foundations', 'data-science-ai-foundations', 'Turn raw data into insight with Python and AI.',
  'Learn Python, data analysis, visualisation and the basics of machine learning, with datasets drawn from agriculture, health and finance.',
  '/__l5e/assets-v1/b2d7a1ae-5c2d-4496-bb1c-9d458c5e6f47/ezana-data.jpg', 'data-ai', 'Intermediate', 36,
  ARRAY['Analyse data with Python and pandas','Visualise insights clearly','Train your first machine learning model','Understand how modern AI works']),
 ('UI/UX Design Masterclass', 'ui-ux-design-masterclass', 'Design beautiful, usable apps people love.',
  'Master user research, wireframing, visual design and prototyping. Finish with a polished portfolio project.',
  '/__l5e/assets-v1/854f79e5-1311-4cac-b83c-8a161c3b1a7a/ezana-design.jpg', 'design', 'Beginner', 28,
  ARRAY['Run simple user research','Wireframe and prototype apps','Apply colour, type and layout','Build a design portfolio piece']),
 ('Mathematics for Grade 11 & 12', 'mathematics-grade-11-12', 'Master the maths you need for the national exam.',
  'Clear, step-by-step lessons covering algebra, functions, trigonometry, calculus and statistics aligned with the Ethiopian curriculum.',
  '/__l5e/assets-v1/d9840e76-0438-419a-8d3b-4ab42fd4d447/ezana-math.jpg', 'mathematics', 'Intermediate', 40,
  ARRAY['Solve equations and inequalities with confidence','Understand functions and graphs','Learn the basics of calculus','Prepare effectively for the national exam']),
 ('Entrepreneurship & Startup Growth', 'entrepreneurship-startup-growth', 'Launch and grow a business in Ethiopia.',
  'From idea validation to marketing, finance and fundraising: practical lessons from founders building in Addis Ababa and beyond.',
  '/__l5e/assets-v1/81a067f9-5b6b-49ce-97e1-1633f9cfeace/ezana-business.jpg', 'business', 'Beginner', 24,
  ARRAY['Validate a business idea','Write a lean business plan','Market on a small budget','Manage cash flow and pitch investors']),
 ('Spoken English & Communication', 'spoken-english-communication', 'Speak English fluently and confidently.',
  'Improve your speaking, listening, pronunciation and professional communication for interviews, school and work.',
  '/__l5e/assets-v1/410eb273-3422-4cee-9b5b-9ec31110a94e/ezana-english.jpg', 'languages', 'Beginner', 20,
  ARRAY['Speak with clearer pronunciation','Build everyday and professional vocabulary','Ace job interviews in English','Write clear emails and reports'])
) AS v(title, slug, short_d, descr, img, cat, lvl, hrs, obj)
JOIN public.categories c ON c.slug = v.cat;

INSERT INTO public.lessons (course_id, position, title, duration_minutes)
SELECT c.id, v.pos, v.title, v.dur
FROM (VALUES
 ('full-stack-web-development',1,'Welcome & how the web works',12),
 ('full-stack-web-development',2,'HTML fundamentals',18),
 ('full-stack-web-development',3,'Styling with CSS',22),
 ('full-stack-web-development',4,'Responsive layouts with Flexbox & Grid',25),
 ('full-stack-web-development',5,'JavaScript basics',28),
 ('full-stack-web-development',6,'DOM & events',24),
 ('full-stack-web-development',7,'Introduction to React',30),
 ('full-stack-web-development',8,'State, props & hooks',32),
 ('full-stack-web-development',9,'REST APIs & JSON',26),
 ('full-stack-web-development',10,'Deploying your project',20),
 ('data-science-ai-foundations',1,'What is data science?',10),
 ('data-science-ai-foundations',2,'Python crash course',30),
 ('data-science-ai-foundations',3,'Working with pandas',28),
 ('data-science-ai-foundations',4,'Cleaning messy data',24),
 ('data-science-ai-foundations',5,'Data visualisation',22),
 ('data-science-ai-foundations',6,'Statistics you need',26),
 ('data-science-ai-foundations',7,'Your first ML model',30),
 ('data-science-ai-foundations',8,'Evaluating models',24),
 ('data-science-ai-foundations',9,'How AI language models work',20),
 ('ui-ux-design-masterclass',1,'Design thinking',14),
 ('ui-ux-design-masterclass',2,'User research basics',20),
 ('ui-ux-design-masterclass',3,'Wireframing',22),
 ('ui-ux-design-masterclass',4,'Colour & typography',24),
 ('ui-ux-design-masterclass',5,'Layout & spacing',20),
 ('ui-ux-design-masterclass',6,'Components & design systems',26),
 ('ui-ux-design-masterclass',7,'Prototyping interactions',22),
 ('ui-ux-design-masterclass',8,'Portfolio case study',28),
 ('mathematics-grade-11-12',1,'Sets & number systems',16),
 ('mathematics-grade-11-12',2,'Equations & inequalities',22),
 ('mathematics-grade-11-12',3,'Functions & graphs',24),
 ('mathematics-grade-11-12',4,'Exponents & logarithms',22),
 ('mathematics-grade-11-12',5,'Trigonometry',26),
 ('mathematics-grade-11-12',6,'Sequences & series',20),
 ('mathematics-grade-11-12',7,'Limits & continuity',24),
 ('mathematics-grade-11-12',8,'Derivatives',28),
 ('mathematics-grade-11-12',9,'Integration basics',28),
 ('mathematics-grade-11-12',10,'Statistics & probability',24),
 ('entrepreneurship-startup-growth',1,'The founder mindset',12),
 ('entrepreneurship-startup-growth',2,'Finding & validating ideas',20),
 ('entrepreneurship-startup-growth',3,'The lean business plan',22),
 ('entrepreneurship-startup-growth',4,'Registering a business in Ethiopia',18),
 ('entrepreneurship-startup-growth',5,'Marketing on a budget',24),
 ('entrepreneurship-startup-growth',6,'Sales that work',20),
 ('entrepreneurship-startup-growth',7,'Cash flow & bookkeeping',22),
 ('entrepreneurship-startup-growth',8,'Pitching to investors',20),
 ('spoken-english-communication',1,'Building confidence',10),
 ('spoken-english-communication',2,'Pronunciation essentials',18),
 ('spoken-english-communication',3,'Everyday conversations',20),
 ('spoken-english-communication',4,'Listening skills',16),
 ('spoken-english-communication',5,'Grammar for speaking',22),
 ('spoken-english-communication',6,'Presentations',20),
 ('spoken-english-communication',7,'Job interviews',24),
 ('spoken-english-communication',8,'Professional emails',18)
) AS v(slug, pos, title, dur)
JOIN public.courses c ON c.slug = v.slug;

INSERT INTO public.lesson_media (lesson_id, video_url)
SELECT l.id, 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/' ||
  (ARRAY['BigBuckBunny.mp4','ElephantsDream.mp4','ForBiggerBlazes.mp4','ForBiggerEscapes.mp4','ForBiggerFun.mp4','ForBiggerJoyrides.mp4','ForBiggerMeltdowns.mp4','Sintel.mp4','TearsOfSteel.mp4','SubaruOutbackOnStreetAndDirt.mp4'])[((l.position - 1) % 10) + 1]
FROM public.lessons l;

INSERT INTO public.announcements (title, body, audience, published)
VALUES ('Welcome to Ezana Academy!', 'Every course includes 5 free tutorial videos. Unlock the full course with Ezana Pro for just ETB 218.', NULL, true);