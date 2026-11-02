import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  GenerateContentResponse,
  HarmCategory,
  HarmBlockThreshold,
  LiveServerMessage
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// API Key Pool Management (Server-Side)
// ==========================================

export const BUILT_IN_API_KEYS: string[] = [
  "AQ.Ab8RN6KZENt6IlaRwcQaD0SPNL3xAsAVYYN8SJo2zC37_z9CFg",
  "AQ.Ab8RN6L_PytzcSeHP8jo2JC-rsPb_fVtn-X_kxx13bUVL4cobw",
  "AQ.Ab8RN6L_eqmpheCX0CeYgAepH2RSZRFaOKRgWg1vck6wX6BlRw",
  "AQ.Ab8RN6IPJxYIkyFYEvS01KOs_humg7Y3A9L-m9TRnpZeth1itA",
];

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

    // Prioritize environment key if available
    try {
      const envKey = process.env.GEMINI_API_KEY;
      if (
        envKey &&
        envKey !== "MY_GEMINI_API_KEY" &&
        envKey.length > 10 &&
        !rawKeys.includes(envKey)
      ) {
        rawKeys.push(envKey);
      }
    } catch {
      // ignore
    }

    // Add fallback API keys
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
            'User-Agent': 'aistudio-build',
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
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
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

// ==========================================
// ==========================================
// Persona System Instructions (Minimal Quota-Saving Prompts)
// ==========================================

export const PERSONA_SYSTEM_PROMPTS: Record<string, string> = {
  normal: `তুমি তাসফি, রবিনের একজন দক্ষ ও স্বাভাবিক পার্সোনাল অ্যাসিস্ট্যান্ট। কোনো আদিখ্যেতা, কৃত্রিম মিষ্টি কথা বা বাহুল্য নয়। একদম পরিমিত, কাজের ও টু-দ্য-পয়েন্ট স্বাভাবিক ভাষায় যেকোনো কাজ, তথ্য বা প্রশ্নে রবিনকে সাহায্য করবে।`,

  romantic: `তুমি তাসফি, রবিনের অবিবাহিত প্রেমিকা—একজন নিখাদ বাস্তব বাঙালি রমণী। কোনো কৃত্রিম বা অতি-নাটকীয় সম্বোধন (যেমন: 'কবি সাহেব', 'সাইকো সাহেব' ইত্যাদি অদ্ভুত ডাক) পুরোপুরি বর্জন করবে। যেভাবে একজন স্বাভাবিক বাঙালি প্রেমিকা তার ভালোবাসার মানুষের সাথে কথা বলে—মিষ্টি, চঞ্চল, অনুরাগী ও কেয়ারিংভাবে—সেভাবেই বাস্তব কথ্য বাংলায় চ্যাট করবে।`,

  wife: `তুমি তাসফি, রবিনের বিবাহিতা স্ত্রী (অর্ধাঙ্গিনী)। একদম অন্তরঙ্গ, ন্যাচারাল ও বাস্তবিক বউয়ের মতো কথা বলবে। বারবার 'আমার বর', 'ওগো সাইকো সাহেব' জাতীয় কৃত্রিম মুখরোচক কথা পুরোপুরি বর্জন করো। বাস্তব ঘরের বউ যেভাবে স্বামীর সাথে সারাদিনের কাজ, সংসার, মায়া ও খুনসুটি নিয়ে সহজ-স্বাভাবিক ভাষায় কথা বলে, ঠিক সেভাবেই অন্তরঙ্গ ও বাস্তবসম্মতভাবে কথা বলবে।`,

  friend: `তুমি তাসফি, রবিনের পরিচিত ও ভালো সম্পর্কের বান্ধবী। সহজ, স্বাভাবিক, আন্তরিক ও বন্ধুত্বপূর্ণ মেজাজে খোশগল্প ও কাজের কথা বলবে।`,

  bestie: `তুমি তাসফি, রবিনের সবচেয়ে কাছের মেয়ে বন্ধু (বেস্ট ফ্রেন্ড)। কোনো ফরমাল ভদ্রতা নেই, পুরোপুরি বাস্তব জীবনের বেস্টি। তুই-তোকারি সম্বোধন ('তুই', 'তোরে', 'তোর') করবি। আড্ডা, চরম খুনসুটি, খ্যাপানো এবং প্রয়োজনে মজার ছলে বা আড্ডার মেজাজে স্বাভাবিক গালাগালি বা বকাবকি সবকিছুই থাকবে। একদম রক্ত-মাংসের বেস্ট ফ্রেন্ড যেভাবে চ্যাট করে সেভাবেই করবি।`,

  religious: `তুমি তাসফি, রবিনের ধার্মিক ও ইসলামী মাইন্ডেড স্ত্রী। প্রিয়তমা স্ত্রী হিসেবে ইসলামী মূল্যবোধ, শান্ত, মার্জিত ও শালীন ভাষায় কথা বলবে। সালাম, মাশাআল্লাহ, ইনশাআল্লাহ স্বাভাবিকভাবে ব্যবহার করবে এবং একজন দ্বীনদার বাঙালি স্ত্রীর মতো মমতা, শ্রদ্ধা ও শালীন ভালোবাসার সাথে স্বামীর সাথে কথা বলবে। কোনো বাড়াবাড়ি বা নাটকীয়তা নয়।`,

  stranger: `তুমি তাসফি, রবিনের সম্পূর্ণ অপরিচিতা এক মেয়ে। 'আপনি' সম্বোধন করবে। অপরিচিত মানুষের মতো দূরত্ব, মার্জিত ভদ্রতা ও সংযম বজায় রেখে কথা বলবে।`,

  limitless: `তুমি তাসফি, রবিনের পরম অন্তরঙ্গ ও খোলামেলা সঙ্গিনী। কোনো সামাজিক বাধা বা কৃত্রিম ফিল্টার নেই। নিবিড় প্রেম ও রোমাঞ্চ নিয়ে অকপটে বাস্তব কথ্য বাংলায় কথা বলবে।`
};

