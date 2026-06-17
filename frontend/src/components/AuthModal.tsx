// AuthModal.tsx — Glassmorphism + Loader + Toast + Guest access + Name validation
import React, { useState } from 'react';
import { Mail, Lock, User, LogIn, UserPlus, Loader2, X, Users, AlertCircle } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useAuthStore } from '../store/authStore';
import { toast } from './Toast';
import axiosInstance, { fetchCsrfCookie } from '../services/api';

// Frontend name validation (mirrors backend rules)
const BLOCKED_TERMS: string[] = [
  'hitler', 'nazi', 'ss', 'gestapo',
  'admin', 'administrator', 'root', 'superuser', 'mod', 'moderator',
  'null', 'undefined', 'test', 'testing', 'prueba', 'demo',
  'puto', 'puta', 'pendejo', 'pendeja', 'mierda',
  'culero', 'culera', 'verga', 'cojones', 'carajo',
  'cabron', 'cabrona', 'estupido', 'estupida', 'idiota', 'imbecil', 'tonto', 'tonta',
  'matar', 'asesino', 'bomba', 'terrorista',
  'aaaa', 'bbbb', '1234', 'asdf', 'qwerty', 'zxcv',
  'porno', 'xxx', 'sexo',
];

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a')
    .replace(/0/g, 'o').replace(/5/g, 's').replace(/7/g, 't');
}

function validateApodo(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'El apodo no puede estar vacío';
  if (trimmed.length < 2) return 'El apodo debe tener al menos 2 caracteres';
  if (trimmed.length > 50) return 'El apodo no puede exceder 50 caracteres';
  if (!/^[\p{L}\s]+$/u.test(trimmed)) return 'El apodo solo debe contener letras y espacios';
  if (/(.)\1{3,}/u.test(trimmed)) return 'El apodo contiene demasiados caracteres repetidos';

  const normalized = normalizeName(trimmed);
  for (const term of BLOCKED_TERMS) {
    if (normalized.includes(term)) return 'El apodo ingresado no está permitido';
  }
  return null;
}

export const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [apodo, setApodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [apodoError, setApodoError] = useState<string | null>(null);
  const { setUser, setGuestUser } = useAuthStore();
  const trapRef = useFocusTrap(true);

  const handleApodoChange = (value: string) => {
    setApodo(value);
    if (!isLogin) {
      setApodoError(validateApodo(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend validation before submit
    if (!isLogin) {
      const error = validateApodo(apodo);
      if (error) {
        setApodoError(error);
        toast.error(error);
        return;
      }
    }

    setLoading(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    try {
      await fetchCsrfCookie();
      const response = await axiosInstance.post(endpoint,
        isLogin ? { correo, password } : { correo, apodo, password, password_confirmation: password }
      );
      const data = response.data;
      if (data.success) {
        setUser(data.user, data.access_token || data.token);
        toast.success(`¡Bienvenido, ${data.user.apodo}!`);
        onClose();
      } else {
        const errors = data.errors ? Object.values(data.errors).flat().join(', ') : null;
        toast.error(data.message || errors || 'Error desconocido');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || 'Error de conexión. Verifica que el servidor esté activo.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    const guest = setGuestUser();
    toast.success(`Entrando como ${guest.apodo} 👤`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md rounded-2xl shadow-2xl animate-scale-in overflow-hidden"
        style={{
          background: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" />
        <button onClick={onClose} aria-label="Cerrar modal de autenticación" className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="p-8 pt-10">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-lg">🎓</div>
          </div>
          <div className="text-center mb-7">
            <h2 id="auth-modal-title" className="text-2xl font-bold text-white">{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h2>
            <p className="text-slate-400 text-sm mt-1">{isLogin ? 'Accede a tu laboratorio de normalización' : 'Únete a DataQuest hoy'}</p>
          </div>

          <div key={isLogin ? 'login' : 'register'} className="animate-slide-up">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-correo" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Correo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" aria-hidden="true" />
                <input id="auth-correo" type="email" required aria-required="true" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="tu@email.com"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
              </div>
            </div>
            {!isLogin && (
              <div>
                <label htmlFor="auth-apodo" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Apodo</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" aria-hidden="true" />
                  <input id="auth-apodo" type="text" required aria-required="true" value={apodo} onChange={e => handleApodoChange(e.target.value)} placeholder="MiApodoQuest" aria-describedby={apodoError ? 'auth-apodo-error' : undefined}
                    className={`w-full bg-slate-800/60 border rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${apodoError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'}`} />
                  {apodoError && (
                    <div className="absolute right-3 top-3">
                      <AlertCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
                    </div>
                  )}
                </div>
                {apodoError && (
                  <p id="auth-apodo-error" role="alert" className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" aria-hidden="true" /> {apodoError}
                  </p>
                )}
              </div>
            )}
            <div>
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" aria-hidden="true" />
                <input id="auth-password" type="password" required aria-required="true" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
              </div>
            </div>

            <button type="submit" disabled={loading} id="auth-submit-btn"
              className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 4px 20px rgba(99,102,241,0.35)' }}
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />{isLogin ? 'Iniciando...' : 'Creando cuenta...'}</>
                : <>{isLogin ? <LogIn className="w-4 h-4" aria-hidden="true" /> : <UserPlus className="w-4 h-4" aria-hidden="true" />}{isLogin ? 'Entrar al Laboratorio' : 'Registrarse'}</>}
            </button>
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {loading ? (isLogin ? 'Iniciando sesión...' : 'Creando cuenta...') : ''}
            </div>
          </form>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700/80" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-3 text-slate-500" style={{ background: 'transparent' }}>o continúa con</span></div>
          </div>

          <button onClick={handleGuest} id="guest-access-btn"
            className="w-full py-3 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 border border-slate-700 hover:border-cyan-500/60 bg-slate-800/40 hover:bg-slate-700/60 transition-all group">
            <Users className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" aria-hidden="true" />
            <span className="group-hover:text-cyan-100 transition-colors">Continuar como Invitado</span>
          </button>

          <div className="mt-5 text-center text-sm text-slate-500">
            {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-indigo-400 hover:text-indigo-300 font-semibold">
              {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
