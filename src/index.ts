import { readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";

type Message = { role: "user" | "assistant" | "system"; content: string };
type ChatBody = { conversationId?: string; message?: string; messages?: Message[] };
type Tool = { name: string; description: string; run: (input: string) => Promise<string> };

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const agentName = process.env.AGENT_NAME ?? "Super Agent";
const provider = process.env.LLM_PROVIDER ?? "mock";
const model = process.env.LLM_MODEL ?? "gpt-4o-mini";
const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const conversations = new Map<string, Message[]>();

const tools: Tool[] = [
  { name: "health", description: "Check whether the agent runtime is available", async run() { return JSON.stringify({ ok: true, timestamp: new Date().toISOString() }); } },
  { name: "list_tools", description: "List tools currently registered with the agent", async run() { return JSON.stringify(tools.map(({ name, description }) => ({ name, description }))); } }
];

function mockReply(input: string): string {
  const text = input.trim();
  if (!text) return "Give me a task and I will take the first useful step.";
  if (/tool|capabilit|what can you do/i.test(text)) return "I am " + agentName + ". I can plan tasks, call registered tools, and return structured results. Current tools: " + tools.map(tool => tool.name).join(", ") + ".";
  return "I received: “" + text + "”\n\nThe runtime is ready. Set LLM_PROVIDER and LLM_API_KEY to connect a real model provider; the mock provider is active now.";
}

async function modelReply(messages: Message[]): Promise<string> {
  if (provider === "mock") return mockReply(messages[messages.length - 1]?.content ?? "");
  if (!process.env.LLM_API_KEY) throw new Error("LLM_API_KEY is required for provider “" + provider + "”");
  const response = await fetch(baseUrl + "/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + process.env.LLM_API_KEY },
    body: JSON.stringify({ model, messages: [{ role: "system", content: "You are a helpful, action-oriented personal super agent named " + agentName + ". Be concise and explain your next step." }, ...messages] })
  });
  if (!response.ok) throw new Error("Model request failed (" + response.status + "): " + (await response.text()).slice(0, 300));
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const answer = data.choices?.[0]?.message?.content;
  if (!answer) throw new Error("Model returned no message");
  return answer;
}

async function runAgent(body: ChatBody) {
  const id = body.conversationId ?? crypto.randomUUID();
  const history = conversations.get(id) ?? body.messages?.filter(message => message.role !== "system") ?? [];
  const input = body.message ?? [...history].reverse().find(message => message.role === "user")?.content;
  if (!input?.trim()) throw new Error("A message is required");
  history.push({ role: "user", content: input.trim() });
  const answer = await modelReply(history);
  history.push({ role: "assistant", content: answer });
  conversations.set(id, history.slice(-20));
  return { conversationId: id, message: answer, history: conversations.get(id), provider, model, tools: tools.map(tool => tool.name) };
}

const app = Fastify({ logger: { transport: { target: "pino-pretty" } } });
await app.register(cors, { origin: true });
const indexHtml = readFileSync(join(process.cwd(), "public", "index.html"), "utf8");
app.get("/", async (_request, reply) => reply.type("text/html").send(indexHtml));
app.get("/health", async () => ({ ok: true, name: agentName, provider, model }));
app.get("/tools", async () => tools.map(({ name, description }) => ({ name, description })));
app.post<{ Body: ChatBody }>("/chat", async (request, reply) => {
  try { return { ok: true, ...(await runAgent(request.body ?? {})) }; }
  catch (error) { reply.code(400); return { ok: false, error: error instanceof Error ? error.message : "Unknown agent error" }; }
});
app.listen({ port, host }).then(() => console.log(agentName + " listening on http://" + host + ":" + port));
