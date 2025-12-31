import { User, Transaction, TransactionType, Notification } from '../types';

// =============================================================================
// REAL FIREBASE CONFIGURATION (Uncomment and fill to go live)
// =============================================================================
/*
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  // ... your config
};

// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getFirestore(app);
*/

// =============================================================================
// FUNCTIONAL LOCAL STORAGE IMPLEMENTATION (Works immediately)
// =============================================================================

const STORAGE_KEYS = {
  USER: 'pesaflow_current_user',
  USERS_DB: 'pesaflow_users_db',
  TXNS: 'pesaflow_transactions',
  NOTIFS: 'pesaflow_notifications'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEFAULT_USER: User = {
  uid: 'user_default_01',
  email: 'demo@pesaflow.com',
  displayName: 'Alex Kamau',
  balance: 24500,
  photoURL: 'https://ui-avatars.com/api/?name=Alex+Kamau&background=0D8ABC&color=fff',
};

// Initialize Storage and ensure Default User exists
const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.TXNS)) {
    localStorage.setItem(STORAGE_KEYS.TXNS, JSON.stringify([]));
  }
  
  let users = [];
  try {
    const usersJson = localStorage.getItem(STORAGE_KEYS.USERS_DB);
    users = usersJson ? JSON.parse(usersJson) : [];
    if (!Array.isArray(users)) users = [];
  } catch (e) {
    users = [];
  }

  // Ensure default user is present if the list is empty or missing the demo user
  if (!users.find((u: User) => u.email === DEFAULT_USER.email)) {
    users.push(DEFAULT_USER);
    localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
  }
};

// Run initialization
initializeStorage();

export const authService = {
  signIn: async (email: string, password: string): Promise<User> => {
    await delay(1000); // Simulate network

    /* REAL FIREBASE
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Fetch extra data from Firestore if needed
    return { ... }; 
    */

    if (email === 'error@test.com') throw new Error('Invalid credentials');
    
    const normalizedEmail = email.toLowerCase().trim();
    let users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
    let user = users.find((u: User) => u.email.toLowerCase() === normalizedEmail);
    
    // Self-healing: If somehow the demo user is missing during sign-in, recreate it
    if (!user && normalizedEmail === DEFAULT_USER.email) {
      user = DEFAULT_USER;
      users.push(user);
      localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
    }
    
    // Auto-Signup: If user still not found, create a new one automatically
    // This resolves the "Account not found" error for simple prototypes
    if (!user) {
      const name = normalizedEmail.split('@')[0];
      const displayName = name.charAt(0).toUpperCase() + name.slice(1);
      
      const newUser: User = {
        uid: `user_${Date.now()}`,
        email: normalizedEmail,
        displayName: displayName,
        balance: 0, // Start empty
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`
      };

      // Save to "DB"
      users.push(newUser);
      localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));

      // Create welcome notification
      const notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || '[]');
      notifications.push({
        id: `notif_${Date.now()}`,
        userId: newUser.uid,
        title: 'Welcome to PesaFlow!',
        message: 'Account created automatically. Start by topping up your wallet via M-Pesa.',
        date: new Date().toISOString(),
        read: false,
        type: 'success'
      });
      localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(notifications));
      
      user = newUser;
    }

    // Set Session
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return user;
  },

  signUp: async (email: string, password: string, name: string): Promise<User> => {
    await delay(1500); // Simulate network

    /* REAL FIREBASE
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    // Create initial wallet doc in Firestore
    return { ... };
    */

    const normalizedEmail = email.toLowerCase().trim();
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
    const existing = users.find((u: User) => u.email.toLowerCase() === normalizedEmail);
    
    if (existing) {
      // Instead of throwing error, just log them in
      return authService.signIn(email, password);
    }

    const newUser: User = {
      uid: `user_${Date.now()}`,
      email: normalizedEmail,
      displayName: name,
      balance: 1000, // Welcome bonus
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`
    };

    // Save to "DB"
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));

    // Create a welcome notification
    const notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || '[]');
    notifications.push({
      id: `notif_${Date.now()}`,
      userId: newUser.uid,
      title: 'Welcome to PesaFlow!',
      message: 'Your account has been successfully created. We have added KES 1,000 to your wallet as a welcome bonus.',
      date: new Date().toISOString(),
      read: false,
      type: 'success'
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(notifications));

    // Set Session
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    return newUser;
  },
  
  signOut: async (): Promise<void> => {
    await delay(500);
    /* await firebaseSignOut(auth); */
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
  
  getCurrentUser: async (): Promise<User | null> => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return stored ? JSON.parse(stored) : null;
  },

  updateUserBalance: async (uid: string, newBalance: number): Promise<void> => {
    // Update Session
    const currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    if (currentUser.uid === uid) {
      currentUser.balance = newBalance;
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    }

    // Update "DB"
    const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS_DB) || '[]');
    const userIndex = users.findIndex((u: User) => u.uid === uid);
    if (userIndex >= 0) {
      users[userIndex].balance = newBalance;
      localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
    }
  }
};

export const dbService = {
  getTransactions: async (userId: string): Promise<Transaction[]> => {
    await delay(800);
    const allTxns: any[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.TXNS) || '[]');
    return allTxns
      .filter(t => t.userId === userId || !t.userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  addTransaction: async (userId: string, transaction: Transaction): Promise<void> => {
    await delay(500);
    const allTxns = JSON.parse(localStorage.getItem(STORAGE_KEYS.TXNS) || '[]');
    allTxns.unshift({ ...transaction, userId });
    localStorage.setItem(STORAGE_KEYS.TXNS, JSON.stringify(allTxns));

    const currentUser = await authService.getCurrentUser();
    if (currentUser) {
      let newBalance = currentUser.balance;
      if (transaction.type === TransactionType.DEPOSIT) {
        newBalance += transaction.amount;
      } else {
        newBalance -= transaction.amount;
      }
      await authService.updateUserBalance(currentUser.uid, newBalance);

      // Create a notification for the transaction
      const notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || '[]');
      notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: currentUser.uid,
        title: 'Transaction Successful',
        message: `Your ${transaction.type.toLowerCase()} of KES ${transaction.amount.toLocaleString()} was successful.`,
        date: new Date().toISOString(),
        read: false,
        type: 'info'
      });
      localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(notifications));
    }
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    await delay(400);
    let notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || '[]');
    
    // Seed some mock notifications if empty for demo purposes
    if (notifications.filter((n: any) => n.userId === userId).length === 0) {
      const mocks: Notification[] = [
        {
          id: 'n1',
          userId,
          title: 'Welcome to PesaFlow',
          message: 'Secure your account by enabling 2FA in settings.',
          date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          read: true,
          type: 'info'
        },
        {
          id: 'n2',
          userId,
          title: 'System Update',
          message: 'We have improved our M-Pesa integration speeds.',
          date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
          read: false,
          type: 'success'
        }
      ];
      notifications = [...notifications, ...mocks];
      localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(notifications));
    }

    return notifications
      .filter((n: Notification) => n.userId === userId)
      .sort((a: Notification, b: Notification) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  markNotificationRead: async (userId: string, notificationId: string): Promise<void> => {
    const notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || '[]');
    const updated = notifications.map((n: Notification) => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(updated));
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    const notifications = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFS) || '[]');
    const updated = notifications.map((n: Notification) => 
      n.userId === userId ? { ...n, read: true } : n
    );
    localStorage.setItem(STORAGE_KEYS.NOTIFS, JSON.stringify(updated));
  }
};