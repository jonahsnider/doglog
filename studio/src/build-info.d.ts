/** Studio's version from `package.json`, replaced at build time */
declare const STUDIO_VERSION: string;
/** Short hash of the commit Studio was built from, replaced at build time */
declare const STUDIO_COMMIT: string | null;
/** Whether Vite is targeting the desktop app */
declare const STUDIO_DESKTOP: boolean;

interface ImportMetaEnv {
	readonly VITE_DOGLOG_LOCAL_PREVIEW?: string;
}
