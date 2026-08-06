'use client';

import { FinancialPlanData, FinancialScores } from '@/types/financial-plan';
import { formatCurrency } from '@/lib/financial-scoring';
import { Lightbulb, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface RecommendationsProps {
  data: FinancialPlanData;
  scores: FinancialScores;
}

export function Recommendations({ data, scores }: RecommendationsProps) {
  const recommendations: { type: 'success' | 'warning' | 'info', text: string, title: string }[] = [];

  // Income calculations
  const totalMonthlyIncome = data.income.monthlyIncome + (data.income.annualIncome / 12) + data.income.rentalIncome + data.income.businessIncome + data.income.passiveIncome;
  const totalMonthlyExpense = data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.education + data.expenses.medical + data.expenses.transportation + data.expenses.insurancePremium + data.expenses.entertainment + data.expenses.utilities + data.expenses.otherExpenses;
  const monthlySavings = totalMonthlyIncome - totalMonthlyExpense;

  // 1. Emergency Fund
  const liquidAssets = data.savings.savingsAccount + data.savings.cash + data.savings.liquidFunds + data.savings.emergencySavings;
  const targetEmergency = totalMonthlyExpense * 6;
  if (liquidAssets < targetEmergency) {
    const gap = targetEmergency - liquidAssets;
    recommendations.push({
      type: 'warning',
      title: 'Build Emergency Fund',
      text: `Increase Emergency Fund by ${formatCurrency(gap)} to reach the recommended 6-month safety net of ${formatCurrency(targetEmergency)}.`
    });
  } else {
    recommendations.push({
      type: 'success',
      title: 'Emergency Ready',
      text: `Great job! You have sufficient liquid assets (${formatCurrency(liquidAssets)}) to cover 6+ months of expenses.`
    });
  }

  // 2. Protection / Insurance
  let totalLifeCover = 0;
  let totalHealthCover = 0;
  data.insurance.forEach(ins => {
    if (ins.type === 'Life Insurance' || ins.type === 'Term Insurance') totalLifeCover += ins.coverage;
    if (ins.type === 'Health Insurance' || ins.type === 'Critical Illness') totalHealthCover += ins.coverage;
  });
  
  const annualIncome = totalMonthlyIncome * 12;
  const targetLifeCover = annualIncome * 10;
  if (totalLifeCover < targetLifeCover && annualIncome > 0) {
    recommendations.push({
      type: 'warning',
      title: 'Increase Life Cover',
      text: `Consider purchasing an additional ${formatCurrency(targetLifeCover - totalLifeCover)} Term Insurance to adequately protect your family (10x annual income).`
    });
  }

  const targetHealthCover = 1000000;
  if (totalHealthCover < targetHealthCover) {
    recommendations.push({
      type: 'warning',
      title: 'Increase Health Cover',
      text: `Increase your Health Insurance coverage to at least ${formatCurrency(targetHealthCover)} to protect against medical inflation.`
    });
  }

  // 3. Debt Management
  const emiRatio = totalMonthlyIncome > 0 ? (data.expenses.emi / totalMonthlyIncome) * 100 : 0;
  if (emiRatio > 40) {
    recommendations.push({
      type: 'warning',
      title: 'Reduce Debt Burden',
      text: `Your EMIs consume ${emiRatio.toFixed(0)}% of your income. Focus on paying down high-interest debt to improve cash flow.`
    });
  } else if (emiRatio > 0) {
    recommendations.push({
      type: 'info',
      title: 'Manageable Debt',
      text: `Your EMI burden is healthy at ${emiRatio.toFixed(0)}%. Continue regular payments.`
    });
  }

  // 4. Wealth Creation
  let totalSIP = 0;
  data.investments.forEach(inv => totalSIP += inv.monthlySIP);
  const targetSIP = monthlySavings * 0.5; // Invest 50% of savings
  
  if (monthlySavings > 0) {
    if (totalSIP < targetSIP) {
      recommendations.push({
        type: 'info',
        title: 'Optimize Savings',
        text: `Start or increase your Monthly SIPs by ${formatCurrency(targetSIP - totalSIP)} to maximize long-term wealth creation.`
      });
    } else {
      recommendations.push({
        type: 'success',
        title: 'Excellent Investing Habit',
        text: `You are investing a healthy portion of your monthly savings (${formatCurrency(totalSIP)} SIP).`
      });
    }
  }

  // 5. General Advice
  recommendations.push({
    type: 'info',
    title: 'Regular Review',
    text: 'Review this portfolio and update your goals every 6 months or whenever a major life event occurs.'
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Lightbulb className="w-5 h-5 text-amber-500" /> Actionable Recommendations
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((rec, i) => (
          <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 ${
            rec.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-300' :
            rec.type === 'warning' ? 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-300' :
            'bg-indigo-500/10 border-indigo-500/20 text-indigo-900 dark:text-indigo-300'
          }`}>
            <div className="shrink-0 mt-0.5">
              {rec.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {rec.type === 'warning' && <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {rec.type === 'info' && <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-1">{rec.title}</h4>
              <p className="text-sm opacity-90 leading-snug">{rec.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
