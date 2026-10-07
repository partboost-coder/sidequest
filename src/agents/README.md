# agents

LLM agents built with the Vercel AI SDK (Planner, Replanner, Scout, taste helpers), starting in v0.3.0.

Rules: agents make judgment calls through typed tools. Tools wrap `src/domain` and `src/adapters` and emit
user-facing activity events. Agents never invent places or scores, and chain-of-thought is never shown to users.
