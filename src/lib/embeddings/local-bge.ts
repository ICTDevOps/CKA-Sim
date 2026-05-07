import {
  pipeline,
  type FeatureExtractionPipeline
} from "@huggingface/transformers";
import {
  EmbeddingError,
  type EmbeddingProvider,
  type EmbeddingProviderId
} from "./types";

/**
 * Local bge-small-en feature-extraction pipeline.
 *
 * Why this model:
 *  - 384 dims → small index, fast retrieval
 *  - English-only is fine (the K8s docs we ingest are EN-only)
 *  - Open-source, runs in Node via onnxruntime, no API call, no key
 *
 * The pipeline is loaded lazily on first use and cached for the lifetime
 * of the process. First load downloads ONNX weights from the Hugging Face
 * CDN (~130 MB) and may take 10-30s. In a Docker image, pre-warm by
 * running the ingestion script during the build so the cache is included.
 */

const MODEL_ID = "Xenova/bge-small-en-v1.5";

let cachedPipeline: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!cachedPipeline) {
    cachedPipeline = (pipeline("feature-extraction", MODEL_ID, {
      dtype: "fp32"
    }) as Promise<unknown>) as Promise<FeatureExtractionPipeline>;
  }
  return cachedPipeline;
}

export class LocalBgeProvider implements EmbeddingProvider {
  readonly id: EmbeddingProviderId = "local-bge-small";
  readonly dimensions = 384;

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const pipe = await getPipeline();
    try {
      const output = await pipe(texts, {
        pooling: "mean",
        normalize: true
      });
      // `output` is a Tensor of shape [N, 384]. Slice into per-text Float32Arrays.
      const data = output.data as Float32Array;
      const dims = (output.dims as number[]) ?? [texts.length, 384];
      const n = dims[0];
      const d = dims[1];
      const out: Float32Array[] = [];
      for (let i = 0; i < n; i++) {
        out.push(new Float32Array(data.buffer, data.byteOffset + i * d * 4, d));
      }
      // Detach views from the underlying buffer (the pipeline may reuse it).
      return out.map((v) => new Float32Array(v));
    } catch (e) {
      throw new EmbeddingError(
        `Local bge-small failed: ${(e as Error).message}`
      );
    }
  }
}
