/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as cloudDashboards from "../cloudDashboards.js";
import type * as invites from "../invites.js";
import type * as pairings from "../pairings.js";
import type * as teamKeys from "../teamKeys.js";
import type * as teams from "../teams.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  cloudDashboards: typeof cloudDashboards;
  invites: typeof invites;
  pairings: typeof pairings;
  teamKeys: typeof teamKeys;
  teams: typeof teams;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPasskey: import("@convex-dev/auth/components/passkey/_generated/component.js").ComponentApi<"authPasskey">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
  authApple: import("@convex-dev/auth/components/apple/_generated/component.js").ComponentApi<"authApple">;
  authGoogle: import("@convex-dev/auth/components/google/_generated/component.js").ComponentApi<"authGoogle">;
};
