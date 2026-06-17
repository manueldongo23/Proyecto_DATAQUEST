// Tooltip.tsx
import React from 'react';

interface TooltipProps {
  message: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ message }) => {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
      <p className="text-sm text-blue-800">{message}</p>
    </div>
  );
};
