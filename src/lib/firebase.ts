import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const dbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
console.log(`🔥 Client: Initializing Firestore with Database ID: ${dbId}`);
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
}, dbId);
export const auth = getAuth(app);
