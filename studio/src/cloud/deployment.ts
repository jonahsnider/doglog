import { ConvexReactClient } from 'convex/react';

// Connects the first time it's used, so signed-out users don't connect to Cloud
export const cloudClient = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

/** The website the desktop app uses to sign in to Cloud through the browser. */
export const studioWebsiteOrigin = import.meta.env.DEV ? 'https://doglog.studio.localhost' : 'https://doglog.studio';
