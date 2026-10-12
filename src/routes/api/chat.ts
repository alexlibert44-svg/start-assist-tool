import { createFileRoute } from "@tanstack/react-router";
import { storageFor, type Storage } from "@/server/storage.server";
import { profileContext } from "@/server/team-setup.server";
import type { Habit } from "@/shared/schema";
import { conversations, ownerFromRequest } from "@/server/conversations.server";
import { isUuid, type ConversationCharacter, type OwnerScope } from "@/shared/conversations";

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
- Items are either kind "task" (one-off, optional deadline) or kind "habit" (daily, resets each local day). Each verified completion earns 5 points (a habit at most once per day). Points accumulate and never reset. There are no levels.
- Create a task or habit ONLY when the user clearly asks for one. To create it call create_task immediately (resolve relative dates like "tomorrow at 9 AM" using the user's current local time and UTC offset given below; output due_at as ISO 8601 with offset). Set linked_character when the task is an activity a specialist runs in-app (learning/study -> Sensei, workout/exercise/training -> Hassan, reflection/mindset exercise -> Dr Neo); those complete automatically when the session is done. Ask one short question only if the task itself is unclear.
- Mark an item complete with complete_task ONLY when the user explicitly says they finished it. Discussing an activity is not completion — if unsure, say it is not confirmed and ask them to confirm.
- For progress questions call get_progress and list_tasks; report statuses exactly as returned (done, done_today, open, overdue, not_yet_due). Never invent streaks, points or statistics.
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
      conversation_id: { type: "string", description: "Id of an EXISTING conversation with that character whose topic matches this request (from the list provided). Omit to start a new conversation for an unrelated topic." },
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
    fn("create_task", "Create and save a task or daily habit in the user's tracker.", {
      name: { type: "string" },
      kind: { type: "string", enum: ["task", "habit"], description: "task = one-off; habit = repeats daily. Default task." },
      due_at: { type: "string", description: "ISO 8601 datetime with offset, or omit if no deadline" },
      linked_character: { type: "string", enum: [...SPECIALISTS], description: "Specialist whose in-app session completes this task" },
    }, ["name"]),
    fn("list_tasks", "Read the user's real saved tasks and habits with today's status.", { status: { type: "string", enum: ["all", "open", "done"] } }),
    fn("update_task", "Edit a task's name or deadline.", {
      task_id: { type: "integer" }, name: { type: "string" }, due_at: { type: "string" },
    }, ["task_id"]),
    fn("complete_task", "Mark a task (or today's habit) complete after the user explicitly confirmed finishing it. Awards 5 points once.", { task_id: { type: "integer" } }, ["task_id"]),
    fn("delete_task", "Delete a task.", { task_id: { type: "integer" } }, ["task_id"]),
    fn("get_progress", "Read the user's real points balance, consecutive active days and today's completion rate."),
  ];
}

const taskView = (h: Habit) => {
  const habit = h.kind !== "task";
  const due = h.dueAt ? new Date(h.dueAt).getTime() : null;
  const status = habit
    ? (h.completed ? "done_today" : "open_today")
    : h.completed ? "done" : due === null ? "open" : due < Date.now() ? "overdue" : "not_yet_due";
  return { id: h.id, kind: habit ? "habit" : "task", name: h.name, status, completed: !!h.completed, due_at: h.dueAt, completed_at: h.completedAt, linked_character: h.linkedCharacter };
};

type Ctx = {
  storage: Storage;
  charId: string; tz: number; scope: OwnerScope; conversationId: string | null;
  handoff: { character: string; question: string; conversationId: string; reused: boolean } | null; changed: boolean;
};

