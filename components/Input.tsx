import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          className={`
            block w-full rounded-lg border 
            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-mpesa-500 focus:ring-mpesa-200'}
            bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 
            focus:outline-none focus:ring-4 focus:ring-opacity-20 transition-all
            disabled:bg-gray-50 disabled:text-gray-500
            ${icon ? 'pl-10' : ''}
            ${className}
          `}
          {...props}
        />
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            {icon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
