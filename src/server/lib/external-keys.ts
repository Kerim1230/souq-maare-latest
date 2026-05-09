/**
 * External Keys — reads encrypted settings from the database.
 *
 * Used by cloudinary.ts and supabase/server.ts as a fallback when
 * environment variables are not set.  Values are stored encrypted
 * in the `encrypted_settings` table and decrypted at runtime.
 */

import { getEncryptedSetting } from '@/lib/supabase-db';
import { decrypt } from '@/server/lib/encryption';

/**
 * Get a decrypted key value from the encrypted_settings table.
 * Returns an empty string if the key is not found or decryption fails.
 */
export async function getKeyValue(key: string): Promise<string> {
  try {
    const encryptedValue = await getEncryptedSetting(key);
    if (!encryptedValue) return '';

    const decrypted = decrypt(encryptedValue);
    return decrypted || '';
  } catch (err) {
    console.error(`[external-keys] Failed to get key "${key}":`, err instanceof Error ? err.message : String(err));
    return '';
  }
}
