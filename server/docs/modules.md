# Adding a feature module

Every server feature is a self-contained Fastify plugin under `src/modules/<name>/`.
A lesson adds one module without touching another module or the shared schema.

## Anatomy

```
src/modules/<name>/
├── routes.ts        default-exported Fastify plugin. Transport only.
├── service.ts       business logic. No HTTP, no raw SQL.
├── repository.ts    Drizzle queries. No business rules.
├── helpers.ts       pure transforms (row → DTO, parsing)
└── constants.ts     literals: job kinds, limits, secret names
```

Split `repository.ts` into a folder (`repository/<entity>.repo.ts`) once it grows —
`modules/reviews/` does this.

## Steps

1. Create `routes.ts` exporting a default async Fastify plugin:

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ThingService } from './service.js';

export default async function thingRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ThingService(app.container);

  app.get('/things/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.get(workspaceId, req.params.id);
  });
}
```

2. Register it in `src/modules/index.ts` — one import, one entry in the `modules` object.

That is the whole wiring. Registration is **static on purpose**: the same code path works
under tsx, the bundler and vitest, whereas native dynamic `import()` of `.ts` files is
not portable. Do not replace it with `@fastify/autoload`.

## What the plugin inherits

Plugins registered before the modules in `app.ts` are inherited by every module:
helmet, cors, rate-limit, the SSE plugin, the Zod validator/serializer compilers, and
the structured error handler. You get all of it for free — do not re-register any of it.

`app.container` is decorated onto the instance, so `app.container` inside a plugin is
the DI container.

## Conventions the reviewer will check

- **Transport only in routes.** Parse the request, map the status code, delegate. A route
  body longer than a few lines usually means logic leaked out of the service.
- **Validation via `schema`**, not `.parse()` in the handler.
- **Throw, do not reply, on error.** `throw new NotFoundError('Thing not found')`.
- **Adapters come from the container**, never `new OctokitGitHubClient(...)` in a service.
- **Cross-module entities go through the container.** If your module needs agents or
  reviews, use `container.agentsRepo` / `container.reviewRepo` rather than importing
  another module's repository file.
- **Background work** registers its job handler at plugin load
  (`service.registerXJobHandler()` in `routes.ts`) and enqueues via `container.jobs`.

## Tests

Add a route smoke test (hermetic) next to the module. If it touches the DB, name it
`<name>.it.test.ts` and use `test/helpers/pg.ts`. See `../../TESTING.md`.
