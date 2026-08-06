'use client';

import { FinancialPlanData } from '@/types/financial-plan';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface ChartsProps {
  data: FinancialPlanData;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'];

export function ChartsDashboard({ data }: ChartsProps) {
  // 1. Asset Allocation Data
  const liquidAssets = data.savings.savingsAccount + data.savings.cash + data.savings.liquidFunds + data.savings.emergencySavings;
  const fixedIncome = data.savings.fixedDeposit + data.savings.epf + data.savings.ppf + data.savings.nps + data.savings.providentFund + data.savings.gratuity;
  const preciousMetals = data.savings.gold + data.savings.silver;
  
  let equity = 0;
  let realEstate = 0;
  let others = 0;

  data.investments.forEach(inv => {
    if (inv.type === 'Mutual Funds' || inv.type === 'Stocks' || inv.type === 'PMS' || inv.type === 'AIF') equity += inv.currentValue;
    else if (inv.type === 'Real Estate') realEstate += inv.currentValue;
    else others += inv.currentValue;
  });

  const allocationData = [
    { name: 'Liquid/Cash', value: liquidAssets },
    { name: 'Fixed Income', value: fixedIncome },
    { name: 'Equity/MF', value: equity },
    { name: 'Real Estate', value: realEstate },
    { name: 'Gold/Silver', value: preciousMetals },
    { name: 'Others', value: others }
  ].filter(d => d.value > 0);

  // 2. Projected Wealth Growth (10, 20, 30 years)
  // Simplified compound interest projection
  const currentNetWorth = liquidAssets + fixedIncome + preciousMetals + equity + realEstate + others - data.loans.reduce((acc, curr) => acc + curr.totalOutstanding, 0);
  const monthlySavings = (data.income.monthlyIncome + (data.income.annualIncome / 12) + data.income.rentalIncome + data.income.businessIncome + data.income.passiveIncome) - 
    (data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.education + data.expenses.medical + data.expenses.transportation + data.expenses.insurancePremium + data.expenses.entertainment + data.expenses.utilities + data.expenses.otherExpenses);
  
  const annualSavings = Math.max(0, monthlySavings * 12);
  const growthRate = 0.10; // 10% average growth assumption for projection

  const projectionData = [];
  let projectedValue = Math.max(0, currentNetWorth);
  
  for (let year = 0; year <= 30; year += 5) {
    projectionData.push({
      year: `Year ${year}`,
      value: Math.round(projectedValue / 100000) // Convert to Lakhs for easier reading
    });
    // Calculate for next 5 years
    for(let i = 0; i < 5; i++) {
      projectedValue = (projectedValue + annualSavings) * (1 + growthRate);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Asset Allocation */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-4">Asset Allocation</h3>
        <div className="h-[300px] w-full">
          {allocationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No asset data available</div>
          )}
        </div>
      </div>

      {/* Wealth Projection */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6 shadow-sm">
        <h3 className="font-semibold text-lg mb-4">Projected Wealth Growth (in Lakhs)</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={projectionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}L`} />
              <Tooltip 
                formatter={(value: number) => [`₹${value} Lakhs`, 'Projected Net Worth']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">* Assumes 10% average annual return and constant current savings rate.</p>
      </div>
    </div>
  );
}
