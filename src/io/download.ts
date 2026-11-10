import { GtfsError, GtfsErrorCode } from '../diagnostics/errors.ts';
import { redactUrlForReporting } from '../reporting/format.ts';

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 20;

export async function fetchGtfsFeed(options: {
  readonly url: string;
  readonly requestHeaders: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
  readonly acceptEncoding?: 'gzip';
}): Promise<Response> {
  const { url, requestHeaders, signal, acceptEncoding } = options;
  const defaultHeaders = {
    'User-Agent': 'node-gtfs',
    ...(acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {}),
  };
  let headers = {
    ...defaultHeaders,
    ...requestHeaders,
    ...(acceptEncoding ? { 'Accept-Encoding': acceptEncoding } : {}),
  };
  let currentUrl = new URL(url);

  for (let redirectCount = 0; ; redirectCount++) {
    signal.throwIfAborted();
    const response = await fetch(currentUrl.href, {
      method: 'GET',
      redirect: 'manual',
      headers,
      signal,
    });
    const location = response.headers.get('location');
    if (!REDIRECT_STATUSES.has(response.status) || location === null) {
      return response;
    }

    try {
      await response.body?.cancel();
    } catch {
      // A failed cancellation must not hide the redirect or timeout error.
    }
    signal.throwIfAborted();

    function rejectRedirect(reason: string, message: string): never {
      throw new GtfsError(
        `Could not download GTFS feed: ${message}; configure the final trusted feed URL`,
        {
          code: GtfsErrorCode.DOWNLOAD_REDIRECT_REJECTED,
          details: {
            url: redactUrlForReporting(url),
            reason,
            redirectCount,
          },
        },
      );
    }

    if (redirectCount === MAX_REDIRECTS) {
      rejectRedirect('redirect-limit-exceeded', 'more than 20 redirects');
    }

    // Do not attach Location or URL-parser errors: they may contain credentials.
    let nextUrl: URL;
    try {
      nextUrl = new URL(location, currentUrl);
    } catch {
      rejectRedirect('invalid-redirect-url', 'invalid redirect URL');
    }
    if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
      rejectRedirect(
        'unsupported-redirect-protocol',
        'redirect URL must use HTTP or HTTPS',
      );
    }
    if (nextUrl.username || nextUrl.password) {
      rejectRedirect(
        'redirect-credentials',
        'redirect URL contains embedded credentials',
      );
    }
    if (currentUrl.protocol === 'https:' && nextUrl.protocol === 'http:') {
      rejectRedirect('https-downgrade', 'HTTPS-to-HTTP redirect rejected');
    }

    if (nextUrl.origin !== currentUrl.origin) {
      // Any configured header can hold a secret. Never restore these headers,
      // even if a later redirect returns to the original origin.
      headers = defaultHeaders;
    }
    currentUrl = nextUrl;
  }
}
