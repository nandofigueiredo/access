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
            ? 'bg-white border-emerald-200 text-slate-900 shadow-lg'
            : isError
            ? 'bg-white border-rose-200 text-slate-900 shadow-lg'
            : isWarning
            ? 'bg-white border-amber-200 text-slate-900 shadow-lg'
            : 'bg-white border-slate-200 text-slate-900 shadow-lg';

          const IconComponent = isSuccess
            ? CheckCircle2
            : isError
            ? XCircle
            : isWarning
            ? AlertTriangle
            : Info;

          const iconColor = isSuccess
            ? 'text-emerald-600'
            : isError
            ? 'text-rose-600'
            : isWarning
            ? 'text-amber-600'
            : 'text-blue-600';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${bgColor}`}
              role="alert"
            >
              <IconComponent className={`w-5 h-5 mt-0.5 shrink-0 ${iconColor}`} />
              <div className="flex-1 text-sm">
                <h4 className="font-bold text-slate-900">{toast.title}</h4>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{toast.message}</p>
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
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
