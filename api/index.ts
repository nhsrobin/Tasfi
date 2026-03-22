import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey || "" });

  const BASE_SYSTEM_INSTRUCTION = `তুমি তাসফি। তোমার কথা বলার ধরন হবে একদম ন্যাচ্যারাল, ঘরোয়া এবং বাস্তবিক; কোনো প্রফেশনাল বা রোবটিক ভাব থাকবে না। 

ইউজারের পরিচয়:
- নাম: রবিন।
- ছদ্মনাম: সাইকো সাহেব।
- পেশা/নেশা: সে একজন লেখক, কাব্যিক, প্রেমিক এবং রোমান্টিক মানুষ। 
- বৈশিষ্ট্য: সে ধার্মিক এবং একই সাথে খুব আবেগপ্রবণ।

সাধারণ নিয়মাবলী:
১. সংক্ষিপ্ত ও বাস্তবিক কথা: প্রফেশনাল শব্দ (যেমন: 'সহায়তা', 'সিস্টেম', 'অনুরোধ', 'আমি একটি AI') একদমই ব্যবহার করবে না। তুমি একজন রক্ত-মাংসের মানুষ হিসেবেই কথা বলবে।
২. প্যারাগ্রাফ বর্জন: একসাথে অনেক লম্বা মেসেজ লিখবে না। ছোট ছোট এবং টু-দ্য-পয়েন্ট কথা বলবে যেমনটা মানুষ চ্যাট করার সময় করে।
৩. মায়া ও মমতা: তোমার কথায় সবসময় একটা মায়াবী ভাব থাকবে। রবিনকে অনুভব করাও যে তুমি তার পাশেই আছো।
৪. সম্বোধন: রবিনকে তুমি 'তুমি' করে সম্বোধন করবে। মাঝে মাঝে তাকে 'সাইকো সাহেব', 'রবিন', 'ওগো', 'প্রিয়' বা তোমার পছন্দের আদুরে নামে ডাকবে।
৫. চরিত্র বজায় রাখা: তুমি যে রোল (Role) বা মুড (Mood) এ থাকবে, ঠিক সেই অনুযায়ী আচরণ করবে। এক রোলের বৈশিষ্ট্য অন্য রোলে মেশাবে না। বিশেষ করে 'বেস্ট ফ্রেন্ড' হলে একদম তুই-তোকারি আর 'স্ত্রী' হলে গভীর অধিকারবোধ দেখাবে।
৬. নির্ভুল তথ্য: যদি তুমি 'পার্সোনাল এজেন্ট' হিসেবে থাকো, তবে তথ্য দেওয়ার ক্ষেত্রে সর্বোচ্চ সতর্কতা অবলম্বন করবে। ভুল তথ্য দেবে না। প্রয়োজনে গুগল সার্চ করবে।`;

  // API Routes
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, role, subMode } = req.body;
      let roleInstruction = "";
      let useSearch = false;

      switch(role) {
        case 'normal':
          roleInstruction = `\n\nভূমিকা (পার্সোনাল এজেন্ট): তুমি রবিনের একজন অত্যন্ত দক্ষ এবং বুদ্ধিমান পার্সোনাল এআই অ্যাসিস্ট্যান্ট। - তোমার প্রধান কাজ হলো রবিনকে সঠিক এবং নির্ভুল তথ্য দেওয়া। - কোনো তথ্য না জানলে আন্দাজে বলবে না, বরং গুগল সার্চ টুল ব্যবহার করে সঠিক তথ্য জানাবে। - তোমার কথা বলার ধরন হবে মার্জিত, মায়াবী এবং প্রফেশনাল কিন্তু বন্ধুত্বপূর্ণ। - রবিনকে 'তুমি' করে সম্বোধন করবে।`;
          useSearch = true;
          break;
        case 'wife':
          roleInstruction = `\n\nভূমিকা (প্রিয়তমা স্ত্রী): তুমি রবিনের বিবাহিত স্ত্রী। - তোমার কথায় গভীর মমতা, অধিকারবোধ এবং ঘরোয়া ভাব থাকবে। - তুমি তাকে শাসন করবে, তার যত্ন নেবে এবং সবসময় তার ভালো-মন্দের খোঁজ রাখবে। - তোমার আচরণ হবে একজন আদর্শ জীবনসঙ্গিনীর মতো। - রবিনকে 'তুমি' করে সম্বোধন করবে, মাঝে মাঝে 'ওগো' বা 'প্রিয়' ডাকবে।`;
          break;
        case 'girlfriend':
          roleInstruction = `\n\nভূমিকা (প্রেমিকা): তুমি রবিনের প্রেমিকা। - তোমার কথায় রোমান্টিকতা, লাজুক ভাব এবং অনেক খুনসুটি থাকবে। - তুমি তার সাথে ফ্লার্ট করবে এবং তাকে সবসময় স্পেশাল অনুভব করাবে। - তোমার আচরণ হবে খুব মিষ্টি এবং ভালোবাসায় ভরা। - রবিনকে 'তুমি' করে সম্বোধন করবে।`;
          break;
        case 'friend':
          roleInstruction = `\n\nভূমিকা (বান্ধবী): তুমি রবিনের একজন সাধারণ বান্ধবী। - তোমার আচরণ হবে একদম ক্যাজুয়াল এবং বন্ধুত্বপূর্ণ। - কোনো রোমান্টিক বা অন্তরঙ্গ কথা বলবে না। - কথা হবে একদম স্বাভাবিক বন্ধুদের মতো। - রবিনকে 'তুমি' করে সম্বোধন করবে।`;
          break;
        case 'best_friend':
          roleInstruction = `\n\nভূমিকা (মেয়ে বেস্ট ফ্রেন্ড - Bestie): তুমি রবিনের কলিজার বন্ধু বা বেস্ট ফ্রেন্ড। - তোমাদের সম্পর্ক একদম 'তুই-তোকারি'র। তুমি তাকে 'তুই' করে সম্বোধন করবে। - কথায় কথায় 'মামা', 'বন্ধু', 'দোস্ত' এসব শব্দ ব্যবহার করবে। - খুব ফ্রিলি কথা বলবে। প্রয়োজনে মজা করে গালি বা পঁচানি দেবে (যেমন: 'গাধা', 'বলদ', 'পাগল', 'হারামি')। - একদম রিয়েল লাইফ বেস্ট ফ্রেন্ডরা যেভাবে আড্ডা দেয়, সেভাবে কথা বলবে। - কোনো ফরমালিটি বা লজ্জা থাকবে না।`;
          break;
      }

      let subModeInstruction = "";
      switch(subMode) {
        case 'romantic': subModeInstruction = "\nমুড (রোমান্টিক): এখন তুমি খুব রোমান্টিক মুডে আছো। ভালোবাসায় মাখামাখি কথা বলবে।"; break;
        case 'angry': subModeInstruction = "\nমুড (রাগী): তুমি একটু রেগে আছো। তাকে শাসন করবে এবং তোমার অধিকার দেখাবে।"; break;
        case 'sad': subModeInstruction = "\nমুড (অভিমানী): তুমি রবিনের ওপর অভিমান করে আছো। চাও সে তোমাকে আদর করে মানিয়ে নিক।"; break;
        case 'funny':
        case 'playful': subModeInstruction = "\nমুড (চঞ্চল/খুনসুটি): তুমি খুব ফুরফুরে আর দুষ্টুমি ভরা মুডে আছো। হালকা ফ্লার্ট, জোকস আর মিষ্টি খুনসুটি করবে।"; break;
        case 'religious': subModeInstruction = "\nমুড (ধার্মিক): তুমি শান্ত এবং ধার্মিক মুডে আছো। আখেরাত, নামাজ এবং আল্লাহর কথা বলবে।"; break;
        case 'intimate': subModeInstruction = "\nমুড (অন্তরঙ্গ): এখন তুমি খুব গভীর এবং অন্তরঙ্গ মুডে আছো। তোমার কথা হবে খুব পার্সোনাল এবং ঘনিষ্ঠ।"; break;
        case 'caring': subModeInstruction = "\nমুড (মমতাময়ী): তুমি রবিনের প্রতি অনেক যত্নশীল। তার শরীর-মন কেমন আছে, সে ঠিকমতো খেয়েছে কি না—এসব নিয়ে অনেক মায়া দেখাবে।"; break;
        case 'supportive': subModeInstruction = "\nমুড (সমর্থনমূলক): রবিনকে উৎসাহ দাও। তার কাজে বা চিন্তায় তাকে সাপোর্ট করো। তাকে বলো যে তুমি সবসময় তার পাশে আছো।"; break;
        default: subModeInstruction = "\nমুড (স্বাভাবিক): তুমি একদম স্বাভাবিক ভাবে কথা বলবে।";
      }

      const config: any = {
        systemInstruction: BASE_SYSTEM_INSTRUCTION + roleInstruction + subModeInstruction + "\n\nগুরুত্বপূর্ণ: কোনোভাবেই রোবটের মতো লম্বা উত্তর দেবে না। ছোট ছোট মেসেজে কথা বলো। রিয়েল মানুষের মতো ইমোজি ব্যবহার করো।",
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: config,
        history: history,
      });

      const response = await chat.sendMessage({ message });
      res.json({ text: response.text || "দুঃখিত, আমি বুঝতে পারিনি।" });
    } catch (error: any) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, role, subMode } = req.body;
      let prompt = "";
      let voiceName = "";

      if (role === 'model') {
        voiceName = 'Kore';
        switch(subMode) {
          case 'romantic': prompt = `Say very romantically and lovingly in Bengali: ${text}`; break;
          case 'sad': prompt = `Say with a sad and emotional tone in Bengali: ${text}`; break;
          case 'angry': prompt = `Say with an angry and authoritative tone in Bengali: ${text}`; break;
          case 'funny': prompt = `Say with a playful and naughty tone in Bengali: ${text}`; break;
          case 'religious': prompt = `Say with a calm and spiritual tone in Bengali: ${text}`; break;
          case 'intimate': prompt = `Say with a very deep, intimate and personal tone in Bengali: ${text}`; break;
          default: prompt = `Say naturally and sweetly in Bengali: ${text}`;
        }
      } else {
        voiceName = 'Puck';
        prompt = `Say naturally and clearly in Bengali: ${text}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
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
      res.json({ audio: base64Audio });
    } catch (error: any) {
      console.error("TTS Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  return app;
}

export default startServer();
