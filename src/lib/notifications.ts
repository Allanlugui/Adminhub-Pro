import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserRole } from '../types';

export async function pushNotification(data: {
  userId?: string;
  role?: UserRole;
  title: string;
  message: string;
  type: 'finance' | 'ticket' | 'system';
  link?: string;
}) {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Notification Error:", error);
  }
}
