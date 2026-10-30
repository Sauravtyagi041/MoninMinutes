export class AiError extends Error {
  /**
   * @param {string} code AI_CONFIG | AI_AUTH | AI_RATE_LIMIT | AI_UNAVAILABLE | AI_BAD_OUTPUT | AI_TOO_LARGE
   * @param {string} userMessage safe to show to end users
   */
  constructor(code, userMessage, { retryable = false, cause } = {}) {
    super(userMessage, { cause });
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = retryable;
  }
}
