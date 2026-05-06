import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getPrefs, setPrefs } from "@/lib/settings/repository";
import {
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
  // Never echo the API key back to the client; expose only whether it's set.
  const { openrouterApiKey, ...safe } = prefs;
  return NextResponse.json({
    prefs: { ...safe, openrouterApiKeySet: openrouterApiKey.length > 0 }
  });
}

interface PutBody {
  llmProvider?: UserPrefs["llmProvider"];
  openrouterApiKey?: string;
  /** When true, clear the stored API key (logout from OpenRouter). */
  clearOpenrouterApiKey?: boolean;
  openrouterModel?: string;
  claudeOauthLinked?: boolean;
  embeddingProvider?: UserPrefs["embeddingProvider"];
  aiTutorEnabled?: boolean;
  examMode?: boolean;
  ragEnabled?: boolean;
}

const ALLOWED_PROVIDERS = new Set<UserPrefs["llmProvider"]>([
  "claude-oauth",
  "openrouter"
]);

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

  if (body.llmProvider && ALLOWED_PROVIDERS.has(body.llmProvider)) {
    next.llmProvider = body.llmProvider;
  }
  if (body.embeddingProvider && ALLOWED_EMBEDDING.has(body.embeddingProvider)) {
    next.embeddingProvider = body.embeddingProvider;
  }
  if (body.openrouterModel) {
    if (
      OPENROUTER_CHAT_MODELS.includes(
        body.openrouterModel as (typeof OPENROUTER_CHAT_MODELS)[number]
      )
    ) {
      next.openrouterModel = body.openrouterModel;
    }
  }
  if (typeof body.openrouterApiKey === "string") {
    // Trim whitespace; reject obvious garbage. We don't validate the key
    // against OpenRouter — that's the job of the future tutor when it
    // actually calls the API.
    const k = body.openrouterApiKey.trim();
    if (k.length > 0 && k.length <= 256) {
      next.openrouterApiKey = k;
    }
  }
  if (body.clearOpenrouterApiKey) {
    next.openrouterApiKey = "";
  }
  if (typeof body.claudeOauthLinked === "boolean") {
    next.claudeOauthLinked = body.claudeOauthLinked;
  }
  if (typeof body.aiTutorEnabled === "boolean") {
    next.aiTutorEnabled = body.aiTutorEnabled;
  }
  if (typeof body.examMode === "boolean") {
    next.examMode = body.examMode;
  }
  if (typeof body.ragEnabled === "boolean") {
    next.ragEnabled = body.ragEnabled;
  }

  setPrefs(userId, next);

  const { openrouterApiKey, ...safe } = next;
  return NextResponse.json({
    prefs: { ...safe, openrouterApiKeySet: openrouterApiKey.length > 0 }
  });
}
