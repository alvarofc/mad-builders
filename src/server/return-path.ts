const DEFAULT_RETURN_PATH = '/build';

// Where to send a builder after they sign in. Only same-origin paths are
// allowed: anything else would turn /login into an open redirect that a
// phishing link could point at another site.
export function safeReturnPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_RETURN_PATH;
  // Reject protocol-relative ("//evil.test") and the backslash variants some
  // clients normalise into a host, plus whitespace and control characters.
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\s\u0000-\u001f]/.test(value)) {
    return DEFAULT_RETURN_PATH;
  }
  return value;
}
