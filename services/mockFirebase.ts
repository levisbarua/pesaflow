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
  writeBatch
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
      // If user exists in Auth but not DB (rare), init DB
      try {
        await setDoc(userDocRef, { 
          email: firebaseUser.email, 
          balance: 0,
          createdAt: new Date().toISOString()
        });
      } catch (writeErr) {
        console.warn("Could not create user document. Check Firestore Rules.", writeErr);
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
      console.error("FIRESTORE PERMISSION DENIED: Please check your Firebase Console > Firestore Database > Rules.");
      throw new Error("Missing or insufficient permissions. Please check Firestore Rules.");
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
    // 1. Create Auth User
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // 2. Update Display Name
    await updateProfile(userCredential.user, { displayName: name });
    
    // 3. Create Firestore Document for Balance
    // REALISM: In a real app, users start with 0. 
    const initialBalance = 0;
    
    try {
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: email.toLowerCase(),
        displayName: name,
        balance: initialBalance,
        createdAt: new Date().toISOString()
      });

      // 4. Create Welcome Notification
      await addDoc(collection(db, 'notifications'), {
        userId: userCredential.user.uid,
        title: 'Welcome to PesaFlow!',
        message: 'Your account has been successfully created. Use M-Pesa to top up your wallet.',
        date: new Date().toISOString(),
        read: false,
        type: 'success'
      });
    } catch (err: any) {
       console.error("Error setting up user profile in Firestore:", err);
       if (err.code === 'permission-denied') {
          throw new Error("Account created, but database access was denied. Please check Firestore Rules.");
       }
    }

    return {
      uid: userCredential.user.uid,
      email: email,
      displayName: name,
      photoURL: userCredential.user.photoURL || undefined,
      balance: initialBalance
    };
  },
  
  signOut: async (): Promise<void> => {
    await firebaseSignOut(auth);
  },
  
  // This waits for the Firebase Auth to initialize and checks session
  getCurrentUser: (): Promise<User | null> => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe(); // Unsubscribe immediately
        if (user) {
          try {
            const profile = await fetchUserProfile(user);
            resolve(profile);
          } catch (err) {
            console.error("Failed to fetch user profile", err);
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
      const q = query(
        collection(db, 'transactions'), 
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      
      return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.error("Error fetching transactions:", err);
      return [];
    }
  },

  addTransaction: async (userId: string, transaction: Transaction): Promise<void> => {
    const { id, ...data } = transaction;
    
    if (id && id.length > 5) {
        await setDoc(doc(db, 'transactions', id), { ...data, userId });
    } else {
        await addDoc(collection(db, 'transactions'), { ...data, userId });
    }

    const userRef = doc(db, 'users', userId);
    const amountChange = transaction.type === TransactionType.DEPOSIT 
      ? transaction.amount 
      : -transaction.amount;

    await updateDoc(userRef, {
      balance: increment(amountChange)
    });

    await addDoc(collection(db, 'notifications'), {
      userId: userId,
      title: 'Transaction Successful',
      message: `Your ${transaction.type.toLowerCase()} of KES ${transaction.amount.toLocaleString()} was successful.`,
      date: new Date().toISOString(),
      read: false,
      type: 'info'
    });
  },

  getNotifications: async (userId: string): Promise<Notification[]> => {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      
      return notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (err) {
      console.error("Error fetching notifications:", err);
      return [];
    }
  },

  markNotificationRead: async (userId: string, notificationId: string): Promise<void> => {
    const notifRef = doc(db, 'notifications', notificationId);
    await updateDoc(notifRef, { read: true });
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach((d) => {
        batch.update(doc(db, 'notifications', d.id), { read: true });
    });
    
    await batch.commit();
  }
};