import { beforeEach, describe, expect, it } from "vitest";
import { createMockSupabaseClient } from "@/integrations/supabase/mock";

describe("mock owner & payment receipt workflows", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("assigns the owner role to the first user and lets them approve, reject, and delete receipts", async () => {
    const sb = createMockSupabaseClient();

    const ownerSignup = await sb.auth.signUp({
      email: "owner@ezanaacademy.et",
      password: "Password123",
      options: { data: { first_name: "Ezana", last_name: "Owner" } },
    });
    expect(ownerSignup.error).toBeNull();
    const ownerId = ownerSignup.data.user!.id;

    const { data: ownerRoles } = await sb.from("user_roles").select("role").eq("user_id", ownerId);
    expect(ownerRoles?.map((r) => r.role)).toContain("owner");

    const { data: initialPayments, error: listError } = await sb.from("payments").select("*");
    expect(listError).toBeNull();
    const pending = (initialPayments ?? []).filter((p) => p.status === "pending");
    expect(pending.length).toBeGreaterThanOrEqual(2);

    const target = pending[0]!;
    const { error: approveError } = await sb
      .from("payments")
      .update({
        status: "approved",
        review_note: "Verified Telebirr reference",
        reviewed_by: ownerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", target.id);
    expect(approveError).toBeNull();

    const { data: afterApprove } = await sb.from("payments").select("*").eq("id", target.id).single();
    expect(afterApprove?.status).toBe("approved");
    expect(afterApprove?.review_note).toBe("Verified Telebirr reference");

    const { error: rejectError } = await sb
      .from("payments")
      .update({
        status: "rejected",
        review_note: "Reference mismatch",
      })
      .eq("id", target.id);
    expect(rejectError).toBeNull();

    const { data: afterReject } = await sb.from("payments").select("*").eq("id", target.id).single();
    expect(afterReject?.status).toBe("rejected");

    const { error: deleteError } = await sb.from("payments").delete().eq("id", target.id);
    expect(deleteError).toBeNull();

    const { data: afterDelete } = await sb.from("payments").select("*").eq("id", target.id).maybeSingle();
    expect(afterDelete).toBeNull();
  });

  it("serves local videos for free lessons and unlocks pro lessons upon payment approval", async () => {
    const sb = createMockSupabaseClient();
    await sb.auth.signUp({
      email: "student@ezanaacademy.et",
      password: "Password123",
      options: { data: { first_name: "Hanna", last_name: "Tesfaye" } },
    });
    const { data: authData } = await sb.auth.getUser();
    const userId = authData.user!.id;

    const { data: lessons } = await sb
      .from("lessons")
      .select("id,course_id,position")
      .eq("course_id", "22222222-2222-4222-8222-222222222201")
      .order("position", { ascending: true });
    expect(lessons?.length).toBeGreaterThanOrEqual(6);

    const freeLesson = lessons![0]!;
    const proLesson = lessons![5]!;

    const { data: freeMedia } = await sb.from("lesson_media").select("video_url").eq("lesson_id", freeLesson.id).maybeSingle();
    expect(freeMedia?.video_url).toBe("/videos/lesson-1.mp4");

    const { data: lockedMedia } = await sb.from("lesson_media").select("video_url").eq("lesson_id", proLesson.id).maybeSingle();
    expect(lockedMedia).toBeNull();

    const { data: inserted } = await sb
      .from("payments")
      .insert({
        user_id: userId,
        course_id: "22222222-2222-4222-8222-222222222201",
        amount: 218,
        method: "Telebirr",
        reference: "FT999888777",
      })
      .select("*")
      .single();
    expect(inserted?.status).toBe("pending");

    await sb.from("payments").update({ status: "approved" }).eq("id", inserted!.id);

    const { data: unlockedMedia } = await sb.from("lesson_media").select("video_url").eq("lesson_id", proLesson.id).maybeSingle();
    expect(unlockedMedia?.video_url).toBe("/videos/lesson-pro.mp4");
  });
});
