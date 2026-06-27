import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  // baseURL can be overridden for the sealed-agent on-prem proxy (Phase 1b); default = OpenAI direct
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export const strongModel = (): LanguageModel => openai(process.env.OPENAI_MODEL_STRONG ?? "");
export const fastModel = (): LanguageModel => openai(process.env.OPENAI_MODEL_FAST ?? "");
