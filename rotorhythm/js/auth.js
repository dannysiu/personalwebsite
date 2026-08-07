const FIREBASE_APP_NAME = 'rotorhythm-neon-airwaves';
const firebaseConfig = {
  apiKey: 'AIzaSyAM-yGDbkDPLUdUI-NdHsCUm5vhlXG0Z3M',
  authDomain: 'world-cup-league-2026.firebaseapp.com',
  projectId: 'world-cup-league-2026',
  storageBucket: 'world-cup-league-2026.firebasestorage.app',
  messagingSenderId: '253099908614',
  appId: '1:253099908614:web:782fd709ac8f7056fe6d87'
};

let modulesPromise;
let authPromise;

async function modules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js')
    ]).then(([app, auth]) => ({ app, auth }));
  }
  return modulesPromise;
}

async function getGameAuth() {
  if (!authPromise) authPromise = modules().then(({ app, auth }) => {
    const firebaseApp = app.getApps().some(candidate => candidate.name === FIREBASE_APP_NAME)
      ? app.getApp(FIREBASE_APP_NAME)
      : app.initializeApp(firebaseConfig, FIREBASE_APP_NAME);
    const instance = auth.getAuth(firebaseApp);
    instance.useDeviceLanguage();
    return instance;
  });
  return authPromise;
}

function toPlayer(user) {
  if (!user?.email) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName?.trim() || user.email.split('@')[0] };
}

export async function observeGooglePlayer(listener) {
  const [{ auth }, instance] = await Promise.all([modules(), getGameAuth()]);
  await auth.getRedirectResult(instance);
  return auth.onAuthStateChanged(instance, user => listener(toPlayer(user)));
}

export async function signInGooglePlayer() {
  const [{ auth }, instance] = await Promise.all([modules(), getGameAuth()]);
  const provider = new auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await auth.signInWithPopup(instance, provider);
  } catch (error) {
    const code = String(error?.code || '');
    if (['auth/popup-blocked','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].includes(code)) {
      await auth.signInWithRedirect(instance, provider);
      return;
    }
    throw error;
  }
}

export async function signOutGooglePlayer() {
  const [{ auth }, instance] = await Promise.all([modules(), getGameAuth()]);
  await auth.signOut(instance);
}

export function googleAuthMessage(error) {
  const code = String(error?.code || '');
  if (code === 'auth/popup-closed-by-user') return 'Sign-in was closed before it finished.';
  if (code === 'auth/unauthorized-domain') return 'Google sign-in is not enabled for this web address yet.';
  if (code === 'auth/network-request-failed') return 'Google sign-in could not reach the network.';
  return 'Google sign-in is temporarily unavailable. Please try again.';
}
