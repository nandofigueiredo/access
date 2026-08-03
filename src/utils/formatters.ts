export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const isValidCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
};

export const formatDateToBR = (dateString?: string): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
};

export const formatDateTimeToBR = (dateTimeString?: string): string => {
  if (!dateTimeString) return 'N/A';
  try {
    const date = new Date(dateTimeString);
    if (isNaN(date.getTime())) return dateTimeString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateTimeString;
  }
};

/**
 * Calculates business days difference from today to the given target date.
 */
export const getBusinessDaysRemaining = (targetDateStr: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() < today.getTime()) {
    return -1;
  }

  let businessDays = 0;
  const current = new Date(today);

  while (current < target) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }

  return businessDays;
};

/**
 * Evaluates SLA Status for Onboarding (5 business days SLA)
 */
export const evaluateOnboardingSLA = (dataInicioStr: string): {
  status: 'ok' | 'warning' | 'expired';
  daysRemaining: number;
  message: string;
} => {
  const days = getBusinessDaysRemaining(dataInicioStr);
  if (days < 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      message: 'Data de início já ultrapassada',
    };
  }
  if (days < 5) {
    return {
      status: 'warning',
      daysRemaining: days,
      message: `Atenção: Prazo de SLA de TI inferior a 5 dias úteis (${days} dia${days === 1 ? '' : 's'} restante${days === 1 ? '' : 's'})`,
    };
  }
  return {
    status: 'ok',
    daysRemaining: days,
    message: `SLA dentro do padrão (${days} dias úteis até o início)`,
  };
};

export const generateTicketId = (prefix: 'ONB' | 'OFF'): string => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${year}-${randomNum}`;
};
