import { Transaction, TransactionStatus, TransactionType } from '../types';
import { db } from './firebase';
import { doc, setDoc, updateDoc, increment, collection, addDoc } from 'firebase/firestore';

// --- CONFIGURATION ---
// 1. DEVELOPMENT: Use "http://localhost:5000"
// 2. PRODUCTION (Render): Replace this string with your actual Render URL (e.g., "https://my-app.onrender.com")
const BACKEND_API_URL = "http://localhost:5000"; 

interface StkPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  userId: string;
}

interface StkPushResponse {
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export const mpesaService = {
  /**
   * Health Check
   */
  checkConnection: async (): Promise<boolean> => {
    const targetUrl = `${BACKEND_API_URL}/ping`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      console.log(`Checking connection to: ${targetUrl}`);
      const response = await fetch(targetUrl, { 
        signal: controller.signal,
        method: 'GET' 
      });
      clearTimeout(timeoutId);
      
      return response.ok;
    } catch (e) {
      console.warn(`Backend unreachable at ${targetUrl}. Is the server running?`);
      return false;
    }
  },

  /**
   * INITIATE STK PUSH (REAL)
   */
  initiateStkPush: async (params: StkPushParams): Promise<StkPushResponse> => {
    if (!params.phoneNumber) throw new Error('Phone number is required');
    if (params.amount <= 0) throw new Error('Amount must be greater than 0.');
    if (!params.userId) throw new Error('User ID is required');

    try {
      // Call our External Node Server
      const response = await fetch(`${BACKEND_API_URL}/stkPush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        return await response.json();
      } else {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Payment Request Failed: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error("STK Push Network Error:", error.message);
      
      if (error.message.includes("Failed to fetch")) {
        throw new Error(`Could not connect to server at ${BACKEND_API_URL}. Ensure it is running/deployed.`);
      }
      throw error;
    }
  },

  /**
   * WITHDRAW
   */
  withdrawToMobile: async (params: { phoneNumber: string; amount: number; userId: string }): Promise<Transaction> => {
      // Mock withdrawal
      const txnId = `WID-${Date.now()}`;
      
      const newTxn: Transaction = {
          id: txnId,
          amount: params.amount,
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.COMPLETED,
          date: new Date().toISOString(),
          description: 'Withdrawal to M-Pesa',
          phoneNumber: params.phoneNumber,
          reference: 'Ref-' + Math.floor(Math.random() * 10000)
      };

      await setDoc(doc(db, 'transactions', txnId), { ...newTxn, userId: params.userId });
      
      await updateDoc(doc(db, 'users', params.userId), {
          balance: increment(-params.amount)
      });

      return newTxn;
  }
};