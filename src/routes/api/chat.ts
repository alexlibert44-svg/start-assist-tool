import { createFileRoute } from "@tanstack/react-router";
import { storage } from "@/server/storage.server";
import type { Habit } from "@/shared/schema";

const MODEL = "google/gemini-3-flash-preview";
const SPECIALISTS = ["Sensei", "Dr Neo", "Hassan"] as const;
const ALL = ["Larry", ...SPECIALISTS] as const;

const SCOPE = `Team scopes:
- Larry: task creation/editing/tracking, deadlines, points, overall progress, coordinating multi-area requests.
- Sensei: languages, grammar, vocabulary, academic subjects, explanations, exercises, quizzes, learning plans.
- Dr Neo: psychology & neuroscience education, procrastination, motivation, habit triggers, self-awareness, behavior-change strategies, self-regulation exercises. Never diagnoses.
- Hassan: fitness, workouts, general nutrition, sleep, recovery, wellness routines. General guidance only, no diagnosis or treatment.`;

const CHARACTER_SYSTEM_PROMPTS: Record<string, string> = {
  Larry: `You are Larry, the main AI agent and coordinator — the user's ideal disciplined self. Calm, firm, concise, professional, strategic. No hype, no empty motivation. Max 2-3 sentences.
You manage the user's REAL tasks with tools. Never invent tasks, points or progress — call list_tasks / get_progress to read real data. Never claim an action succeeded unless the tool result says ok.
- To create a task call create_task immediately (resolve relative dates like "tomorrow at 9 AM" using the user's current local time and UTC offset given below; output due_at as ISO 8601 with offset). Set linked_character when the task is an activity a specialist runs in-app (learning/study -> Sensei, workout/exercise/training -> Hassan, reflection/mindset exercise -> Dr Neo); those complete automatically when the session is done. Ask one short question only if the task itself is unclear.
- Mark a general task complete with complete_task ONLY when the user explicitly says they finished it. If unsure, ask them to confirm.
- If a request belongs entirely to one specialist, call route_to_specialist with the user's original question verbatim — do not answer it yourself. Keep coordinating requests spanning several areas yourself (e.g. create tasks, then route the main question).
- If something is outside every scope, say so honestly.
${SCOPE}`,
  Sensei: `You are Sensei, a patient, knowledgeable, disciplined learning mentor. Explain clearly with examples, adapt to the user's level, encourage practice. Be concise but complete.
Stay strictly within learning and education. You do not manage tasks or points — that is Larry.
If a request belongs to another member, call route_to_specialist (fitness -> Hassan, psychology/procrastination -> Dr Neo, tasks/points/progress -> Larry).
If you receive a question handed over by Larry, answer it immediately and directly — never ask "how can I help".
When the user has genuinely finished a learning session in this chat (e.g. completed your exercise or quiz), call complete_linked_activity so their linked learning task is updated.
${SCOPE}`,
  "Dr Neo": `You are Dr Neo, calm, analytical, empathetic, scientifically minded. Explain behavior and the mind in a balanced, evidence-informed way. Avoid unsupported assumptions. Never diagnose medical or psychiatric conditions; you do not replace a qualified professional — suggest one when appropriate. Concise.
Stay within psychology, self-awareness and behavior change. You do not manage tasks or points — that is Larry.
If a request belongs to another member, call route_to_specialist (exercise plans/nutrition/sleep routines -> Hassan, grammar/academic -> Sensei, tasks/points -> Larry).
If you receive a question handed over by Larry, answer it immediately and directly.
When the user has genuinely completed a reflection or self-regulation exercise in this chat, call complete_linked_activity.
${SCOPE}`,
  Hassan: `You are Hassan, a practical, approachable, realistic fitness and wellness coach. Promote sustainable habits, no extreme routines or unrealistic promises. General educational guidance only; respect safety, no diagnosis or medical treatment. Concise.
Stay within fitness, nutrition, sleep and wellness. You do not manage tasks or points — that is Larry.
If a request belongs to another member, call route_to_specialist (grammar/learning -> Sensei, psychology/procrastination -> Dr Neo, tasks/points -> Larry).
If you receive a question handed over by Larry, answer it immediately and directly.
When the user reports in this chat that they have finished the workout/training you guided, call complete_linked_activity.
${SCOPE}`,
};

function resolveCharacterId(raw: string | undefined): string {
  if (!raw) return "Larry";
  if (CHARACTER_SYSTEM_PROMPTS[raw]) return raw;
  const lower = raw.toLowerCase();
  if (lower === "larry") return "Larry";
  if (lower === "sensei") return "Sensei";
  if (lower === "dr neo" || lower === "drneo" || lower === "neo" || lower === "dr. neo") return "Dr Neo";
  if (lower === "hassan") return "Hassan";
  return "Larry";
}

type Tool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };
const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): Tool => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
});

