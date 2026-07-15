import { describe, expect, it } from "vitest";
import type { LearningRepository, SubmissionInput } from "../lib/data/repository";
import { MockLearningRepository } from "../lib/data/mock-repository";
import { SupabaseLearningRepository } from "../lib/data/supabase-repository";
import type { MistakePattern, ReviewItem } from "../lib/domain/types";
import { INTRO_MISSION } from "../lib/content/seed";
import { validateActivityAnswer } from "../lib/learning/answer-validation";

type DbRow = Record<string, unknown>;
type QueryResult = { data: DbRow[] | DbRow | null; error: null };

class FakeQuery {
  private operation: "select" | "update" = "select";
  private updateValues: DbRow = {};
  private readonly filters: { column: string; value: unknown }[] = [];

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
    return this.rows().filter((row) => this.filters.every(({ column, value }) => row[column] === value));
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

  rows(table: string) {
    return this.tables.get(table) ?? [];
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

async function record(repository: LearningRepository, input: SubmissionInput) {
  return repository.recordSubmission({
    ...input,
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
    const base = { userId, sessionId: "no-session", activity, latencyMs: 2_000 };
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
});