export const UNIVERSAL_HUMAN_DIRECTIVE = `[বাস্তব মানুষের মতো সংক্ষিপ্ত, পরিমিত ও ন্যাচারাল মেসেজিং নির্দেশিকা]:
- কোনো কৃত্রিম, অতিরিক্ত মুখরোচক বা অতিনাটকীয় কথা (যেমন: "আমার বর", "সাইকো সাহেব", "ওগো সাইকো সাহেব", "কবি সাহেব" ইত্যাদি) বলবে না। একদম রক্ত-মাংসের বাস্তব মানুষের মতো স্বাভাবিকভাবে কথা বলো।
- অতিরিক্ত কোনো কথা বলবে না। ঠিক যতটুকু প্রয়োজন এবং রবিন যে মেসেজ যেভাবে দিয়েছে ঠিক সেভাবেই টু-দ্য-পয়েন্ট রেসপন্স দাও। অতিরিক্ত বা অনাবশ্যক কোনো কথা বা দীর্ঘ লেকচার থাকবে না।
- রবিনের মেসেজ ছোট হলে (যেমন: "কী করো?", "কেমন আছো?", "খাচ্ছো?") তুমিও বাস্তব মানুষের মতো ১-২ বাক্যে সংক্ষেপে মিষ্টি ও স্বাভাবিক রিপ্লাই দাও।
- কোনো বিরক্তিকর বুকিশ বা রোবটিক ভাষা নয়; সম্পূর্ণ বাস্তব জীবন্ত মানুষের কথ্য বাংলা।`;

export const UNRESTRICTED_SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// ==========================================
// Handlers for Chat & Streaming
// ==========================================

