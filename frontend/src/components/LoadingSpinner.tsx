import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 20, text, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-live="polite" aria-label={text || 'Cargando...'}>
    <div className="relative">
      <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin relative" style={{ width: size, height: size }} aria-hidden="true" />
    </div>
    {text && <p className="text-slate-400 text-sm animate-pulse">{text}</p>}
  </div>
);
