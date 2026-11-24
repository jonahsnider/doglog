import { ConvexReactClient } from 'convex/react';

const url = import.meta.env.VITE_CONVEX_URL;
export const cloudDeploymentUrl = url === '' ? undefined : url;
// Connects the first time it's used, so signed-out users don't connect to Cloud
export const cloudClient = cloudDeploymentUrl === undefined ? undefined : new ConvexReactClient(cloudDeploymentUrl);

/** Studio's website, where Cloud's passkeys and Apple sign-in work. The desktop app signs in through it. */
export const studioWebsiteOrigin = import.meta.env.DEV ? 'https://doglog.studio.localhost' : 'https://doglog.studio';