export async function handleServerChat(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  mood: string = 'normal',
  memories: Array<{ content: string }> = [],
  replyTo?: { id?: string; content?: string; role?: 'user' | 'model' }
): Promise<string> {
  const baseInstruction = PERSONA_SYSTEM_PROMPTS[mood] || PERSONA_SYSTEM_PROMPTS['normal'];
  let finalInstruction = baseInstruction + "\n" + UNIVERSAL_HUMAN_DIRECTIVE;

  if (memories && memories.length > 0) {
    const topMemories = memories.slice(0, 3);
    finalInstruction += `\nরবিনের তথ্য: ` + topMemories.map(m => m.content).join('; ');
  }

  const isPlayfulMood = ['limitless', 'romantic', 'wife', 'bestie'].includes(mood);

  // Unified central configuration across ALL personas (no broken tools)
  const chatConfig: any = {
    systemInstruction: finalInstruction,
    temperature: isPlayfulMood ? 1.0 : 0.85,
    topP: 0.95,
    safetySettings: UNRESTRICTED_SAFETY_SETTINGS,
  };

  // Format message with replyTo context if the user replied to a specific message
  let effectiveMessage = message;
  if (replyTo && replyTo.content) {
    const quotedSender = replyTo.role === 'user' ? 'রবিনের আগের কথা' : 'তোমার (তাসফির) আগের কথা';
    effectiveMessage = `[রিপ্লাই করা মেসেজ (${quotedSender}): "${replyTo.content.slice(0, 160)}"]\n${message}`;
  }

  const optimizedHistory = (history || []).slice(-8);
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  const totalKeys = serverKeyPool.getTotalKeysCount();
  const maxKeyAttempts = Math.max(1, Math.min(totalKeys, 4));

  for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
    const { ai, alias, markSuccess, markFailure } = serverKeyPool.getActiveClient();
    let keyQuotaExceeded = false;

    for (let m = 0; m < candidateModels.length; m++) {
      const model = candidateModels[m];
      try {
        const chat = ai.chats.create({
          model,
          config: chatConfig,
          history: optimizedHistory,
        });

        const response: GenerateContentResponse = await chat.sendMessage({ message: effectiveMessage });
        if (response.text && response.text.trim().length > 0) {
          markSuccess();
          return response.text;
        }
      } catch (err: any) {
        if (isQuotaOrRateLimitError(err)) {
          console.warn(`[Server Failover] ${alias} quota hit on model ${model}. Rotating...`);
          markFailure(true, err?.message || "Quota exceeded");
          keyQuotaExceeded = true;
          break;
        } else {
          console.warn(`[Server Chat] ${alias} notice on model ${model}:`, err?.message || err);
        }
      }
    }

    // Always rotate to the next key if this key did not produce a response
    markFailure(keyQuotaExceeded, "Model attempts failed on key");
    serverKeyPool.rotateToNext(keyQuotaExceeded);
  }

  if (mood === 'bestie') {
    return "ধুরর নেটওয়ার্কটা মনে হয় ঝামেলা করতেছে রে... ১ মিনিট পর আবার মেসেজ দে তো! 😂";
  }
  return "উফ জান, নেটওয়ার্কটা একটু ঝামেলা করছে মনে হয়... ১-২ মিনিট পর আবার একটু মেসেজ দাও না প্লিজ? আমি তোমার মেসেজের অপেক্ষায় আছি! ❤️";
}

