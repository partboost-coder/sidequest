/** One Qloo request as seen by a CallMeter. */
export interface CallRecord {
  endpoint: "search" | "insights" | "tags";
  ms: number;
  cached: boolean;
  /** Monthly quota remaining after this call, when the response reported it. */
  remaining?: number;
}

/**
 * Counts the Qloo calls made for one unit of work (e.g. one trip plan). Pass it per request via
 * `RequestOptions.meter` so concurrent plans never mix their counts.
 */
export class CallMeter {
  readonly records: CallRecord[] = [];

  record(entry: CallRecord) {
    this.records.push(entry);
  }

  /** Calls that reached Qloo (cache hits excluded). */
  get liveCalls() {
    return this.records.filter((r) => !r.cached).length;
  }

  get cachedCalls() {
    return this.records.filter((r) => r.cached).length;
  }

  summary() {
    const live = this.records.filter((r) => !r.cached);
    const byEndpoint = Object.fromEntries(
      (["search", "insights", "tags"] as const).map((e) => [
        e,
        live.filter((r) => r.endpoint === e).length,
      ]),
    );
    const remaining = [...this.records].reverse().find((r) => r.remaining !== undefined)?.remaining;
    return {
      liveCalls: live.length,
      cachedCalls: this.cachedCalls,
      totalMs: Math.round(live.reduce((sum, r) => sum + r.ms, 0)),
      byEndpoint,
      remaining,
    };
  }
}
