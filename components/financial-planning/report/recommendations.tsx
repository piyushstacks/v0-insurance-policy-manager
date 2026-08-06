'use client';

import { FinancialPlanData, FinancialScores } from '@/types/financial-plan';
import { formatCurrency } from '@/lib/financial-scoring';
import { Shield, HeartPulse, PiggyBank, TrendingUp, Umbrella, Target, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface RecommendationsProps {
  data: FinancialPlanData;
  scores: FinancialScores;
}

export function Recommendations({ data, scores }: RecommendationsProps) {
  // Income calculations
  const totalMonthlyIncome = data.income.monthlyIncome + (data.income.annualIncome / 12) + data.income.rentalIncome + data.income.businessIncome + data.income.passiveIncome;
  const totalMonthlyExpense = data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.education + data.expenses.medical + data.expenses.transportation + data.expenses.insurancePremium + data.expenses.entertainment + data.expenses.utilities + data.expenses.otherExpenses;
  const monthlySavings = totalMonthlyIncome - totalMonthlyExpense;
  const annualIncome = totalMonthlyIncome * 12;

  // 1. Life Insurance (Target: 20x Annual Income)
  let totalLifeCover = 0;
  let totalHealthCover = 0;
  data.insurance.forEach(ins => {
    if (ins.type === 'Life Insurance' || ins.type === 'Term Insurance') totalLifeCover += ins.coverage;
    if (ins.type === 'Health Insurance' || ins.type === 'Critical Illness') totalHealthCover += ins.coverage;
  });

  const targetLifeCover = annualIncome * 20;
  const lifeProgress = targetLifeCover > 0 ? Math.min(100, (totalLifeCover / targetLifeCover) * 100) : 100;
  const lifeSecured = lifeProgress >= 100;

  // 2. Health Insurance (Target: 10L)
  const targetHealthCover = 1000000;
  const healthProgress = Math.min(100, (totalHealthCover / targetHealthCover) * 100);
  const healthSecured = healthProgress >= 100;

  // 3. Emergency Fund (Target: 1 Year Annual Income)
  const liquidAssets = data.savings.savingsAccount + data.savings.cash + data.savings.liquidFunds + data.savings.emergencySavings;
  const targetEmergency = annualIncome;
  const emergencyProgress = targetEmergency > 0 ? Math.min(100, (liquidAssets / targetEmergency) * 100) : 100;
  const emergencySecured = emergencyProgress >= 100;

  // 4. Wealth Creation / Mutual Funds (Target: 50% of savings in SIP)
  let totalSIP = 0;
  data.investments.forEach(inv => totalSIP += inv.monthlySIP);
  const targetSIP = monthlySavings * 0.5;
  const sipProgress = targetSIP > 0 ? Math.min(100, (totalSIP / targetSIP) * 100) : (monthlySavings <= 0 ? 0 : 100);
  const wealthSecured = sipProgress >= 100;

  // 5. Personal Accident
  const paSecured = !!data.hasPersonalAccident;

  // 6. Goal Planning
  let totalGoalTarget = 0;
  let maxGoalYears = 0;
  data.goals.forEach(g => {
    totalGoalTarget += Number(g.targetAmount || 0);
    const targetYr = Number(g.targetYear || 0);
    if (targetYr > maxGoalYears) {
      maxGoalYears = targetYr;
    }
  });

  let goalSecured = true;
  let goalProgress = 100;
  let goalActionText = "No specific goals added. Add goals in the wizard to see projections.";
  
  if (totalGoalTarget > 0 && maxGoalYears > 0) {
    const r = 0.12 / 12; // 12% annual return, monthly rate
    const n = maxGoalYears * 12; // months
    
    // Future Value of current SIPs
    const fvOfSips = totalSIP > 0 ? totalSIP * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) : 0;
    
    // Required SIP to reach Target
    const requiredSip = (totalGoalTarget * r) / ((Math.pow(1 + r, n) - 1) * (1 + r));
    
    goalProgress = Math.min(100, (fvOfSips / totalGoalTarget) * 100);
    goalSecured = fvOfSips >= totalGoalTarget;
    
    if (goalSecured) {
      goalActionText = `At 12% returns, your current SIPs will grow to ${formatCurrency(fvOfSips)}, easily achieving your ${formatCurrency(totalGoalTarget)} goals in ${maxGoalYears} years!`;
    } else {
      const shortfall = requiredSip - totalSIP;
      goalActionText = `Your SIPs will only reach ${formatCurrency(fvOfSips)}. Action Required: Invest an additional ${formatCurrency(shortfall)} per month (increase income/savings) to hit your ${formatCurrency(totalGoalTarget)} goal in ${maxGoalYears} years.`;
    }
  } else if (totalGoalTarget > 0) {
    goalActionText = "Please specify 'Years to Achieve' for your goals to see projections.";
    goalSecured = false;
    goalProgress = 0;
  }

  const actionables = [
    {
      id: 'life',
      title: 'Life Insurance (20x Income)',
      icon: Shield,
      secured: lifeSecured,
      progress: lifeProgress,
      actionText: lifeSecured 
        ? `Your family is well protected with ${formatCurrency(totalLifeCover)} life cover.`
        : `Action Required: Add ${formatCurrency(targetLifeCover - totalLifeCover)} Term Insurance to reach your ${formatCurrency(targetLifeCover)} target.`,
      color: 'blue'
    },
    {
      id: 'health',
      title: 'Health Insurance (Min 10L)',
      icon: HeartPulse,
      secured: healthSecured,
      progress: healthProgress,
      actionText: healthSecured 
        ? `You have adequate medical cover (${formatCurrency(totalHealthCover)}).`
        : `Action Required: Increase your health cover by ${formatCurrency(targetHealthCover - totalHealthCover)} to protect against medical inflation.`,
      color: 'rose'
    },
    {
      id: 'emergency',
      title: 'Emergency Fund (1 Yr Income)',
      icon: PiggyBank,
      secured: emergencySecured,
      progress: emergencyProgress,
      actionText: emergencySecured 
        ? `Great job! You have ${formatCurrency(liquidAssets)} in liquid assets.`
        : `Action Required: Build your emergency fund by ${formatCurrency(targetEmergency - liquidAssets)} for a 1-year safety net.`,
      color: 'amber'
    },
    {
      id: 'pa',
      title: 'Personal Accident Policy',
      icon: Umbrella,
      secured: paSecured,
      progress: paSecured ? 100 : 0,
      actionText: paSecured 
        ? `Excellent! You are covered against accidental disabilities.`
        : `Action Required: Highly recommended to purchase a Personal Accident cover. It has a very nominal premium and protects your income against disability.`,
      color: 'purple'
    },
    {
      id: 'wealth',
      title: 'Wealth Creation (Mutual Funds)',
      icon: TrendingUp,
      secured: wealthSecured,
      progress: sipProgress,
      actionText: wealthSecured 
        ? `You are investing a healthy ${formatCurrency(totalSIP)} monthly.`
        : (!emergencySecured 
            ? `Action Required: Start a SIP of ${formatCurrency(targetSIP - totalSIP)} and sweep it into liquid funds for your Emergency Fund first. Then shift to equity.`
            : `Action Required: Increase your Monthly SIP by ${formatCurrency(targetSIP - totalSIP)} into equity/mutual funds to maximize wealth.`),
      color: 'emerald'
    },
    {
      id: 'goals',
      title: 'Goal Planning (12% Projections)',
      icon: Target,
      secured: goalSecured,
      progress: goalProgress,
      actionText: goalActionText,
      color: 'indigo'
    }
  ];

  const getColorClasses = (color: string, secured: boolean) => {
    if (secured) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300';
    return 'bg-card border-border hover:shadow-md text-foreground';
  };

  const getIconColor = (color: string, secured: boolean) => {
    if (secured) return 'text-emerald-600 dark:text-emerald-400';
    switch (color) {
      case 'blue': return 'text-blue-500';
      case 'rose': return 'text-rose-500';
      case 'amber': return 'text-amber-500';
      case 'purple': return 'text-purple-500';
      case 'emerald': return 'text-emerald-500';
      case 'indigo': return 'text-indigo-500';
      default: return 'text-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">6 Pillars of Financial Security</h3>
          <p className="text-sm text-muted-foreground mt-1">Clear, actionable steps to bulletproof your financial future.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-4 h-4"/> Secured</span>
          <span className="text-border mx-2">|</span>
          <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-4 h-4"/> Action Needed</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {actionables.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className={`p-5 rounded-2xl border transition-all duration-300 ${getColorClasses(item.color, item.secured)}`}>
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl bg-background/50 shadow-sm border border-border/50 ${getIconColor(item.color, item.secured)}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-base">{item.title}</h4>
                    {item.secured ? (
                      <span className="shrink-0 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Secured
                      </span>
                    ) : (
                      <span className="shrink-0 bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Action Needed
                      </span>
                    )}
                  </div>
                  
                  {!item.secured && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium text-muted-foreground">
                        <span>Progress</span>
                        <span>{Math.round(item.progress)}%</span>
                      </div>
                      <Progress 
                        value={item.progress} 
                        className={`h-2 ${item.progress > 50 ? '[&_[data-slot=progress-indicator]]:bg-amber-500' : '[&_[data-slot=progress-indicator]]:bg-rose-500'}`} 
                      />
                    </div>
                  )}

                  <div className={`text-sm leading-relaxed p-3 rounded-lg flex gap-3 ${item.secured ? 'bg-emerald-500/10' : 'bg-muted/50 border border-border/50'}`}>
                    {!item.secured && <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />}
                    <p className={item.secured ? 'opacity-90 font-medium' : 'font-medium'}>{item.actionText}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
