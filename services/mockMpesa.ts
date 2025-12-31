import { Transaction, TransactionStatus, TransactionType } from '../types';
import { dbService, authService } from './mockFirebase';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Replace this with your actual Firebase Cloud Function URL after deployment
// e.g. 'https://us-central1-pesaflow-real-72e5f.cloudfunctions.net'
const BACKEND_API_URL = 'https://us-central1-pesaflow-real-72e5f.cloudfunctions.net';

interface StkPushParams {
  phoneNumber: string;
  amount: number;
  accountReference: string;
}

interface StkPushResponse {
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

// SIMULATION LOGIC (Fallback)
const simulateStkPush = async (params: StkPushParams): Promise<StkPushResponse> => {
  await delay(2000); 
  return {
    CheckoutRequestID: `ws_CO_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    ResponseCode: '0',
    ResponseDescription: 'Success. Request accepted for processing (SIMULATED)',
    CustomerMessage: 'Success. Request accepted for processing',
  };
};

export const mpesaService = {
  /**
   * Health Check
   * Checks if the real backend is reachable
   */
  checkConnection: async (): Promise<boolean> => {
    try {
      // We try to fetch from the backend. Even a 404 or 405 means the server is UP.
      // Network error means it's DOWN.
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000);
      
      // We ping the stkPush endpoint with a GET (which will fail with 405 Method Not Allowed, but that proves connectivity)
      const res = await fetch(`${BACKEND_API_URL}/stkPush`, { 
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(id);
      return true; // If we got a response (even an error response), the server exists.
    } catch (e) {
      return false; // Network error, server unreachable
    }
  },

  /**
   * INITIATE STK PUSH
   * Tries to call the real backend. If not found, falls back to simulation.
   */
  initiateStkPush: async (params: StkPushParams): Promise<StkPushResponse> => {
    if (!params.phoneNumber) throw new Error('Phone number is required');
    if (params.amount <= 0) throw new Error('Amount must be greater than 0.');

    try {
      // 1. Try hitting the real backend
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(`${BACKEND_API_URL}/stkPush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal
      });
      clearTimeout(id);

      if (!response.ok) {
        throw new Error(`Backend Error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.warn("Real M-Pesa Backend not reachable. Using Simulation Mode.", error);
      // Fallback to simulation for development/demo purposes
      return simulateStkPush(params);
    }
  },

  /**
   * CHECK STATUS
   * Tries to poll real status or simulates user input
   */
  checkTransactionStatus: async (checkoutRequestId: string): Promise<Transaction> => {
    // In a real app, you might poll an endpoint like `${BACKEND_API_URL}/queryStatus?id=${checkoutRequestId}`
    // For now, we simulate the async nature of the user entering their PIN on the phone.
    
    await delay(4000); // Waiting for user to enter PIN...

    // 90% Success Rate for Demo
    const isSuccess = Math.random() > 0.1;

    const newTransaction: Transaction = {
      id: checkoutRequestId,
      amount: 0, 
      type: TransactionType.DEPOSIT,
      status: isSuccess ? TransactionStatus.COMPLETED : TransactionStatus.FAILED,
      date: new Date().toISOString(),
      description: 'M-Pesa Express',
      phoneNumber: '2547XXXXXXXX',
      reference: `M${Math.floor(Math.random() * 1000000)}`,
    };

    return newTransaction;
  },

  /**
   * WITHDRAW (B2C)
   */
  withdrawToMobile: async (params: { phoneNumber: string; amount: number }): Promise<Transaction> => {
    if (!params.phoneNumber) throw new Error('Phone number is required');
    if (params.amount <= 0) throw new Error('Amount must be greater than 0');

    // In a real app, call `${BACKEND_API_URL}/b2cWithdraw`
    
    await delay(3000); 

    if (Math.random() < 0.05) throw new Error('M-Pesa service temporarily unavailable');

    return {
      id: `ws_B2C_${Date.now()}`,
      amount: params.amount,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.COMPLETED,
      date: new Date().toISOString(),
      description: 'Withdrawal to M-Pesa',
      phoneNumber: params.phoneNumber,
      reference: `W${Math.floor(Math.random() * 1000000)}`
    };
  },

  /**
   * Helper to complete the transaction in our local DB
   */
  completeTransaction: async (txn: Transaction, amount: number) => {
    const user = await authService.getCurrentUser();
    if (user && txn.status === TransactionStatus.COMPLETED) {
      const finalTxn = { ...txn, amount }; 
      await dbService.addTransaction(user.uid, finalTxn);
      return finalTxn;
    }
    return txn;
  }
};