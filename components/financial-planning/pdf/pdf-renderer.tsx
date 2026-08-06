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
  
  // Basic static layout optimized for A4 PDF rendering (794px width usually)
  return (
    <div 
      ref={ref} 
      className="bg-white text-black p-10 w-[794px] min-h-[1123px] relative mx-auto font-sans"
      style={{ boxSizing: 'border-box' }}
    >
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-indigo-600 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-indigo-900 tracking-tight">Financial Planning Report</h1>
          <p className="text-gray-600 mt-2 font-medium">Prepared for: <span className="text-black">{data.personal.fullName || 'Client'}</span></p>
          <p className="text-gray-600">Date: <span className="text-black">{date}</span></p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-indigo-600 tracking-tighter">Apex Solutions</div>
          <p className="text-sm text-gray-500 font-medium">Wealth Management</p>
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
                 <td className="py-2 text-right font-semibold">{formatCurrency(data.income.monthlyIncome)}</td>
               </tr>
               <tr className="border-b border-gray-100">
                 <td className="py-2 text-gray-600">Monthly Expenses</td>
                 <td className="py-2 text-right font-semibold text-rose-600">-{formatCurrency(data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.otherExpenses)}</td>
               </tr>
               <tr>
                 <td className="py-2 font-bold text-gray-800">Monthly Savings</td>
                 <td className="py-2 text-right font-bold text-emerald-600">
                   {formatCurrency(data.income.monthlyIncome - (data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.otherExpenses))}
                 </td>
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
                 <td className="py-2 text-right font-semibold">{formatCurrency(data.savings.savingsAccount + data.savings.emergencySavings + data.savings.liquidFunds)}</td>
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

      {/* Footer */}
      <div className="absolute bottom-10 left-10 right-10 border-t-2 border-gray-200 pt-4 flex justify-between items-center text-xs text-gray-500">
        <p>Confidential • Prepared by Apex Solutions</p>
        <p>Page 1</p>
      </div>
    </div>
  );
});

PdfRenderer.displayName = 'PdfRenderer';
