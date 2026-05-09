/**
 * Recursively convert snake_case object keys to camelCase.
 * Used across API routes to transform database (snake_case) responses
 * to camelCase for frontend consumption.
 */
export function snakeToCamel<T = Record<string, unknown>>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(snakeToCamel) as T;
  if (obj !== null && typeof obj === 'object') {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      converted[camelKey] = snakeToCamel(value);
    }
    return converted as T;
  }
  return obj as T;
}

/**
 * Recursively convert camelCase object keys to snake_case.
 * Converts Date objects to ISO strings automatically.
 * Used across API routes to normalize camelCase responses
 * to snake_case matching database convention.
 */
export function camelToSnake<T = Record<string, unknown>>(obj: unknown): T {
  if (Array.isArray(obj)) return obj.map(camelToSnake) as T;
  if (obj !== null && typeof obj === 'object') {
    // Handle Date → ISO string conversion
    if (obj instanceof Date) {
      return obj.toISOString() as T;
    }
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
      converted[snakeKey] = camelToSnake(value);
    }
    return converted as T;
  }
  return obj as T;
}