async function runTool(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<unknown> {
  try {
    switch (name) {
      case "route_to_specialist": {
        const character = resolveCharacterId(String(args["character"] ?? ""));
        const question = String(args["question"] ?? "");
        if (character === ctx.charId || !question) return { ok: false, error: "invalid handoff" };
        // Reuse a matching conversation with the target character when given and valid; otherwise create one.
        const wanted = args["conversation_id"];
        let target = isUuid(wanted) ? await conversations.getConversation(ctx.scope, wanted) : undefined;
        if (target && target.characterId !== character) target = undefined;
        const reused = !!target;
        if (!target) {
          const t = question.replace(/\s+/g, " ").trim();
          target = await conversations.createConversation(ctx.scope, {
            characterId: character as ConversationCharacter,
            title: t.length > 48 ? `${t.slice(0, 45)}...` : t,
            metadata: ctx.conversationId ? { handedOffFrom: ctx.conversationId } : {},
          });
        }
        ctx.handoff = { character, question, conversationId: target.id, reused };
        return { ok: true, note: `The app is opening ${character}'s chat now. Write one short handoff line only.` };
      }
      case "create_task": {
        const nm = String(args["name"] ?? "").trim();
        if (!nm) return { ok: false, error: "name required" };
        const due = args["due_at"] ? new Date(String(args["due_at"])) : null;
        if (due && isNaN(due.getTime())) return { ok: false, error: "invalid due_at" };
        const linked = args["linked_character"] ? resolveCharacterId(String(args["linked_character"])) : null;
        const t = await ctx.storage.createHabit({
          name: nm, completed: false, streak: 0, dueAt: due ? due.toISOString() : null,
          kind: args["kind"] === "habit" ? "habit" : "task",
          linkedCharacter: linked && linked !== "Larry" ? linked : null,
        }, ctx.tz);
        ctx.changed = true;
        return { ok: true, task: taskView(t) };
      }
      case "list_tasks": {
        const s = String(args["status"] ?? "all");
        const all = (await ctx.storage.getHabits(ctx.tz)).map(taskView);
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
        const t = await ctx.storage.updateHabit(id, u, ctx.tz);
        if (!t) return { ok: false, error: "task not found" };
        ctx.changed = true;
        return { ok: true, task: taskView(t) };
      }
      case "complete_task": {
        const id = Number(args["task_id"]);
        const before = await ctx.storage.getHabit(id, ctx.tz);
        if (!before) return { ok: false, error: "task not found" };
        if (before.completed) return { ok: true, already_completed: true, points_awarded_now: 0 };
        const p0 = (await ctx.storage.getProfile())?.xp ?? 0;
        const t = await ctx.storage.setCompletion(id, true, ctx.tz);
        ctx.changed = true;
        const p1 = (await ctx.storage.getProfile())?.xp ?? 0;
        return { ok: !!t?.completed, task: t && taskView(t), points_awarded_now: p1 - p0, points: p1 };
      }
      case "delete_task": {
        const ok = await ctx.storage.deleteHabit(Number(args["task_id"]));
        if (ok) ctx.changed = true;
        return ok ? { ok: true } : { ok: false, error: "task not found" };
      }
      case "get_progress": {
        const st = await ctx.storage.getStats(ctx.tz);
        return {
          ok: true, points: st.points, consecutive_active_days: st.consecutiveDays, local_date: st.today,
          due_today: st.dueToday, completed_today: st.completedToday,
          daily_completion_rate_percent: st.dailyCompletionRate ?? "no activities scheduled today",
        };
      }
      case "complete_linked_activity": {
        const open = (await ctx.storage.getHabits(ctx.tz)).filter((h) => !h.completed && h.linkedCharacter === ctx.charId);
        const target = args["task_id"] ? open.find((h) => h.id === Number(args["task_id"])) : open[0];
        if (!target) return { ok: false, error: "no open task linked to you" };
        const p0 = (await ctx.storage.getProfile())?.xp ?? 0;
        const t = await ctx.storage.setCompletion(target.id, true, ctx.tz);
        ctx.changed = true;
        const p1 = (await ctx.storage.getProfile())?.xp ?? 0;
        return { ok: !!t?.completed, task: t && taskView(t), points_awarded_now: p1 - p0 };
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
          const { message, character, characterId, history, handoffFrom, clientNow, tzOffsetMinutes, conversationId } = (await request.json()) as {
            message?: unknown; character?: string; characterId?: string; history?: unknown; conversationId?: string;
            handoffFrom?: string; clientNow?: string; tzOffsetMinutes?: number;
          };
          if (!message || typeof message !== "string" || !message.trim()) {
            return Response.json({ reply: "No message provided." }, { status: 400 });
          }
          const charId = resolveCharacterId(character || characterId);
          const scope = (await ownerFromRequest(request));
          if (!scope.userId) return Response.json({ reply: "Please sign in." }, { status: 401 });
          const storage = storageFor(scope.userId);
          const ctx: Ctx = { storage, charId, tz: typeof tzOffsetMinutes === "number" ? tzOffsetMinutes : 0, scope, conversationId: isUuid(conversationId) ? conversationId : null, handoff: null, changed: false };

          let system = CHARACTER_SYSTEM_PROMPTS[charId] + "\n\nAlways reply in the same language as the user's latest message (e.g. English question -> English answer), regardless of earlier messages or the user's location.";
          const off = typeof tzOffsetMinutes === "number" ? -tzOffsetMinutes : 0;
          const sign = off >= 0 ? "+" : "-";
          const offStr = `${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
          system += `\n\nUser's current local time: ${clientNow ?? new Date().toISOString()} (UTC offset ${offStr}).`;
          try {
            const habits = await storage.getHabits();
            if (charId === "Larry") {
              if (habits.length > 0) system += `\n\nCurrent tasks:\n${JSON.stringify(habits.map(taskView))}`;
              const prof = await storage.getProfile();
              if (prof) system += `\n\nUser points balance: ${prof.xp}`;
            } else {
              const linked = habits.filter((h) => !h.completed && h.linkedCharacter === charId).map(taskView);
              if (linked.length) system += `\n\nOpen tasks linked to your sessions: ${JSON.stringify(linked)}`;
            }
          } catch (ctxErr) {
            console.error("Context injection error (non-fatal):", ctxErr);
          }
          try {
            system += await profileContext(scope.userId, charId);
          } catch (pErr) {
            console.error("Profile context error (non-fatal):", pErr);
          }
          try {
            const others = (await conversations.listConversations(scope, { limit: 30 }))
              .filter((c) => c.characterId !== charId).slice(0, 15)
              .map((c) => ({ id: c.id, character: c.characterId, title: c.title }));
            if (others.length) system += `\n\nExisting conversations with other team members (when routing, pass conversation_id of one whose topic clearly matches; omit it for a new topic):\n${JSON.stringify(others)}`;
          } catch (convErr) {
            console.error("Conversation context error (non-fatal):", convErr);
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
