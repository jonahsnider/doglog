import { ConvexReactClient } from 'convex/react';

const url = import.meta.env.VITE_CONVEX_URL;
export const cloudDeploymentUrl = !STUDIO_DESKTOP && url !== '' ? url : undefined;
// Connects the first time it's used, so signed-out users don't connect to Cloud
export const cloudClient = cloudDeploymentUrl === undefined ? undefined : new ConvexReactClient(cloudDeploymentUrl);
