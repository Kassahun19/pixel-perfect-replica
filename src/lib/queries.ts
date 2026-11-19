import { queryOptions } from "@tanstack/react-query";
import {
  getAcademySettings,
  getPublicCourse,
  listPublicCategories,
  listPublicCourses,
} from "./public.functions";

export const coursesQuery = queryOptions({
  queryKey: ["public", "courses"],
  queryFn: () => listPublicCourses(),
  staleTime: 60_000,
});

export const courseQuery = (slug: string) =>
  queryOptions({
    queryKey: ["public", "course", slug],
    queryFn: () => getPublicCourse({ data: { slug } }),
    staleTime: 60_000,
  });

export const categoriesQuery = queryOptions({
  queryKey: ["public", "categories"],
  queryFn: () => listPublicCategories(),
  staleTime: 5 * 60_000,
});

export const settingsQuery = queryOptions({
  queryKey: ["public", "settings"],
  queryFn: () => getAcademySettings(),
  staleTime: 5 * 60_000,
});
