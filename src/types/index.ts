// ===== User Types =====
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  city?: string;
  created_at?: string;
  isBanned?: boolean;
}

// ===== Product Types =====
export interface Product {
  id: string;
  store_id: string;
  user_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  is_featured: boolean;
  is_new: boolean;
  is_real_photo?: boolean;
  views?: number;
  expires_at?: string | null;
  created_at: string;
  store_name?: string;
  store_logo?: string;
  store_verified?: boolean;
  store_chat_enabled?: boolean;
  store_governorate?: string | null;
}

// ===== Store Types =====
export interface Store {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  logo_url?: string;
  cover_url?: string;
  category?: string;
  is_verified: boolean;
  is_featured?: boolean;
  chat_enabled?: boolean;
  theme_color?: string | null;
  theme_color_changed_at?: string | null;
  followers_count?: number;
  is_following?: boolean;
  governorate?: string | null;
  city?: string | null;
  district?: string | null;
  location?: string | null;
  created_at: string;
}

// ===== Favorite Types =====
export interface Favorite {
  id: string;
  user_id: string;
  product_id?: string;
  store_id?: string;
  product?: Product;
  store?: Store;
}

// ===== Chat Types =====
export interface ChatConversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  storeId: string;
  storeName: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageSenderId: string;
  unreadCount: number;
  isArchived: boolean;
  isStarred: boolean;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  storeId?: string;
  content: string;
  createdAt: string;
  timestamp?: number;
  isRead?: boolean;
  senderName?: string;
  senderAvatar?: string;
}

export interface QuickReply {
  id: string;
  text: string;
  isCustom?: boolean;
}

// ===== Notification Types =====
export type NotificationType = 'system' | 'store' | 'interaction' | 'admin' | 'auto' | 'points' | 'message';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: string;
  title: string;
  body: string;
  icon?: string;
  imageUrl?: string;
  deepLink?: string;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string;
  data?: Record<string, unknown>;
}

export interface NotificationSettings {
  enabled: boolean;
  types: Partial<Record<NotificationType, boolean>>;
}

export interface ScheduledNotification {
  id: string;
  userId: string | '*';
  type: NotificationType;
  category: string;
  title: string;
  body: string;
  icon?: string;
  imageUrl?: string;
  deepLink?: string;
  priority: NotificationPriority;
  scheduledFor: string;
  isSent: boolean;
  createdAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<NotificationType, number>;
  today: number;
  thisWeek: number;
}

// ===== Wallet/Points Types =====
export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'admin_add' | 'purchase' | 'verification' | 'share_reward' | 'admin_deduct';
  amount: number;
  description: string;
  createdAt: string;
}

export interface PointsOrder {
  id: string;
  userId: string;
  amount: number;
  cost: number;
  status: 'pending' | 'approved' | 'rejected';
  method: string;
  createdAt: string;
}

// ===== Verification Types =====
export interface VerificationData {
  id: string;
  userId: string;
  storeId: string;
  storeName: string;
  status: 'active' | 'expired' | 'revoked';
  grantedAt: string;
  expiresAt: string;
}

// ===== Navigation Types =====
export type SubScreen = 'none' | 'store-detail' | 'product-detail' | 'offer-detail' | 'wallet' | 'purchase-points' | 'transactions' | 'admin-dashboard' | 'expired-content' | 'verification' | 'share-earn' | 'notifications' | 'store-messages' | 'user-messages' | 'settings' | 'help' | 'contact-support' | 'policy' | 'debug-push' | 'auth';

// ===== Pagination Types =====
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  hasMore: boolean;
  loading: boolean;
}

// ===== Search Types =====
export interface SearchFilters {
  query: string;
  category?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  type?: 'products' | 'stores' | 'all';
}

// ===== API Types =====
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ReportState {
  isOpen: boolean;
  targetType: 'product' | 'store' | 'offer' | 'comment' | null;
  targetId: string | null;
  targetName: string | null;
}
