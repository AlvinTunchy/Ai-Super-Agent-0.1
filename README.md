# AI Super Agent 0.1

A small, provider-neutral TypeScript agent runtime that is easy to extend.

## Included

- Fastify HTTP API with /health, /tools, and /chat endpoints
- A clear boundary for adding OpenAI, Anthropic, or another model adapter
- In-process tool registry with health and introspection tools
- Mock mode so it runs before credentials are configured
- TypeScript, environment template, and start scripts

## Run locally

npm install
cp .env.example .env
npm run dev

Then try:

    curl http://localhost:3000/health
    curl http://localhost:3000/tools
    curl -X POST http://localhost:3000/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"What can you do?"}]}'

## Connect a real model

Set LLM_PROVIDER and LLM_API_KEY in .env, then replace the provider adapter boundary in src/index.ts. The HTTP contract and tool registry are independent from that choice.

## Next build steps

1. Add a real model adapter and streaming responses.
2. Add persistent conversation state.
3. Add authenticated tool execution and approval policies.
4. Add a web UI for chat, runs, and tool traces.
