import auth from '@convex-dev/auth/convex.config.js';
import passkey from '@convex-dev/auth/components/passkey/convex.config.js';
import username from '@convex-dev/auth/components/username/convex.config.js';
import { defineApp } from 'convex/server';
import { v } from 'convex/values';

const app = defineApp({ env: { STUDIO_ORIGIN: v.string() } });

app.use(auth);
app.use(passkey);
app.use(username);

export default app;
