import React from 'react';
import { X, CheckCircle2, Download, Share2, AlertOctagon } from 'lucide-react';
import { Transaction, TransactionStatus, TransactionType } from '../types';
import { Button } from './Button';

interface ReceiptModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const isDeposit = transaction.type === TransactionType.DEPOSIT;
  const isSuccess = transaction.status === TransactionStatus.COMPLETED;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Background Overlay */}
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" 
          aria-hidden="true" 
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal Panel */}
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 relative">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${isSuccess ? 'bg-green-100' : 'bg-red-100'} mb-4`}>
                {isSuccess ? (
                  <CheckCircle2 className={`h-8 w-8 ${isSuccess ? 'text-green-600' : 'text-red-600'}`} />
                ) : (
                  <AlertOctagon className="h-8 w-8 text-red-600" />
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-900" id="modal-title">
                {isSuccess ? 'Transaction Successful' : 'Transaction Failed'}
              </h3>
              
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {new Date(transaction.date).toLocaleDateString()} at {new Date(transaction.date).toLocaleTimeString()}
                </p>
              </div>

              <div className="mt-6 w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                <p className={`text-3xl font-bold ${isDeposit ? 'text-green-600' : 'text-gray-900'}`}>
                  KES {transaction.amount.toLocaleString()}
                </p>
              </div>

              <div className="w-full mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Reference ID</span>
                  <span className="font-mono font-medium text-gray-900">{transaction.id.substring(0, 16)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium text-gray-900 capitalize">{transaction.type.toLowerCase()}</span>
                </div>
                {transaction.phoneNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Phone Number</span>
                    <span className="font-medium text-gray-900">{transaction.phoneNumber}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
            <Button fullWidth onClick={onClose}>
              Close Receipt
            </Button>
            {isSuccess && (
              <button className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mpesa-500 sm:mt-0 sm:w-auto sm:text-sm items-center gap-2">
                <Download className="w-4 h-4" />
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};