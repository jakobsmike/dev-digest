# Contracts — `@devdigest/shared`

Every request body, response shape and cross-package type is a Zod schema in
`@devdigest/shared`. One definition does three jobs: request validation, response
serialization (both via `fastify-type-provider-zod`), and static types on the client.

## The duplication rule

`@devdigest/shared` exists **twice**:

| Path | Status | Consumed by |
|---|---|---|
| `server/src/vendor/shared/` | **canonical** | server, reviewer-core |
| `client/src/vendor/shared/` | copy | client |

They are separate files held in sync by hand. Nothing in the build or CI enforces it,
and they have already drifted.

**The rule: change the server copy first, then mirror into the client in the same commit.**

### Known drift (as of 2026-09-20)

The client copy is behind on:

- `Provider` — missing `'openrouter'`, although the agent-creation UI offers it
- `AgentManifest` — the studio ↔ CI-runner agent contract
- `CommitFile` / `CommitFilesPayload`
- `LLMProvider.completeStructured` — missing the `sessionId` option
- `CiFailOn` doc comments, and `agent_versions` snapshot types

If you hit a type error in the client that makes no sense against the server's
behaviour, check this drift before assuming the client is wrong.

## Layout

```
vendor/shared/
├── index.ts                    re-exports everything
├── adapters.ts                 port interfaces: LLMProvider, GitHubClient, GitClient,
│                               CodeIndex, Embedder, SecretsProvider, AuthProvider
└── contracts/
    ├── findings.ts             Finding, Severity, Review, Verdict
    ├── review-api.ts           review request/response shapes
    ├── trace.ts                RunTrace, PromptAssembly, RunEvent
    ├── knowledge.ts            Provider, CiFailOn, memory + conventions types
    ├── platform.ts             settings, repos, pulls, agents
    ├── observability.ts        run summaries and stats
    ├── brief.ts · why.ts · eval-ci.ts · productionize.ts   (mostly L05–L08, unused today)
```

Several contract files describe features the starter does not ship. They are kept so a
lesson can wire a feature without a schema migration. Their presence is not evidence
that the feature exists.

## Adding or changing a contract

1. Edit `server/src/vendor/shared/contracts/<file>.ts`.
2. Mirror the change into `client/src/vendor/shared/contracts/<file>.ts`.
3. If the shape crosses into the engine, check `reviewer-core/src` — it aliases the
   **server** copy, so it needs no separate edit, but it may need a type update.
4. Run `pnpm typecheck` in both `server/` and `client/`. This is the only thing that
   catches a bad mirror.

## Why ports live here

`adapters.ts` holds interfaces, not implementations. The server implements them
(`src/adapters/*`), reviewer-core only consumes `LLMProvider`, and tests substitute
`src/adapters/mocks.ts`. That is what keeps the engine free of I/O and mock-testable —
see `../reviewer-core/CLAUDE.md`.
