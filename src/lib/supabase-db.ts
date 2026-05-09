/**
 * Supabase Database Client — Primary database access layer.
 * Replaces Prisma/SQLite with Supabase/PostgreSQL.
 *
 * Uses the service-role admin client for all server-side operations
 * (bypasses RLS, equivalent to Prisma's unrestricted access).
 *
 * All table/column names use snake_case matching the PostgreSQL schema.
 */

import { createAdminClient } from '@/lib/supabase/admin';

// ── Singleton Admin Client ──────────────────────────────────────────────

let _adminClient: ReturnType<typeof createAdminClient> | null = null;

export function getSupabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient();
  }
  return _adminClient;
}

// ── Table Names ─────────────────────────────────────────────────────────

export const TABLES = {
  USERS: 'users',
  STORES: 'stores',
  PRODUCTS: 'products',
  FAVORITES: 'favorites',
  STORE_FOLLOWS: 'store_follows',
  STORE_OFFERS: 'store_offers',
  COMMENTS: 'comments',
  CHAT_MESSAGES: 'chat_messages',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  NOTIFICATIONS: 'notifications',
  ADMIN_NOTIFICATIONS: 'admin_notifications',
  WALLET: 'wallets',
  POINT_TRANSACTIONS: 'point_transactions',
  APP_SETTINGS: 'app_settings',
  POINT_ORDERS: 'point_orders',
  REPORTS: 'reports',
  USER_BANS: 'user_bans',
  ADMIN_ACTIVITY_LOGS: 'admin_activity_log',
  VERIFICATIONS: 'verifications',
  VERIFICATION_ACTIVITY_LOGS: 'verification_activity_log',
  SUPPORT_TICKETS: 'support_tickets',
  ENCRYPTED_SETTINGS: 'encrypted_settings',
  CATEGORIES: 'categories',
  REFERRALS: 'referrals',
} as const;

// ── Query Helpers ───────────────────────────────────────────────────────

/**
 * Build pagination parameters for Supabase queries.
 */
export function paginate(page: number, pageSize: number) {
  const safePage = Math.max(page, 1);
  const safePageSize = Math.min(Math.max(pageSize, 1), 200);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  return { from, to };
}

/**
 * Build an ILIKE search filter for Supabase (case-insensitive contains).
 */
export function searchFilter(field: string, query: string) {
  return `${field}.ilike.%${query}%`;
}

/**
 * Handle Supabase response — throws on error, returns data.
 */
export function handleResponse<T>(response: { data: T | null; error: { message: string; code: string; details?: string } | null }, context?: string): T {
  if (response.error) {
    const msg = context
      ? `[supabase-db] ${context}: ${response.error.message}`
      : `[supabase-db] ${response.error.message}`;
    console.error(msg, response.error.details);
    throw new Error(response.error.message);
  }
  return response.data as T;
}

/**
 * Handle Supabase response for count queries.
 */
export function handleCount(response: { count: number | null; error: { message: string } | null }, context?: string): number {
  if (response.error) {
    const msg = context
      ? `[supabase-db] ${context}: ${response.error.message}`
      : `[supabase-db] ${response.error.message}`;
    console.error(msg);
    throw new Error(response.error.message);
  }
  return response.count ?? 0;
}

// ── Row Type Definitions ─────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  display_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  is_admin: boolean;
  points?: number;
  created_at?: string;
  updated_at?: string;
}

// ── User Operations ─────────────────────────────────────────────────────

export async function findUserById(id: string): Promise<UserRow> {
  const sb = getSupabaseAdmin();
  return handleResponse<UserRow>(
    await sb.from(TABLES.USERS).select('*').eq('id', id).single(),
    'findUserById'
  );
}

export async function findUserByEmail(email: string): Promise<UserRow> {
  const sb = getSupabaseAdmin();
  return handleResponse<UserRow>(
    await sb.from(TABLES.USERS).select('*').eq('email', email).single(),
    'findUserByEmail'
  );
}

export async function findUserByEmailSafe(email: string): Promise<UserRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.USERS).select('*').eq('email', email).single();
  if (error || !data) return null;
  return data as unknown as UserRow;
}

