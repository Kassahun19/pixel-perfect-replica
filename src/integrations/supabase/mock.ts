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
    title: "Basic Computer Skills",
    slug: "basic-computer-skills",
    short_description:
      "Master essential computer, Windows, Word, Excel, and internet skills for school and work.",
    description:
      "Build practical everyday computer literacy from scratch. Learn Windows basics, Microsoft Word, Excel spreadsheets, PowerPoint, and safe productivity tools step by step.",
    image_url: "/__l5e/assets-v1/2e71e2fe-b00b-498a-a344-0d3e02eb7786/ezana-web.jpg",
    category_id: "11111111-1111-4111-8111-111111111101",
    instructor_id: null,
    level: "Beginner",
    duration_hours: 4,
    objectives: [
      "Navigate Windows and manage files confidently",
      "Create and format documents in Microsoft Word",
      "Organize tables and formulas in Microsoft Excel",
      "Use everyday productivity shortcuts and online tools safely",
    ],
    status: "published",
    created_at: "2026-11-19T18:18:52.001Z",
    updated_at: "2026-11-19T18:18:52.001Z",
  },
];

const LESSON_SPECS: Array<[string, number, string, number]> = [
  ["basic-computer-skills", 1, "Getting started with your computer and desktop", 12],
  ["basic-computer-skills", 2, "Managing files, folders, and USB drives", 15],
  ["basic-computer-skills", 3, "Essential Windows keyboard shortcuts", 10],
  ["basic-computer-skills", 4, "Creating and formatting documents in MS Word", 18],
  ["basic-computer-skills", 5, "How to Create a Table in Excel (Microsoft Excel)", 14],
  ["basic-computer-skills", 6, "Autofit columns and smart formulas in Excel", 16],
  ["basic-computer-skills", 7, "Professional PowerPoint intro design", 20],
  ["basic-computer-skills", 8, "Converting PDF to editable Word cleanly", 12],
  ["basic-computer-skills", 9, "Email etiquette and safe internet browsing", 15],
  ["basic-computer-skills", 10, "Hidden Windows productivity features", 18],
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
  video_url: l.position <= 5 ? `/videos/lesson-${l.position}.mp4` : "/videos/lesson-pro.mp4",
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

const SEED_DEMO_PROFILES: Row[] = [
  {
    id: "99999999-9999-4999-8999-999999999901",
    first_name: "Abebe",
    last_name: "Bikila",
    email: "abebe@ezanaacademy.et",
    phone: "+251 911 234 567",
    avatar_url: null,
    bio: null,
    status: "active",
    created_at: "2026-11-20T09:15:00Z",
    updated_at: "2026-11-20T09:15:00Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999902",
    first_name: "Tigist",
    last_name: "Haile",
    email: "tigist@ezanaacademy.et",
    phone: "+251 922 876 543",
    avatar_url: null,
    bio: null,
    status: "active",
    created_at: "2026-11-21T11:30:00Z",
    updated_at: "2026-11-21T11:30:00Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999903",
    first_name: "Dawit",
    last_name: "Mekonnen",
    email: "dawit@ezanaacademy.et",
    phone: "+251 933 445 566",
    avatar_url: null,
    bio: null,
    status: "active",
    created_at: "2026-11-21T14:20:00Z",
    updated_at: "2026-11-21T14:20:00Z",
  },
];

const SEED_PAYMENTS: Row[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    user_id: "99999999-9999-4999-8999-999999999901",
    course_id: "22222222-2222-4222-8222-222222222201",
    amount: 218,
    currency: "ETB",
    method: "Telebirr",
    reference: "FT26324TX891",
    note: "Paid from 0911 234 567 (Telebirr screenshot confirmed)",
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: "2026-11-22T08:15:00Z",
    updated_at: "2026-11-22T08:15:00Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    user_id: "99999999-9999-4999-8999-999999999902",
    course_id: "22222222-2222-4222-8222-222222222201",
    amount: 218,
    currency: "ETB",
    method: "Bank transfer (CBE)",
    reference: "CBE2026112204",
    note: "Transferred via CBE mobile app to 1000 2180 0000",
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: "2026-11-22T09:40:00Z",
    updated_at: "2026-11-22T09:40:00Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    user_id: "99999999-9999-4999-8999-999999999903",
    course_id: "22222222-2222-4222-8222-222222222201",
    amount: 218,
    currency: "ETB",
    method: "CBE Birr",
    reference: "CBB7741209",
    note: "Basic Computer Skills full access",
    status: "approved",
    reviewed_by: null,
    reviewed_at: "2026-11-21T16:05:00Z",
    review_note: "Verified in CBE Birr ledger",
    created_at: "2026-11-21T15:50:00Z",
    updated_at: "2026-11-21T16:05:00Z",
  },
];

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
  payments: [...SEED_PAYMENTS],
  profiles: [...SEED_DEMO_PROFILES],
  user_roles: SEED_DEMO_PROFILES.map((p, idx) => ({
    id: `88888888-8888-4888-8888-88888888880${idx + 1}`,
    user_id: p["id"],
    role: "student",
    created_at: p["created_at"],
  })),
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

