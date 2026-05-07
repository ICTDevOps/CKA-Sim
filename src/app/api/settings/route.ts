import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getPrefs, setPrefs } from "@/lib/settings/repository";
import {
  ANTHROPIC_CHAT_MODELS,
  DEFAULT_PREFS,
  OPENROUTER_CHAT_MODELS,
  type UserPrefs
} from "@/lib/settings/types";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireLocalUserId();
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }
  const prefs = getPrefs(userId);
  // Never echo API keys back to the client; only expose whether they are set.
  const { anthropicApiKey, openrouterApiKey, ...safe } = prefs;
  return NextResponse.json({
    prefs: {
      ...safe,
      anthropicApiKeySet: anthropicApiKey.length > 0,
      openrouterApiKeySet: openrouterApiKey.length > 0
    }
  });
}

interface PutBody {
  llmProvider?: string;
  anthropicApiKey?: string;
  clearAnthropicApiKey?: boolean;
  anthropicModel?: string;
  openrouterApiKey?: string;
  clearOpenrouterApiKey?: boolean;
  openrouterModel?: string;
  embeddingProvider?: UserPrefs["embeddingProvider"];
  aiTutorEnabled?: boolean;
  examMode?: boolean;
  ragEnabled?: boolean;
}

const ALLOWED_EMBEDDING = new Set<UserPrefs["embeddingProvider"]>([
  "local-bge-small",
  "openrouter-text-embedding-3-small",
  "openrouter-text-embedding-3-large",
  "openrouter-qwen3-embedding-0-6b"
]);

export async function PUT(req: NextRequest) {
  const userId = await requireLocalUserId();
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as PutBody;

  const current = getPrefs(userId);
  const next: UserPrefs = { ...DEFAULT_PREFS, ...current };

  // llmProvider — accept both modern values and the legacy "claude-oauth"
  // alias used by older clients.
  if (body.llmProvider) {
    if (body.llmProvider === "openrouter") next.llmProvider = "openrouter";
    else if (
      body.llmProvider === "anthropic" ||
      body.llmProvider === "claude-oauth"
    ) {
      next.llmProvider = "anthropic";
    }
  }

  if (body.embeddingProvider && ALLOWED_EMBEDDING.has(body.embeddingProvider)) {
    next.embeddingProvider = body.embeddingProvider;
  }

  // Anthropic key + model
  if (typeof body.anthropicApiKey === "string") {
    const k = body.anthropicApiKey.trim();
    if (k.length > 0 && k.length <= 256) next.anthropicApiKey = k;
  }
  if (body.clearAnthropicApiKey) next.anthropicApiKey = "";
  if (body.anthropicModel) {
    if (
      ANTHROPIC_CHAT_MODELS.includes(
        body.anthropicModel as (typeof ANTHROPIC_CHAT_MODELS)[number]
      )
    ) {
      next.anthropicModel = body.anthropicModel;
    }
  }

  // OpenRouter key + model
  if (typeof body.openrouterApiKey === "string") {
    const k = body.openrouterApiKey.trim();
    if (k.length > 0 && k.length <= 256) next.openrouterApiKey = k;
  }
  if (body.clearOpenrouterApiKey) next.openrouterApiKey = "";
  if (body.openrouterModel) {
    if (
      OPENROUTER_CHAT_MODELS.includes(
        body.openrouterModel as (typeof OPENROUTER_CHAT_MODELS)[number]
      )
    ) {
      next.openrouterModel = body.openrouterModel;
    }
  }

  if (typeof body.aiTutorEnabled === "boolean") {
    next.aiTutorEnabled = body.aiTutorEnabled;
  }
  if (typeof body.examMode === "boolean") next.examMode = body.examMode;
  if (typeof body.ragEnabled === "boolean") next.ragEnabled = body.ragEnabled;

  setPrefs(userId, next);

  const { anthropicApiKey, openrouterApiKey, ...safe } = next;
  return NextResponse.json({
    prefs: {
      ...safe,
      anthropicApiKeySet: anthropicApiKey.length > 0,
      openrouterApiKeySet: openrouterApiKey.length > 0
    }
  });
}
