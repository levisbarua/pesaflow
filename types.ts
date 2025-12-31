export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  balance: number;
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT', // M-Pesa -> App
  WITHDRAWAL = 'WITHDRAWAL', // App -> M-Pesa
  PAYMENT = 'PAYMENT',
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  date: string; // ISO string
  description: string;
  phoneNumber?: string;
  reference?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}