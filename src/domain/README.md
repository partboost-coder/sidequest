# domain

Pure TypeScript business logic: taste profiles, geo/corridor math, group scoring, planner, Scout trigger, XP.

Rules: no network calls, no framework imports, no LLM calls. Everything here is deterministic and unit-tested.
Agents and route handlers call into this layer; they never re-implement it.
