/**
 * Server-side secrets — reads sensitive configuration from environment variables.
 * These values must NEVER be exposed to the client.
 */

/**
 * Get the admin email from the ADMIN_EMAIL environment variable.
 * Used to identify the super-admin user.
 */
export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || '';
}
