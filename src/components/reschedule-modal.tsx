"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromBookingId?: number;
  fromClassName?: string;
  fromClassTime?: string;
  booking?: any;
}

export function RescheduleModal({
  isOpen,
  onClose,
  fromBookingId,
  fromClassName,
  fromClassTime,
  booking,
}: RescheduleModalProps) {
  const [selectedClassId, setSelectedClassId] = useState<number | "">("");
  const [reason, setReason] = useState("");

  const utils = trpc.useUtils ? trpc.useUtils() : (trpc as any).useContext();

  // Support both individual props and full booking objects
  const bookingId = fromBookingId ?? booking?.id;
  const className = fromClassName ?? booking?.className ?? booking?.class?.name ?? "";
  const startsAt = fromClassTime ?? booking?.startsAt ?? booking?.class?.startsAt;

  // Fetch all classes to find potential reschedule targets
  const { data: classes, isLoading } = trpc.classes.list.useQuery(
    {},
    { enabled: isOpen && !!bookingId }
  );

  const rescheduleMutation = trpc.bookings.reschedule.useMutation({
    onSuccess: async () => {
      if (utils.bookings?.mine) await utils.bookings.mine.invalidate();
      if (utils.classes?.list) await utils.classes.list.invalidate();
      onClose();
      setSelectedClassId("");
      setReason("");
    },
  });

  if (!isOpen) return null;

  // Filter classes: same name, not cancelled
  const availableOptions = (classes ?? []).filter(
    (c) => c.name === className && !c.cancelled
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !bookingId) return;

    rescheduleMutation.mutate({
      fromBookingId: bookingId,
      toClassId: Number(selectedClassId),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl text-neutral-100">
        <h2 className="text-xl font-bold mb-1">Reschedule Class</h2>
        <p className="text-sm text-neutral-400 mb-4">
          Current: <span className="font-medium text-neutral-200">{className || "Selected Class"}</span>{" "}
          {startsAt ? `(${formatDateTime(startsAt)})` : ""}
        </p>

        {rescheduleMutation.error && (
          <div className="mb-4 rounded bg-red-950/50 p-3 border border-red-500/30 text-xs text-red-400">
            {rescheduleMutation.error.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Select New Schedule
            </label>

            {isLoading ? (
              <div className="p-2 text-xs text-neutral-400">Loading available sessions...</div>
            ) : availableOptions.length === 0 ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-xs text-amber-400">
                No alternative upcoming sessions found for <strong>{className}</strong>.
              </div>
            ) : (
              <select
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : "")}
                required
              >
                <option value="">Choose a session...</option>
                {availableOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {formatDateTime(c.startsAt)} — {c.room} ({c.spotsLeft} spots left)
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Reason (Optional)
            </label>
            <textarea
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Why are you rescheduling?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedClassId || rescheduleMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {rescheduleMutation.isPending ? "Rescheduling..." : "Confirm Reschedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
