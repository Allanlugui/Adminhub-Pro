import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA90SNwmX52RmRY94ZsZAEw74W1mxmTZkc",
  authDomain: "escolabiblica-9c8cc.firebaseapp.com",
  projectId: "escolabiblica-9c8cc",
  storageBucket: "escolabiblica-9c8cc.firebasestorage.app",
  messagingSenderId: "87598436483",
  appId: "1:87598436483:web:42b2996f17634463e08bb6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "ai-studio-141427a9-4e9e-469b-9bbc-3dbd9668da97");
export const auth = getAuth(app);
