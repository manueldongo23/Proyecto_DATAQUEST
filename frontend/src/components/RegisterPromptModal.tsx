import React from 'react';
import { X, Lock, Star } from 'lucide-react';

interface RegisterPromptModalProps {
  isOpen: boolean;
  feature: 'quests' | 'ranking';
  onClose: () => void;
  onRegister: () => void;
}

export const RegisterPromptModal: React.FC<RegisterPromptModalProps> = ({
  isOpen,
  feature,
  onClose,
  onRegister,
}) => {
  if (!isOpen) return null;

  const featureMessages = {
    quests: {
      title: '🚀 ¡Desbloquea DataQuests!',
      description: 'Acceso a misiones gamificadas, ganar XP, subir en el ranking y desbloquear medallas.',
      benefits: [
        'Guardar tu progreso',
        'Ganar XP y medallas',
        'Competir en el ranking',
        'Desafíos semanales',
      ],
    },
    ranking: {
      title: '🏆 ¡Únete al Ranking!',
      description: 'Compite con otros usuarios, gana XP y demuestra tu maestría en normalización.',
      benefits: [
        'Ver tu posición',
        'Competir globalmente',
        'Ganar premios',
        'Mostrar logros',
      ],
    },
  };

  const config = featureMessages[feature];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-md w-full border border-slate-700 shadow-2xl animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-8 text-center border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white mb-2">{config.title}</h2>
          <p className="text-slate-400">{config.description}</p>
        </div>

        {/* Benefits */}
        <div className="p-8">
          <p className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-cyan-400" />
            Beneficios exclusivos:
          </p>

          <ul className="space-y-3 mb-8">
            {config.benefits.map((benefit, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-slate-300"
              >
                <Star className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={onRegister}
              className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105 active:scale-95"
            >
              Crear Cuenta Gratuita
            </button>

            <button
              onClick={onClose}
              className="w-full bg-slate-700/50 hover:bg-slate-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Cancelar
            </button>
          </div>

          {/* Footer Note */}
          <p className="text-xs text-slate-500 text-center mt-4">
            Es rápido y gratis. Solo necesitamos tu email.
          </p>
        </div>
      </div>
    </div>
  );
};
