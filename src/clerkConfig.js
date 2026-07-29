/**
 * Clerk publishable key.
 *
 * Publishable keys are public by design — they ship inside the client bundle
 * and only identify the instance. The matching secret key is server-side and
 * is not used here.
 *
 * This is a Clerk **development** instance (pk_test_…), reused from the NAVADA
 * Edge Portal. Dev instances accept any origin, so the Vercel URL works with
 * no domain configuration — ideal for UAT. Swap for a production instance
 * (pk_live_…) before the Capacitor App Store build.
 */
export const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_c2FjcmVkLW9zcHJleS01MC5jbGVyay5hY2NvdW50cy5kZXYk';

export const SSO_CALLBACK_PATH = '/sso-callback';
