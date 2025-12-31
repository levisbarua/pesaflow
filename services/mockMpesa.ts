import { Transaction, TransactionStatus, TransactionType } from '../types';
import { dbService, authService } from './mockFirebase';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// =============================================================================
// REAL MPESA INTEGRATION NOTES
// =============================================================================
/*
  To integrate M-Pesa properly, you cannot call the Safaricom API directly from the browser 
  due to CORS policies and security (exposing Consumer Key/Secret).
  
  You must set up a backend endpoint (e.g., Firebase Cloud Functions, Node.js, Python).
  
  Client -> Your Backend -> Safaricom API
  
  1. Client sends phone & amount to Your Backend.
  2. Your Backend generates OAuth Token from Safaricom.
  3. Your Backend sends STK Push request to Safaricom.
  4. Safaricom processes and calls your Callback URL.
*/

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

export const mpesaService = {
  /**
   * Simulates an M-Pesa STK Push
   */
  initiateStkPush: async (params: StkPushParams): Promise<StkPushResponse> => {
    await delay(2000); // Simulate network

    /* 
    // REAL IMPLEMENTATION EXAMPLE:
    const response = await fetch('https://your-api.com/api/v1/mpesa/stkpush', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    return await response.json();
    */

    // Basic validation
    if (!params.phoneNumber) {
      throw new Error('Phone number is required');
    }

    if (params.amount <= 0) {
      throw new Error('Amount must be greater than 0.');
    }

    return {
      CheckoutRequestID: `ws_CO_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      ResponseCode: '0',
      ResponseDescription: 'Success. Request accepted for processing',
      CustomerMessage: 'Success. Request accepted for processing',
    };
  },

  /**
   * Simulates polling for payment status
   */
  checkTransactionStatus: async (checkoutRequestId: string): Promise<Transaction> => {
    await delay(4000); // Simulate user entering PIN

    /* 
    // REAL IMPLEMENTATION: Poll your own backend to check if Callback was received
    const response = await fetch(`https://your-api.com/api/v1/mpesa/status/${checkoutRequestId}`);
    */

    // Demo: 90% Success Rate
    const isSuccess = Math.random() > 0.1;

    const newTransaction: Transaction = {
      id: checkoutRequestId,
      amount: 0, // Will be filled by the caller usually, but here we mock it or need to pass it
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
   * Simulates B2C Withdrawal (Withdraw to Mobile)
   */
  withdrawToMobile: async (params: { phoneNumber: string; amount: number }): Promise<Transaction> => {
    await delay(3000); // Simulate processing time

    if (!params.phoneNumber) throw new Error('Phone number is required');
    if (params.amount <= 0) throw new Error('Amount must be greater than 0');

    // Random failure chance (low)
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
      const finalTxn = { ...txn, amount }; // Ensure amount is correct
      await dbService.addTransaction(user.uid, finalTxn);
      return finalTxn;
    }
    return txn;
  }
};