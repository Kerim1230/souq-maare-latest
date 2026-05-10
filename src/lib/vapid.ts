/**
 * VAPID & Web Push — Server-side push notification sender.
 *
 * Reads VAPID keys from environment and provides helpers to send
 * push notifications to one or many users via their stored subscriptions
 * in the `push_subscriptions` Supabase table.
 */

import webpush from 'web-push';
import { getSupabaseAdmin, TABLES } from '@/lib/supabase-db';
import { logger } from '@/lib/logger';

// ── VAPID Configuration ─────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@suq-hurriya.com';

let vapidConfigured = false;

/**
 * Configure web-push with VAPID keys (called once lazily).
 */
function ensureVapidConfig(): boolean {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn('VAPID keys not configured — push notifications disabled', 'VAPID');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

// ── Types ───────────────────────────────────────────────────────────────

/**
 * Row shape from the `push_subscriptions` Supabase table.
 * The subscription is stored as a jsonb column containing
 * the full PushSubscription JSON object:
 *   { endpoint: string, keys: { p256dh: string, auth: string } }
 */
interface PushSubscriptionRow {
  id: string;
  user_id: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  } | string; // may be string if Supabase returns raw jsonb
  created_at?: string;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

// ── Subscription Helpers ────────────────────────────────────────────────

/**
 * Fetch all push subscriptions for a given user.
 */
async function getUserSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.PUSH_SUBSCRIPTIONS)
    .select('*')
    .eq('user_id', userId);

  if (error) {
    logger.warn('Failed to fetch push subscriptions', 'VAPID', { userId, error: error.message });
    return [];
  }
  return (data || []) as PushSubscriptionRow[];
}

/**
 * Fetch all push subscriptions for multiple users.
 */
async function getUsersSubscriptions(userIds: string[]): Promise<PushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.PUSH_SUBSCRIPTIONS)
    .select('*')
    .in('user_id', userIds);

  if (error) {
    logger.warn('Failed to fetch push subscriptions for users', 'VAPID', { count: userIds.length, error: error.message });
    return [];
  }
  return (data || []) as PushSubscriptionRow[];
}

/**
 * Delete a stale/expired subscription from the database.
 */
async function deleteSubscription(subscriptionId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from(TABLES.PUSH_SUBSCRIPTIONS)
    .delete()
    .eq('id', subscriptionId);

  if (error) {
    logger.warn('Failed to delete stale subscription', 'VAPID', { subscriptionId, error: error.message });
  }
}

// ── Send Helpers ────────────────────────────────────────────────────────

/**
 * Parse the subscription field from a database row.
 * Handles both parsed objects and raw JSON strings.
 */
function parseSubscription(sub: PushSubscriptionRow): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  try {
    const parsed = typeof sub.subscription === 'string'
      ? JSON.parse(sub.subscription)
      : sub.subscription;
    if (!parsed?.endpoint || !parsed?.keys?.p256dh || !parsed?.keys?.auth) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Send a push notification to a single subscription row.
 * Returns true if sent successfully, false otherwise.
 * If the subscription is expired (410), deletes it from the database.
 */
async function sendToSubscription(sub: PushSubscriptionRow, payload: PushPayload): Promise<boolean> {
  const parsed = parseSubscription(sub);
  if (!parsed) {
    logger.warn('Invalid subscription data in DB, skipping', 'VAPID', { subId: sub.id });
    // Delete invalid subscription
    await deleteSubscription(sub.id);
    return false;
  }

  const pushSubscription: webpush.PushSubscription = {
    endpoint: parsed.endpoint,
    keys: {
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
    },
  };

  try {
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );
    return true;
  } catch (err: any) {
    const statusCode = err?.statusCode || 0;
    if (statusCode === 410 || statusCode === 404) {
      // Subscription expired or unsubscribed — remove from DB
      logger.info('Removing expired push subscription', 'VAPID', { subId: sub.id, statusCode });
      await deleteSubscription(sub.id);
    } else {
      logger.warn('Push notification send failed', 'VAPID', { subId: sub.id, statusCode, error: err?.message });
    }
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Send a push notification to a single user.
 * Finds all their subscriptions and sends to each one.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<number> {
  if (!ensureVapidConfig()) return 0;

  const payload: PushPayload = { title, body, url, tag: `suq-${Date.now()}` };
  const subs = await getUserSubscriptions(userId);

  if (subs.length === 0) return 0;

  const results = await Promise.allSettled(
    subs.map(sub => sendToSubscription(sub, payload))
  );

  const sentCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return sentCount;
}

/**
 * Send a push notification to multiple users.
 * Fetches all their subscriptions and sends to each one.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  url?: string
): Promise<number> {
  if (!ensureVapidConfig()) return 0;
  if (userIds.length === 0) return 0;

  const payload: PushPayload = { title, body, url, tag: `suq-broadcast-${Date.now()}` };
  const subs = await getUsersSubscriptions(userIds);

  if (subs.length === 0) return 0;

  const results = await Promise.allSettled(
    subs.map(sub => sendToSubscription(sub, payload))
  );

  const sentCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return sentCount;
}

/**
 * Check if VAPID is properly configured.
 */
export function isVapidConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}
