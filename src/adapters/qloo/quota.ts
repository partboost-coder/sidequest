import { QlooError } from "./client";

export interface QuotaState {
  remaining: number;
  /** ISO timestamp of the response that reported it. */
  observedAt: string;
}

/** Where the last-known remaining quota is persisted (file in development, AppState table later). */
export interface QuotaStore {
  load(): Promise<QuotaState | undefined>;
  save(state: QuotaState): Promise<void>;
}

export class MemoryQuotaStore implements QuotaStore {
  private state?: QuotaState;
  async load() {
    return this.state;
  }
  async save(state: QuotaState) {
    this.state = state;
  }
}

export interface QuotaGuardOptions {
  /** Refuse live calls below this remaining count unless allowReserve. */
  reserve: number;
  /** Max live calls before any remaining count is known (fail closed after that). */
  unknownBudget: number;
  store?: QuotaStore;
  now?: () => Date;
}

/**
 * Tracks Qloo's monthly quota from `x-month-ratelimit-remaining` and refuses live calls that
 * would eat into the reserve. Never fails open: an unknown balance only allows a small budget.
 */
export class QuotaGuard {
  private state?: QuotaState;
  private loaded = false;
  private unknownCalls = 0;
  private readonly store: QuotaStore;
  private readonly now: () => Date;

  constructor(private readonly options: QuotaGuardOptions) {
    this.store = options.store ?? new MemoryQuotaStore();
    this.now = options.now ?? (() => new Date());
  }

  /** Throws QlooError(code "quota_reserve") if this live call isn't allowed. */
  async check(allowReserve = false): Promise<void> {
    await this.load();
    if (this.state) {
      if (this.state.remaining < this.options.reserve && !allowReserve) {
        throw new QlooError(
          `Qloo quota reserve reached (${this.state.remaining} left, reserve ${this.options.reserve}).`,
          429,
          false,
          "quota_reserve",
        );
      }
      return;
    }
    if (this.unknownCalls >= this.options.unknownBudget && !allowReserve) {
      throw new QlooError(
        `Qloo quota unknown after ${this.unknownCalls} calls; refusing further live calls.`,
        429,
        false,
        "quota_reserve",
      );
    }
    this.unknownCalls++;
  }

  /** Records the remaining count from a response header (ignored if missing or invalid). */
  async observe(remainingHeader: string | null | undefined): Promise<number | undefined> {
    const remaining = remainingHeader == null ? NaN : Number(remainingHeader);
    if (!Number.isFinite(remaining) || remaining < 0) return undefined;
    this.state = { remaining, observedAt: this.now().toISOString() };
    await this.store.save(this.state).catch(() => {});
    return remaining;
  }

  async snapshot(): Promise<QuotaState | undefined> {
    await this.load();
    return this.state;
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    this.state ??= await this.store.load().catch(() => undefined);
  }
}
