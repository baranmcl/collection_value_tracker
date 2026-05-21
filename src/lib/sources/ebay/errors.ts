// ABOUTME: Error vocabulary for the eBay client — a typed error carrying the
// ABOUTME: HTTP status, and a classifier that buckets failures for the refresh loop.

/** An eBay API call that returned a non-OK HTTP response. */
export class EbayError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'EbayError';
  }
}

/** The three failure buckets the refresh loop reacts to. */
export type ErrorReason = 'auth' | 'rate_limit' | 'other';

/** Bucket any thrown value into a reason. Non-EbayError values are `other`. */
export function classifyError(e: unknown): ErrorReason {
  if (e instanceof EbayError) {
    if (e.status === 401 || e.status === 403) return 'auth';
    if (e.status === 429) return 'rate_limit';
  }
  return 'other';
}
