export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface PermissionMatrix {
  finance?: { view: boolean; approve: boolean; delete: boolean; };
  inventory?: { view: boolean; adjust: boolean; delete: boolean; };
  hr?: { view: boolean; manage: boolean; };
  tickets?: { view: boolean; resolve: boolean; admin: boolean; };
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  status: 'active' | 'disabled';
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
  permissions?: PermissionMatrix;
  lastLogin?: any;
  lastIp?: string;
  userAgent?: string;
  createdAt: any;
}

export interface Employee {
  id?: string;
  name: string;
  role: string;
  departmentId: string;
  departmentName: string;
  reportsTo?: string; // Employee ID
  email: string;
  phone?: string;
  documentId?: string; // CPF/RG/ID
  address?: string;
  salary: number;
  benefits?: {
    healthPlan: boolean;
    dentalPlan: boolean;
    mealVoucher: number;
    transportVoucher: boolean;
  };
  status: 'active' | 'on_leave' | 'onboarding' | 'terminated';
  hiredAt: any;
  terminatedAt?: any;
  birthDate?: any;
  performanceScore?: number; // 0-100
  history?: {
    date: any;
    event: string;
    description: string;
  }[];
}

export interface Department {
  id: string;
  name: string;
  parentDeptId?: string;
  headId?: string; // Employee ID
}

export interface LeaveRequest {
  id?: string;
  employeeId: string;
  employeeName: string;
  type: 'vacation' | 'sick_leave' | 'maternity_paternity' | 'other';
  startDate: any;
  endDate: any;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

export interface PerformanceReview {
  id?: string;
  employeeId: string;
  reviewerId: string;
  date: any;
  score: number;
  feedback: string;
  competencies: {
    technical: number;
    soft_skills: number;
    leadership?: number;
    productivity: number;
  };
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
  description?: string;
  dueDate?: any;
  paidAt?: any;
  bankData?: {
    bank: string;
    agency: string;
    account: string;
    pix?: string;
  };
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
  supplier?: string;
}

export interface Asset extends InventoryItem {
  serialNumber?: string;
  assignedTo?: string; // Employee Name
  assignedToId?: string; // Employee ID linked to HR
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

export interface TicketInteraction {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
  type: 'public' | 'internal';
}

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
  slaTarget?: any;
  linkedAssetId?: string;
  linkedAssetName?: string;
  linkedTransactionId?: string;
  linkedTransactionAmount?: number;
}

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'upload' | 'transfer' | 'login' | 'logout' | 'failed_login' | 'settings_update';
  resource: 'employees' | 'transactions' | 'inventory' | 'tickets' | 'users' | 'hr_leaves' | 'auth' | 'settings';
  resourceId: string;
  changes?: {
    before?: any;
    after?: any;
  };
  timestamp: any;
}

export interface SystemSettings {
  companyName: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
  security: {
    strongPassword: boolean;
    sessionTimeout: number; // in hours
    requireMfaForAdmins: boolean;
  };
  retention: {
    auditLogs: number; // in years
    backups: number; // in days
  };
  integrations?: {
    adminHubApiKey: string;
    nexusBaseUrl: string;
    nexusApiKey: string;
  };
  lastBackupAt?: any;
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
