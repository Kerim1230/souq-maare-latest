/**
 * Utility for safely extracting an error message from an unknown caught value.
 * Replaces `(error as any)?.message` patterns with proper type narrowing.
 */

/**
 * Safely extract a message string from an unknown error value.
 * Works with Error instances, objects with a message property, and primitives.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
