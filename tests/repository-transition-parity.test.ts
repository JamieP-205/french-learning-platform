import { describe, expect, it } from "vitest";
import type { LearningRepository, SubmissionInput } from "../lib/data/repository";
import { MockLearningRepository } from "../lib/data/mock-repository";
import { SupabaseLearningRepository } from "../lib/data/supabase-repository";
import type { LearnerProfile, MistakePattern, ReviewItem } from "../lib/domain/types";
import { INTRO_MISSION } from "../lib/content/seed";
import { validateActivityAnswer } from "../lib/learning/answer-validation";
import { buildSessionPlan } from "../lib/learning/session-planner";

type DbRow = Record<string, unknown>;
type QueryResult = { data: DbRow[] | DbRow | null; error: null };

class FakeQuery {
  private operation: "select" | "update" = "select";
  private updateValues: DbRow = {};
  private readonly filters: { column: string; value: unknown }[] = [];
  private rowLimit: number | undefined;

  constructor(
    private readonly table: string,
    private readonly tables: Map<string, DbRow[]>,
  ) {}

  select() {
    this.operation = "select";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order() {
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  update(values: DbRow) {
    this.operation = "update";
    this.updateValues = values;
    return this;
  }

  async insert(value: DbRow | DbRow[]): Promise<QueryResult> {
    this.rows().push(...(Array.isArray(value) ? value : [value]).map((row) => ({ ...row })));
    return { data: null, error: null };
  }

  async upsert(value: DbRow | DbRow[], options?: { onConflict?: string }): Promise<QueryResult> {
    const conflictColumns = options?.onConflict?.split(",") ?? ["id"];
    for (const incoming of Array.isArray(value) ? value : [value]) {
      const index = this.rows().findIndex((row) =>
        conflictColumns.every((column) => row[column] === incoming[column]),
      );
      if (index >= 0) this.rows()[index] = { ...this.rows()[index], ...incoming };
      else this.rows().push({ ...incoming });
    }
    return { data: null, error: null };
  }

  async maybeSingle(): Promise<QueryResult> {
    return { data: this.matchingRows()[0] ?? null, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private rows() {
    const existing = this.tables.get(this.table);
    if (existing) return existing;
    const created: DbRow[] = [];
    this.tables.set(this.table, created);
    return created;
  }

  private matchingRows() {
    const rows = this.rows().filter((row) =>
      this.filters.every(({ column, value }) => row[column] === value),
    );
    return this.rowLimit === undefined ? rows : rows.slice(0, this.rowLimit);
  }

  private execute(): QueryResult {
    const matching = this.matchingRows();
    if (this.operation === "update") {
      matching.forEach((row) => Object.assign(row, this.updateValues));
      return { data: null, error: null };
    }
    return { data: matching, error: null };
  }
}

class FakeSupabaseClient {
  readonly tables = new Map<string, DbRow[]>();

  from(table: string) {
    return new FakeQuery(table, this.tables);
  }

  async rpc(name: string, input: DbRow): Promise<QueryResult> {
    if (name === "create_or_resume_learning_session") {
      const session = {
        id: input.p_session_id,
        user_id: input.p_user_id,
        mission_id: input.p_mission_id,
        plan_json: input.p_plan_json,
        mode: input.p_mode,
        started_at: input.p_started_at,
        completed_at: null,
        current_index: 0,
        created_at: new Date().toISOString(),
      };
      this.rowsFor("sessions").push(session);
      return { data: session, error: null };
    }

    if (name !== "submit_activity_attempt") throw new Error(`Unexpected RPC: ${name}`);
    const createdAt = new Date().toISOString();
    const attempt = {
      id: crypto.randomUUID(),
      request_id: input.p_request_id,
      user_id: input.p_user_id,
      session_id: input.p_session_id,
      activity_id: input.p_activity_id,
      submitted_answer: input.p_submitted_answer,
      latency_ms: input.p_latency_ms,
      result_json: input.p_result_json,
      completed: input.p_completed,
      is_correct: input.p_is_correct,
      evidence_kind: input.p_evidence_kind,
      created_at: createdAt,
    };
    this.rowsFor("activity_attempts").push(attempt);

    const pattern = input.p_mistake_pattern as DbRow | null;
    if (pattern) {
      this.upsertRow("mistake_patterns", ["user_id", "rule_id"], {
        ...pattern,
        last_seen_at: createdAt,
        transition_revision: Number(pattern.expected_revision) + 1,
      });
    }
    const review = input.p_review_item as DbRow | null;
    if (review) {
      this.upsertRow("review_items", ["id"], {
        ...review,
        transition_revision: Number(review.expected_revision) + 1,
      });
    }
    return { data: attempt, error: null };
  }

  rows(table: string) {
    return this.tables.get(table) ?? [];
  }

  private rowsFor(table: string) {
    const rows = this.tables.get(table) ?? [];
    this.tables.set(table, rows);
    return rows;
  }

  private upsertRow(table: string, keys: string[], incoming: DbRow) {
    const rows = this.rowsFor(table);
    const index = rows.findIndex((row) => keys.every((key) => row[key] === incoming[key]));
    if (index >= 0) rows[index] = { ...rows[index], ...incoming };
    else rows.push({ ...incoming });
  }
}

function supabaseRepositoryWith(client: FakeSupabaseClient) {
  const repository = Object.create(SupabaseLearningRepository.prototype) as SupabaseLearningRepository;
  Object.defineProperty(repository, "client", { value: client });
  return repository;
}

function stateShape(pattern: MistakePattern) {
  return {
    ruleId: pattern.ruleId,
    mistakeType: pattern.mistakeType,
    repeatCount: pattern.repeatCount,
    separateProductionSuccesses: pattern.separateProductionSuccesses,
    resolved: pattern.resolved,
  };
}

async function record(repository: LearningRepository, input: Omit<SubmissionInput, "requestId">) {
  return repository.recordSubmission({
    ...input,
    requestId: crypto.randomUUID(),
    completed: true,
    correct: input.result.isCorrect,
    evidenceKind: "free-production",
  });
}

describe("repository response transition parity", () => {
  it("resolves a mistake after two qualifying productive successes in mock and Supabase", async () => {
    const userId = `transition-${crypto.randomUUID()}`;
    const activity = INTRO_MISSION.activities.find((candidate) => candidate.id === "act-age-typing-v1")!;
    const wrongResult = validateActivityAnswer(activity, "Je suis 20 ans");
    const correctResult = validateActivityAnswer(activity, "J'ai 20 ans");
    const base = { userId, sessionId: "no-session", expectedCurrentIndex: 0, activity, latencyMs: 2_000 };
    const mock = new MockLearningRepository();
    const fakeClient = new FakeSupabaseClient();
    const supabase = supabaseRepositoryWith(fakeClient);

    for (const repository of [mock, supabase]) {
      await record(repository, { ...base, submittedAnswer: "Je suis 20 ans", result: wrongResult });
      await record(repository, { ...base, submittedAnswer: "J'ai 20 ans", result: correctResult });
      const afterOne = await repository.getOpenMistakes(userId);
      expect(afterOne).toHaveLength(1);
      expect(afterOne[0]).toMatchObject({ separateProductionSuccesses: 1, resolved: false });
      await record(repository, { ...base, submittedAnswer: "J'ai 20 ans", result: correctResult });
      expect(await repository.getOpenMistakes(userId)).toHaveLength(0);
    }

    const mockData = await mock.exportLearnerData(userId);
    const mockPattern = (mockData.mistakes as MistakePattern[])[0];
    const supabaseRow = fakeClient.rows("mistake_patterns")[0];
    const supabasePattern: MistakePattern = {
      id: supabaseRow.id as string,
      userId: supabaseRow.user_id as string,
      ruleId: supabaseRow.rule_id as string,
      mistakeType: supabaseRow.mistake_type as MistakePattern["mistakeType"],
      correctedAnswer: supabaseRow.corrected_answer as string,
      explanation: supabaseRow.explanation as string,
      repeatCount: supabaseRow.repeat_count as number,
      separateProductionSuccesses: supabaseRow.separate_production_successes as number,
      resolved: supabaseRow.resolved as boolean,
      lastSeenAt: supabaseRow.last_seen_at as string,
    };
    expect(stateShape(mockPattern)).toEqual(stateShape(supabasePattern));
    expect(stateShape(mockPattern)).toMatchObject({ separateProductionSuccesses: 2, resolved: true });

    const mockReview = (mockData.reviews as ReviewItem[])[0];
    const supabaseReview = fakeClient.rows("review_items")[0];
    expect({
      stage: mockReview.stage,
      successCount: mockReview.successCount,
      failureCount: mockReview.failureCount,
      priority: mockReview.priority,
    }).toEqual({
      stage: supabaseReview.stage,
      successCount: supabaseReview.success_count,
      failureCount: supabaseReview.failure_count,
      priority: supabaseReview.priority,
    });
  });

  it("persists audio-speed and theme preferences identically in mock and Supabase", async () => {
    const userId = `speed-${crypto.randomUUID()}`;
    const mock = new MockLearningRepository();
    const client = new FakeSupabaseClient();
    const supabase = supabaseRepositoryWith(client);

    client.tables.set("profiles", [{ id: userId, display_name: "Learner", policy_version: "test" }]);
    await mock.saveProfile({
      userId,
      displayName: "Learner",
      currentLevel: "A1",
      learningGoals: ["travel"],
      interests: [],
      dailyMinutes: 8,
      preferredMode: "normal",
      policyVersion: "test",
      completedSessions: 0,
      currentStreak: 0,
    });

    for (const repository of [mock, supabase]) {
      const before = await repository.getProfile(userId);
      expect(before?.speechSpeed ?? "normal").toBe("normal");
      expect(before?.themePreference ?? "system").toBe("system");
      const updated = await repository.updateProfilePreferences(userId, {
        speechSpeed: "slow",
        themePreference: "dark",
      });
      expect(updated?.speechSpeed).toBe("slow");
      expect(updated?.themePreference).toBe("dark");
      const reloaded = await repository.getProfile(userId);
      expect(reloaded?.speechSpeed).toBe("slow");
      expect(reloaded?.themePreference).toBe("dark");
    }
  });

  it("never rewrites canonical curriculum rows while creating an adaptive session", async () => {
    const client = new FakeSupabaseClient();
    const repository = supabaseRepositoryWith(client);
    const profile: LearnerProfile = {
      userId: crypto.randomUUID(),
      displayName: "Learner",
      currentLevel: "A1",
      learningGoals: ["travel"],
      interests: [],
      dailyMinutes: 8,
      preferredMode: "normal",
      policyVersion: "test",
      completedSessions: 0,
      currentStreak: 0,
    };
    const plan = buildSessionPlan({
      profile,
      mission: INTRO_MISSION,
      dueReviews: [],
      mistakes: [],
    });
    const canonicalMission = {
      id: INTRO_MISSION.id,
      title: INTRO_MISSION.title,
      publication_status: "published",
    };
    const canonicalActivities = INTRO_MISSION.activities.map((activity, index) => ({
      id: activity.id,
      mission_id: INTRO_MISSION.id,
      step_order: index + 1,
      activity_type: activity.type,
      publication_status: "published",
    }));
    client.tables.set("missions", [canonicalMission]);
    client.tables.set("activities", canonicalActivities.map((row) => ({ ...row })));

    await repository.createSession(profile.userId, {
      ...plan,
      activities: [...plan.activities].reverse(),
    });

    expect(client.rows("missions")).toEqual([canonicalMission]);
    expect(client.rows("activities")).toEqual(canonicalActivities);
    expect(client.rows("sessions")).toHaveLength(1);
  });
});
