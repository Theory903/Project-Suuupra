import crypto from 'crypto';

export interface EmbeddingsProvider {
  embed(text: string): Promise<number[]>;
}

// Deterministic stub provider that produces a 768-d vector based on SHA256 chunks
class StubEmbeddings implements EmbeddingsProvider {
  private dims = 768;
  async embed(text: string): Promise<number[]> {
    const base = text || '';
    const vec: number[] = new Array(this.dims).fill(0);
    // Hash sliding windows to fill vector deterministically
    for (let i = 0; i < this.dims; i += 32) {
      const h = crypto.createHash('sha256').update(`${i}:${base}`).digest();
      for (let j = 0; j < 32 && i + j < this.dims; j++) {
        vec[i + j] = (h[j] / 255) * 2 - 1; // normalize to [-1, 1]
      }
    }
    // L2-normalize
    const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    return vec.map((x) => x / norm);
  }
}

export class EmbeddingService {
  private provider: EmbeddingsProvider;
  constructor(provider?: EmbeddingsProvider) {
    this.provider = provider || new StubEmbeddings();
  }

  async embedForContent(c: { title: string; description?: string; tags?: string[] }): Promise<number[]> {
    const text = `${c.title}\n${c.description || ''}\n${(c.tags || []).join(' ')}`;
    return this.provider.embed(text);
  }
}

export const embeddingService = new EmbeddingService();

