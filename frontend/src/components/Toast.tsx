// Toast.tsx — Wrapper centralizado para notificaciones con Sonner
import { Toaster } from 'sonner';

export const ToastProvider = () => (
  <Toaster
    position="top-right"
    expand={false}
    richColors
    closeButton
    toastOptions={{
      style: {
        fontFamily: "'Inter', sans-serif",
        fontSize: '14px',
      },
      duration: 4000,
    }}
  />
);

// Re-exportar toast para uso en toda la app
export { toast } from 'sonner';