function syncUserRow(u: StoredMockUser): void {
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
  const hasAnyRole = tables["user_roles"]!.some((r) => r["user_id"] === u.id);
  if (!hasAnyRole) {
    tables["user_roles"]!.push({
      id: crypto.randomUUID(),
      user_id: u.id,
      role: u.role,
      created_at: new Date().toISOString(),
    });
  }
}

function getStoredUsers(): StoredMockUser[] {
  const fromStorage = readStorage<StoredMockUser[]>(STORAGE_USERS_KEY);
  if (fromStorage) {
    for (const u of fromStorage) memoryUsers.set(u.email.toLowerCase(), u);
  }
  const list = Array.from(memoryUsers.values());
  if (list.length > 0 && !list.some((u) => u.role === "owner")) {
    list[0]!.role = "owner";
    writeStorage(STORAGE_USERS_KEY, list);
  }
  for (const u of list) syncUserRow(u);
  return list;
}

function saveUser(u: StoredMockUser): void {
  memoryUsers.set(u.email.toLowerCase(), u);
  const list = Array.from(memoryUsers.values());
  if (list.length > 0 && !list.some((item) => item.role === "owner")) {
    list[0]!.role = "owner";
  }
  writeStorage(STORAGE_USERS_KEY, list);
  syncUserRow(u);
}

function ensurePaymentsLoaded(): void {
  if (typeof window === "undefined") return;
  const saved = readStorage<Row[]>(STORAGE_PAYMENTS_KEY);
  if (saved !== null) {
    tables["payments"] = saved;
  } else {
    tables["payments"] = [...SEED_PAYMENTS];
    writeStorage(STORAGE_PAYMENTS_KEY, tables["payments"]);
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
  const users = getStoredUsers();
  if (s?.user) {
    const existing = users.find((u) => u.id === s.user.id);
    if (existing) syncUserRow(existing);
    else {
      const meta = (s.user.user_metadata ?? {}) as Record<string, string>;
      saveUser({
        id: s.user.id,
        email: s.user.email ?? "",
        password: "",
        first_name: meta["first_name"] ?? "",
        last_name: meta["last_name"] ?? "",
        role: users.length === 0 ? "owner" : "student",
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
    if (table === "profiles" || table === "user_roles") {
      getStoredUsers();
    }
    if (table === "payments") {
      ensurePaymentsLoaded();
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

  private async execute(): Promise<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }> {
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
        rows = [];
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
    onfulfilled?:
      ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

let warnedMock = false;
export function warnMockOnce(context: string) {
  if (warnedMock) return;
  warnedMock = true;
  console.warn(
    `[AI Studio] Supabase env vars not configured (${context}) — using in-memory mock data.`,
  );
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
    async signUp(params: {
      email: string;
      password: string;
      options?: { data?: Record<string, string> };
    }) {
      const email = params.email.trim().toLowerCase();
      const users = getStoredUsers();
      if (users.some((u) => u.email.toLowerCase() === email)) {
        return {
          data: { user: null, session: null },
          error: { message: "User already registered" },
        };
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
      const user = users.find(
        (u) => u.email.toLowerCase() === email && u.password === params.password,
      );
      if (!user) {
        return {
          data: { user: null, session: null },
          error: { message: "Invalid login credentials" },
        };
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

  const storageBuckets = new Map<string, Map<string, Blob>>();

  const storage = {
    from(bucket: string) {
      if (!storageBuckets.has(bucket)) storageBuckets.set(bucket, new Map());
      const files = storageBuckets.get(bucket)!;
      return {
        async upload(path: string, file: Blob) {
          files.set(path, file);
          return { data: { path }, error: null };
        },
        async remove(paths: string[]) {
          for (const p of paths) files.delete(p);
          return { data: [], error: null };
        },
        async download(path: string) {
          const blob = files.get(path) ?? null;
          if (!blob) return { data: null, error: { message: "Object not found" } };
          return { data: blob, error: null };
        },
        async createSignedUrl(path: string) {
          const blob = files.get(path);
          if (blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
            return { data: { signedUrl: URL.createObjectURL(blob) }, error: null };
          }
          return { data: null, error: { message: "Signed URL unavailable in local mock mode" } };
        },
      };
    },
  };

  async function rpc(fn: string, params?: Record<string, unknown>) {
    if (fn === "is_staff" || fn === "has_role") {
      const uid = params?.["_user_id"];
      const targetRole = params?.["_role"];
      const roles = (tables["user_roles"] ?? [])
        .filter((r) => r["user_id"] === uid)
        .map((r) => r["role"]);
      if (fn === "is_staff") {
        return { data: roles.includes("owner") || roles.includes("admin"), error: null };
      }
      return { data: roles.includes(targetRole), error: null };
    }
    return { data: null, error: null };
  }

  return {
    auth,
    storage,
    rpc,
    from(table: string) {
      return new MockQueryBuilder(table);
    },
  } as unknown as SupabaseClient<Database>;
}
