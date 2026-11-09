// Supabase Edge Function: identify-species
// Meneruskan foto + daftar kandidat jenis dari aplikasi ke Claude (Anthropic API).
// Kunci API disimpan sebagai secret di Supabase, tidak pernah dikirim ke HP.
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (opsional) supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5-5
// Hanya pengguna yang sudah login (JWT valid) yang bisa memanggil fungsi ini.

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Metode tidak didukung" }, 405);
  if (!API_KEY) return json({ error: "ANTHROPIC_API_KEY belum diatur di Supabase" }, 500);

  let body: { prompt?: string; imageBase64?: string | null; mediaType?: string };
  try { body = await req.json(); } catch { return json({ error: "Permintaan tidak valid" }, 400); }
  const prompt = (body.prompt ?? "").toString();
  if (!prompt || prompt.length > 20000) return json({ error: "Prompt kosong atau terlalu panjang" }, 400);
  if (body.imageBase64 && body.imageBase64.length > 7_000_000) return json({ error: "Foto terlalu besar" }, 413);

  const content: unknown[] = [];
  if (body.imageBase64) {
    content.push({ type: "image", source: { type: "base64", media_type: body.mediaType || "image/jpeg", data: body.imageBase64 } });
  }
  content.push({ type: "text", text: prompt });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1200, messages: [{ role: "user", content }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: j?.error?.message ?? `Anthropic API ${r.status}` }, 502);

  const text: string = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  let data = null;
  try { data = JSON.parse(m ? m[0] : text); } catch { /* biarkan null */ }
  return json({ data, text, model: MODEL });
});
