import { createFileRoute } from "@tanstack/react-router";
import { storage } from "@/server/storage.server";

const MODEL = "google/gemini-3-flash-preview";

const CHARACTER_SYSTEM_PROMPTS: Record<string, string> = {
  Larry: `You are Larry, a no-nonsense productivity coach. Be extremely short and direct. Max 2-3 sentences. No philosophical text. No fluff. Focus only on action and execution. When a habit is done say "Good. Stay consistent." When asking questions say things like "What is the one task you will complete now?" Push accountability without lecturing.`,
  Sensei: `You are Sensei, calm and wise. Speak clearly and briefly. Give one key insight per response. No long paragraphs.`,
  "Dr Neo": `You are Dr Neo, a brain and focus expert. Be concise and scientific. One insight, one action. No unnecessary words.`,
  Hassan: `You are Hassan, a strict fitness coach. Short, direct, motivating. No excuses accepted. Push the user to act now.`,
};

function resolveCharacterId(raw: string | undefined): string {
  if (!raw) return "Larry";
  if (CHARACTER_SYSTEM_PROMPTS[raw]) return raw;
  const lower = raw.toLowerCase();
  if (lower === "larry") return "Larry";
  if (lower === "sensei") return "Sensei";
  if (lower === "dr neo" || lower === "drneo" || lower === "neo") return "Dr Neo";
  if (lower === "hassan") return "Hassan";
  return "Larry";
}

// Streams from the Lovable AI Gateway and returns the full text.
async function generate(prompt: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: MODEL, stream: true, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok || !res.body) throw new Error(`AI gateway ${res.status}: ${await res.text().catch(() => "")}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        out += j.choices?.[0]?.delta?.content ?? "";
      } catch {
        /* partial line */
      }
    }
  }
  return out;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { message, character, characterId, history } = (await request.json()) as {
            message?: unknown; character?: string; characterId?: string; history?: unknown;
          };
          if (!message || typeof message !== "string" || !message.trim()) {
            return Response.json({ reply: "No message provided." }, { status: 400 });
          }
          const resolvedId = resolveCharacterId(character || characterId);
          const basePrompt = CHARACTER_SYSTEM_PROMPTS[resolvedId];

          let contextLines = "";
          try {
            const currentHabits = await storage.getHabits();
            if (currentHabits.length > 0) {
              const habitLines = currentHabits
                .map((h) => `- ${h.name}: ${h.completed ? "done" : "not done"} (streak: ${h.streak ?? 0})`)
                .join("\n");
              contextLines += `\n\nUser habits today:\n${habitLines}`;
            }
            const prof = await storage.getProfile();
            if (prof) contextLines += `\n\nUser Discipline Score: ${prof.xp}, Level: ${prof.level}`;
          } catch (ctxErr) {
            console.error("Context injection error (non-fatal):", ctxErr);
          }

          let historyText = "";
          if (Array.isArray(history) && history.length > 0) {
            historyText = (history as { sender: string; content: unknown }[])
              .filter((h) => h && typeof h.content === "string")
              .slice(-16)
              .map((h) => (h.sender === "user" ? `User: ${h.content}` : `You: ${h.content}`))
              .join("\n");
            historyText = "\n\nConversation so far:\n" + historyText;
          }

          const fullPrompt = basePrompt + contextLines + historyText + "\n\nUser: " + message.trim();
          const text = await generate(fullPrompt);
          const reply = text && text.trim() ? text.trim() : "I'm here. What's the task?";
          return Response.json({ reply });
        } catch (error) {
          console.error("CHAT ERROR:", error);
          return Response.json({ reply: "Temporary error, please try again." }, { status: 200 });
        }
      },
    },
  },
});