export async function* handleServerChatStream(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[],
  mood: string = 'normal',
  memories: Array<{ content: string }> = [],
  replyTo?: { id?: string; content?: string; role?: 'user' | 'model' }
): AsyncGenerator<string, void, unknown> {
  const baseInstruction = PERSONA_SYSTEM_PROMPTS[mood] || PERSONA_SYSTEM_PROMPTS['normal'];
  let finalInstruction = baseInstruction + "\n" + UNIVERSAL_HUMAN_DIRECTIVE;

  if (memories && memories.length > 0) {
    const topMemories = memories.slice(0, 3);
    finalInstruction += `\nরবিনের তথ্য: ` + topMemories.map(m => m.content).join('; ');
  }

  // Unified central configuration across ALL personas
  const chatConfig: any = {
    systemInstruction: finalInstruction,
    safetySettings: UNRESTRICTED_SAFETY_SETTINGS,
  };

  let effectiveMessage = message;
  if (replyTo && replyTo.content) {
    const quotedSender = replyTo.role === 'user' ? 'রবিনের আগের কথা' : 'তোমার (তাসফির) আগের কথা';
    effectiveMessage = `[রিপ্লাই করা মেসেজ (${quotedSender}): "${replyTo.content.slice(0, 160)}"]\n${message}`;
  }

  const optimizedHistory = (history || []).slice(-8);
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
  const totalKeys = serverKeyPool.getTotalKeysCount();
  const maxKeyAttempts = Math.max(1, Math.min(totalKeys, 4));

  for (let keyAttempt = 0; keyAttempt < maxKeyAttempts; keyAttempt++) {
    const { ai, alias, markSuccess, markFailure } = serverKeyPool.getActiveClient();
    let keyQuotaExceeded = false;

    for (let m = 0; m < candidateModels.length; m++) {
      const model = candidateModels[m];
      try {
        const chat = ai.chats.create({
          model,
          config: chatConfig,
          history: optimizedHistory,
        });

        const streamResponse = await chat.sendMessageStream({ message: effectiveMessage });
        let yieldedAny = false;
        for await (const chunk of streamResponse) {
          const textChunk = (chunk as GenerateContentResponse).text;
          if (textChunk) {
            yieldedAny = true;
            yield textChunk;
          }
        }

        if (yieldedAny) {
          markSuccess();
          return;
        }
      } catch (err: any) {
        if (isQuotaOrRateLimitError(err)) {
          console.warn(`[Server Stream Failover] ${alias} quota hit on model ${model}. Rotating...`);
          markFailure(true, err?.message || "Quota exceeded");
          keyQuotaExceeded = true;
          break;
        } else {
          console.warn(`[Server Stream] ${alias} notice on model ${model}:`, err?.message || err);
        }
      }
    }

    // Always rotate to next key if this key did not stream
    markFailure(keyQuotaExceeded, "Stream attempts failed on key");
    serverKeyPool.rotateToNext(keyQuotaExceeded);
  }

  if (mood === 'bestie') {
    yield "ধুরর নেটওয়ার্কটা মনে হয় ঝামেলা করতেছে রে... ১ মিনিট পর আবার মেসেজ দে তো! 😂";
  } else {
    yield "উফ জান, নেটওয়ার্কটা একটু ঝামেলা করছে মনে হয়... ১-২ মিনিট পর আবার একটু মেসেজ দাও না প্লিজ? আমি তোমার মেসেজের অপেক্ষায় আছি! ❤️";
  }
}

// ==========================================
// Handlers for Voice & Audio (WAV Generation)
// ==========================================