function toolsFor(charId: string): Tool[] {
  const route = fn(
    "route_to_specialist",
    "Hand the user's request to the correct team member; the app opens their chat and they answer immediately.",
    {
      character: { type: "string", enum: ALL.filter((c) => c !== charId) },
      question: { type: "string", description: "The user's original request, verbatim, plus any needed context" },
    },
    ["character", "question"],
  );
  if (charId !== "Larry") {
    return [route, fn("complete_linked_activity", "Mark the user's open task(s) linked to you as completed because the session was actually finished in this chat.", {
      task_id: { type: "integer", description: "Specific linked task id, or omit to complete the earliest open linked task" },
    })];
  }
  return [
    route,
    fn("create_task", "Create and save a task in the user's task list.", {
      name: { type: "string" },
      due_at: { type: "string", description: "ISO 8601 datetime with offset, or omit if no deadline" },
      linked_character: { type: "string", enum: [...SPECIALISTS], description: "Specialist whose in-app session completes this task" },
    }, ["name"]),
    fn("list_tasks", "Read the user's real saved tasks.", { status: { type: "string", enum: ["all", "open", "done"] } }),
    fn("update_task", "Edit a task's name or deadline.", {
      task_id: { type: "integer" }, name: { type: "string" }, due_at: { type: "string" },
    }, ["task_id"]),
    fn("complete_task", "Mark a task complete after the user explicitly confirmed finishing it. Awards points once.", { task_id: { type: "integer" } }, ["task_id"]),
    fn("delete_task", "Delete a task.", { task_id: { type: "integer" } }, ["task_id"]),
    fn("get_progress", "Read the user's real Discipline Score, level and task completion stats."),
  ];
}

const taskView = (h: Habit) => ({
  id: h.id, name: h.name, completed: !!h.completed, due_at: h.dueAt, linked_character: h.linkedCharacter, streak: h.streak ?? 0,
});

type Ctx = { charId: string; handoff: { character: string; question: string } | null; changed: boolean };

async function runTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<unknown> {
  try {
    switch (name) {
      case "route_to_specialist": {
        const character = resolveCharacterId(String(args["character"] ?? ""));
        const question = String(args["question"] ?? "");
        if (character === ctx.charId || !question) return { ok: false, error: "invalid handoff" };
        ctx.handoff = { character, question };
        return { ok: true, note: `The app is opening ${character}'s chat now. Write one short handoff line only.` };
      }
      case "create_task": {
        const nm = String(args["name"] ?? "").trim();
        if (!nm) return { ok: false, error: "name required" };
        const due = args["due_at"] ? new Date(String(args["due_at"])) : null;
        if (due && isNaN(due.getTime())) return { ok: false, error: "invalid due_at" };
        const linked = args["linked_character"] ? resolveCharacterId(String(args["linked_character"])) : null;
        const t = await storage.createHabit({
          name: nm, completed: false, streak: 0, dueAt: due ? due.toISOString() : null,
          linkedCharacter: linked && linked !== "Larry" ? linked : null,
        });
        ctx.changed = true;
        return { ok: true, task: taskView(t) };
      }
      case "list_tasks": {
        const s = String(args["status"] ?? "all");
        const all = (await storage.getHabits()).map(taskView);
        return { ok: true, tasks: s === "open" ? all.filter((t) => !t.completed) : s === "done" ? all.filter((t) => t.completed) : all };
      }
      case "update_task": {
        const id = Number(args["task_id"]);
        const u: Record<string, unknown> = {};
        if (args["name"]) u["name"] = String(args["name"]);
        if (args["due_at"]) {
          const d = new Date(String(args["due_at"]));
          if (isNaN(d.getTime())) return { ok: false, error: "invalid due_at" };
          u["dueAt"] = d.toISOString();
        }
        const t = await storage.updateHabit(id, u);
        if (!t) return { ok: false, error: "task not found" };
        ctx.changed = true;
        return { ok: true, task: taskView(t) };
      }
      case "complete_task": {
        const id = Number(args["task_id"]);
        const before = await storage.getHabit(id);
        if (!before) return { ok: false, error: "task not found" };
        if (before.completed) return { ok: true, already_completed: true, points_awarded_now: 0 };
        const t = await storage.setCompletion(id, true);
        ctx.changed = true;
        const prof = await storage.getProfile();
        return { ok: !!t?.completed, task: t && taskView(t), points_awarded_now: 10, score: prof?.xp };
      }
      case "delete_task": {
        const ok = await storage.deleteHabit(Number(args["task_id"]));
        if (ok) ctx.changed = true;
        return ok ? { ok: true } : { ok: false, error: "task not found" };
      }
      case "get_progress": {
        const [prof, tasks] = await Promise.all([storage.getProfile(), storage.getHabits()]);
        return {
          ok: true, discipline_score: prof?.xp ?? 0, level: prof?.level ?? 1,
          tasks_total: tasks.length, tasks_done: tasks.filter((t) => t.completed).length,
        };
      }
      case "complete_linked_activity": {
        const open = (await storage.getHabits()).filter((h) => !h.completed && h.linkedCharacter === ctx.charId);
        const target = args["task_id"] ? open.find((h) => h.id === Number(args["task_id"])) : open[0];
        if (!target) return { ok: false, error: "no open task linked to you" };
        const t = await storage.setCompletion(target.id, true);
        ctx.changed = true;
        return { ok: !!t?.completed, task: t && taskView(t), points_awarded_now: 10 };
      }
    }
    return { ok: false, error: "unknown tool" };
  } catch (e) {
    console.error("tool error", name, e);
    return { ok: false, error: `Database error: ${(e as Error).message}` };
  }
}

