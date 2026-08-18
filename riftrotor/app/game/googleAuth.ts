import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

export type GooglePilot = {
  uid: string;
  displayName: string;
  email: string;
  photoUrl: string | null;
};

// This is the same public Firebase web configuration used by the existing
// dannysiudata.com game. Firebase API keys identify the client; authorization
// is enforced by Firebase Authentication and its authorized-domain settings.
const FIREBASE_APP_NAME = "rift-rotor";
const firebaseConfig = {
  apiKey: "AIzaSyAM-yGDbkDPLUdUI-NdHsCUm5vhlXG0Z3M",
  authDomain: "world-cup-league-2026.firebaseapp.com",
  projectId: "world-cup-league-2026",
  storageBucket: "world-cup-league-2026.firebasestorage.app",
  messagingSenderId: "253099908614",
  appId: "1:253099908614:web:782fd709ac8f7056fe6d87",
};

let authPromise: Promise<Auth> | null = null;

function getGameAuth(): Promise<Auth> {
  if (!authPromise) {
    authPromise = Promise.resolve().then(() => {
      const app = getApps().some((candidate) => candidate.name === FIREBASE_APP_NAME)
        ? getApp(FIREBASE_APP_NAME)
        : initializeApp(firebaseConfig, FIREBASE_APP_NAME);
      const auth = getAuth(app);
      auth.useDeviceLanguage();
      return auth;
    });
  }
  return authPromise;
}

function toGooglePilot(user: User | null): GooglePilot | null {
  if (!user || !user.email) return null;
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || user.email.split("@")[0],
    email: user.email,
    photoUrl: user.photoURL,
  };
}

export async function observeGooglePilot(
  listener: (pilot: GooglePilot | null) => void,
): Promise<() => void> {
  const auth = await getGameAuth();
  await getRedirectResult(auth);
  return onAuthStateChanged(auth, (user) => listener(toGooglePilot(user)));
}

export async function signInGooglePilot(): Promise<void> {
  const auth = await getGameAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
    if (
      code === "auth/popup-blocked" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutGooglePilot(): Promise<void> {
  await signOut(await getGameAuth());
}

export function googleAuthMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
  if (code === "auth/popup-closed-by-user") return "Sign-in was closed before it finished.";
  if (code === "auth/unauthorized-domain") return "Google sign-in is not enabled for this web address yet.";
  if (code === "auth/network-request-failed") return "Google sign-in could not reach the network.";
  return "Google sign-in is temporarily unavailable. Please try again.";
}
