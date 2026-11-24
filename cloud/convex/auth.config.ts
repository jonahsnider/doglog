import { convexAuthProvider } from '@convex-dev/auth/server';
import type { AuthConfig } from 'convex/server';

export default { providers: [convexAuthProvider()] } satisfies AuthConfig;
