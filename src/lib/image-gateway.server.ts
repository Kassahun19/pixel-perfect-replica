export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "openai" | "gemini-chat" | "generate-content" | "cloudflare-input";
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
};

export type CourseThumbnailPromptInput = {
  title: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  level?: string | undefined;
  category?: string | undefined;
};

export function buildCourseThumbnailPrompt(input: CourseThumbnailPromptInput): string {
  const title = input.title.trim();
  const subjectDetails = [input.category?.trim(), input.shortDescription?.trim(), input.description?.trim().slice(0, 180)]
    .filter(Boolean)
    .join(". ");
  const level = input.level?.trim() || "Beginner";

  return [
    `Create a polished, high-resolution 16:9 widescreen editorial course thumbnail illustrating the subject "${title}".`,
    subjectDetails ? `Course focus: ${subjectDetails}.` : "",
    `Audience level: ${level}.`,
    "Visual style: modern, refined educational photography or clean studio editorial illustration with a cohesive deep emerald green, warm burnished gold, and soft cream color palette inspired by contemporary Ethiopian craftsmanship and academic excellence.",
    "Composition: clear central subject with balanced negative space, crisp studio lighting, rich depth of field, and vibrant yet refined contrast suitable for an e-learning catalog card.",
    "Strict exclusions: no text, no letters, no numbers, no logos, no watermarks, and no UI chrome.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function generateImage(
  config: ImageConfig,
  prompt: string,
  stream = true,
  signal?: AbortSignal,
) {
  let input: Record<string, unknown>;
  switch (config.format) {
    case "openai":
      input = {
        prompt,
        size: "1536x1024",
        quality: "medium",
        ...(stream ? { partial_images: 1 } : {}),
      };
      break;
    case "cloudflare-input":
      input = { input: { prompt } };
      break;
    case "generate-content":
      input = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      };
      break;
    default:
      input = {
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      };
  }
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: config.model, ...input, ...(stream ? { stream: true } : {}) }),
    signal: signal ?? null,
  });
}