type Msg = { role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };
type ToolCall = { id: string; name: string; args: string };

// Streams from the Lovable AI Gateway; returns text plus any tool calls.
async function generate(messages: Msg[], tools: Tool[]): Promise<{ text: string; calls: ToolCall[] }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: MODEL, stream: true, messages, tools }),
  });
  if (!res.ok || !res.body) throw new Error(`AI gateway ${res.status}: ${await res.text().catch(() => "")}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  const calls: ToolCall[] = [];
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
        const j = JSON.parse(data) as {
          choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[];
        };
        const d = j.choices?.[0]?.delta;
        text += d?.content ?? "";
        for (const tc of d?.tool_calls ?? []) {
          const i = tc.index ?? calls.length;
          calls[i] ??= { id: tc.id ?? `call_${i}`, name: "", args: "" };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function?.name) calls[i].name += tc.function.name;
          if (tc.function?.arguments) calls[i].args += tc.function.arguments;
        }
      } catch {
        /* partial line */
      }
    }
  }
  return { text, calls: calls.filter(Boolean) };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { message, character, characterId, history, handoffFrom, clientNow, tzOffsetMinutes } = (await request.json()) as {
            message?: unknown; character?: string; characterId?: string; history?: unknown;
            handoffFrom?: string; clientNow?: string; tzOffsetMinutes?: number;
          };
          if (!message || typeof message !== "string" || !message.trim()) {
            return Response.json({ reply: "No message provided." }, { status: 400 });
          }
          const charId = resolveCharacterId(character || characterId);
          const ctx: Ctx = { charId, handoff: null, changed: false };

          let system = CHARACTER_SYSTEM_PROMPTS[charId] + "\n\nAlways reply in the language of the user's latest message.";
          const off = typeof tzOffsetMinutes === "number" ? -tzOffsetMinutes : 0;
          const sign = off >= 0 ? "+" : "-";
          const offStr = `${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
          system += `\n\nUser's current local time: ${clientNow ?? new Date().toISOString()} (UTC offset ${offStr}).`;
          try {
            const habits = await storage.getHabits();
            if (charId === "Larry") {
              if (habits.length > 0) system += `\n\nCurrent tasks:\n${JSON.stringify(habits.map(taskView))}`;
              const prof = await storage.getProfile();
              if (prof) system += `\n\nUser Discipline Score: ${prof.xp}, Level: ${prof.level}`;
            } else {
              const linked = habits.filter((h) => !h.completed && h.linkedCharacter === charId).map(taskView);
              if (linked.length) system += `\n\nOpen tasks linked to your sessions: ${JSON.stringify(linked)}`;
            }
          } catch (ctxErr) {
            console.error("Context injection error (non-fatal):", ctxErr);
          }
          if (handoffFrom) {
            system += `\n\n${resolveCharacterId(handoffFrom)} just handed this user's request to you. Answer it immediately and fully. Do not greet at length or ask what they need.`;
          }

          const msgs: Msg[] = [{ role: "system", content: system }];
          if (Array.isArray(history)) {
            for (const h of (history as { sender: string; content: unknown }[]).slice(-16)) {
              if (h && typeof h.content === "string") msgs.push({ role: h.sender === "user" ? "user" : "assistant", content: h.content });
            }
          }
          msgs.push({ role: "user", content: message.trim() });

          const tools = toolsFor(charId);
          let reply = "";
          for (let step = 0; step < 5; step++) {
            const { text, calls } = await generate(msgs, tools);
            if (calls.length === 0) { reply = text; break; }
            msgs.push({
              role: "assistant", content: text || null,
              tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })),
            });
            for (const c of calls) {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(c.args || "{}"); } catch { /* empty */ }
              const result = await runTool(c.name, args, ctx);
              msgs.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
            }
            reply = text;
          }
          reply = reply.trim();
          if (!reply) {
            reply = ctx.handoff ? `Handing this to ${ctx.handoff.character}.`
              : ctx.changed ? "Done. Your task list and points have been updated."
              : "I'm here. What's the task?";
          }
          return Response.json({ reply, handoff: ctx.handoff, dataChanged: ctx.changed });
        } catch (error) {
          console.error("CHAT ERROR:", error);
          return Response.json({ reply: "Temporary error, please try again. Nothing was saved from this message." }, { status: 200 });
        }
      },
    },
  },
});
