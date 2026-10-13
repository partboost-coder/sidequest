/**
 * Spaces request starts to at most `ratePerSec` and caps in-flight requests at `concurrency`.
 * Qloo allows 5 req/s per key; the app uses 4 for headroom.
 */
export interface ThrottleOptions {
  ratePerSec: number;
  concurrency: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export class Throttle {
  private nextStart = 0;
  private active = 0;
  private readonly waiters: (() => void)[] = [];
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly intervalMs: number;

  constructor(private readonly options: ThrottleOptions) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.intervalMs = 1000 / options.ratePerSec;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      // Reserve a start time synchronously so concurrent callers queue in order.
      const start = Math.max(this.now(), this.nextStart);
      this.nextStart = start + this.intervalMs;
      const wait = start - this.now();
      if (wait > 0) await this.sleep(wait);
      return await fn();
    } finally {
      this.releaseSlot();
    }
  }

  private async acquireSlot() {
    if (this.active < this.options.concurrency) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
  }

  private releaseSlot() {
    this.active--;
    this.waiters.shift()?.();
  }
}
