// Server-side input validation utilities

// Import and re-export unified sanitizeString from canonical source
import { sanitizeString } from '@/server/lib/sanitize';
export { sanitizeString };

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) return { valid: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
  return { valid: true };
}

export function validatePrice(price: any): { valid: boolean; error?: string; value?: number } {
  const num = Number(price);
  if (isNaN(num) || num < 0) return { valid: false, error: 'السعر يجب أن يكون رقماً موجباً' };
  if (num > 999999999) return { valid: false, error: 'السعر يتجاوز الحد المسموح' };
  return { valid: true, value: num };
}

export function validateRequired(value: string, fieldName: string): { valid: boolean; error?: string } {
  if (!value || !value.trim()) return { valid: false, error: `${fieldName} مطلوب` };
  return { valid: true };
}

export function validateLength(value: string, min: number, max: number, fieldName: string): { valid: boolean; error?: string } {
  if (value.length < min) return { valid: false, error: `${fieldName} يجب أن يكون ${min} أحرف على الأقل` };
  if (value.length > max) return { valid: false, error: `${fieldName} يجب أن لا يتجاوز ${max} حرف` };
  return { valid: true };
}

/**
 * Validates that a value is a non-empty string ID.
 * Use this to centralize all `if (!storeId)` / `if (!id)` checks with Arabic error messages.
 */
export function validateId(value: unknown, fieldName: string = 'المعرّف'): { valid: boolean; error?: string; value?: string } {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return { valid: false, error: `${fieldName} مطلوب` };
  }
  return { valid: true, value: value.trim() };
}

/**
 * Validates that a value is a valid integer within an optional range.
 * Use this to centralize `parseInt()` with NaN guards and range checks.
 */
export function validateInt(value: unknown, min?: number, max?: number, fieldName: string = 'القيمة'): { valid: boolean; error?: string; value?: number } {
  const num = parseInt(String(value), 10);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} يجب أن يكون رقماً صحيحاً` };
  }
  if (min !== undefined && num < min) {
    return { valid: false, error: `${fieldName} يجب أن لا يقل عن ${min}` };
  }
  if (max !== undefined && num > max) {
    return { valid: false, error: `${fieldName} يجب أن لا يتجاوز ${max}` };
  }
  return { valid: true, value: num };
}

/**
 * Combines sanitizeString + validateRequired + validateLength into one call.
 * Sanitizes the input first (trim, strip HTML, limit length), then validates
 * that the result is non-empty. Returns the sanitized value on success.
 */
export function sanitizeAndValidate(input: unknown, maxLength: number, fieldName: string): { valid: boolean; error?: string; value?: string } {
  const sanitized = sanitizeString(input, maxLength);
  const requiredCheck = validateRequired(sanitized, fieldName);
  if (!requiredCheck.valid) return { valid: false, error: requiredCheck.error };
  const lengthCheck = validateLength(sanitized, 1, maxLength, fieldName);
  if (!lengthCheck.valid) return { valid: false, error: lengthCheck.error };
  return { valid: true, value: sanitized };
}
