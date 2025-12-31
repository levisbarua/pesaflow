import React, { useState } from 'react';
import { Mail, Lock, CheckCircle2, ShieldCheck, ArrowRight, User as UserIcon, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { authService } from '../services/mockFirebase';
import { User } from '../types';

interface SignInProps {
  onSuccess: (user: User) => void;
}

export const SignIn: React.FC<SignInProps> = ({ onSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setEmail('');
    setPassword('');
    setName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!email || !password) {
        throw new Error('Please fill in all fields');
      }

      if (isSignUp && !name) {
         throw new Error('Please enter your full name');
      }
      
      let user;
      if (isSignUp) {
        user = await authService.signUp(email, password, name);
      } else {
        user = await authService.signIn(email, password);
      }
      
      onSuccess(user);
    } catch (err: any) {
      console.error("Sign In Error:", err);
      
      // Parse Firebase Error Codes
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please check your credentials.');
      } else if (err.code === 'auth/email-already-in-use') {
        // UX Fix: Auto-switch to Sign In if account exists
        setError('This email is already registered. Please enter your password to sign in.');
        setIsSignUp(false);
        // We keep the email field populated so they don't have to retype it
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'permission-denied' || err.message.includes('Missing or insufficient permissions')) {
        setError('Database permission denied. Please check your Firestore Security Rules in the Firebase Console.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Side - Visuals */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-mpesa-900 to-mpesa-700 p-12 flex-col justify-between text-white relative overflow-hidden">
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-mpesa-500 opacity-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-mpesa-400 opacity-10 blur-3xl"></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-2xl font-bold">
            <div className="w-8 h-8 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
              <span className="text-white">P</span>
            </div>
            <span>PesaFlow</span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            {isSignUp ? 'Join the revolution.' : 'The future of payments.'}
          </h1>
          <p className="text-mpesa-100 text-lg mb-8">
            {isSignUp 
              ? 'Create an account today and get a KES 1,000 welcome bonus to test our secure platform.' 
              : 'Seamlessly integrate M-Pesa, manage your transactions, and scale your business.'}
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-mpesa-300" />
              <span className="font-medium">Instant M-Pesa STK Pushes</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-mpesa-300" />
              <span className="font-medium">Real-time Transaction Analytics</span>
            </div>
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-6 h-6 text-mpesa-300" />
              <span className="font-medium">Enterprise Grade Security</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-mpesa-200">
          © 2024 PesaFlow Inc. All rights reserved.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              {isSignUp ? 'Create an account' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-gray-600">
              {isSignUp ? 'Enter your details to get started.' : 'Sign in to manage your payments.'}
            </p>
          </div>

          {!isSignUp && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold">Secure Login</p>
                <p>Please enter your email and password to access your dashboard.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {isSignUp && (
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={<UserIcon className="w-5 h-5" />}
                  required
                />
              )}
              
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-5 h-5" />}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder={isSignUp ? "Create a password" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-5 h-5" />}
                required
              />
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-mpesa-600 focus:ring-mpesa-500" />
                  <span className="ml-2 text-gray-600">Remember me</span>
                </label>
                <a href="#" className="font-medium text-mpesa-600 hover:text-mpesa-500">
                  Forgot password?
                </a>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" fullWidth isLoading={loading} className="group">
              {isSignUp ? 'Create Account' : 'Sign in to Dashboard'}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button 
              onClick={toggleMode} 
              className="font-semibold text-mpesa-600 hover:text-mpesa-500 hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Create one now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};