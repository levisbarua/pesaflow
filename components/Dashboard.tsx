import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  CreditCard, 
  History, 
  LogOut, 
  Bell, 
  Menu, 
  X,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
  ChevronRight,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Check,
  ShieldCheck,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';
import { User, Transaction, TransactionType, TransactionStatus, Notification } from '../types';
import { dbService, authService } from '../services/mockFirebase';
import { mpesaService } from '../services/mockMpesa';
import { Button } from './Button';
import { Input } from './Input';
import { ReceiptModal } from './ReceiptModal';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user: initialUser, onLogout }) => {
  const [user, setUser] = useState(initialUser);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'history'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Connection State
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Payment Form State
  const [paymentMode, setPaymentMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [phone, setPhone] = useState('254');
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  
  // Receipt State
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  // Initial load
  useEffect(() => {
    refreshData();
    fetchNotifications();
    checkBackend();

    // Click outside handler for notifications
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [user.uid]);

  const checkBackend = async () => {
    const connected = await mpesaService.checkConnection();
    setIsConnected(connected);
  };

  const refreshData = async () => {
    setLoadingTxns(true);
    try {
      const data = await dbService.getTransactions(user.uid);
      setTransactions(data);
      // Also refresh user balance
      const updatedUser = await authService.getCurrentUser();
      if (updatedUser) setUser(updatedUser);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoadingTxns(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await dbService.getNotifications(user.uid);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    }
  };

  const handleMarkRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await dbService.markNotificationRead(user.uid, id);
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await dbService.markAllNotificationsRead(user.uid);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaying(true);
    setPaymentStatus('processing');
    setLastTransaction(null);
    
    try {
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) throw new Error('Invalid amount');

      let completedTxn: Transaction;

      if (paymentMode === 'withdraw') {
        if (numericAmount > user.balance) throw new Error('Insufficient funds');
        setStatusMessage('Processing withdrawal...');
        
        // 1. Simulate Withdrawal
        const txn = await mpesaService.withdrawToMobile({
          phoneNumber: phone,
          amount: numericAmount
        });

        // 2. Save to DB (dbService handles balance deduction for withdrawals)
        await dbService.addTransaction(user.uid, txn);
        completedTxn = txn;
        setStatusMessage('Withdrawal Successful!');

      } else {
        // Deposit Logic
        setStatusMessage('Initiating STK Push...');
        
        // 1. Initiate STK Push
        const response = await mpesaService.initiateStkPush({
          phoneNumber: phone,
          amount: numericAmount,
          accountReference: 'PesaFlow Wallet'
        });

        setStatusMessage('Check your phone to enter PIN...');
        
        // 2. Poll for status
        const txn = await mpesaService.checkTransactionStatus(response.CheckoutRequestID);
        
        if (txn.status === TransactionStatus.COMPLETED) {
          // 3. Complete and persist to DB
          await mpesaService.completeTransaction(txn, numericAmount);
          completedTxn = { ...txn, amount: numericAmount };
          setStatusMessage('Payment Successful!');
        } else {
          throw new Error('Transaction failed or cancelled');
        }
      }

      setLastTransaction(completedTxn);
      setPaymentStatus('success');
      setAmount('');
      refreshData();
      fetchNotifications();

    } catch (err: any) {
      setPaymentStatus('error');
      setStatusMessage(err.message || 'Transaction failed');
    } finally {
      setPaying(false);
    }
  };

  const SidebarItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setMobileMenuOpen(false);
      }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        activeTab === id 
          ? 'bg-mpesa-50 text-mpesa-700 font-medium' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <Icon className={`w-5 h-5 ${activeTab === id ? 'text-mpesa-600' : 'text-gray-400'}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Receipt Modal */}
      <ReceiptModal 
        transaction={selectedTransaction} 
        onClose={() => setSelectedTransaction(null)} 
      />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-gray-800 bg-opacity-50 lg:hidden" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            <div className="flex items-center space-x-2 font-bold text-xl text-gray-900">
              <div className="w-8 h-8 rounded bg-mpesa-600 flex items-center justify-center text-white">P</div>
              <span>PesaFlow</span>
            </div>
            <button className="ml-auto lg:hidden" onClick={() => setMobileMenuOpen(false)}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            <SidebarItem id="overview" icon={LayoutDashboard} label="Overview" />
            <SidebarItem id="payments" icon={CreditCard} label="Payments" />
            <SidebarItem id="history" icon={History} label="Transactions" />
          </div>

          <div className="p-4 border-t border-gray-100 space-y-4">
             {/* System Status Indicator */}
            <div className={`rounded-lg p-3 flex items-center space-x-3 text-xs border ${
              isConnected === true ? 'bg-green-50 border-green-200 text-green-700' : 
              isConnected === false ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500'
            }`}>
              <div className="relative">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected === true ? 'bg-green-500' : 
                  isConnected === false ? 'bg-orange-500' : 'bg-gray-400'
                }`}></div>
                {isConnected && <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-green-500 animate-ping"></div>}
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {isConnected === true ? 'System Online' : 
                   isConnected === false ? 'Demo Mode' : 'Checking...'}
                </p>
                <p className="opacity-80">
                  {isConnected === true ? 'Real M-Pesa Connected' : 
                   isConnected === false ? 'Simulated Backend' : 'Connecting to Server'}
                </p>
              </div>
              {isConnected === true ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>

            <div className="flex items-center space-x-3 px-2">
               <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full bg-gray-200" />
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                 <p className="text-xs text-gray-500 truncate">{user.email}</p>
               </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 relative z-20">
          <button className="lg:hidden p-2 text-gray-500" onClick={() => setMobileMenuOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center space-x-4 ml-auto" ref={notificationRef}>
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-full transition-colors relative ${showNotifications ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden ring-1 ring-black ring-opacity-5">
                  <div className="px-4 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={handleMarkAllRead} 
                        className="text-xs text-mpesa-600 hover:text-mpesa-700 font-medium hover:underline flex items-center"
                      >
                        <Check className="w-3 h-3 mr-1" /> Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[24rem] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            onClick={() => handleMarkRead(notif.id)}
                            className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer group ${notif.read ? 'opacity-60 bg-white' : 'bg-blue-50/30'}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${notif.read ? 'bg-transparent' : 'bg-mpesa-500'}`}></div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${notif.read ? 'text-gray-700 font-medium' : 'text-gray-900 font-semibold'}`}>
                                  {notif.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                                <p className="text-[10px] text-gray-400 mt-1.5">
                                  {new Date(notif.date).toLocaleDateString()} {new Date(notif.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-8">
            
            {/* Overview Section */}
            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Balance Card */}
                  <div className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-gray-400 text-sm font-medium mb-1">Total Balance</p>
                          <h3 className="text-4xl font-bold tracking-tight">KES {user.balance.toLocaleString()}</h3>
                        </div>
                        <div className="p-2 bg-white bg-opacity-10 rounded-lg">
                          <Wallet className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="mt-8 flex space-x-4">
                        <button 
                          onClick={() => {
                            setPaymentMode('deposit');
                            setActiveTab('payments');
                            setPaymentStatus('idle');
                          }}
                          className="flex-1 bg-mpesa-500 hover:bg-mpesa-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                          <span>Top Up</span>
                        </button>
                        <button 
                          onClick={() => {
                            setPaymentMode('withdraw');
                            setActiveTab('payments');
                            setPaymentStatus('idle');
                          }}
                          className="flex-1 bg-white bg-opacity-10 hover:bg-opacity-20 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 backdrop-blur-sm"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                          <span>Withdraw</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Payment Teaser */}
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-center">
                     <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <Smartphone className="w-6 h-6 text-green-600" />
                     </div>
                     <h3 className="text-lg font-bold text-gray-900">Lipa na M-Pesa</h3>
                     <p className="text-gray-500 text-sm mt-1 mb-4">Quickly pay bills or top up your account directly from your phone.</p>
                     <Button variant="outline" onClick={() => {
                        setPaymentMode('deposit');
                        setActiveTab('payments');
                     }}>
                        Go to Payments
                     </Button>
                  </div>
                </div>

                {/* Recent Transactions Preview */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
                    <button 
                      onClick={() => setActiveTab('history')}
                      className="text-sm text-mpesa-600 hover:text-mpesa-700 font-medium flex items-center"
                    >
                      View All <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {loadingTxns ? (
                       <div className="p-8 text-center text-gray-500">Loading...</div>
                    ) : transactions.slice(0, 3).map((txn) => (
                      <div 
                        key={txn.id} 
                        onClick={() => setSelectedTransaction(txn)}
                        className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            txn.type === TransactionType.DEPOSIT ? 'bg-green-100 text-green-600' : 
                            txn.type === TransactionType.WITHDRAWAL ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {txn.type === TransactionType.DEPOSIT ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{txn.description}</p>
                            <p className="text-xs text-gray-500">{new Date(txn.date).toLocaleDateString()} • {txn.status}</p>
                          </div>
                        </div>
                        <span className={`font-semibold ${
                           txn.type === TransactionType.DEPOSIT ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {txn.type === TransactionType.DEPOSIT ? '+' : '-'} KES {txn.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Payments Section */}
            {activeTab === 'payments' && (
              <div className="max-w-xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className={`p-6 text-white text-center transition-colors ${paymentMode === 'deposit' ? 'bg-mpesa-600' : 'bg-gray-800'}`}>
                    <h2 className="text-2xl font-bold">
                      {paymentMode === 'deposit' ? 'M-Pesa Express' : 'Withdraw to M-Pesa'}
                    </h2>
                    <p className="text-white/80 mt-1">
                      {paymentMode === 'deposit' ? 'Secure STK Push to your phone' : 'Instant transfer to your mobile wallet'}
                    </p>
                  </div>
                  
                  {/* Mode Toggles */}
                  <div className="flex border-b border-gray-200">
                     <button 
                        onClick={() => { setPaymentMode('deposit'); setPaymentStatus('idle'); }}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${paymentMode === 'deposit' ? 'text-mpesa-600 border-b-2 border-mpesa-600 bg-mpesa-50' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                        Deposit
                     </button>
                     <button 
                        onClick={() => { setPaymentMode('withdraw'); setPaymentStatus('idle'); }}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${paymentMode === 'withdraw' ? 'text-gray-800 border-b-2 border-gray-800 bg-gray-50' : 'text-gray-500 hover:text-gray-700'}`}
                     >
                        Withdraw
                     </button>
                  </div>

                  <div className="p-8">
                    {paymentStatus === 'success' ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{paymentMode === 'deposit' ? 'Payment Successful!' : 'Withdrawal Successful!'}</h3>
                        <p className="text-gray-500 mb-6">Your transaction has been processed.</p>
                        <Button onClick={() => {
                          setPaymentStatus('idle');
                          if (lastTransaction) setSelectedTransaction(lastTransaction);
                        }}>
                          View Receipt
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleTransactionSubmit} className="space-y-6">
                         <div className={`border rounded-lg p-4 text-sm ${paymentMode === 'deposit' ? 'bg-yellow-50 border-yellow-100 text-yellow-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                            {paymentMode === 'deposit' 
                              ? <span>
                                  <strong>{isConnected ? 'Live Mode:' : 'Demo Mode:'}</strong> 
                                  {isConnected 
                                    ? ' Enter real M-Pesa phone number. You will receive a real STK Push on your phone.' 
                                    : ' Backend not found. Simulating successful payment.'}
                                </span>
                              : <span><strong>Balance:</strong> KES {user.balance.toLocaleString()}. You cannot withdraw more than this.</span>
                            }
                         </div>

                        <Input
                          label="Phone Number"
                          placeholder="254712345678"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          icon={<Smartphone className="w-5 h-5" />}
                          required
                          type="tel"
                        />
                        
                        <Input
                          label="Amount (KES)"
                          placeholder="e.g. 500"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                          type="number"
                          min="1"
                        />

                        {paymentStatus === 'error' && (
                          <div className="text-red-600 text-sm text-center font-medium">
                            {statusMessage}
                          </div>
                        )}
                        
                        {paymentStatus === 'processing' && (
                          <div className={`${paymentMode === 'deposit' ? 'text-mpesa-600' : 'text-gray-700'} text-sm text-center font-medium animate-pulse`}>
                            {statusMessage}
                          </div>
                        )}

                        <Button 
                          type="submit" 
                          fullWidth 
                          className={`h-12 text-lg ${paymentMode === 'withdraw' ? 'bg-gray-800 hover:bg-gray-900' : ''}`}
                          isLoading={paying}
                          disabled={!amount || !phone}
                        >
                          {paying 
                            ? 'Processing...' 
                            : (paymentMode === 'deposit' ? 'Pay Now' : 'Withdraw Funds')
                          }
                        </Button>
                      </form>
                    )}
                  </div>
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-500 flex items-center justify-center">
                      <ShieldCheck className="w-3 h-3 mr-1" /> 
                      Secured by PesaFlow Encryption
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* History Section */}
            {activeTab === 'history' && (
               <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="font-semibold text-gray-900">Transaction History</h2>
                    <Button variant="outline" size="sm" onClick={refreshData} disabled={loadingTxns}>
                      <RefreshCw className={`w-4 h-4 ${loadingTxns ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3">Reference</th>
                          <th className="px-6 py-3">Description</th>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.map((txn) => (
                          <tr 
                            key={txn.id} 
                            onClick={() => setSelectedTransaction(txn)}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-4 font-mono text-xs text-gray-500">{txn.id.substring(0, 16)}...</td>
                            <td className="px-6 py-4 font-medium text-gray-900">{txn.description}</td>
                            <td className="px-6 py-4">{new Date(txn.date).toLocaleDateString()} {new Date(txn.date).toLocaleTimeString()}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                txn.status === TransactionStatus.COMPLETED ? 'bg-green-100 text-green-800' :
                                txn.status === TransactionStatus.FAILED ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {txn.status}
                              </span>
                            </td>
                            <td className={`px-6 py-4 text-right font-semibold ${
                              txn.type === TransactionType.DEPOSIT ? 'text-green-600' : 'text-gray-900'
                            }`}>
                              {txn.type === TransactionType.DEPOSIT ? '+' : '-'} {txn.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {transactions.length === 0 && !loadingTxns && (
                      <div className="p-12 text-center text-gray-500">
                        No transactions found.
                      </div>
                    )}
                  </div>
               </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};