export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  status: 'active' | 'disabled';
  mustChangePassword?: boolean;
  createdAt: any;
}

export interface Employee {
  id?: string;
  name: string;
  role: string;
  department: string;
  email: string;
  salary: number;
  status: 'active' | 'on_leave' | 'terminated';
  hiredAt: any;
}

export type TransactionStatus = 'pending_approval' | 'approved' | 'paid' | 'cancelled' | 'void';

export interface Transaction {
  id?: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  costCenter: string;
  date: any;
  status: TransactionStatus;
  isRecurring: boolean;
  attachmentUrl?: string; // Metadata for secure storage
  requestedBy: string;
  approvedBy?: string;
}

export interface InventoryItem {
  id?: string;
  name: string;
  sku: string;
  quantity: number;
  minQuantity: number; // For low stock alerts
  unitPrice: number;
  category: string;
  type: 'consumable' | 'asset'; 
  location: string;
  lastRestockedAt: any;
  status: 'available' | 'low_stock' | 'out_of_stock';
}

export interface Asset extends InventoryItem {
  serialNumber?: string;
  assignedTo?: string; // Employee ID or Name
  condition: 'new' | 'good' | 'fair' | 'poor' | 'broken';
  acquisitionDate: any;
  warrantyExpiration?: any;
}

export interface StockMovement {
  id?: string;
  itemId: string;
  itemName: string;
  quantity: number; // Positive for entry, negative for exit
  reason: 'purchase' | 'adjustment' | 'ticket_fulfillment' | 'disposal' | 'transfer';
  ticketProtocol?: string; // Optional link to a Ticket
  performedBy: string;
  performedById: string;
  timestamp: any;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketCategory = 'Maintenance' | 'Purchasing' | 'HR' | 'IT' | 'General' | 'System';

export interface Ticket {
  id?: string;
  protocol: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requesterId: string;
  requesterName: string;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: any;
  updatedAt: any;
  closedAt?: any;
}

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'upload';
  resource: 'employees' | 'transactions' | 'inventory' | 'tickets' | 'users';
  resourceId: string;
  changes?: {
    before?: any;
    after?: any;
  };
  timestamp: any;
}

export interface ActivityLog {
  id?: string;
  type: string;
  message: string;
  user: string;
  timestamp: any;
}

export interface AppNotification {
  id?: string;
  userId?: string;
  role?: UserRole;
  title: string;
  message: string;
  type: 'finance' | 'ticket' | 'system';
  link?: string;
  read: boolean;
  createdAt: any;
}
