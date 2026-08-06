'use client';

import { FinancialPlanData, FinancialScores } from '@/types/financial-plan';
import { formatCurrency } from '@/lib/financial-scoring';
import { ShieldAlert, ShieldCheck, TrendingDown, TrendingUp, Trophy } from 'lucide-react';

interface PyramidProps {
  data: FinancialPlanData;
  scores: FinancialScores;
}

export function FinancialPyramid({ data, scores }: PyramidProps) {
  // Pyramid Levels
  const levels = [
    {
      level: 5,
      title: 'Future Planning',
      desc: 'Legacy, Estate, Taxes',
      icon: <Trophy className="w-5 h-5 text-amber-500" />,
      color: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
      width: '40%',
      status: scores.goalPlanningScore > 50 ? 'On Track' : 'Needs Focus'
    },
    {
      level: 4,
      title: 'Wealth Creation',
      desc: 'Mutual Funds, Equity',
      icon: <TrendingUp className="w-5 h-5 text-indigo-500" />,
      color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400',
      width: '55%',
      status: `${scores.investmentScore}% Health`
    },
    {
      level: 3,
      title: 'Debt Management',
      desc: 'Loans, Credit Cards',
      icon: <TrendingDown className="w-5 h-5 text-rose-500" />,
      color: 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400',
      width: '70%',
      status: `${scores.debtScore}% Health`
    },
    {
      level: 2,
      title: 'Protection',
      desc: 'Life & Health Cover',
      icon: <ShieldCheck className="w-5 h-5 text-blue-500" />,
      color: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
      width: '85%',
      status: `${scores.protectionScore}% Health`
    },
    {
      level: 1,
      title: 'Emergency Fund',
      desc: '6-12 Months Liquidity',
      icon: <ShieldAlert className="w-5 h-5 text-emerald-500" />,
      color: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
      width: '100%',
      status: `${scores.emergencyScore}% Health`
    }
  ];

  return (
    <div className="flex flex-col items-center justify-end h-full gap-2 w-full py-8">
      {levels.map((lvl, index) => (
        <div 
          key={lvl.level}
          className={`flex flex-col items-center justify-center border-b-4 border-l-4 border-r-4 rounded-t-sm rounded-b-xl p-4 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] cursor-default ${lvl.color}`}
          style={{ width: lvl.width, minHeight: '80px', borderTopWidth: index === 0 ? '4px' : '0' }}
        >
          <div className="flex items-center gap-2 mb-1">
            {lvl.icon}
            <h4 className="font-bold tracking-tight text-sm md:text-base uppercase">{lvl.title}</h4>
          </div>
          <p className="text-[10px] md:text-xs opacity-80 font-medium">{lvl.desc}</p>
          <div className="mt-2 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full bg-background/50 border border-current/20">
            {lvl.status}
          </div>
        </div>
      ))}
    </div>
  );
}
