import { GoogleGenAI, type GenerateContentResponse } from "@google/genai";

export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite-image";

export type CourseThumbnailPromptInput = {
  title: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  level?: string | undefined;
  category?: string | undefined;
};

export type GeneratedImageResult = {
  b64Json: string;
  mimeType: string;
};

export function buildCourseThumbnailPrompt(input: CourseThumbnailPromptInput): string {
  const title = input.title.trim();
  const subjectDetails = [
    input.category?.trim(),
    input.shortDescription?.trim(),
    input.description?.trim().slice(0, 180),
  ]
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

export function extractGeminiImageResult(
  response: GenerateContentResponse,
): GeneratedImageResult | null {
  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return {
        b64Json: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }
  return null;
}

export function formatImageSsePayload(result: GeneratedImageResult): string {
  const payload = JSON.stringify({
    type: "image_generation.completed",
    b64_json: result.b64Json,
    mime_type: result.mimeType,
  });
  return `event: image_generation.completed\ndata: ${payload}\n\n`;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export async function generateCourseThumbnailImage(
  apiKey: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<GeneratedImageResult> {
  const ai = createGeminiClient(apiKey);
  const response = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9",
      },
      ...(signal ? { abortSignal: signal } : {}),
    },
  });

  const image = extractGeminiImageResult(response);
  if (!image) {
    throw new Error("Gemini API returned no image data.");
  }
  return image;
}
