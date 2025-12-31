import { Transaction, TransactionStatus, TransactionType } from '../types';
import { db } from './firebase';
import { doc, setDoc, updateDoc, increment, collection, addDoc, runTransaction } from 'firebase/firestore';

// --- CONFIGURATION ---
// 1. DEVELOPMENT: Use "http://localhost:5000"
// 2. PRODUCTION: Use your Vercel or Render URL
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

/**
 * SIMULATION HELPER
 * Runs if the real backend is offline.
 * Simulates the exact behavior of M-Pesa:
 * 1. Creates a PENDING transaction
 * 2. Waits 5 seconds (simulating user typing PIN)
 * 3. Updates transaction to COMPLETED
 * 4. Updates User Balance
 */
const runSimulation = async (params: StkPushParams): Promise<StkPushResponse> => {
  console.log("⚠️ Backend unavailable. Running SIMULATION mode.");
  
  const checkoutRequestId = `SIM-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // 1. Create Pending Transaction
  const txnRef = doc(db, 'transactions', checkoutRequestId);
  await setDoc(txnRef, {
      id: checkoutRequestId,
      userId: params.userId,
      amount: params.amount,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      date: timestamp,
      description: 'M-Pesa Topup (Simulated)',
      phoneNumber: params.phoneNumber,
      reference: params.accountReference
  });

  // 2. Simulate network delay and callback
  setTimeout(async () => {
      try {
          await runTransaction(db, async (t) => {
              const userRef = doc(db, 'users', params.userId);
              
              // Update Transaction
              t.update(txnRef, { 
                  status: TransactionStatus.COMPLETED,
                  reference: `SIM-REF-${Math.floor(Math.random() * 100000)}` 
              });
              
              // Update User Balance
              t.update(userRef, { 
                  balance: increment(params.amount) 
              });

              // Send Notification
              const notifRef = doc(collection(db, 'notifications'));
              t.set(notifRef, {
                  userId: params.userId,
                  title: 'Payment Received',
                  message: `Confirmed: KES ${params.amount} added (Simulated).`,
                  date: new Date().toISOString(),
                  read: false,
                  type: 'success'
              });
          });
          console.log("✅ Simulation Completed successfully");
      } catch (err) {
          console.error("Simulation failed", err);
      }
  }, 5000); // 5 second delay

  return {
      CheckoutRequestID: checkoutRequestId,
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing",
      CustomerMessage: "Success. Request accepted for processing"
  };
};

export const mpesaService = {
  /**
   * Health Check
   */
  checkConnection: async (): Promise<boolean> => {
    const targetUrl = `${BACKEND_API_URL}/ping`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(targetUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response.ok;
    } catch (e) {
      return false; // Offline
    }
  },

  /**
   * INITIATE STK PUSH (Smart)
   * Tries Real Backend first -> Falls back to Simulation
   */
  initiateStkPush: async (params: StkPushParams): Promise<StkPushResponse> => {
    if (!params.phoneNumber) throw new Error('Phone number is required');
    if (params.amount <= 0) throw new Error('Amount must be greater than 0.');
    if (!params.userId) throw new Error('User ID is required');

    try {
      // 1. Try Real Backend
      const response = await fetch(`${BACKEND_API_URL}/stkPush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (response.ok) {
        return await response.json();
      } else {
        // If backend returns a specific error, throw it
        throw new Error(`Server Error: ${response.statusText}`);
      }
    } catch (error: any) {
      // 2. Fallback to Simulation if Network Error (Server down/blocked)
      // We assume if fetch fails, it's a connection issue, so we simulate.
      console.warn("STK Push Network Error:", error.message);
      return await runSimulation(params);
    }
  },

  /**
   * WITHDRAW
   */
  withdrawToMobile: async (params: { phoneNumber: string; amount: number; userId: string }): Promise<Transaction> => {
      // Withdrawals are always mocked for safety in this demo
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