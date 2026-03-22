export class GeminiService {
  async chat(message: string, history: { role: "user" | "model"; parts: { text: string }[] }[], role: string = 'normal', subMode: string = 'normal') {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, role, subMode })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Response:', errorData);
        throw new Error(`Network response was not ok: ${response.status} ${errorData.error || ''}`);
      }
      
      const data = await response.json();
      return data.text || "দুঃখিত, আমি বুঝতে পারিনি।";
    } catch (error) {
      console.error("Chat Error Details:", error);
      return "দুঃখিত, সার্ভারের সাথে যোগাযোগ করতে সমস্যা হচ্ছে।";
    }
  }

  async generateVoice(text: string, role: 'user' | 'model', subMode: string = 'normal'): Promise<string | null> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, role, subMode })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      const base64Audio = data.audio;
      if (!base64Audio) return null;

      // The model returns raw PCM data (16-bit, 24kHz, mono).
      // We need to add a WAV header so the browser can play it.
      const pcmData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      const wavHeader = this.createWavHeader(pcmData.length, 24000);
      const wavData = new Uint8Array(wavHeader.length + pcmData.length);
      wavData.set(wavHeader);
      wavData.set(pcmData, wavHeader.length);

      const blob = new Blob([wavData], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }

  private createWavHeader(pcmLength: number, sampleRate: number): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + pcmLength, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, pcmLength, true);

    return new Uint8Array(header);
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export const geminiService = new GeminiService();
