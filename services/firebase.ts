import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSt2rmCaXkhD2GTQdM1kLzY9EjUNunnsg",
  authDomain: "pesaflow-real-72e5f.firebaseapp.com",
  projectId: "pesaflow-real-72e5f",
  storageBucket: "pesaflow-real-72e5f.firebasestorage.app",
  messagingSenderId: "40086424382",
  appId: "1:40086424382:web:494970082500389a1aba6f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);