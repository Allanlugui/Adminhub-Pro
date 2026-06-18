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

export interface Transaction {
  id?: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: any;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface InventoryItem {
  id?: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  lastRestocked: any;
}

export interface Task {
  id?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo: string;
  status: 'todo' | 'in_progress' | 'completed' | 'on_hold';
  dueDate: any;
  createdAt: any;
}

export interface ActivityLog {
  id?: string;
  type: 'hr' | 'finance' | 'inventory' | 'task';
  message: string;
  user: string;
  timestamp: any;
}
