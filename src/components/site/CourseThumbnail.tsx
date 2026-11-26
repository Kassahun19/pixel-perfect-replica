import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { courseImageUrl, fallbackCourseImage, type CourseImageContext } from "@/lib/course-image";
import { cn } from "@/lib/utils";

type CourseThumbnailProps = {
  imageUrl: string | null | undefined;
  course?: CourseImageContext;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
};

/** Renders a course thumbnail with automatic subject-matched fallback if missing or broken. */
export function CourseThumbnail({ imageUrl, course, alt, className, loading = "lazy" }: CourseThumbnailProps) {
  const primary = courseImageUrl(imageUrl);
  const fallback = fallbackCourseImage(course);
  const [stage, setStage] = useState<"primary" | "fallback" | "icon">(primary ? "primary" : "fallback");

  useEffect(() => {
    setStage(primary ? "primary" : "fallback");
  }, [primary, fallback]);

  if (stage === "icon") {
    return (
      <div className={cn("flex items-center justify-center bg-emerald-gradient text-primary-foreground", className)}>
        <BookOpen className="h-8 w-8 opacity-80" aria-hidden="true" />
      </div>
    );
  }

  const src = stage === "primary" && primary ? primary : fallback;
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={cn("bg-secondary object-cover", className)}
      onError={() => setStage((current) => (current === "primary" && primary !== fallback ? "fallback" : "icon"))}
    />
  );
}