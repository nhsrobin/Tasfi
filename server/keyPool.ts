import { GoogleGenAI } from '@google/genai';

export const BUILT_IN_API_KEYS: string[] = [];

export interface ServerKeyItem {
  key: string;
  alias: string;
  cooldownUntil: number;
  failureCount: number;
  successCount: number;
  lastUsed: number;
  lastError: string | null;
}

export function isQuotaOrRateLimitError(err: any): boolean {
  if (!err) return false;
  const msg = (err?.message || (typeof err === "string" ? err : JSON.stringify(err))).toLowerCase();
  const status = (err?.status || err?.code || "").toString().toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("exceeded your current quota") ||
    status === "429" ||
    status === "503" ||
    status === "resource_exhausted" ||
    status === "unavailable"
  );
}

export class ServerKeyPool {
  private keys: ServerKeyItem[] = [];
  private activeIndex: number = 0;
  private clientCache: Map<string, GoogleGenAI> = new Map();

  constructor() {
    this.initPool();
  }

  private initPool() {
    const rawKeys: string[] = [];

    // Support individual numbered keys: GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY_4
    const numberedKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ];
    for (const k of numberedKeys) {
      if (k && k !== "MY_GEMINI_API_KEY" && k.trim().length > 10) {
        const clean = k.trim();
        if (!rawKeys.includes(clean)) rawKeys.push(clean);
      }
    }

    // Support standard GEMINI_API_KEY and GEMINI_API_KEYS (comma or newline separated)
    const envVars = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS];
    for (const rawVal of envVars) {
      if (!rawVal) continue;
      const splitKeys = rawVal.split(/[,\n\r]+/).map(k => k.trim()).filter(Boolean);
      for (const k of splitKeys) {
        if (k && k !== "MY_GEMINI_API_KEY" && k.length > 10 && !rawKeys.includes(k)) {
          rawKeys.push(k);
        }
      }
    }

    // Add fallback keys from BUILT_IN_API_KEYS (if any)
    for (const key of BUILT_IN_API_KEYS) {
      if (key && !rawKeys.includes(key)) {
        rawKeys.push(key);
      }
    }

    this.keys = rawKeys.map((k, index) => ({
      key: k,
      alias: `API Key #${index + 1} (${k.slice(0, 5)}...${k.slice(-4)})`,
      cooldownUntil: 0,
      failureCount: 0,
      successCount: 0,
      lastUsed: 0,
      lastError: null,
    }));

    console.info(`[ServerKeyPool] Initialized with ${this.keys.length} API keys.`);
  }

  public getTotalKeysCount(): number {
    return this.keys.length;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getKeyStatusList() {
    return this.keys.map(k => ({
      key: `${k.key.slice(0, 8)}...${k.key.slice(-4)}`,
      alias: k.alias,
      cooldownUntil: k.cooldownUntil,
      failureCount: k.failureCount,
      successCount: k.successCount,
      lastUsed: k.lastUsed,
      lastError: k.lastError,
    }));
  }

  public getClientForKey(key: string): GoogleGenAI {
    let client = this.clientCache.get(key);
    if (!client) {
      client = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'Tasfi-Companion/1.0',
          },
        },
      });
      this.clientCache.set(key, client);
    }
    return client;
  }

  public getActiveClient() {
    if (this.keys.length === 0) {
      const dummy = new GoogleGenAI({
        apiKey: "EMPTY",
        httpOptions: { headers: { 'User-Agent': 'Tasfi-Companion/1.0' } },
      });
      return {
        ai: dummy,
        key: "",
        alias: "None",
        index: -1,
        markSuccess: () => {},
        markFailure: () => {},
      };
    }

    const now = Date.now();
    const current = this.keys[this.activeIndex];
    if (current && current.cooldownUntil <= now) {
      return this.wrapKey(this.activeIndex);
    }

    for (let offset = 1; offset <= this.keys.length; offset++) {
      const idx = (this.activeIndex + offset) % this.keys.length;
      if (this.keys[idx].cooldownUntil <= now) {
        this.activeIndex = idx;
        return this.wrapKey(idx);
      }
    }

    let soonestIdx = 0;
    let minCooldown = this.keys[0].cooldownUntil;
    for (let i = 1; i < this.keys.length; i++) {
      if (this.keys[i].cooldownUntil < minCooldown) {
        minCooldown = this.keys[i].cooldownUntil;
        soonestIdx = i;
      }
    }

    this.activeIndex = soonestIdx;
    return this.wrapKey(soonestIdx);
  }

  private wrapKey(idx: number) {
    const item = this.keys[idx];
    item.lastUsed = Date.now();
    const ai = this.getClientForKey(item.key);

    return {
      ai,
      key: item.key,
      alias: item.alias,
      index: idx,
      markSuccess: () => {
        item.successCount++;
        item.cooldownUntil = 0;
        item.lastError = null;
      },
      markFailure: (isQuota: boolean = false, errorMsg?: string) => {
        item.failureCount++;
        if (errorMsg) item.lastError = errorMsg;
        if (isQuota) {
          item.cooldownUntil = Date.now() + 60 * 1000;
          console.warn(`[ServerKeyPool] ${item.alias} quota exhausted. Cooldown 60s.`);
        }
      },
    };
  }

  public rotateToNext(cooldownCurrent: boolean = true) {
    if (this.keys.length <= 1) return;
    const current = this.keys[this.activeIndex];
    if (cooldownCurrent && current) {
      current.cooldownUntil = Date.now() + 60 * 1000;
    }
    this.activeIndex = (this.activeIndex + 1) % this.keys.length;
    console.info(`[ServerKeyPool] Rotated to ${this.keys[this.activeIndex].alias}`);
  }

  async executeWithFailover<T>(
    operation: (ai: GoogleGenAI, keyInfo: { key: string; alias: string; index: number }) => Promise<T>,
    maxAttempts: number = this.keys.length
  ): Promise<T> {
    if (this.keys.length === 0) {
      throw new Error(
        "No Gemini API keys configured. Please add GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc. in Render Dashboard > Environment."
      );
    }

    let lastError: any = null;
    const attempts = Math.max(1, Math.min(maxAttempts, this.keys.length || 1));

    for (let i = 0; i < attempts; i++) {
      const { ai, key, alias, index, markSuccess, markFailure } = this.getActiveClient();
      try {
        const result = await operation(ai, { key, alias, index });
        markSuccess();
        return result;
      } catch (err: any) {
        lastError = err;
        const isQuota = isQuotaOrRateLimitError(err);
        markFailure(isQuota, err?.message || String(err));
        this.rotateToNext(isQuota);
      }
    }

    throw lastError || new Error("All API keys in server pool failed.");
  }
}

export const serverKeyPool = new ServerKeyPool();
