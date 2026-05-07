import {
  EmbeddingError,
  type EmbeddingProvider,
  type EmbeddingProviderId
} from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/embeddings";

const MODEL_BY_ID: Record<
  Exclude<EmbeddingProviderId, "local-bge-small">,
  { model: string; dimensions: number }
> = {
  "openrouter-text-embedding-3-small": {
    model: "openai/text-embedding-3-small",
    dimensions: 1536
  },
  "openrouter-text-embedding-3-large": {
    model: "openai/text-embedding-3-large",
    dimensions: 3072
  },
  "openrouter-qwen3-embedding-0-6b": {
    model: "qwen/qwen3-embedding-0.6b",
    dimensions: 1024
  }
};

/**
 * OpenRouter-routed embeddings provider. The OpenAI-compatible
 * /v1/embeddings endpoint accepts an array of inputs and returns a
 * matching array of vectors (`data[i].embedding`).
 *
 * We L2-normalize the returned vectors so cosine similarity reduces to a
 * dot product — same invariant as LocalBgeProvider.
 */
export class OpenRouterEmbeddingProvider implements EmbeddingProvider {
  readonly id: EmbeddingProviderId;
  readonly dimensions: number;
  private readonly model: string;

  constructor(
    id: Exclude<EmbeddingProviderId, "local-bge-small">,
    private readonly apiKey: string
  ) {
    if (!apiKey) {
      throw new EmbeddingError(
        "OpenRouter API key is required for embeddings."
      );
    }
    const cfg = MODEL_BY_ID[id];
    if (!cfg) throw new EmbeddingError(`Unknown embedding model: ${id}`);
    this.id = id;
    this.dimensions = cfg.dimensions;
    this.model = cfg.model;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://github.com/ictdevops/cka-sim",
          "X-Title": "CKA-Sim"
        },
        body: JSON.stringify({ model: this.model, input: texts })
      });
    } catch (e) {
      throw new EmbeddingError(
        `Network error contacting OpenRouter: ${(e as Error).message}`
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new EmbeddingError(
        `OpenRouter ${res.status}: ${body.slice(0, 300) || res.statusText}`
      );
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding: number[] }>;
    };
    if (!json.data || json.data.length !== texts.length) {
      throw new EmbeddingError(
        `OpenRouter returned ${json.data?.length ?? 0} embeddings for ${texts.length} inputs.`
      );
    }
    return json.data.map((d) => normalize(new Float32Array(d.embedding)));
  }
}

function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}
