# Platform docs (placeholder)

> **Status:** stub — full specification docs are being re-authored. Code is
> live and well-named; this index will link out to proper docs in a
> follow-up commit.

This directory will hold the full platform specification (~20 files,
~5,000 lines) covering:

1. Architecture + layering contract
2. Roadmap + phased plan
3. RBAC + user model
4. Chatbot platform contract (registry, runtime, dynamic routing)
5. AI providers via Vercel AI SDK (Anthropic, OpenAI, Google, xAI)
6. Prompt management + versioning
7. Tool registry
8. Conversation persistence (threads + messages)
9. Rate limits + cost controls (fail-closed)
10. Admin console UX spec
11. Admin API contract
12. Database schema
13. Security + threat model
14. Testing strategy
15. Observability
16. Code quality standards
17. Deployment + ops
18. Adding a new chatbot runbook

In the meantime, the code itself is the source of truth:

| To understand… | Read… |
|----------------|-------|
| The chatbot platform | [lib/chatbots/](../../lib/chatbots/) — `providers.ts`, `runtime.ts`, `registry.ts`, `route-handler.ts` |
| RBAC + admin guard | [lib/auth/rbac.ts](../../lib/auth/rbac.ts) |
| Schema | [db/schema/](../../db/schema/) |
| Admin console | [app/(app)/admin/](<../../app/(app)/admin/>) |
| User chat history | [app/(app)/chat/](<../../app/(app)/chat/>) |
| Runbook "add a new chatbot" | Click "+ New chatbot" in `/admin/chatbots`. |
