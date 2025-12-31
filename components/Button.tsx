import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading = false, 
  fullWidth = false,
  className = '',
  disabled,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-mpesa-600 hover:bg-mpesa-700 text-white focus:ring-mpesa-500 shadow-sm hover:shadow-md",
    secondary: "bg-gray-800 hover:bg-gray-900 text-white focus:ring-gray-500",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-200",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
  };

  return (
    <button 
      className={`
        ${baseStyles} 
        ${variants[variant]} 
        ${fullWidth ? 'w-full' : ''} 
        ${className}
      `}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
};
