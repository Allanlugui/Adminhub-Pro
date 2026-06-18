import { db, auth } from './firebase.ts';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditLog } from '../types.ts';

/**
 * Enterprise Audit Engine
 * Logs every critical mutation for compliance and security traceability.
 */
export async function logAudit(
  action: AuditLog['action'],
  resource: AuditLog['resource'],
  resourceId: string,
  changes?: AuditLog['changes']
) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'auditLogs'), {
      userId: user?.uid || 'system',
      userName: user?.displayName || user?.email || 'System',
      action,
      resource,
      resourceId,
      changes: changes || {},
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Audit Logging failed:', error);
    // In enterprise systems, audit failures should ideally be handled strictly.
  }
}
