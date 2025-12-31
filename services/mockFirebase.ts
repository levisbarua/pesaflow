import { User, Transaction, TransactionType, Notification } from '../types';
import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  increment,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';

// Helper to merge Auth User with Firestore Balance
const fetchUserProfile = async (firebaseUser: FirebaseUser): Promise<User> => {
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  
  try {
    const userDocSnap = await getDoc(userDocRef);
    let balance = 0;
    
    if (userDocSnap.exists()) {
      balance = userDocSnap.data().balance;
    } else {
      try {
        await setDoc(userDocRef, { 
          email: firebaseUser.email, 
          balance: 0,
          createdAt: new Date().toISOString()
        });
      } catch (writeErr) {
        console.warn("Could not create user document.", writeErr);
      }
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || 'User',
      photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=random&color=fff`,
      balance: balance
    };
  } catch (err: any) {
    if (err.code === 'permission-denied') {
      throw new Error("Database permission denied.");
    }
    throw err;
  }
};

export const authService = {
  signIn: async (email: string, password: string): Promise<User> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return await fetchUserProfile(userCredential.user);
  },

  signUp: async (email: string, password: string, name: string): Promise<User> => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
    
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: email.toLowerCase(),
      displayName: name,
      balance: 0,
      createdAt: new Date().toISOString()
    });

    await addDoc(collection(db, 'notifications'), {
      userId: userCredential.user.uid,
      title: 'Welcome to PesaFlow!',
      message: 'Your account has been successfully created.',
      date: new Date().toISOString(),
      read: false,
      type: 'success'
    });

    return {
      uid: userCredential.user.uid,
      email: email,
      displayName: name,
      photoURL: userCredential.user.photoURL || undefined,
      balance: 0
    };
  },
  
  signOut: async (): Promise<void> => {
    await firebaseSignOut(auth);
  },
  
  getCurrentUser: (): Promise<User | null> => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          try {
            const profile = await fetchUserProfile(user);
            resolve(profile);
          } catch (err) {
            resolve({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'User',
                balance: 0
            });
          }
        } else {
          resolve(null);
        }
      });
    });
  },

  updateUserBalance: async (uid: string, newBalance: number): Promise<void> => {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { balance: newBalance });
  }
};

export const dbService = {
  getTransactions: async (userId: string): Promise<Transaction[]> => {
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.error("Error fetching transactions:", err);
      return [];
    }
  },

  // Listen to a specific transaction ID for status changes (Real-time)
  listenToTransaction: (transactionId: string, callback: (txn: Transaction | null) => void) => {
    const docRef = doc(db, 'transactions', transactionId);
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as Transaction);
      } else {
        callback(null);
      }
    });
  },

  addTransaction: async (userId: string, transaction: Transaction): Promise<void> => {
    const { id, ...data } = transaction;
    // For manual additions (Withdrawals if enabled)
    await setDoc(doc(db, 'transactions', id), { ...data, userId });

    const userRef = doc(db, 'users', userId);
    const amountChange = transaction.type === TransactionType.DEPOSIT 
      ? transaction.amount 
      : -transaction.amount;

    await updateDoc(userRef, {
      balance: increment(amountChange)
    });
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    return notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  markNotificationRead: async (userId: string, notificationId: string): Promise<void> => {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.update(doc(db, 'notifications', d.id), { read: true }));
    await batch.commit();
  }
};