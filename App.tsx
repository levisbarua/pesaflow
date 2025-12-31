import React, { useState, useEffect } from 'react';
import { SignIn } from './components/SignIn';
import { Dashboard } from './components/Dashboard';
import { User } from './types';
import { authService } from './services/mockFirebase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Session check failed", error);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setUser(user);
  };

  const handleLogout = async () => {
    await authService.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mpesa-600"></div>
      </div>
    );
  }

  return (
    <div className="antialiased text-gray-900 bg-white">
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <SignIn onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

export default App;