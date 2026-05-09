/**
 * Runtime Configuration — Supabase Mode
 *
 * The application uses Supabase (PostgreSQL) for database and Cloudinary for uploads.
 * Authentication is handled via Supabase Auth + JWT session cookies.
 */

// ── Admin Email ──

export const ADMIN_EMAIL: string = process.env.ADMIN_EMAIL || '';

// ── Session Secret ──

export const SESSION_SECRET: string = process.env.SESSION_SECRET || '';
