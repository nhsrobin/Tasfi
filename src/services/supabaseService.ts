import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.init();
  }

  /**
   * Initializes the Supabase client if environment variables are present.
   */
  public init() {
    // Check for standard Vite env variables
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (url && anonKey && url !== 'YOUR_SUPABASE_URL' && anonKey !== 'YOUR_SUPABASE_ANON_KEY') {
      try {
        this.client = createClient(url, anonKey, {
          auth: {
            persistSession: false
          }
        });
        this.isConfigured = true;
        console.log('✅ Supabase initialized successfully!');
      } catch (error) {
        console.error('❌ Failed to initialize Supabase client:', error);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      console.log('ℹ️ Supabase credentials not found. Running in Local Mode (localStorage).');
    }
  }

  /**
   * Checks whether Supabase is active and connected.
   */
  public isActive(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Fetches all chats and their messages from Supabase.
   */
  async loadChats(): Promise<any[] | null> {
    if (!this.isActive() || !this.client) return null;

    try {
      // 1. Fetch chats ordered by last_updated descending
      const { data: chatsData, error: chatsError } = await this.client
        .from('tasfi_chats')
        .select('*')
        .order('last_updated', { ascending: false });

      if (chatsError) throw chatsError;
      if (!chatsData) return [];

      // 2. Fetch all messages
      const { data: messagesData, error: messagesError } = await this.client
        .from('tasfi_messages')
        .select('*')
        .order('timestamp', { ascending: true });

      if (messagesError) throw messagesError;

      // 3. Map messages to their respective chats
      return chatsData.map((chat: any) => {
        const chatMessages = (messagesData || [])
          .filter((msg: any) => msg.chat_id === chat.id)
          .map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            reactions: msg.reactions || [],
            replyTo: msg.reply_to || undefined,
            status: msg.status || undefined
          }));

        return {
          id: chat.id,
          title: chat.title,
          mood: chat.mood || 'normal',
          lastUpdated: new Date(chat.last_updated),
          expiresAt: chat.expires_at ? Number(chat.expires_at) : undefined,
          messages: chatMessages
        };
      });
    } catch (error) {
      console.error('Failed to load chats from Supabase:', error);
      throw error;
    }
  }

  /**
   * Saves or updates a single chat and its messages in Supabase.
   */
  async saveChat(chat: any): Promise<boolean> {
    if (!this.isActive() || !this.client) return false;

    try {
      // 1. Upsert the chat record
      const { error: chatError } = await this.client
        .from('tasfi_chats')
        .upsert({
          id: chat.id,
          title: chat.title,
          mood: chat.mood || 'normal',
          last_updated: new Date(chat.lastUpdated).toISOString(),
          expires_at: chat.expiresAt ? Number(chat.expiresAt) : null
        });

      if (chatError) throw chatError;

      // 2. Upsert message records for this chat
      if (chat.messages && chat.messages.length > 0) {
        const messagesToUpsert = chat.messages.map((msg: any) => ({
          id: msg.id,
          chat_id: chat.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toISOString(),
          reactions: msg.reactions || [],
          reply_to: msg.replyTo || null,
          status: msg.status || null
        }));

        const { error: messagesError } = await this.client
          .from('tasfi_messages')
          .upsert(messagesToUpsert);

        if (messagesError) throw messagesError;
      }

      return true;
    } catch (error) {
      console.error(`Failed to save chat ${chat.id} to Supabase:`, error);
      throw error;
    }
  }

  /**
   * Syncs all local chats to Supabase. Useful for onboarding.
   */
  async syncAllChats(localChats: any[]): Promise<{ successCount: number; failedCount: number }> {
    if (!this.isActive() || !this.client) return { successCount: 0, failedCount: localChats.length };

    let successCount = 0;
    let failedCount = 0;

    for (const chat of localChats) {
      try {
        const success = await this.saveChat(chat);
        if (success) successCount++;
        else failedCount++;
      } catch (err) {
        failedCount++;
      }
    }

    return { successCount, failedCount };
  }

  /**
   * Deletes a chat from Supabase (messages are deleted via cascade foreign key).
   */
  async deleteChat(chatId: string): Promise<boolean> {
    if (!this.isActive() || !this.client) return false;

    try {
      const { error } = await this.client
        .from('tasfi_chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Failed to delete chat ${chatId} from Supabase:`, error);
      throw error;
    }
  }

  /**
   * Gets the SQL Schema required to set up Supabase.
   */
  public getSQLSetupSchema(): string {
    return `-- ১. চ্যাট টেবিল তৈরি (tasfi_chats)
CREATE TABLE IF NOT EXISTS public.tasfi_chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    mood TEXT NOT NULL DEFAULT 'normal',
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at BIGINT
);

-- ২. মেসেজ টেবিল তৈরি (tasfi_messages)
CREATE TABLE IF NOT EXISTS public.tasfi_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES public.tasfi_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reactions JSONB DEFAULT '[]'::jsonb,
    reply_to JSONB DEFAULT NULL,
    status TEXT
);

-- ৩. Row Level Security (RLS) পলিসি অন করা
ALTER TABLE public.tasfi_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasfi_messages ENABLE ROW LEVEL SECURITY;

-- ৪. অ্যানোনিমাস ইউজারদের জন্য সহজ অ্যাক্সেস পলিসি তৈরি করা (যেহেতু এটি রবিনের ব্যক্তিগত অ্যাপ)
CREATE POLICY "সবাইকে চ্যাট দেখতে ও পরিবর্তন করতে দিন" 
ON public.tasfi_chats 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "সবাইকে মেসেজ দেখতে ও পরিবর্তন করতে দিন" 
ON public.tasfi_messages 
FOR ALL 
USING (true) 
WITH CHECK (true);`;
  }
}

export const supabaseService = new SupabaseService();
