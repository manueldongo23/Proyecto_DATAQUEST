import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Mail,
  Lock,
  LogIn,
  Users,
  Loader2,
  Database,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
  ShieldAlert,
  ArrowLeft,
  X
} from 'lucide-react';
import axiosInstance, { fetchCsrfCookie } from '../services/api';
import { toast } from './Toast';

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

interface TableCardProps {
  name: string;
  fields: { name: string; type?: string }[];
  className?: string;
}

const TableCard: React.FC<TableCardProps> = ({ name, fields, className }) => (
  <div className={`bg-white border border-slate-200/80 rounded-xl p-3 shadow-md w-32 text-left select-none animate-float transition-all hover:border-blue-400 ${className || ''}`}>
    <div className="font-bold text-[10px] text-slate-800 border-b border-slate-100 pb-1.5 mb-1.5 flex justify-between items-center">
      <span>{name}</span>
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
    </div>
    <div className="space-y-0.5">
      {fields.map((f, i) => (
        <div key={i} className="flex justify-between items-center text-[9px] text-slate-500">
          <span className="font-medium truncate max-w-[75px]">{f.name}</span>
          {f.type && (
            <span className={`font-bold text-[7px] px-1 py-0.5 rounded scale-90 ${
              f.type === 'PK' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-100'
            }`}>
              {f.type}
            </span>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Volumetric 3D Cylinder segment with curved side walls and elliptical bottom
const CylinderSegment: React.FC<{ isBlue?: boolean; className?: string }> = ({ isBlue, className }) => (
  <div className={`relative w-24 h-12 flex-shrink-0 ${className || ''}`}>
    {/* Side/Body with matching elliptical bottom curve */}
    <div className={`absolute bottom-0 left-0 right-0 h-9 rounded-b-[50%_12px] bg-gradient-to-b ${
      isBlue ? 'from-[#3B82F6] to-[#1D4ED8]' : 'from-[#E2E8F0] to-[#CBD5E1]'
    } border-x border-b ${isBlue ? 'border-[#2563EB]/40' : 'border-slate-300/60'}`} />
    
    {/* Top Lid (ellipse) */}
    <div className={`absolute top-0 left-0 right-0 h-6 rounded-full bg-gradient-to-b ${
      isBlue ? 'from-[#93C5FD] to-[#3B82F6]' : 'from-white to-[#F1F5F9]'
    } border ${isBlue ? 'border-[#2563EB]/40' : 'border-slate-200'} shadow-sm`} />
  </div>
);

export const Landing: React.FC = () => {
  const { setUser, setGuestUser } = useAuthStore();
  const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Form states
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [apodo, setApodo] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apodoError, setApodoError] = useState<string | null>(null);

  const handleApodoChange = (val: string) => {
    setApodo(val);
    setApodoError(validateApodo(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (view === 'register') {
      const apError = validateApodo(apodo);
      if (apError) {
        setApodoError(apError);
        toast.error(apError);
        return;
      }
    }

    setLoading(true);
    const endpoint = view === 'login' ? '/auth/login' : '/auth/register';

    try {
      await fetchCsrfCookie();
      const response = await axiosInstance.post(
        endpoint,
        view === 'login'
          ? { correo, password }
          : { correo, apodo, password, password_confirmation: password }
      );

      const data = response.data;
      if (data.success) {
        setUser(data.user, data.access_token || data.token);
        toast.success(`¡Bienvenido, ${data.user.apodo || data.user.correo}!`);
      } else {
        const errors = data.errors ? Object.values(data.errors).flat().join(', ') : null;
        setError(data.message || errors || 'Error de validación');
        toast.error(data.message || errors || 'Error de validación');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error de conexión. Intenta de nuevo.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axiosInstance.post('/auth/forgot-password', { correo });
      if (response.data.success) {
        toast.success('Se han enviado las instrucciones de restablecimiento.');
        setView('login');
      } else {
        setError(response.data.message || 'Error al enviar el correo');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al conectar con el servidor.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    const guest = setGuestUser();
    toast.success(`Entrando como ${guest.apodo} 👤`);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center lg:items-stretch lg:justify-start bg-slate-50 relative overflow-hidden py-12 px-4 sm:px-8 lg:px-20">
      
      {/* Top-Right Circular Close Button (for Guest access) */}
      <button
        onClick={handleGuestAccess}
        className="absolute top-6 right-6 w-9 h-9 rounded-full bg-[#1E293B] hover:bg-slate-800 flex items-center justify-center text-white transition-all shadow-md z-50 cursor-pointer"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Decorative Dot Grid */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }} 
      />

      {/* Background Blobs */}
      <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] right-[-100px] w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row lg:items-stretch lg:gap-16 relative z-10">
        
        {/* Left Column - Product Presentation */}
        <div className="hidden lg:flex lg:w-[60%] flex-col justify-between py-4 pr-6 text-left">
          
          {/* Header & Logo */}
          <div>
            <div className="flex items-center gap-3">
              {/* Stylized 3D Database stack logo */}
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="filter drop-shadow-sm">
                <path d="M12 6C15.866 6 19 4.88071 19 3.5C19 2.11929 15.866 1 12 1C8.13401 1 5 2.11929 5 3.5C5 4.88071 8.13401 6 12 6Z" fill="url(#logo_top)" />
                <path d="M5 3.5V6.5C5 7.88 8.13 9 12 9C15.87 9 19 7.88 19 6.5V3.5C19 4.88 15.87 6 12 6C8.13 6 5 4.88 5 3.5Z" fill="url(#logo_top_side)" />
                
                <path d="M12 13.5C15.866 13.5 19 12.3807 19 11C19 9.61929 15.866 8.5 12 8.5C8.13401 8.5 5 9.61929 5 11C5 12.3807 8.13401 13.5 12 13.5Z" fill="url(#logo_mid)" />
                <path d="M5 11V14C5 15.38 8.13 16.5 12 16.5C15.87 16.5 19 15.38 19 14V11C19 12.38 15.87 13.5 12 13.5C8.13 13.5 5 12.38 5 11Z" fill="url(#logo_mid_side)" />
                
                <path d="M12 21C15.866 21 19 19.8807 19 18.5C19 17.1193 15.866 16 12 16C8.13401 16 5 17.1193 5 18.5C5 19.8807 8.13401 21 12 21Z" fill="url(#logo_bot)" />
                <path d="M5 18.5V21.5C5 22.88 8.13 24 12 24C15.87 24 19 22.88 19 21.5V18.5C19 19.88 15.87 21 12 21Z" fill="url(#logo_bot_side)" />
                
                <defs>
                  <linearGradient id="logo_top" x1="5" y1="1" x2="19" y2="6" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#38BDF8" />
                    <stop offset="1" stopColor="#0EA5E9" />
                  </linearGradient>
                  <linearGradient id="logo_top_side" x1="5" y1="3.5" x2="19" y2="9" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#0284C7" />
                    <stop offset="1" stopColor="#0369A1" />
                  </linearGradient>
                  <linearGradient id="logo_mid" x1="5" y1="8.5" x2="19" y2="13.5" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#2563EB" />
                    <stop offset="1" stopColor="#1D4ED8" />
                  </linearGradient>
                  <linearGradient id="logo_mid_side" x1="5" y1="11" x2="19" y2="16.5" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#1E40AF" />
                    <stop offset="1" stopColor="#1E3A8A" />
                  </linearGradient>
                  <linearGradient id="logo_bot" x1="5" y1="16" x2="19" y2="21" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#8B5CF6" />
                    <stop offset="1" stopColor="#7C3AED" />
                  </linearGradient>
                  <linearGradient id="logo_bot_side" x1="5" y1="18.5" x2="19" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#6D28D9" />
                    <stop offset="1" stopColor="#5B21B6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">DataQuest</span>
            </div>

            {/* Slogan */}
            <h1 className="text-4xl lg:text-[42px] font-extrabold text-slate-900 tracking-tight leading-[1.15] mt-6">
              Normaliza, aprende <br /> y valida con precisión
            </h1>
            <p className="text-sm text-slate-500 mt-3 max-w-xl leading-relaxed">
              Plataforma integral que combina un poderoso normalizador de bases de datos con rutas académicas y validación inteligente para llevar tus proyectos al siguiente nivel.
            </p>
          </div>

          {/* Row with Features (Left) and Data Model Visualizer (Right) */}
          <div className="flex items-center gap-6 my-4">
            
            {/* Features (Left Column) */}
            <div className="w-[42%] space-y-6">
              {/* Feature 1 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 shadow-sm shadow-blue-500/5">
                  <Database className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-slate-800">Normalizer Engine</h3>
                  <p className="text-xs text-slate-500 leading-normal mt-0.5">
                    Normaliza tus esquemas y obtiene descomposiciones óptimas paso a paso con análisis automático.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center flex-shrink-0 text-teal-600 shadow-sm shadow-teal-500/5">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-slate-800">Academy</h3>
                  <p className="text-xs text-slate-500 leading-normal mt-0.5">
                    Aprende teoría, practica ejercicios y avanza con rutas guiadas adaptadas a tu nivel.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0 text-purple-600 shadow-sm shadow-purple-500/5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-slate-800">Validator</h3>
                  <p className="text-xs text-slate-500 leading-normal mt-0.5">
                    Valida esquemas, detecta dependencias y verifica formas normales con precisión.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Model Visualizer (Right Column - Symmetrical Triangle layout with 3D Cylinder) */}
            <div className="w-[58%] relative h-[280px] flex items-center justify-center">
              {/* Symmetrical connecting lines mapped to viewBox (320 x 280) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 320 280" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Line from Cliente (top) to Database */}
                <path d="M 160 75 L 160 95" stroke="#93C5FD" strokeWidth="1.2" strokeDasharray="3 3" />
                {/* Line from Orden (bottom-left) to Database */}
                <path d="M 100 205 C 130 205, 130 165, 120 145" stroke="#93C5FD" strokeWidth="1.2" strokeDasharray="3 3" />
                {/* Line from Detalle_Orden (bottom-right) to Database */}
                <path d="M 220 205 C 190 205, 190 165, 200 145" stroke="#93C5FD" strokeWidth="1.2" strokeDasharray="3 3" />

                {/* Connector dots */}
                <circle cx="160" cy="75" r="2.5" fill="#60A5FA" />
                <circle cx="160" cy="95" r="2.5" fill="#3B82F6" />
                <circle cx="100" cy="205" r="2.5" fill="#60A5FA" />
                <circle cx="120" cy="145" r="2.5" fill="#3B82F6" />
                <circle cx="220" cy="205" r="2.5" fill="#60A5FA" />
                <circle cx="200" cy="145" r="2.5" fill="#3B82F6" />
              </svg>

              {/* Central Database cylinder (Large, centered, volumetric 3D layout) */}
              <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 flex flex-col justify-center items-center z-10 select-none">
                <CylinderSegment isBlue={true} className="z-40 animate-float" />
                <CylinderSegment isBlue={false} className="z-30 -mt-6 animate-float" />
                <CylinderSegment isBlue={false} className="z-20 -mt-6 animate-float" />
                <CylinderSegment isBlue={false} className="z-10 -mt-6 animate-float" />
              </div>

              {/* Table: Cliente (Centered at top) */}
              <TableCard 
                name="Cliente" 
                fields={[
                  { name: 'id_cliente', type: 'PK' },
                  { name: 'nombre' },
                  { name: 'email' },
                  { name: '...' }
                ]}
                className="absolute top-0 left-1/2 -translate-x-1/2"
              />

              {/* Table: Orden (Bottom Left) */}
              <TableCard 
                name="Orden" 
                fields={[
                  { name: 'id_orden', type: 'PK' },
                  { name: 'fecha' },
                  { name: 'id_cliente', type: 'FK' },
                  { name: '...' }
                ]}
                className="absolute bottom-0 left-0"
              />

              {/* Table: Detalle_Orden (Bottom Right) */}
              <TableCard 
                name="Detalle_Orden" 
                fields={[
                  { name: 'id_orden', type: 'FK' },
                  { name: 'id_producto', type: 'FK' },
                  { name: 'cantidad' },
                  { name: '...' }
                ]}
                className="absolute bottom-0 right-0"
              />
            </div>

          </div>

          {/* Bottom trust box with real product signals instead of invented metrics */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.01)] w-full">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tu sesion real alimenta la plataforma
              </span>
              <div className="h-px w-8 bg-slate-200" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 leading-tight">Validacion real</div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-1">
                    Tus esquemas quedan guardados cuando analizas datos de verdad.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 leading-tight">Progreso persistente</div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-1">
                    Cada accion suma a tu historial y cambia tu siguiente inicio.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 leading-tight">Ruta adaptativa</div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-1">
                    Academy se ajusta a tu nivel y a las elecciones que haces.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column - Embedded Auth Form Card */}
        <div className="w-full lg:w-[40%] flex flex-col justify-center items-center py-4">
          
          {/* Card Container */}
          <div className="bg-white border border-slate-100 shadow-2xl shadow-slate-200/50 rounded-3xl p-8 sm:p-10 w-full max-w-[430px] flex flex-col justify-between relative overflow-hidden transition-all duration-300">
            
            {/* View State: LOGIN */}
            {view === 'login' && (
              <div className="animate-fade-in text-left">
                {/* Titles */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
                    Iniciar sesión
                  </h2>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Accede a tu cuenta para continuar
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs text-left mb-4 flex items-start gap-2 animate-shake">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5 text-left">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={correo}
                        onChange={e => setCorreo(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5 text-left">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Checkbox and Forgot Link */}
                  <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
                    <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={recordarme}
                        onChange={e => setRecordarme(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/10"
                      />
                      <span className="font-medium">Recordarme</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setError(null); setView('forgot'); }}
                      className="text-blue-600 hover:underline font-semibold text-xs sm:text-sm"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/10 active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>Ingresar a DataQuest</span>
                  </button>
                </form>

                {/* Secondary: Create Account */}
                <button
                  onClick={() => { setError(null); setView('register'); }}
                  className="w-full bg-white border border-[#2563EB] hover:bg-blue-50/20 text-[#2563EB] font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-3"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Crear cuenta</span>
                </button>
              </div>
            )}

            {/* View State: REGISTER */}
            {view === 'register' && (
              <div className="animate-fade-in text-left">
                {/* Titles */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
                    Crear cuenta
                  </h2>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Únete y comienza a normalizar gratis
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs text-left mb-4 flex items-start gap-2 animate-shake">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Apodo */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5 text-left">
                      Apodo / Nombre de usuario
                    </label>
                    <div className="relative">
                      <Users className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={apodo}
                        onChange={e => handleApodoChange(e.target.value)}
                        placeholder="MiApodoNormalizado"
                        className={`w-full bg-white border rounded-xl pl-10 pr-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 transition-all ${
                          apodoError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
                        }`}
                        required
                      />
                    </div>
                    {apodoError && (
                      <p className="text-left text-[10px] text-red-500 mt-1 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> {apodoError}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5 text-left">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={correo}
                        onChange={e => setCorreo(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5 text-left">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/10 active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>Registrar cuenta</span>
                  </button>
                </form>

                {/* Secondary: Go back to Login */}
                <button
                  onClick={() => { setError(null); setView('login'); }}
                  className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a iniciar sesión</span>
                </button>
              </div>
            )}

            {/* View State: FORGOT PASSWORD */}
            {view === 'forgot' && (
              <div className="animate-fade-in text-left">
                {/* Titles */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">
                    Recuperar acceso
                  </h2>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Recibe instrucciones para restablecer contraseña
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs text-left mb-4 flex items-start gap-2 animate-shake">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1.5 text-left">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={correo}
                        onChange={e => setCorreo(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/10 active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4" />
                    )}
                    <span>Enviar correo de recuperación</span>
                  </button>
                </form>

                {/* Secondary: Go back to Login */}
                <button
                  onClick={() => { setError(null); setView('login'); }}
                  className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 mt-3"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver a iniciar sesión</span>
                </button>
              </div>
            )}

            {/* Card Footer (Shield & Role explanation) */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-8 select-none border-t border-slate-100 pt-4">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Acceso para estudiantes y administradores</span>
            </div>

          </div>

          {/* Guest Entry Sub-link (Subtle, outside the card) */}
          <button
            onClick={handleGuestAccess}
            className="text-xs text-slate-400 hover:text-blue-600 font-semibold flex items-center justify-center gap-1.5 mt-4 transition-colors select-none"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Continuar como invitado</span>
          </button>

        </div>

      </div>
    </div>
  );
};
