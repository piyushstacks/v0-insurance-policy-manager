'use client';

import { FinancialPlanData, FinancialScores } from '@/types/financial-plan';
import { calculateFinancialScores, formatCurrency } from '@/lib/financial-scoring';
import { FinancialPyramid } from './pyramid';
import { ChartsDashboard } from './charts-dashboard';
import { Recommendations } from './recommendations';
import { Button } from '@/components/ui/button';
import { Share2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const PdfExportButton = dynamic(() => import('../pdf/pdf-export-button'), { ssr: false });

interface ReportViewProps {
  data: FinancialPlanData;
  onEdit: () => void;
  pdfRef: React.RefObject<HTMLDivElement | null>;
}

export function ReportView({ data, onEdit, pdfRef }: ReportViewProps) {
  const scores: FinancialScores = calculateFinancialScores(data);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
      
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Financial Planning Report</h1>
          <p className="text-sm text-muted-foreground">Prepared for {data.personal.fullName || 'Client'} • {new Date().toLocaleDateString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit2 className="w-4 h-4 mr-2" /> Edit Data
          </Button>
          <PdfExportButton planData={data} pdfRef={pdfRef} />
        </div>
      </div>

      {/* Top Section: Score & Pyramid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Main Health Score */}
        <div className="lg:col-span-4 bg-card border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
          <h2 className="text-lg font-semibold text-muted-foreground mb-4 z-10">Financial Health Score</h2>
          <div className="relative w-48 h-48 flex items-center justify-center z-10">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <path
                className="text-muted/20"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className={`${getScoreColor(scores.overallReadinessScore)} drop-shadow-md transition-all duration-1000 ease-out`}
                strokeDasharray={`${scores.overallReadinessScore}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-5xl font-black tracking-tighter ${getScoreColor(scores.overallReadinessScore)}`}>
                {scores.overallReadinessScore}
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">out of 100</span>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium opacity-80">
            {scores.overallReadinessScore >= 80 ? 'Excellent Financial Health! Keep it up.' : scores.overallReadinessScore >= 50 ? 'Fair Health. Some areas need improvement.' : 'Critical Action Needed.'}
          </p>
        </div>

        {/* Financial Pyramid */}
        <div className="lg:col-span-8 bg-card border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-2">The Financial Planning Pyramid</h2>
          <p className="text-sm text-muted-foreground mb-4">A structured roadmap to long-term financial freedom.</p>
          <FinancialPyramid data={data} scores={scores} />
        </div>
      </div>

      {/* Sub-Scores Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Emergency', score: scores.emergencyScore },
          { label: 'Protection', score: scores.protectionScore },
          { label: 'Debt', score: scores.debtScore },
          { label: 'Savings', score: scores.savingsScore },
          { label: 'Investment', score: scores.investmentScore },
          { label: 'Retirement', score: scores.retirementScore }
        ].map(item => (
          <div key={item.label} className="bg-card border rounded-xl p-4 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{item.label}</span>
            <span className={`text-2xl font-bold ${getScoreColor(item.score)}`}>{item.score}</span>
            <div className="w-full bg-muted rounded-full h-1.5 mt-3">
              <div className={`h-1.5 rounded-full ${getScoreBg(item.score)}`} style={{ width: `${item.score}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts & Visualizations */}
      <ChartsDashboard data={data} />

      {/* Recommendations */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm">
        <Recommendations data={data} scores={scores} />
      </div>

    </div>
  );
}
