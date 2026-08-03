import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          const bgColor = isSuccess
            ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100'
            : isError
            ? 'bg-rose-900/90 border-rose-500/40 text-rose-100'
            : isWarning
            ? 'bg-amber-900/90 border-amber-500/40 text-amber-100'
            : 'bg-slate-900/90 border-slate-700 text-slate-100';

          const IconComponent = isSuccess
            ? CheckCircle2
            : isError
            ? XCircle
            : isWarning
            ? AlertTriangle
            : Info;

          const iconColor = isSuccess
            ? 'text-emerald-400'
            : isError
            ? 'text-rose-400'
            : isWarning
            ? 'text-amber-400'
            : 'text-blue-400';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md ${bgColor}`}
              role="alert"
            >
              <IconComponent className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
              <div className="flex-1 text-sm">
                <h4 className="font-semibold">{toast.title}</h4>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title="Fechar notificação"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
