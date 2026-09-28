/**
 * Klien REST Gemini untuk asisten AI (28 September 2026). Satu fetch, tanpa SDK.
 *
 * HANYA dipakai di Route Handler (server). GEMINI_API_KEY = env Vercel, TIDAK
 * PERNAH berawalan NEXT_PUBLIC_, TIDAK PERNAH di .env.local, TIDAK PERNAH
 * dicetak/di-log. Dikirim lewat header x-goog-api-key (bukan query string).
 * Galat cuma membawa status HTTP, tidak pernah isi respons.
 *
 * GEMINI_MODEL = nama model, bisa diganti di env Vercel tanpa ubah kode.
 */

export const MODEL_BAWAAN = 'gemini-2.5-flash-lite';

export type BagianGemini =
  | { text: string; thoughtSignature?: string }
  | { functionCall: { name: string; args?: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type IsiGemini = { role: 'user' | 'model'; parts: BagianGemini[] };

export type DeklarasiFungsi = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type PermintaanGemini = {
  instruksiSistem: string;
  isi: IsiGemini[];
  fungsi: DeklarasiFungsi[];
};

/** Satu giliran model -- tipe terpisah supaya agen bisa diuji dengan model palsu. */
export type PanggilModel = (permintaan: PermintaanGemini) => Promise<IsiGemini>;

export class GalatPenyediaAi extends Error {
  constructor(public readonly status: number) {
    super(`Gemini menjawab status ${status}`);
  }
}

export function aiTerkonfigurasi(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function buatPanggilGemini(): PanggilModel {
  const kunci = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || MODEL_BAWAAN;
  if (!kunci) {
    throw new Error('GEMINI_API_KEY belum diset di server.');
  }

  return async ({ instruksiSistem, isi, fungsi }) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': kunci },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruksiSistem }] },
        contents: isi,
        tools: [{ functionDeclarations: fungsi }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        generationConfig: { temperature: 0, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new GalatPenyediaAi(res.status);
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: BagianGemini[] } }[] };
    return { role: 'model', parts: data.candidates?.[0]?.content?.parts ?? [] };
  };
}
