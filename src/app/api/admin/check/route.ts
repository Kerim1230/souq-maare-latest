export const runtime = 'nodejs'
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/lib/auth-guard';
import { success } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';

/**
 * GET /api/admin/check
 * Verify admin access. Returns admin info or 403.
 * Called by the Admin Dashboard component on mount.
 */
export const GET = withRoute(async (request: NextRequest) => {
  const admin = await requireAdmin(request);
  if (!admin.success) return admin.response;

  return success({
    isAdmin: true,
    role: admin.role,
    email: admin.email,
  });
})
