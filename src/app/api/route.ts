export const runtime = 'nodejs'
import { success } from '@/lib/api-response';
import { withRoute } from '@/server/lib/route-wrapper';

export const GET = withRoute(async () => {
  return success({
    status: 'ok',
    service: 'سوق شامل',
    version: process.env.npm_package_version || '0.2.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/api/health',
      diagnostics: '/api/diagnostics',
    },
  });
})
