'use client';

import { FinancialPlanData, FinancialScores } from '@/types/financial-plan';
import { formatCurrency } from '@/lib/financial-scoring';
import { forwardRef } from 'react';

interface PdfRendererProps {
  data: FinancialPlanData;
  scores: FinancialScores;
}

export const PdfRenderer = forwardRef<HTMLDivElement, PdfRendererProps>(({ data, scores }, ref) => {
  const date = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Real Calculations
  const totalMonthlyIncome = data.income.monthlyIncome + (data.income.annualIncome / 12) + data.income.rentalIncome + data.income.businessIncome + data.income.passiveIncome;
  const totalMonthlyExpense = data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.education + data.expenses.medical + data.expenses.transportation + data.expenses.insurancePremium + data.expenses.entertainment + data.expenses.utilities + data.expenses.otherExpenses;
  const monthlySavings = totalMonthlyIncome - totalMonthlyExpense;
  const annualIncome = totalMonthlyIncome * 12;

  let totalLifeCover = 0;
  let totalHealthCover = 0;
  data.insurance.forEach(ins => {
    if (ins.type === 'Life Insurance' || ins.type === 'Term Insurance') totalLifeCover += ins.coverage;
    if (ins.type === 'Health Insurance' || ins.type === 'Critical Illness') totalHealthCover += ins.coverage;
  });

  const targetLifeCover = annualIncome * 20;
  const lifeSecured = totalLifeCover >= targetLifeCover;

  const targetHealthCover = 1000000;
  const healthSecured = totalHealthCover >= targetHealthCover;

  const liquidAssets = data.savings.savingsAccount + data.savings.cash + data.savings.liquidFunds + data.savings.emergencySavings;
  const targetEmergency = annualIncome;
  const emergencySecured = liquidAssets >= targetEmergency;

  let totalSIP = 0;
  data.investments.forEach(inv => totalSIP += inv.monthlySIP);
  const targetSIP = monthlySavings * 0.5;
  const wealthSecured = totalSIP >= targetSIP && monthlySavings > 0;

  const paSecured = !!data.hasPersonalAccident;

  // 6. Goal Planning
  let totalGoalTarget = 0;
  let maxGoalYears = 0;
  data.goals.forEach(g => {
    totalGoalTarget += (g.targetAmount || 0);
    if ((g.targetYear || 0) > maxGoalYears) {
      maxGoalYears = g.targetYear;
    }
  });

  let goalSecured = true;
  let goalActionText = "No specific goals added. Add goals in the wizard to see projections.";
  let fvOfSips = 0;
  let requiredSip = 0;
  
  if (totalGoalTarget > 0 && maxGoalYears > 0) {
    const r = 0.12 / 12; // 12% annual return, monthly rate
    const n = maxGoalYears * 12; // months
    fvOfSips = totalSIP > 0 ? totalSIP * ((Math.pow(1 + r, n) - 1) / r) * (1 + r) : 0;
    requiredSip = (totalGoalTarget * r) / ((Math.pow(1 + r, n) - 1) * (1 + r));
    goalSecured = fvOfSips >= totalGoalTarget;
    
    if (goalSecured) {
      goalActionText = `At 12% returns, your current SIPs will grow to ${formatCurrency(fvOfSips)}, easily achieving your ${formatCurrency(totalGoalTarget)} goals in ${maxGoalYears} years!`;
    } else {
      const shortfall = requiredSip - totalSIP;
      goalActionText = `Your SIPs will only reach ${formatCurrency(fvOfSips)}. Action Required: Invest an additional ${formatCurrency(shortfall)} per month to hit your ${formatCurrency(totalGoalTarget)} goal in ${maxGoalYears} years.`;
    }
  } else if (totalGoalTarget > 0) {
    goalActionText = "Please specify 'Years to Achieve' for your goals to see projections.";
    goalSecured = false;
  }

  return (
    <div ref={ref} className="bg-white w-[794px] mx-auto font-sans" style={{ boxSizing: 'border-box' }}>
      
      {/* PAGE 1: Overview */}
      <div id="pdf-page-1" className="relative p-10 h-[1123px] w-[794px] bg-white overflow-hidden border-b border-gray-100 text-black">
        {/* Header */}
        <div className="flex justify-between items-end border-b-2 border-indigo-600 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">Financial Planning Report</h1>
            <p className="text-gray-600 mt-2 font-medium">Prepared for: <span className="text-black">{data.personal.fullName || 'Client'}</span></p>
            <p className="text-gray-600">Date: <span className="text-black">{date}</span></p>
          </div>
          <div className="flex flex-col items-end text-right">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Apex Solutions" className="h-12 w-auto object-contain" />
              <div className="text-2xl font-black text-indigo-600 tracking-tighter mt-1">Apex Solutions</div>
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">Wealth Management | +91 9327001565</p>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-indigo-900 mb-4 border-l-4 border-indigo-600 pl-3">Executive Summary</h2>
          <div className="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm text-gray-600 uppercase font-semibold">Financial Health Score</p>
              <p className="text-4xl font-black text-indigo-600 mt-1">{scores.overallReadinessScore}<span className="text-lg text-gray-400">/100</span></p>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Emergency</p>
                  <p className="font-bold">{scores.emergencyScore}%</p>
               </div>
               <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Protection</p>
                  <p className="font-bold">{scores.protectionScore}%</p>
               </div>
               <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Savings</p>
                  <p className="font-bold">{scores.savingsScore}%</p>
               </div>
               <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Debt</p>
                  <p className="font-bold">{scores.debtScore}%</p>
               </div>
            </div>
          </div>
        </div>

        {/* Pyramid Overview (Static Print Version) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-indigo-900 mb-4 border-l-4 border-indigo-600 pl-3">Financial Pyramid Analysis</h2>
          <div className="flex flex-col items-center gap-1">
            <div className="bg-amber-100 border-2 border-amber-300 w-1/2 p-3 text-center rounded-t-lg">
              <p className="font-bold text-amber-800">Future Planning</p>
              <p className="text-xs text-amber-700">Goal Score: {scores.goalPlanningScore}%</p>
            </div>
            <div className="bg-indigo-100 border-2 border-indigo-300 w-3/5 p-3 text-center">
              <p className="font-bold text-indigo-800">Wealth Creation</p>
              <p className="text-xs text-indigo-700">Investment Score: {scores.investmentScore}%</p>
            </div>
            <div className="bg-rose-100 border-2 border-rose-300 w-3/4 p-3 text-center">
              <p className="font-bold text-rose-800">Debt Management</p>
              <p className="text-xs text-rose-700">Debt Score: {scores.debtScore}%</p>
            </div>
            <div className="bg-blue-100 border-2 border-blue-300 w-[85%] p-3 text-center">
              <p className="font-bold text-blue-800">Protection (Insurance)</p>
              <p className="text-xs text-blue-700">Protection Score: {scores.protectionScore}%</p>
            </div>
            <div className="bg-emerald-100 border-2 border-emerald-300 w-full p-4 text-center rounded-b-lg shadow-sm">
              <p className="font-bold text-emerald-800">Emergency Fund (Foundation)</p>
              <p className="text-xs text-emerald-700">Emergency Score: {scores.emergencyScore}%</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mb-8 grid grid-cols-2 gap-8">
          <div>
             <h2 className="text-lg font-bold text-indigo-900 mb-3 border-b-2 border-gray-100 pb-2">Cash Flow</h2>
             <table className="w-full text-sm">
               <tbody>
                 <tr className="border-b border-gray-100">
                   <td className="py-2 text-gray-600">Monthly Income</td>
                   <td className="py-2 text-right font-semibold">{formatCurrency(totalMonthlyIncome)}</td>
                 </tr>
                 <tr className="border-b border-gray-100">
                   <td className="py-2 text-gray-600">Monthly Expenses</td>
                   <td className="py-2 text-right font-semibold text-rose-600">-{formatCurrency(totalMonthlyExpense)}</td>
                 </tr>
                 <tr>
                   <td className="py-2 font-bold text-gray-800">Monthly Savings</td>
                   <td className="py-2 text-right font-bold text-emerald-600">{formatCurrency(monthlySavings)}</td>
                 </tr>
               </tbody>
             </table>
          </div>
          <div>
             <h2 className="text-lg font-bold text-indigo-900 mb-3 border-b-2 border-gray-100 pb-2">Net Worth Snapshot</h2>
             <table className="w-full text-sm">
               <tbody>
                 <tr className="border-b border-gray-100">
                   <td className="py-2 text-gray-600">Liquid Assets</td>
                   <td className="py-2 text-right font-semibold">{formatCurrency(liquidAssets)}</td>
                 </tr>
                 <tr className="border-b border-gray-100">
                   <td className="py-2 text-gray-600">Investments</td>
                   <td className="py-2 text-right font-semibold">{formatCurrency(data.investments.reduce((a, b) => a + b.currentValue, 0))}</td>
                 </tr>
                 <tr>
                   <td className="py-2 font-bold text-gray-800">Total Liabilities</td>
                   <td className="py-2 text-right font-bold text-rose-600">
                     -{formatCurrency(data.loans.reduce((a, b) => a + b.totalOutstanding, 0))}
                   </td>
                 </tr>
               </tbody>
             </table>
          </div>
        </div>

        <div className="absolute bottom-10 left-10 right-10 border-t-2 border-gray-200 pt-4 flex justify-between items-center text-xs text-gray-500">
          <p>Confidential • Prepared by Apex Solutions</p>
          <p>Page 1 of 2</p>
        </div>
      </div>

      {/* PAGE 2: Actionables */}
      <div id="pdf-page-2" className="relative p-10 h-[1123px] w-[794px] bg-white overflow-hidden text-black">
        <div className="flex justify-between items-end border-b-2 border-indigo-600 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">Your Action Plan</h1>
            <p className="text-gray-600 mt-2 font-medium">6 Pillars of Financial Security</p>
          </div>
          <div className="flex flex-col items-end text-right">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Apex Solutions" className="h-12 w-auto object-contain" />
              <div className="text-2xl font-black text-indigo-600 tracking-tighter mt-1">Apex Solutions</div>
            </div>
            <p className="text-sm text-gray-500 font-medium mt-1">Wealth Management | +91 9327001565</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Life Insurance */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
              <span className="text-lg">🛡️</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-gray-900">1. Life Insurance (Target: 20x Income)</h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${lifeSecured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {lifeSecured ? 'Secured' : 'Action Needed'}
                </span>
              </div>
              <p className="text-gray-700 text-sm mt-1">Current Cover: {formatCurrency(totalLifeCover)}</p>
              {!lifeSecured && (
                <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs font-semibold text-blue-900">
                  Action: Add {formatCurrency(targetLifeCover - totalLifeCover)} Term Insurance to reach your {formatCurrency(targetLifeCover)} target.
                </div>
              )}
            </div>
          </div>

          {/* Health Insurance */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 border border-rose-200">
              <span className="text-lg">❤️</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-gray-900">2. Health Insurance (Min 10 Lakhs)</h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${healthSecured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {healthSecured ? 'Secured' : 'Action Needed'}
                </span>
              </div>
              <p className="text-gray-700 text-sm mt-1">Current Cover: {formatCurrency(totalHealthCover)}</p>
              {!healthSecured && (
                <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs font-semibold text-rose-900">
                  Action: Increase health cover by {formatCurrency(targetHealthCover - totalHealthCover)} to protect against medical inflation.
                </div>
              )}
            </div>
          </div>

          {/* Emergency Fund */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-200">
              <span className="text-lg">🏦</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-gray-900">3. Emergency Fund (1 Year Annual Income)</h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${emergencySecured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {emergencySecured ? 'Secured' : 'Action Needed'}
                </span>
              </div>
              <p className="text-gray-700 text-sm mt-1">Current Liquid Assets: {formatCurrency(liquidAssets)}</p>
              {!emergencySecured && (
                <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs font-semibold text-amber-900">
                  Action: Build your emergency fund by {formatCurrency(targetEmergency - liquidAssets)} for a 1-year safety net.
                </div>
              )}
            </div>
          </div>

          {/* Personal Accident */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0 border border-purple-200">
              <span className="text-lg">☂️</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-gray-900">4. Personal Accident Policy</h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${paSecured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {paSecured ? 'Secured' : 'Action Needed'}
                </span>
              </div>
              <p className="text-gray-700 text-sm mt-1">Crucial income replacement against accidental disabilities.</p>
              {!paSecured && (
                <div className="mt-2 p-2 bg-white rounded-lg border border-purple-200 text-xs font-bold text-purple-900">
                  Action: Highly recommended to purchase a Personal Accident cover. Nominal premium, huge protection.
                </div>
              )}
            </div>
          </div>

          {/* Wealth Creation */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 border border-emerald-200">
              <span className="text-lg">📈</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-gray-900">5. Wealth Creation (Mutual Funds)</h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${wealthSecured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {wealthSecured ? 'Secured' : 'Action Needed'}
                </span>
              </div>
              <p className="text-gray-700 text-sm mt-1">Current Monthly SIP: {formatCurrency(totalSIP)}</p>
              {!wealthSecured && (
                <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs font-semibold text-emerald-900">
                  Action: {!emergencySecured 
                    ? `Start a SIP of ${formatCurrency(targetSIP - totalSIP)} and sweep it into liquid funds for your Emergency Fund first.`
                    : `Increase your Monthly SIP by ${formatCurrency(targetSIP - totalSIP)} into equity/mutual funds.`}
                </div>
              )}
            </div>
          </div>

          {/* Goal Planning */}
          <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 border border-indigo-200">
              <span className="text-lg">🎯</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-base text-gray-900">6. Goal Planning (12% Projections)</h3>
                <span className={`text-[10px] px-2 py-1 rounded font-bold ${goalSecured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {goalSecured ? 'On Track' : 'Action Needed'}
                </span>
              </div>
              <p className="text-gray-700 text-sm mt-1">Target: {formatCurrency(totalGoalTarget)} in {maxGoalYears} years.</p>
              <div className="mt-2 p-2 bg-white rounded-lg border border-gray-200 text-xs font-semibold text-indigo-900">
                {goalActionText}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-10 right-10 border-t-2 border-gray-200 pt-4 flex justify-between items-center text-xs text-gray-500">
          <p>Confidential • Prepared by Apex Solutions</p>
          <p>Page 2 of 2</p>
        </div>
      </div>
    </div>
  );
});

PdfRenderer.displayName = 'PdfRenderer';
