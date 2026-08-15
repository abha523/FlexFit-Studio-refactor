"use client";

import { trpc } from "@/lib/trpc";
import { formatDateTime } from "@/lib/format";

export default function SchedulePage() {
  const utils = trpc.useUtils ? trpc.useUtils() : (trpc as any).useContext();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: classes, isLoading, error } = trpc.classes.list.useQuery({});
  const { data: myBookings } = trpc.bookings.mine.useQuery(
    { includePast: false },
    { enabled: !!user }
  );

  // Map classId -> booking status ("booked" | "waitlisted")
  const bookingMap = new Map(
    myBookings?.map((b) => [b.classId, b.status]) ?? []
  );

  const book = trpc.bookings.book.useMutation({
    onSuccess: async () => {
      if (utils.classes?.list) await utils.classes.list.invalidate();
      if (utils.bookings?.mine) await utils.bookings.mine.invalidate();
      if (utils.auth?.me) await utils.auth.me.invalidate();
    },
  });

  if (isLoading) return <p className="muted p-4">Loading schedule...</p>;

  if (error) return <p className="p-4 text-red-500">Error loading schedule: {error.message}</p>;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Class schedule</h1>
        <p className="muted mt-1 text-sm">
          {classes?.length ?? 0} classes available
        </p>
      </div>

      {book.error && (
        <div className="rounded bg-red-950/40 p-3 border border-red-500/30 text-sm text-red-400">
          {book.error.message}
        </div>
      )}

      {(!classes || classes.length === 0) ? (
        <p className="muted text-sm">No classes available at this time.</p>
      ) : (
        <div className="space-y-2">
          {classes.map((c) => {
            const userBookingStatus = bookingMap.get(c.id);
            const isBooked = userBookingStatus === "booked";
            const isWaitlisted = userBookingStatus === "waitlisted";

            return (
              <div
                key={c.id}
                className="panel flex items-center gap-4 p-4 border rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{c.name}</h2>
                    {c.full && (
                      <span className="rounded px-1.5 py-0.5 text-xs" style={{ background: "#3a2a1a", color: "#fbbf24" }}>
                        Full
                      </span>
                    )}
                  </div>
                  <p className="muted mt-0.5 text-sm">
                    {formatDateTime(c.startsAt)} &middot; {c.room} &middot;{" "}
                    {c.trainerName ?? "Unassigned"} &middot; {c.durationMin} min
                  </p>
                </div>

                <div className="text-right text-sm muted">
                  <div>
                    {c.spotsLeft} / {c.capacity} left
                  </div>
                  <div>
                    {c.creditCost} credit{c.creditCost === 1 ? "" : "s"}
                  </div>
                </div>

                <div>
                  {isBooked ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                      Booked
                    </span>
                  ) : isWaitlisted ? (
                    <span className="inline-flex items-center rounded-md bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                      Waitlisted
                    </span>
                  ) : (
                    <button
                      className="btn btn-primary px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm disabled:opacity-50"
                      disabled={!user || book.isPending}
                      onClick={() => book.mutate({ classId: c.id })}
                    >
                      {book.isPending ? "Booking..." : c.full ? "Join waitlist" : "Book"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!user && (
        <p className="muted text-sm">Sign in to book a class.</p>
      )}
    </div>
  );
}
