/**
 * Map axios / fetch failures to a clear user-facing message for the situation.
 */
export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const serverMsg =
    (typeof data?.message === 'string' && data.message.trim()) ||
    (typeof data?.error === 'string' && data.error.trim()) ||
    '';

  if (serverMsg && status && status < 500) {
    return serverMsg;
  }

  if (!err?.response) {
    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
      return 'You appear to be offline. Check your internet connection.';
    }
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
      return 'Request timed out. The server is taking too long — try again in a moment.';
    }
    if (err?.message === 'Network Error') {
      return 'Cannot reach the server. It may be down or busy — try again shortly.';
    }
    return fallback;
  }

  switch (status) {
    case 400:
      return serverMsg || 'Invalid request. Please check your input.';
    case 401:
      return serverMsg || 'Session expired. Please sign in again.';
    case 403:
      return serverMsg || 'You do not have access to this feature.';
    case 404:
      return serverMsg || 'Requested data was not found.';
    case 409:
      return serverMsg || 'Conflict. Please refresh and try again.';
    case 429:
      return serverMsg || 'Too many requests. Please wait a moment and try again.';
    case 502:
    case 503:
    case 504:
      return serverMsg || 'Server is temporarily unavailable. Please try again shortly.';
    default:
      if (status >= 500) {
        return serverMsg || 'Server error. Please try again shortly.';
      }
      return serverMsg || fallback;
  }
}
