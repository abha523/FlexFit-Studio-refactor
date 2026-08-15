import React from 'react';

interface ScheduleFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categories: string[];
}

export function ScheduleFilters({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories,
}: ScheduleFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <input
        type="text"
        placeholder="Search classes or instructors..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="px-4 py-2 border rounded-md w-full sm:w-1/2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="px-4 py-2 border rounded-md w-full sm:w-1/4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="ALL">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  );
}
