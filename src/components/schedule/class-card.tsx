import React from 'react';
import { formatTime, getStatusBadgeClass } from '@/lib/format';

interface ClassCardProps {
  item: any;
  onBook?: (id: string | number) => void;
}

export function ClassCard({ item, onBook }: ClassCardProps) {
  return (
    <div className="border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg">{item.title ?? item.name ?? 'Fitness Class'}</h3>
          {item.status && (
            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusBadgeClass(item.status)}`}>
              {item.status}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
        <div className="text-xs text-gray-500 space-y-1 mb-4">
          {item.startTime && <div>⏰ {formatTime(item.startTime)}</div>}
          {item.instructor && <div>👤 {item.instructor}</div>}
          {item.capacity && <div>👥 Capacity: {item.bookedCount ?? 0} / {item.capacity}</div>}
        </div>
      </div>
      {onBook && (
        <button
          onClick={() => onBook(item.id)}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Book Class
        </button>
      )}
    </div>
  );
}