export async function createUser(data: {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  city?: string;
  is_admin?: boolean;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.USERS).insert(data).select().single(),
    'createUser'
  );
}

export async function updateUser(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.USERS).update(data).eq('id', id).select().single(),
    'updateUser'
  );
}

// ── Store Operations ────────────────────────────────────────────────────

export interface StoreRow {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  theme_color?: string | null;
  is_verified?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function findStoreById(id: string): Promise<StoreRow> {
  const sb = getSupabaseAdmin();
  return handleResponse<StoreRow>(
    await sb.from(TABLES.STORES).select('*').eq('id', id).single(),
    'findStoreById'
  );
}

export async function findStoreByUserId(userId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.STORES).select('*').eq('user_id', userId).limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

export async function createStore(data: {
  user_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  cover_url?: string;
  category?: string;
  chat_enabled?: boolean;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORES).insert(data).select().single(),
    'createStore'
  );
}

export async function updateStore(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORES).update(data).eq('id', id).select().single(),
    'updateStore'
  );
}

export async function deleteStore(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORES).delete().eq('id', id),
    'deleteStore'
  );
}

// ── Product Operations ──────────────────────────────────────────────────

export async function findProductById(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.PRODUCTS).select('*').eq('id', id).single(),
    'findProductById'
  );
}

export async function createProduct(data: {
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  user_id: string;
  store_id?: string;
  category?: string;
  is_featured?: boolean;
  is_new?: boolean;
  expires_at?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.PRODUCTS).insert(data).select().single(),
    'createProduct'
  );
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.PRODUCTS).update(data).eq('id', id).select().single(),
    'updateProduct'
  );
}

export async function deleteProduct(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.PRODUCTS).delete().eq('id', id),
    'deleteProduct'
  );
}

// ── Favorite Operations ─────────────────────────────────────────────────

export async function findFavorite(userId: string, productId?: string, storeId?: string) {
  const sb = getSupabaseAdmin();
  let query = sb.from(TABLES.FAVORITES).select('*').eq('user_id', userId);
  if (productId) query = query.eq('product_id', productId);
  else query = query.is('product_id', null);
  if (storeId) query = query.eq('store_id', storeId);
  else query = query.is('store_id', null);

  const { data, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

export async function createFavorite(data: { user_id: string; product_id?: string; store_id?: string }) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.FAVORITES).insert(data).select().single(),
    'createFavorite'
  );
}

export async function deleteFavorite(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.FAVORITES).delete().eq('id', id),
    'deleteFavorite'
  );
}

// ── Follow Operations ───────────────────────────────────────────────────

export async function findFollow(userId: string, storeId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.STORE_FOLLOWS)
    .select('*')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

export async function createFollow(data: { user_id: string; store_id: string }) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORE_FOLLOWS).insert(data).select().single(),
    'createFollow'
  );
}

export async function deleteFollow(userId: string, storeId: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORE_FOLLOWS).delete().eq('user_id', userId).eq('store_id', storeId),
    'deleteFollow'
  );
}

export async function countFollowers(storeId: string): Promise<number> {
  const sb = getSupabaseAdmin();
  return handleCount(
    await sb.from(TABLES.STORE_FOLLOWS).select('*', { count: 'exact', head: true }).eq('store_id', storeId),
    'countFollowers'
  );
}

export async function getFollowerIds(storeId: string, excludeUserId?: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  let query = sb.from(TABLES.STORE_FOLLOWS).select('user_id').eq('store_id', storeId);
  if (excludeUserId) query = query.neq('user_id', excludeUserId);
  const data = handleResponse(await query, 'getFollowerIds');
  return data.map((f: { user_id: string }) => f.user_id);
}

// ── Notification Operations ─────────────────────────────────────────────

export async function createNotification(data: {
  user_id: string;
  title: string;
  body?: string;
  type?: string;
  category?: string;
  icon?: string;
  priority?: string;
  deep_link?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.NOTIFICATIONS).insert(data).select().single(),
    'createNotification'
  );
}

