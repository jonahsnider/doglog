import { ConvexReactClient } from 'convex/react';

const url = import.meta.env.VITE_CONVEX_URL;
export const cloudDeploymentUrl = url === '' ? undefined : url;
// Connects the first time it's used, so signed-out users don't connect to Cloud
export const cloudClient = cloudDeploymentUrl === undefined ? undefined : new ConvexReactClient(cloudDeploymentUrl);

/** The website the desktop app uses to sign in to Cloud through the browser. */
export const studioWebsiteOrigin = import.meta.env.DEV ? 'https://doglog.studio.localhost' : 'https://doglog.studio';
