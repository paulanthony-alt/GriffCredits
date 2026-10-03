import type { FirebaseOptions } from "firebase/app";

export const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

export const firebaseConfig: FirebaseOptions = useEmulators
  ? // The emulators accept any values; "demo-" projects never touch real resources.
    { apiKey: "demo-key", authDomain: "localhost", projectId: "demo-griff-credits", appId: "demo-app" }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

/** False when the app was built without Firebase settings (see SETUP.md). */
export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
