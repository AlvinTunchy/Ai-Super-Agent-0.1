import Fastify from "fastify";
import cors from "@fastify/cors";

type Message = { role: "user" | "assistant" | "system" | "tool"; content: string };
type Tool = { name: string; description: string; run: (input: string) => Promise<string> };

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const agentName = process.env.AGENT_NAME ?? "Super Agent";
const provider = process.env.LLM_PROVIDER ?? "mock";

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

async function runAgent(messages: Message[]) {
  const latest = [...messages].reverse().find(message => message.role === "user");
  if (!latest) throw new Error("At least one user message is required");
  if (provider !== "mock" && !process.env.LLM_API_KEY) throw new Error("LLM_API_KEY is required for provider “" + provider + "”");
  return { message: mockReply(latest.content), provider, tools: tools.map(tool => tool.name) };
}

const app = Fastify({ logger: { transport: { target: "pino-pretty" } } });
await app.register(cors, { origin: true });
app.get("/health", async () => ({ ok: true, name: agentName, provider }));
app.get("/tools", async () => tools.map(({ name, description }) => ({ name, description })));
app.post<{ Body: { messages?: Message[] } }>("/chat", async (request, reply) => {
  try { return { ok: true, ...(await runAgent(request.body?.messages ?? [])) }; }
  catch (error) { reply.code(400); return { ok: false, error: error instanceof Error ? error.message : "Unknown agent error" }; }
});
app.listen({ port, host }).then(() => console.log(agentName + " listening on http://" + host + ":" + port));
