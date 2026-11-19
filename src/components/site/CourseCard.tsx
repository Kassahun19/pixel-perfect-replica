import { Link } from "@tanstack/react-router";
import { Clock, PlayCircle, Sparkles } from "lucide-react";
import type { PublicCourse } from "@/lib/public.functions";
import { FREE_LESSON_LIMIT, formatETB } from "@/lib/access";

export function CourseCard({ course, index = 0 }: { course: PublicCourse; index?: number }) {
  return (
    <Link
      to="/courses/$slug"
      params={{ slug: course.slug }}
      className="lift group flex animate-fade-up flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {course.image_url && (
          <img
            src={course.image_url}
            alt={course.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        )}
        <div className="bg-fade-deep absolute inset-0 opacity-60" />
        {course.category && (
          <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-primary backdrop-blur">
            {course.category.name}
          </span>
        )}
        <span className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-bold text-gold-foreground">
          <Sparkles className="h-3.5 w-3.5" /> {FREE_LESSON_LIMIT} free videos
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-xl font-semibold leading-snug transition-colors group-hover:text-primary">{course.title}</h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.short_description}</p>
        <div className="mt-auto flex items-center justify-between pt-6 text-sm">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1"><PlayCircle className="h-4 w-4" />{course.lesson_count}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{course.duration_hours}h</span>
          </div>
          <span className="font-display text-lg font-semibold text-primary">{formatETB()}</span>
        </div>
      </div>
    </Link>
  );
}
