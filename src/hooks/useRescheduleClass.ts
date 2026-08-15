import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export function useRescheduleClass(onSuccess?: () => void) {
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | number | null>(null);
  const [reason, setReason] = useState('');

  const reschedulesRouter = (trpc as any).reschedules;
  const rescheduleMutation = (
    reschedulesRouter?.requestReschedule ||
    reschedulesRouter?.reschedule ||
    reschedulesRouter?.create
  )?.useMutation({
    onSuccess: () => {
      setSelectedScheduleId(null);
      setReason('');
      if (onSuccess) onSuccess();
    },
  }) || { isLoading: false, error: null, mutate: () => {} };

  const handleReschedule = (bookingId: string | number) => {
    if (!selectedScheduleId) return;
    rescheduleMutation.mutate({
      bookingId,
      newScheduleId: selectedScheduleId,
      reason,
    } as any);
  };

  return {
    selectedScheduleId,
    setSelectedScheduleId,
    reason,
    setReason,
    isLoading: rescheduleMutation.isLoading,
    error: rescheduleMutation.error,
    handleReschedule,
  };
}