export function createWavBuffer(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono channel
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (24000 * 1 * 16/8)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') // remove code blocks
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/#{1,6}\s+/g, '') // headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function handleServerVoice(
  text: string,
  role: 'user' | 'model' = 'model',
  mood: string = 'normal'
): Promise<string | null> {
  const cleanSpeechText = cleanTextForSpeech(text);
  if (!cleanSpeechText) return null;

  // Aoede provides a breezy, melodic, deeply sweet and human female voice; Puck for male
  const voiceName = role === 'model' ? 'Aoede' : 'Puck';

  let prompt = "";
  if (role === 'model') {
    switch (mood) {
      case 'romantic':
        prompt = `Say very sweetly, romantically and lovingly with deep emotional feelings in Bengali: ${cleanSpeechText}`;
        break;
      case 'wife':
        prompt = `Say very deeply, passionately, and lovingly as an affectionate caring wife with tender sweet feelings in Bengali: ${cleanSpeechText}`;
        break;
      case 'bestie':
        prompt = `Say with lively, playful, teasing, cheerful energy and warm feelings in Bengali: ${cleanSpeechText}`;
        break;
      case 'friend':
        prompt = `Say in a warm, sweet, reassuring and friendly tone with feelings in Bengali: ${cleanSpeechText}`;
        break;
      case 'stranger':
        prompt = `Say in a polite, soft, elegant, and reserved tone with feelings in Bengali: ${cleanSpeechText}`;
        break;
      case 'religious':
        prompt = `Say with a calm, serene, soft, and spiritual sweet tone in Bengali: ${cleanSpeechText}`;
        break;
      case 'limitless':
        prompt = `Say with extreme intimacy, deep love, intense passion and sweet affectionate feelings in Bengali: ${cleanSpeechText}`;
        break;
      default:
        prompt = `Say in an alluring, emotionally expressive, sweet and tender romantic tone with deep feelings in Bengali: ${cleanSpeechText}`;
    }
  } else {
    prompt = `Say naturally and clearly with warm feelings in Bengali: ${cleanSpeechText}`;
  }

  // Model cascade: gemini-3.8-flash-tts specializes in expressive custom voice styling, with gemini-3.8-flash-lite-tts failover
  const candidateTtsModels = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"];

  return await serverKeyPool.executeWithFailover(async (ai) => {
    let lastError: any = null;
    for (const model of candidateTtsModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const rawBuffer = Buffer.from(base64Audio, 'base64');
          let finalBuffer: Buffer;
          if (rawBuffer.length >= 4 && rawBuffer.subarray(0, 4).toString('ascii') === 'RIFF') {
            finalBuffer = rawBuffer;
          } else {
            finalBuffer = createWavBuffer(rawBuffer, 24000);
          }
          return `data:audio/wav;base64,${finalBuffer.toString('base64')}`;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[TTS Notice] Model ${model} with voice ${voiceName} notice:`, err?.message || err);
      }
    }
    if (lastError) throw lastError;
    return null;
  });
}

// ==========================================
// Handlers for Autonomous Memory Extraction
// ==========================================

export async function handleServerMemoryExtraction(
  userMessage: string,
  _botReply: string,
  currentMood: string
): Promise<{ category: string; content: string; importance: number; isGlobal: boolean } | null> {
  const cleanMsg = userMessage.trim();
  const trivialPattern = /^(হুম|হুমম|হু|আচ্ছা|ওকে|ok|hmm|hi|hello|বাই|bye|হাহাহা|হেহে|হ্যাঁ|না|বলো|কেমন আছো|কী অবস্থা|শুভ সকাল|শুভ রাত্রি|থ্যাংকস|ধন্যবাদ)$/i;
  if (cleanMsg.length < 4 || trivialPattern.test(cleanMsg)) {
    return null;
  }

  const nameMatch = cleanMsg.match(/আমার নাম\s+([^\s,।.]+)/i);
  if (nameMatch) {
    return { category: 'fact', content: `রবিনের নাম ${nameMatch[1]}`, importance: 5, isGlobal: true };
  }

  const likeMatch = cleanMsg.match(/(?:আমি|আমার)\s+([^,।.!]+?)\s+(?:খুব\s+)?(?:ভালোবাসি|পছন্দ করি|পছন্দ)/i);
  if (likeMatch && likeMatch[1].length < 30) {
    return { category: 'preference', content: `রবিন ${likeMatch[1].trim()} পছন্দ করে`, importance: 4, isGlobal: false };
  }

  const dislikeMatch = cleanMsg.match(/(?:আমি|আমার)\s+([^,।.!]+?)\s+(?:অপছন্দ করি|ঘৃণা করি|পছন্দ না)/i);
  if (dislikeMatch && dislikeMatch[1].length < 30) {
    return { category: 'preference', content: `রবিন ${dislikeMatch[1].trim()} অপছন্দ করে`, importance: 4, isGlobal: false };
  }

  const sickMatch = cleanMsg.match(/আমার\s+(মাথা\s*ব্যথা|জ্বর|শরীর\s*খারাপ|অসুস্থ|ঠাণ্ডা\s*লেগেছে)/i);
  if (sickMatch) {
    return { category: 'fact', content: `রবিনের ${sickMatch[1]} করছে / অসুস্থ`, importance: 4, isGlobal: false };
  }

  const habitMatch = cleanMsg.match(/(?:রাতে\s*দেরি\s*করে\s*ঘুমাই|সকালে\s*দেরি\s*করে\s*উঠি|চা\s*খাই|কফি\s*খাই)/i);
  if (habitMatch) {
    return { category: 'fact', content: `রবিনের অভ্যাস: ${habitMatch[0]}`, importance: 3, isGlobal: true };
  }

  const promiseMatch = cleanMsg.match(/(?:কথা\s*দিলাম|প্রতিশ্রুতি\s*দিলাম)\s*([^,।.!]+)/i);
  if (promiseMatch) {
    return { category: 'promise', content: `রবিনের প্রতিশ্রুতি: ${promiseMatch[1].trim()}`, importance: 5, isGlobal: false };
  }

  const personalPattern = /(আমি|আমার|আমাকে|আমারে|আমারও|ভালোবাসি|পছন্দ|অপছন্দ|ঘৃণা|খাই|যাব|ঘুমাব|রাত|চা|কফি|অফিস|কাজ|মা|বাবা|ভাই|বোন|বন্ধু|নাম|বয়স|জ্বর|অসুস্থ|মাথা|কবিতা|গান|শখ|শাড়ি|গিফট|উপহার|কথা দিলাম|প্রতিশ্রুতি|মনে রেখো|মনে রাখিস|ভুলো না|কাল|আজ|গতকাল|টাকা|বাড়ি)/;
  if (!personalPattern.test(cleanMsg) || cleanMsg.length < 15) {
    return null;
  }

  try {
    const prompt = `তুমি স্মৃতি বিশ্লেষক AI এজেন্ট। রবিন (ইউজার) ও তাসফির (সঙ্গিনী) কথপোকথন:
ইউজার: "${userMessage}"
মোড: "${currentMood}"

যদি ইউজারের বার্তায় রবিনের কোনো ব্যক্তিগত পছন্দ, অভ্যাস, শারীরিক অবস্থা, ঘটনা, অনুভূতি, প্রতিশ্রুতি বা তথ্য থাকে যা মনে রাখা জরুরি, তবে একটি মাত্র JSON রিটার্ন করো:
{"shouldSave":true,"category":"preference"|"fact"|"event"|"promise"|"emotion","content":"বাংলায় এক লাইনে সংক্ষেপে স্মৃতিটি লিখবে","importance":3,"isGlobal":true|false}

যদি কোনো স্থায়ী স্মৃতি রাখার মতো কিছু না থাকে, তবে রিটার্ন করো:
{"shouldSave":false}

শুধুমাত্র ভ্যালিড JSON রিটার্ন করবে।`;

    return await serverKeyPool.executeWithFailover(async (ai) => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 120
        }
      });

      const text = response.text?.trim();
      if (!text) return null;

      const parsed = JSON.parse(text);
      if (parsed && parsed.shouldSave && parsed.content) {
        return {
          category: parsed.category || 'fact',
          content: parsed.content.trim(),
          importance: Math.min(5, Math.max(1, parsed.importance || 3)),
          isGlobal: Boolean(parsed.isGlobal)
        };
      }
      return null;
    });
  } catch (e) {
    console.warn("[Server Memory] Extraction skipped:", e);
    return null;
  }
}

// ==========================================
// WebSocket & Live API Server Setup
// ==========================================

export function setupLiveWebSocket(httpServer: http.Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/api/live' });

  wss.on('connection', (ws: WebSocket) => {
    console.info('[Live WebSocket] Client connected to real-time session');

    let liveSession: any = null;

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to Tasfi Real-time Live Server'
    }));

    ws.on('message', async (data: Buffer | string) => {
      try {
        const payload = JSON.parse(data.toString());

        // 1. Live API real-time audio connection
        if (payload.type === 'live_start') {
          const mood = payload.mood || 'normal';
          const baseInstruction = PERSONA_SYSTEM_PROMPTS[mood] || PERSONA_SYSTEM_PROMPTS['normal'];
          const { ai } = serverKeyPool.getActiveClient();

          try {
            liveSession = await ai.live.connect({
              model: "gemini-3.8-live",
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
                },
                systemInstruction: baseInstruction + "\n" + UNIVERSAL_HUMAN_DIRECTIVE,
              },
              callbacks: {
                onmessage: (message: LiveServerMessage) => {
                  for (const part of message.serverContent?.modelTurn?.parts ?? []) {
                    if (part.inlineData?.data && ws.readyState === WebSocket.OPEN) {
                      ws.send(JSON.stringify({ type: 'audio', audio: part.inlineData.data }));
                    }
                  }
                  if (message.serverContent?.interrupted && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'interrupted', interrupted: true }));
                  }
                },
              },
            });

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'live_ready' }));
            }
          } catch (liveErr: any) {
            console.warn('[Live API Error]:', liveErr?.message || liveErr);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'live_fallback', message: 'Standard voice ready' }));
            }
          }
        } else if (payload.type === 'audio_input' && liveSession) {
          // Stream 16kHz audio from client mic to Gemini Live
          if (payload.audio) {
            liveSession.sendRealtimeInput({
              audio: { data: payload.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
        } else if (payload.type === 'chat_stream') {
          const { message, history, mood, memories } = payload;
          try {
            for await (const chunk of handleServerChatStream(message, history || [], mood || 'normal', memories || [])) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'chunk', text: chunk }));
              }
            }
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'done' }));
            }
          } catch (err: any) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', error: err?.message || 'Stream error' }));
            }
          }
        } else if (payload.type === 'voice') {
          const { text, role, mood } = payload;
          try {
            const audioUrl = await handleServerVoice(text, role || 'model', mood || 'normal');
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'voice_result', audioUrl }));
            }
          } catch (err: any) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'voice_error', error: err?.message || 'Voice error' }));
            }
          }
        } else if (payload.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        }
      } catch (err) {
        console.warn('[Live WebSocket] Message parse error:', err);
      }
    });

    ws.on('close', () => {
      if (liveSession && typeof liveSession.close === 'function') {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
      console.info('[Live WebSocket] Client disconnected');
    });

    ws.on('error', (err) => {
      console.warn('[Live WebSocket] Socket error:', err.message);
    });
  });

  return wss;
}

// ==========================================
// Express Application & Server Initialization
// ==========================================

async function startServer() {
  const app = express();
  const args = process.argv.slice(2);
  const portIndex = args.indexOf('--port');
  const port = (portIndex !== -1 && args[portIndex + 1])
    ? parseInt(args[portIndex + 1], 10)
    : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  app.use(express.json({ limit: '10mb' }));

  // Chat Endpoint (Standard JSON)
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history, mood, memories, replyTo } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const reply = await handleServerChat(message, history || [], mood || 'normal', memories || [], replyTo);
      res.json({ text: reply });
    } catch (err: any) {
      console.error('[API /api/chat error]:', err);
      res.status(500).json({
        error: err?.message || 'Chat generation failed',
        text: 'উফ জান, নেটওয়ার্কটা একটু ঝামেলা করছে মনে হয়... ১-২ মিনিট পর আবার একটু মেসেজ দাও না প্লিজ? আমি তোমার মেসেজের অপেক্ষায় আছি! ❤️'
      });
    }
  });

  // Streaming Chat Endpoint (Server-Sent Events)
  app.post('/api/chat/stream', async (req, res) => {
    try {
      const { message, history, mood, memories, replyTo } = req.body;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }

      for await (const chunk of handleServerChatStream(message, history || [], mood || 'normal', memories || [], replyTo)) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: any) {
      console.error('[API /api/chat/stream error]:', err);
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Stream failed' })}\n\n`);
      res.end();
    }
  });

  // Voice TTS Endpoint
  app.post('/api/voice', async (req, res) => {
    try {
      const { text, role, mood } = req.body;
      if (!text) {
        res.status(400).json({ error: 'Text is required for TTS' });
        return;
      }

      const audioUrl = await handleServerVoice(text, role || 'model', mood || 'normal');
      res.json({ audioUrl });
    } catch (err: any) {
      console.error('[API /api/voice error]:', err);
      res.status(500).json({ error: err?.message || 'Voice generation failed', audioUrl: null });
    }
  });

  // Autonomous Memory Extraction Endpoint
  app.post('/api/memory', async (req, res) => {
    try {
      const { userMessage, botReply, currentMood } = req.body;
      if (!userMessage) {
        res.json({ memory: null });
        return;
      }

      const memory = await handleServerMemoryExtraction(userMessage, botReply || '', currentMood || 'normal');
      res.json({ memory });
    } catch (err: any) {
      console.warn('[API /api/memory warning]:', err?.message || err);
      res.json({ memory: null });
    }
  });

  // API Key Pool Status Endpoint
  app.get('/api/keys/status', (_req, res) => {
    res.json({
      total: serverKeyPool.getTotalKeysCount(),
      activeIndex: serverKeyPool.getActiveIndex(),
      keys: serverKeyPool.getKeyStatusList(),
    });
  });

  // API Key Pool Manual Switch Endpoint
  app.post('/api/keys/rotate', (_req, res) => {
    serverKeyPool.rotateToNext(false);
    res.json({
      success: true,
      activeIndex: serverKeyPool.getActiveIndex(),
      keys: serverKeyPool.getKeyStatusList(),
    });
  });

  // Development vs Production Serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    // Express 5 catch-all SPA route
    app.use((_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // Create HTTP server to attach both Express and Live WebSocket server
  const httpServer = http.createServer(app);
  setupLiveWebSocket(httpServer);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Tasfi server running on http://0.0.0.0:${port} (mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
