'use client';

import React from 'react';
import { BarChart3, Clock, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ReportingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
      <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-6 shadow-xl shadow-blue-100/50">
        <BarChart3 className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Advanced Analytics</h1>
      <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
        We are currently building a powerful reporting engine to track your commissions, renewal trends, and portfolio growth.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full mb-10">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
             <ArrowUpRight className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Coming Soon</p>
            <p className="text-sm font-black text-slate-800">Renewal Heatmaps</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shadow-sm">
             <Clock className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Coming Soon</p>
            <p className="text-sm font-black text-slate-800">Commision Tracking</p>
          </div>
        </div>
      </div>

      <Link href="/app">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-8 font-bold shadow-lg shadow-blue-100">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}
