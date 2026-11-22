import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./types";

type Row = Record<string, unknown>;

const STORAGE_SESSION_KEY = "ezana_mock_session";
const STORAGE_USERS_KEY = "ezana_mock_users";
const STORAGE_PAYMENTS_KEY = "ezana_mock_payments";

const SEED_CATEGORIES = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Technology",
    slug: "technology",
    description: "Programming, web and software development",
    parent_id: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Data & AI",
    slug: "data-ai",
    description: "Data analysis, machine learning and AI",
    parent_id: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Design",
    slug: "design",
    description: "UI/UX, graphic and product design",
    parent_id: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Mathematics",
    slug: "mathematics",
    description: "Algebra, calculus, statistics and more",
    parent_id: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    name: "Business",
    slug: "business",
    description: "Entrepreneurship, marketing and management",
    parent_id: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
  {
    id: "11111111-1111-4111-8111-111111111106",
    name: "Languages",
    slug: "languages",
    description: "English and communication skills",
    parent_id: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
];

const SEED_COURSES = [
  {
    id: "22222222-2222-4222-8222-222222222201",
    title: "Full-Stack Web Development",
    slug: "full-stack-web-development",
    short_description: "Build modern websites and web apps from scratch.",
    description:
      "Go from zero to job-ready. Learn HTML, CSS, JavaScript, React and backend fundamentals by building real projects for Ethiopian businesses.",
    image_url: "/__l5e/assets-v1/2e71e2fe-b00b-498a-a344-0d3e02eb7786/ezana-web.jpg",
    category_id: "11111111-1111-4111-8111-111111111101",
    instructor_id: null,
    level: "Beginner",
    duration_hours: 42,
    objectives: [
      "Build responsive websites with HTML & CSS",
      "Write modern JavaScript",
      "Create React applications",
      "Connect apps to a database and API",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.001Z",
    updated_at: "2026-11-19T18:18:52.001Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222202",
    title: "Data Science & AI Foundations",
    slug: "data-science-ai-foundations",
    short_description: "Turn raw data into insight with Python and AI.",
    description:
      "Learn Python, data analysis, visualisation and the basics of machine learning, with datasets drawn from agriculture, health and finance.",
    image_url: "/__l5e/assets-v1/b2d7a1ae-5c2d-4496-bb1c-9d458c5e6f47/ezana-data.jpg",
    category_id: "11111111-1111-4111-8111-111111111102",
    instructor_id: null,
    level: "Intermediate",
    duration_hours: 36,
    objectives: [
      "Analyse data with Python and pandas",
      "Visualise insights clearly",
      "Train your first machine learning model",
      "Understand how modern AI works",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.002Z",
    updated_at: "2026-11-19T18:18:52.002Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222203",
    title: "UI/UX Design Masterclass",
    slug: "ui-ux-design-masterclass",
    short_description: "Design beautiful, usable apps people love.",
    description:
      "Master user research, wireframing, visual design and prototyping. Finish with a polished portfolio project.",
    image_url: "/__l5e/assets-v1/854f79e5-1311-4cac-b83c-8a161c3b1a7a/ezana-design.jpg",
    category_id: "11111111-1111-4111-8111-111111111103",
    instructor_id: null,
    level: "Beginner",
    duration_hours: 28,
    objectives: [
      "Run simple user research",
      "Wireframe and prototype apps",
      "Apply colour, type and layout",
      "Build a design portfolio piece",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.003Z",
    updated_at: "2026-11-19T18:18:52.003Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222204",
    title: "Mathematics for Grade 11 & 12",
    slug: "mathematics-grade-11-12",
    short_description: "Master the maths you need for the national exam.",
    description:
      "Clear, step-by-step lessons covering algebra, functions, trigonometry, calculus and statistics aligned with the Ethiopian curriculum.",
    image_url: "/__l5e/assets-v1/d9840e76-0438-419a-8d3b-4ab42fd4d447/ezana-math.jpg",
    category_id: "11111111-1111-4111-8111-111111111104",
    instructor_id: null,
    level: "Intermediate",
    duration_hours: 40,
    objectives: [
      "Solve equations and inequalities with confidence",
      "Understand functions and graphs",
      "Learn the basics of calculus",
      "Prepare effectively for the national exam",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.004Z",
    updated_at: "2026-11-19T18:18:52.004Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222205",
    title: "Entrepreneurship & Startup Growth",
    slug: "entrepreneurship-startup-growth",
    short_description: "Launch and grow a business in Ethiopia.",
    description:
      "From idea validation to marketing, finance and fundraising: practical lessons from founders building in Addis Ababa and beyond.",
    image_url: "/__l5e/assets-v1/81a067f9-5b6b-49ce-97e1-1633f9cfeace/ezana-business.jpg",
    category_id: "11111111-1111-4111-8111-111111111105",
    instructor_id: null,
    level: "Beginner",
    duration_hours: 24,
    objectives: [
      "Validate a business idea",
      "Write a lean business plan",
      "Market on a small budget",
      "Manage cash flow and pitch investors",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.005Z",
    updated_at: "2026-11-19T18:18:52.005Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222206",
    title: "Spoken English & Communication",
    slug: "spoken-english-communication",
    short_description: "Speak English fluently and confidently.",
    description:
      "Improve your speaking, listening, pronunciation and professional communication for interviews, school and work.",
    image_url: "/__l5e/assets-v1/410eb273-3422-4cee-9b5b-9ec31110a94e/ezana-english.jpg",
    category_id: "11111111-1111-4111-8111-111111111106",
    instructor_id: null,
    level: "Beginner",
    duration_hours: 20,
    objectives: [
      "Speak with clearer pronunciation",
      "Build everyday and professional vocabulary",
      "Ace job interviews in English",
      "Write clear emails and reports",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.006Z",
    updated_at: "2026-11-19T18:18:52.006Z",
  },
];

const LESSON_SPECS: Array<[string, number, string, number]> = [
  ["full-stack-web-development", 1, "Welcome & how the web works", 12],
  ["full-stack-web-development", 2, "HTML fundamentals", 18],
  ["full-stack-web-development", 3, "Styling with CSS", 22],
  ["full-stack-web-development", 4, "Responsive layouts with Flexbox & Grid", 25],
  ["full-stack-web-development", 5, "JavaScript basics", 28],
  ["full-stack-web-development", 6, "DOM & events", 24],
  ["full-stack-web-development", 7, "Introduction to React", 30],
  ["full-stack-web-development", 8, "State, props & hooks", 32],
  ["full-stack-web-development", 9, "REST APIs & JSON", 26],
  ["full-stack-web-development", 10, "Deploying your project", 20],
  ["data-science-ai-foundations", 1, "What is data science?", 10],
  ["data-science-ai-foundations", 2, "Python crash course", 30],
  ["data-science-ai-foundations", 3, "Working with pandas", 28],
  ["data-science-ai-foundations", 4, "Cleaning messy data", 24],
  ["data-science-ai-foundations", 5, "Data visualisation", 22],
  ["data-science-ai-foundations", 6, "Statistics you need", 26],
  ["data-science-ai-foundations", 7, "Your first ML model", 30],
  ["data-science-ai-foundations", 8, "Evaluating models", 24],
  ["data-science-ai-foundations", 9, "How AI language models work", 20],
  ["ui-ux-design-masterclass", 1, "Design thinking", 14],
  ["ui-ux-design-masterclass", 2, "User research basics", 20],
  ["ui-ux-design-masterclass", 3, "Wireframing", 22],
  ["ui-ux-design-masterclass", 4, "Colour & typography", 24],
  ["ui-ux-design-masterclass", 5, "Layout & spacing", 20],
  ["ui-ux-design-masterclass", 6, "Components & design systems", 26],
  ["ui-ux-design-masterclass", 7, "Prototyping interactions", 22],
  ["ui-ux-design-masterclass", 8, "Portfolio case study", 28],
  ["mathematics-grade-11-12", 1, "Sets & number systems", 16],
  ["mathematics-grade-11-12", 2, "Equations & inequalities", 22],
  ["mathematics-grade-11-12", 3, "Functions & graphs", 24],
  ["mathematics-grade-11-12", 4, "Exponents & logarithms", 22],
  ["mathematics-grade-11-12", 5, "Trigonometry", 26],
  ["mathematics-grade-11-12", 6, "Sequences & series", 20],
  ["mathematics-grade-11-12", 7, "Limits & continuity", 24],
  ["mathematics-grade-11-12", 8, "Derivatives", 28],
  ["mathematics-grade-11-12", 9, "Integration basics", 28],
  ["mathematics-grade-11-12", 10, "Statistics & probability", 24],
  ["entrepreneurship-startup-growth", 1, "The founder mindset", 12],
  ["entrepreneurship-startup-growth", 2, "Finding & validating ideas", 20],
  ["entrepreneurship-startup-growth", 3, "The lean business plan", 22],
  ["entrepreneurship-startup-growth", 4, "Registering a business in Ethiopia", 18],
  ["entrepreneurship-startup-growth", 5, "Marketing on a budget", 24],
  ["entrepreneurship-startup-growth", 6, "Sales that work", 20],
  ["entrepreneurship-startup-growth", 7, "Cash flow & bookkeeping", 22],
  ["entrepreneurship-startup-growth", 8, "Pitching to investors", 20],
  ["spoken-english-communication", 1, "Building confidence", 10],
  ["spoken-english-communication", 2, "Pronunciation essentials", 18],
  ["spoken-english-communication", 3, "Everyday conversations", 20],
  ["spoken-english-communication", 4, "Listening skills", 16],
  ["spoken-english-communication", 5, "Grammar for speaking", 22],
  ["spoken-english-communication", 6, "Presentations", 20],
  ["spoken-english-communication", 7, "Job interviews", 24],
  ["spoken-english-communication", 8, "Professional emails", 18],
];

const SAMPLE_VIDEOS = [
  "BigBuckBunny.mp4",
  "ElephantsDream.mp4",
  "ForBiggerBlazes.mp4",
  "ForBiggerEscapes.mp4",
  "ForBiggerFun.mp4",
  "ForBiggerJoyrides.mp4",
  "ForBiggerMeltdowns.mp4",
  "Sintel.mp4",
  "TearsOfSteel.mp4",
  "SubaruOutbackOnStreetAndDirt.mp4",
];

const courseIdBySlug = new Map(SEED_COURSES.map((c) => [c.slug, c.id]));

const SEED_LESSONS = LESSON_SPECS.map(([slug, pos, title, dur], idx) => ({
  id: `33333333-3333-4333-8333-${String(idx + 1).padStart(12, "0")}`,
  course_id: courseIdBySlug.get(slug)!,
  title,
  description: null,
  position: pos,
  duration_minutes: dur,
  created_at: "2026-11-19T18:18:52Z",
  updated_at: "2026-11-19T18:18:52Z",
}));

const SEED_LESSON_MEDIA = SEED_LESSONS.map((l) => ({
  lesson_id: l.id,
  video_url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${SAMPLE_VIDEOS[(l.position - 1) % SAMPLE_VIDEOS.length]}`,
  created_at: "2026-11-19T18:18:52Z",
  updated_at: "2026-11-19T18:18:52Z",
}));

const SEED_SETTINGS = [
  {
    id: 1,
    name: "Ezana Academy",
    tagline: "Learn without limits. Rise like Aksum.",
    description:
      "Ezana Academy is an Ethiopian online academy offering practical, high-quality courses in technology, data, design, mathematics, business and languages, taught by experienced instructors.",
    email: "hello@ezanaacademy.et",
    phone: "+251 911 000 218",
    address: "Bole Road, Addis Ababa, Ethiopia",
    website: "https://ezanaacademy.et",
    facebook: null,
    telegram: "https://t.me/ezanaacademy",
    youtube: null,
    linkedin: null,
    payment_instructions:
      "Send ETB 218 via Telebirr to 0911 000 218 or to CBE account 1000 2180 0000 (Ezana Academy). Then enter your transaction reference below.",
    updated_at: "2026-11-19T18:18:52Z",
  },
];

const SEED_ANNOUNCEMENTS = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    title: "Welcome to Ezana Academy!",
    body: "Every course includes 5 free tutorial videos. Unlock the full course with Ezana Pro for just ETB 218.",
    audience: null,
    published: true,
    publish_at: "2026-11-19T18:18:52Z",
    created_by: null,
    created_at: "2026-11-19T18:18:52Z",
    updated_at: "2026-11-19T18:18:52Z",
  },
];

type StoredMockUser = {
  id: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: Database["public"]["Enums"]["app_role"];
};

const tables: Record<string, Row[]> = {
  academy_settings: [...SEED_SETTINGS],
  announcements: [...SEED_ANNOUNCEMENTS],
  audit_logs: [],
  categories: [...SEED_CATEGORIES],
  contact_messages: [],
  courses: [...SEED_COURSES],
  enrollments: [],
  lesson_media: [...SEED_LESSON_MEDIA],
  lesson_progress: [],
  lessons: [...SEED_LESSONS],
  parent_links: [],
  payments: [],
  profiles: [],
  user_roles: [],
};

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

const memoryUsers = new Map<string, StoredMockUser>();
let memorySession: Session | null = null;

function getStoredUsers(): StoredMockUser[] {
  const fromStorage = readStorage<StoredMockUser[]>(STORAGE_USERS_KEY);
  if (fromStorage) {
    for (const u of fromStorage) memoryUsers.set(u.email.toLowerCase(), u);
  }
  return Array.from(memoryUsers.values());
}

function saveUser(u: StoredMockUser): void {
  memoryUsers.set(u.email.toLowerCase(), u);
  writeStorage(STORAGE_USERS_KEY, Array.from(memoryUsers.values()));
  if (!tables["profiles"]!.some((p) => p["id"] === u.id)) {
    tables["profiles"]!.push({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone: null,
      avatar_url: null,
      bio: null,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  if (!tables["user_roles"]!.some((r) => r["user_id"] === u.id)) {
    tables["user_roles"]!.push({
      id: crypto.randomUUID(),
      user_id: u.id,
      role: u.role,
      created_at: new Date().toISOString(),
    });
  }
}

function makeSession(u: StoredMockUser): Session {
  const now = Math.floor(Date.now() / 1000);
  const user: User = {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: new Date().toISOString(),
    phone: "",
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { first_name: u.first_name, last_name: u.last_name },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return {
    access_token: `mock.${btoa(u.id)}.token`,
    refresh_token: `mock-refresh-${u.id}`,
    expires_in: 3600 * 24,
    expires_at: now + 3600 * 24,
    token_type: "bearer",
    user,
  };
}

function getCurrentSession(): Session | null {
  const fromStorage = readStorage<Session>(STORAGE_SESSION_KEY);
  const s = fromStorage ?? memorySession;
  if (s?.user) {
    const users = getStoredUsers();
    const existing = users.find((u) => u.id === s.user.id);
    if (existing) saveUser(existing);
    else {
      const meta = (s.user.user_metadata ?? {}) as Record<string, string>;
      saveUser({
        id: s.user.id,
        email: s.user.email ?? "",
        password: "",
        first_name: meta["first_name"] ?? "",
        last_name: meta["last_name"] ?? "",
        role: "student",
      });
    }
  }
  return s;
}

function setCurrentSession(session: Session | null): void {
  memorySession = session;
  writeStorage(STORAGE_SESSION_KEY, session);
}

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
const authListeners = new Set<AuthListener>();

function emitAuth(event: AuthChangeEvent, session: Session | null) {
  for (const cb of authListeners) {
    try {
      cb(event, session);
    } catch {
      // Ignore listener errors
    }
  }
}

function hydrateRow(table: string, row: Row, selectStr: string): Row {
  const out: Row = { ...row };
  if (table === "courses") {
    if (selectStr.includes("categories(")) {
      const cat = tables["categories"]!.find((c) => c["id"] === row["category_id"]);
      out["categories"] = cat ? { name: cat["name"], slug: cat["slug"] } : null;
    }
    if (selectStr.includes("lessons(count)")) {
      const count = tables["lessons"]!.filter((l) => l["course_id"] === row["id"]).length;
      out["lessons"] = [{ count }];
    }
  }
  return out;
}

class MockQueryBuilder {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols = "*";
  private payload: Row | Row[] | null = null;
  private filters: Array<(row: Row) => boolean> = [];
  private orders: Array<{ col: string; ascending: boolean }> = [];
  private maxRows: number | null = null;
  private singleMode: "none" | "single" | "maybeSingle" = "none";

  constructor(table: string) {
    this.table = table;
    if (table === "payments" && typeof window !== "undefined") {
      const saved = readStorage<Row[]>(STORAGE_PAYMENTS_KEY);
      if (saved) tables["payments"] = saved;
    }
  }

  select(columns = "*") {
    if (this.op === "select") this.selectCols = columns;
    return this;
  }

  insert(values: Row | Row[]) {
    this.op = "insert";
    this.payload = values;
    return this;
  }

  update(values: Row) {
    this.op = "update";
    this.payload = values;
    return this;
  }

  delete() {
    this.op = "delete";
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }

  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.maxRows = n;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  private async execute(): Promise<{ data: unknown; error: { message: string; code?: string } | null }> {
    const list = tables[this.table] ?? [];

    if (this.op === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted: Row[] = [];
      for (const item of items) {
        if (this.table === "payments") {
          const dup = list.find(
            (p) =>
              p["user_id"] === item["user_id"] &&
              p["course_id"] === item["course_id"] &&
              (p["status"] === "pending" || p["status"] === "approved"),
          );
          if (dup) {
            return { data: null, error: { message: "Duplicate payment", code: "23505" } };
          }
        }
        const row: Row = {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: this.table === "payments" ? "pending" : item["status"],
          ...item,
        };
        list.push(row);
        inserted.push(row);
      }
      tables[this.table] = list;
      if (this.table === "payments") writeStorage(STORAGE_PAYMENTS_KEY, list);
      if (this.singleMode === "single" || this.singleMode === "maybeSingle") {
        return { data: inserted[0] ?? null, error: null };
      }
      return { data: inserted, error: null };
    }

    if (this.op === "update") {
      const patch = (this.payload as Row) ?? {};
      const updated: Row[] = [];
      for (const row of list) {
        if (this.filters.every((f) => f(row))) {
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
          updated.push(row);
        }
      }
      if (this.table === "payments") writeStorage(STORAGE_PAYMENTS_KEY, list);
      return { data: this.singleMode === "none" ? updated : (updated[0] ?? null), error: null };
    }

    if (this.op === "delete") {
      const kept: Row[] = [];
      const deleted: Row[] = [];
      for (const row of list) {
        if (this.filters.every((f) => f(row))) deleted.push(row);
        else kept.push(row);
      }
      tables[this.table] = kept;
      if (this.table === "payments") writeStorage(STORAGE_PAYMENTS_KEY, kept);
      return { data: deleted, error: null };
    }

    // SELECT
    let rows = list.filter((r) => this.filters.every((f) => f(r)));

    if (this.table === "lesson_media") {
      const session = getCurrentSession();
      if (!session?.user) {
        rows = [];
      } else if (rows.length > 0) {
        rows = rows.filter((m) => {
          const lesson = tables["lessons"]!.find((l) => l["id"] === m["lesson_id"]);
          if (!lesson) return false;
          const pos = Number(lesson["position"] ?? 999);
          if (pos <= 5) return true;
          const unlocked = tables["payments"]!.some(
            (p) =>
              p["course_id"] === lesson["course_id"] &&
              p["user_id"] === session.user.id &&
              p["status"] === "approved",
          );
          return unlocked;
        });
      } else {
        rows = [
          {
            lesson_id: "external",
            video_url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${SAMPLE_VIDEOS[0]}`,
          },
        ];
      }
    }

    if (this.orders.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const o of this.orders) {
          const av = a[o.col];
          const bv = b[o.col];
          if (av === bv) continue;
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av ?? "").localeCompare(String(bv ?? ""));
          return o.ascending ? cmp : -cmp;
        }
        return 0;
      });
    }

    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);

    const hydrated = rows.map((r) => hydrateRow(this.table, r, this.selectCols));

    if (this.singleMode === "maybeSingle") {
      return { data: hydrated[0] ?? null, error: null };
    }
    if (this.singleMode === "single") {
      if (hydrated.length === 0) {
        return { data: null, error: { message: "Row not found", code: "PGRST116" } };
      }
      return { data: hydrated[0], error: null };
    }
    return { data: hydrated, error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

let warnedMock = false;
export function warnMockOnce(context: string) {
  if (warnedMock) return;
  warnedMock = true;
  console.warn(`[AI Studio] Supabase env vars not configured (${context}) — using in-memory mock data.`);
}

export function createMockSupabaseClient(): SupabaseClient<Database> {
  const auth = {
    async getSession() {
      return { data: { session: getCurrentSession() }, error: null };
    },
    async getUser() {
      const s = getCurrentSession();
      return { data: { user: s?.user ?? null }, error: null };
    },
    async signUp(params: { email: string; password: string; options?: { data?: Record<string, string> } }) {
      const email = params.email.trim().toLowerCase();
      const users = getStoredUsers();
      if (users.some((u) => u.email.toLowerCase() === email)) {
        return { data: { user: null, session: null }, error: { message: "User already registered" } };
      }
      const user: StoredMockUser = {
        id: crypto.randomUUID(),
        email,
        password: params.password,
        first_name: params.options?.data?.["first_name"] ?? "",
        last_name: params.options?.data?.["last_name"] ?? "",
        role: users.length === 0 ? "owner" : "student",
      };
      saveUser(user);
      const session = makeSession(user);
      setCurrentSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { user: session.user, session }, error: null };
    },
    async signInWithPassword(params: { email: string; password: string }) {
      const email = params.email.trim().toLowerCase();
      const users = getStoredUsers();
      const user = users.find((u) => u.email.toLowerCase() === email && u.password === params.password);
      if (!user) {
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      }
      const session = makeSession(user);
      setCurrentSession(session);
      emitAuth("SIGNED_IN", session);
      return { data: { user: session.user, session }, error: null };
    },
    async signOut() {
      setCurrentSession(null);
      emitAuth("SIGNED_OUT", null);
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async updateUser(attrs: { password?: string }) {
      const s = getCurrentSession();
      if (!s?.user) return { data: { user: null }, error: { message: "Not authenticated" } };
      const users = getStoredUsers();
      const existing = users.find((u) => u.id === s.user.id);
      if (existing && attrs.password) {
        existing.password = attrs.password;
        saveUser(existing);
      }
      emitAuth("USER_UPDATED", s);
      return { data: { user: s.user }, error: null };
    },
    async getClaims(token?: string) {
      const s = getCurrentSession();
      if (s?.user) {
        return { data: { claims: { sub: s.user.id, email: s.user.email } }, error: null };
      }
      if (token) {
        return { data: { claims: { sub: "mock-user" } }, error: null };
      }
      return { data: null, error: { message: "Invalid token" } };
    },
    onAuthStateChange(callback: AuthListener) {
      authListeners.add(callback);
      return {
        data: {
          subscription: {
            id: crypto.randomUUID(),
            callback,
            unsubscribe: () => {
              authListeners.delete(callback);
            },
          },
        },
      };
    },
  };

  return {
    auth,
    from(table: string) {
      return new MockQueryBuilder(table);
    },
  } as unknown as SupabaseClient<Database>;
}
