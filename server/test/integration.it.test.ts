import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { PrMeta } from '@devdigest/shared';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn(
    '[integration] Docker not available — skipping Testcontainers integration tests.',
  );
}

d('Testcontainers: pg + pgvector', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('migrations applied: every table exists', async () => {
    const rows = await pg.handle.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'`;
    // 35 domain tables + drizzle migration bookkeeping
    expect(rows[0]!.count).toBeGreaterThanOrEqual(35);
  });

  it('pgvector extension is enabled', async () => {
    const rows = await pg.handle.sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    expect(rows).toHaveLength(1);
  });

  it('vector insert + similarity query round-trips', async () => {
    const { db } = pg.handle;
    const { workspaceId } = await seed(db);
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'v', name: 'vec', fullName: 'v/vec' })
      .returning();
    const vec = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
    await db.insert(t.codeChunks).values({
      workspaceId,
      repoId: repo!.id,
      path: 'a.ts',
      content: 'hello',
      embedding: vec,
      source: 'code',
    });
    // cosine distance query against the same vector → distance ~0
    const literal = `[${vec.join(',')}]`;
    const rows = await pg.handle.sql<{ dist: number }[]>`
      SELECT embedding <=> ${literal}::vector AS dist
      FROM code_chunks WHERE repo_id = ${repo!.id}`;
    expect(rows[0]!.dist).toBeLessThan(0.0001);
  });

  it('seed is idempotent (re-run does not duplicate workspace)', async () => {
    await seed(pg.handle.db);
    await seed(pg.handle.db);
    const ws = await pg.handle.db.select().from(t.workspaces);
    expect(ws.filter((w) => w.name === 'default')).toHaveLength(1);
  });
});

