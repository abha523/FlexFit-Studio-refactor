export function formatDate(date: Date | string | number): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(date: Date | string | number): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateTime(date: Date | string | number): string {
  if (!date) return '';
  const d = new Date(date);
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount ?? 0);
}

export function formatCurrency(amount: number): string {
  return formatMoney(amount);
}

export function getStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'completed':
    case 'active':
    case 'attended':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelled':
    case 'inactive':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'waitlisted':
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}