export async function createManyNotifications(items: Array<{
  user_id: string;
  title: string;
  body?: string;
  type?: string;
  category?: string;
  icon?: string;
  priority?: string;
  deep_link?: string;
}>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.NOTIFICATIONS).insert(items).select(),
    'createManyNotifications'
  );
}

// ── Comment Operations ──────────────────────────────────────────────────

export async function createComment(data: {
  user_id: string;
  content: string;
  product_id?: string;
  offer_id?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.COMMENTS).insert(data).select().single(),
    'createComment'
  );
}

export async function deleteComment(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.COMMENTS).delete().eq('id', id),
    'deleteComment'
  );
}

// ── Order Operations ────────────────────────────────────────────────────

export async function createOrder(data: {
  user_id: string;
  store_id: string;
  product_id?: string;
  status?: string;
  total_amount: number;
  quantity?: number;
  notes?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.ORDERS).insert(data).select().single(),
    'createOrder'
  );
}

export async function updateOrder(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.ORDERS).update(data).eq('id', id).select().single(),
    'updateOrder'
  );
}

export async function deleteOrder(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.ORDERS).delete().eq('id', id),
    'deleteOrder'
  );
}

// ── Store Offer Operations ──────────────────────────────────────────────

export async function createStoreOffer(data: {
  store_id: string;
  user_id: string;
  title: string;
  description?: string;
  image_url?: string;
  type?: string;
  discount?: string;
  expires_at?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORE_OFFERS).insert(data).select().single(),
    'createStoreOffer'
  );
}

export async function updateStoreOffer(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORE_OFFERS).update(data).eq('id', id).select().single(),
    'updateStoreOffer'
  );
}

export async function deleteStoreOffer(id: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.STORE_OFFERS).delete().eq('id', id),
    'deleteStoreOffer'
  );
}

// ── Wallet Operations ───────────────────────────────────────────────────

export async function findWalletByUserId(userId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.WALLET).select('*').eq('user_id', userId).single();
  if (error || !data) return null;
  return data;
}

export async function createWallet(data: { user_id: string; balance?: number; total_used?: number; total_purchased?: number }) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.WALLET).insert(data).select().single(),
    'createWallet'
  );
}

export async function updateWallet(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.WALLET).update(data).eq('id', id).select().single(),
    'updateWallet'
  );
}

export async function upsertWallet(data: { user_id: string; balance?: number; total_used?: number; total_purchased?: number }) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.WALLET).upsert(data, { onConflict: 'user_id' }).select().single(),
    'upsertWallet'
  );
}

// ── Point Transaction Operations ────────────────────────────────────────

export async function createPointTransaction(data: {
  wallet_id: string;
  user_id: string;
  amount: number;
  type: string;
  description?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.POINT_TRANSACTIONS).insert(data).select().single(),
    'createPointTransaction'
  );
}

// ── Ban Operations ──────────────────────────────────────────────────────

export async function findActiveBan(userId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from(TABLES.USER_BANS)
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

export async function updateBan(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.USER_BANS).update(data).eq('id', id).select().single(),
    'updateBan'
  );
}

// ── Chat Message Operations ─────────────────────────────────────────────

export async function createChatMessage(data: {
  sender_id: string;
  receiver_id: string;
  store_id?: string;
  content: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.CHAT_MESSAGES).insert(data).select().single(),
    'createChatMessage'
  );
}

export async function markMessagesRead(senderId: string, receiverId: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.CHAT_MESSAGES).update({ is_read: true }).eq('sender_id', senderId).eq('receiver_id', receiverId).eq('is_read', false),
    'markMessagesRead'
  );
}

// ── Report Operations ───────────────────────────────────────────────────

export async function createReport(data: {
  target_id: string;
  target_type: string;
  target_name?: string;
  reporter_id: string;
  reporter_name?: string;
  reporter_email?: string;
  reason: string;
  description?: string;
  images?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.REPORTS).insert(data).select().single(),
    'createReport'
  );
}

// ── Support Ticket Operations ───────────────────────────────────────────

export async function createSupportTicket(data: {
  user_id: string;
  subject: string;
  message: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.SUPPORT_TICKETS).insert(data).select().single(),
    'createSupportTicket'
  );
}