d('Testcontainers: DB-backed routes via app.inject', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('POST /repos persists + enqueues a clone (mock git) and GET /repos lists it', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const git = new MockGitClient();
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git, github: new MockGitHubClient() },
    });

    const create = await app.inject({
      method: 'POST',
      url: '/repos',
      payload: { url: 'https://github.com/acme/widgets' },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().full_name).toBe('acme/widgets');

    await app.container.jobs.onIdle();
    expect(git.cloned.some((c) => c.repo.name === 'widgets')).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/repos' });
    expect(list.json().some((r: { full_name: string }) => r.full_name === 'acme/widgets')).toBe(
      true,
    );
    await app.close();
  });

  it('GET /repos/:id/pulls imports PRs (mock GitHub) idempotently', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const repos = await app.inject({ method: 'GET', url: '/repos' });
    const repoId = repos.json()[0]!.id;

    const first = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    expect(first.statusCode).toBe(200);
    expect(first.json().length).toBeGreaterThan(0);
    // import again → still idempotent (unique repo_id+number)
    const second = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    expect(second.json().length).toBe(first.json().length);
    await app.close();
  });

  it('GET /repos/:id/pulls totals the cost of every successful run on a PR', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    // Two PRs: one we run agents on, one nobody touches. The default mock ships
    // a single PR, so the second is spelled out here.
    const pr = (number: number, title: string): PrMeta => ({
      number,
      title,
      author: 'marisa.koch',
      branch: `feat/${number}`,
      base: 'main',
      head_sha: `sha-${number}`,
      additions: 10,
      deletions: 1,
      files_count: 2,
      status: 'open',
      opened_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T03:00:00Z',
    });
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient({
          pulls: [pr(901, 'reviewed twice'), pr(902, 'never reviewed')],
        }),
      },
    });
    const repos = await app.inject({ method: 'GET', url: '/repos' });
    const repoId = repos.json()[0]!.id;
    const pulls: { id: string; number: number }[] = (
      await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` })
    ).json();
    const target = pulls.find((p) => p.number === 901)!;
    const untouched = pulls.find((p) => p.number === 902)!;

    const [repoRow] = await pg.handle.db
      .select()
      .from(t.repos)
      .where(eq(t.repos.id, repoId));

    // Three runs on the same PR. The total (0.75) differs from the latest
    // (0.25) and from the max (0.50), so picking one run instead of summing
    // fails here. The failed run is dearer than either and must be ignored
    // entirely — only successful runs count.
    const run = (ranAt: Date, costUsd: number | null, status = 'done') => ({
      workspaceId: repoRow!.workspaceId,
      prId: target.id,
      ranAt,
      status,
      costUsd,
    });
    await pg.handle.db.insert(t.agentRuns).values([
      run(new Date('2026-06-10T10:00:00Z'), 0.5),
      run(new Date('2026-06-11T10:00:00Z'), 0.25),
      run(new Date('2026-06-12T10:00:00Z'), 9.0, 'failed'),
    ]);

    const after: { id: string; cost_usd: number | null }[] = (
      await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` })
    ).json();
    const byId = (id: string) => after.find((p) => p.id === id)!;
    expect(byId(target.id).cost_usd).toBeCloseTo(0.75, 10);
    // A PR nobody has run an agent on has no cost at all — not zero.
    expect(byId(untouched.id).cost_usd).toBeNull();

    await app.close();
  });

  it('GET /repos/:id/pulls counts findings per severity, unioning agents without double-counting', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const pr = (number: number, title: string): PrMeta => ({
      number,
      title,
      author: 'marisa.koch',
      branch: `feat/${number}`,
      base: 'main',
      head_sha: `sha-${number}`,
      additions: 10,
      deletions: 1,
      files_count: 2,
      status: 'open',
      opened_at: '2026-06-01T00:00:00Z',
      updated_at: '2026-06-01T03:00:00Z',
    });
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient(),
        github: new MockGitHubClient({
          pulls: [pr(911, 'two agents, one re-run'), pr(912, 'never reviewed')],
        }),
      },
    });
    const repos = await app.inject({ method: 'GET', url: '/repos' });
    const repoId = repos.json()[0]!.id;
    const pulls: { id: string; number: number }[] = (
      await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` })
    ).json();
    const target = pulls.find((p) => p.number === 911)!;
    const untouched = pulls.find((p) => p.number === 912)!;

    const [repoRow] = await pg.handle.db.select().from(t.repos).where(eq(t.repos.id, repoId));
    const workspaceId = repoRow!.workspaceId;
    const [agentA, agentB] = await pg.handle.db
      .insert(t.agents)
      .values([
        { workspaceId, name: 'Agent A', provider: 'openai', model: 'gpt-4.1', systemPrompt: 'a' },
        { workspaceId, name: 'Agent B', provider: 'openai', model: 'gpt-4.1', systemPrompt: 'b' },
      ])
      .returning();

    const review = async (agentId: string, createdAt: Date) => {
      const [row] = await pg.handle.db
        .insert(t.reviews)
        .values({
          workspaceId,
          prId: target.id,
          agentId,
          kind: 'review',
          verdict: 'request_changes',
          summary: 's',
          createdAt,
        })
        .returning();
      return row!.id;
    };
    const finding = (reviewId: string, severity: string, title: string) => ({
      reviewId,
      severity,
      category: 'bug',
      title,
      file: 'src/a.ts',
      startLine: 1,
      endLine: 1,
      rationale: 'r',
      confidence: 0.9,
    });

    // Agent A reviewed twice. Only its LATEST review counts, so the superseded
    // one's findings must not be added on top.
    const aStale = await review(agentA!.id, new Date('2026-06-10T10:00:00Z'));
    const aLatest = await review(agentA!.id, new Date('2026-06-11T10:00:00Z'));
    const b = await review(agentB!.id, new Date('2026-06-11T11:00:00Z'));
    await pg.handle.db.insert(t.findings).values([
      finding(aStale, 'CRITICAL', 'superseded — must not be counted'),
      finding(aStale, 'CRITICAL', 'superseded too'),
      finding(aLatest, 'CRITICAL', 'a-crit'),
      finding(aLatest, 'WARNING', 'a-warn'),
      finding(b, 'WARNING', 'b-warn'),
      finding(b, 'SUGGESTION', 'b-sugg'),
    ]);

    const after: { id: string; findings_counts: Record<string, number> | null }[] = (
      await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` })
    ).json();
    const byId = (id: string) => after.find((p) => p.id === id)!;

    // Union of both agents' latest reviews: 1 critical + 2 warnings + 1 suggestion.
    // The stale review's 2 criticals are excluded.
    expect(byId(target.id).findings_counts).toEqual({ critical: 1, warning: 2, suggestion: 1 });
    // Never reviewed is null, not three zeroes — the UI shows an em dash for it.
    expect(byId(untouched.id).findings_counts).toBeNull();

    await app.close();
  });

  it('POST /repos/:id/poll syncs PR list and does NOT trigger a review', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const repoId = (await app.inject({ method: 'GET', url: '/repos' })).json()[0]!.id;
    const poll = await app.inject({ method: 'POST', url: `/repos/${repoId}/poll` });
    expect(poll.json().reviewTriggered).toBe(false);
    expect(poll.json().synced).toBeGreaterThan(0);
    await app.close();
  });
});
