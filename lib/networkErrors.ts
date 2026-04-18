type ErrorLike = {
  code?: unknown;
  message?: unknown;
};

function getErrorParts(error: unknown): { code: string; message: string } {
  const candidate = (error || {}) as ErrorLike;
  return {
    code: typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '',
    message: typeof candidate.message === 'string' ? candidate.message.toLowerCase() : String(error || '').toLowerCase(),
  };
}

export function isNetworkRequestFailedError(error: unknown): boolean {
  const { code, message } = getErrorParts(error);

  return (
    code.includes('network-request-failed') ||
    message.includes('network request failed') ||
    message.includes('fetching auth token failed')
  );
}

export function isOfflineFirestoreError(error: unknown): boolean {
  const { code, message } = getErrorParts(error);

  return (
    code.includes('unavailable') ||
    message.includes('client is offline') ||
    message.includes('could not reach cloud firestore backend') ||
    message.includes('offline mode')
  );
}

export function isExpectedNetworkError(error: unknown): boolean {
  return isNetworkRequestFailedError(error) || isOfflineFirestoreError(error);
}