// ── App Settings Operations ─────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.APP_SETTINGS).select('value').eq('key', key).single();
  if (error || !data) return null;
  return data.value;
}

export async function setAppSetting(key: string, value: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.APP_SETTINGS).upsert({ key, value }, { onConflict: 'key' }).select().single(),
    'setAppSetting'
  );
}

// ── Point Order Operations ──────────────────────────────────────────────

export async function createPointOrder(data: {
  user_id: string;
  user_name?: string;
  user_email?: string;
  points: number;
  amount: number;
  payment_code?: string;
  receipt_image?: string;
  point_price?: number;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.POINT_ORDERS).insert(data).select().single(),
    'createPointOrder'
  );
}

export async function updatePointOrder(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.POINT_ORDERS).update(data).eq('id', id).select().single(),
    'updatePointOrder'
  );
}

// ── Verification Operations ─────────────────────────────────────────────

export async function findVerificationByStoreId(storeId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.VERIFICATIONS).select('*').eq('store_id', storeId).single();
  if (error || !data) return null;
  return data;
}

export async function createVerification(data: {
  store_id: string;
  user_id: string;
  store_name?: string;
  tier?: string;
  is_active?: boolean;
  start_date?: string;
  end_date?: string;
  granted_by?: string;
}) {
  const sb = getSupabaseAdmin();
  // The verifications table may not have a 'tier' column yet (migration pending).
  // Try with tier first; if that fails, retry without it.
  const result = await sb.from(TABLES.VERIFICATIONS).insert(data).select().single();
  if (result.error && data.tier !== undefined && result.error.message?.includes('tier')) {
    console.warn('[supabase-db] createVerification: tier column missing, retrying without tier');
    const { tier, ...dataWithoutTier } = data;
    return handleResponse(
      await sb.from(TABLES.VERIFICATIONS).insert(dataWithoutTier).select().single(),
      'createVerification(noTier)'
    );
  }
  return handleResponse(result, 'createVerification');
}

export async function updateVerification(id: string, data: Record<string, unknown>) {
  const sb = getSupabaseAdmin();
  // Try with tier first; if the column doesn't exist yet, retry without it
  const result = await sb.from(TABLES.VERIFICATIONS).update(data).eq('id', id).select().single();
  if (result.error && data.tier !== undefined && result.error.message?.includes('tier')) {
    console.warn('[supabase-db] updateVerification: tier column missing, retrying without tier');
    const { tier, ...dataWithoutTier } = data;
    return handleResponse(
      await sb.from(TABLES.VERIFICATIONS).update(dataWithoutTier).eq('id', id).select().single(),
      'updateVerification(noTier)'
    );
  }
  return handleResponse(result, 'updateVerification');
}

// ── Admin Activity Log Operations ───────────────────────────────────────

export async function logAdminActivity(data: {
  admin_email?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  details?: string;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.ADMIN_ACTIVITY_LOGS).insert(data).select().single(),
    'logAdminActivity'
  );
}

// ── Admin Notification Operations ───────────────────────────────────────

export async function createAdminNotification(data: {
  title: string;
  body?: string;
  type?: string;
  priority?: string;
  target?: string;
  target_id?: string;
  user_name?: string;
  total_recipients?: number;
}) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.ADMIN_NOTIFICATIONS).insert(data).select().single(),
    'createAdminNotification'
  );
}

// ── Category Operations ─────────────────────────────────────────────────

export async function getAllCategories() {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.CATEGORIES).select('*').order('name'),
    'getAllCategories'
  );
}

// ── Encrypted Setting Operations ────────────────────────────────────────

export async function getEncryptedSetting(key: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.ENCRYPTED_SETTINGS).select('encrypted_value').eq('key', key).single();
  if (error || !data) return null;
  return data.encrypted_value;
}

export async function setEncryptedSetting(key: string, encryptedValue: string) {
  const sb = getSupabaseAdmin();
  return handleResponse(
    await sb.from(TABLES.ENCRYPTED_SETTINGS).upsert({ key, encrypted_value: encryptedValue }, { onConflict: 'key' }).select().single(),
    'setEncryptedSetting'
  );
}
