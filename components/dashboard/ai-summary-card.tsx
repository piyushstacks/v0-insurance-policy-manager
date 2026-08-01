'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, Loader2 } from 'lucide-react';

export function AIBusinessSummaryCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['ai-summary'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/ai-summary');
      if (!res.ok) throw new Error('Failed to fetch AI summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 60, // 1 hour (it's cached in Redis anyway)
  });

  if (isError) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-card transition-colors/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-card transition-colors/20 flex items-center justify-center backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
          </div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200">
            Monthly Executive Briefing
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-3 text-indigo-200/60 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Synthesizing business performance...</span>
          </div>
        ) : (
          <div className="flex gap-4 items-start">
             <TrendingUp className="w-8 h-8 text-indigo-300 shrink-0 mt-1" />
             <p className="text-sm md:text-base text-indigo-50 leading-relaxed font-medium">
               {data?.summary || 'No summary available.'}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
