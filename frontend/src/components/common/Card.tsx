import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
      {title && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          {title}
        </h2>
      )}
      <div>{children}</div>
    </div>
  );
}
