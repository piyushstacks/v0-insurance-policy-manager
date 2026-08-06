import { FinancialPlanData, FinancialScores } from '@/types/financial-plan';

export function calculateFinancialScores(data: FinancialPlanData): FinancialScores {
  // Helpers
  const totalMonthlyIncome = data.income.monthlyIncome + (data.income.annualIncome / 12) + data.income.rentalIncome + data.income.businessIncome + data.income.passiveIncome;
  
  const totalMonthlyExpense = data.expenses.homeExpense + data.expenses.food + data.expenses.emi + data.expenses.education + data.expenses.medical + data.expenses.transportation + data.expenses.insurancePremium + data.expenses.entertainment + data.expenses.utilities + data.expenses.otherExpenses;
  
  const monthlySavings = totalMonthlyIncome - totalMonthlyExpense;
  const savingsRate = totalMonthlyIncome > 0 ? (monthlySavings / totalMonthlyIncome) * 100 : 0;

  // 1. Savings Score (Target: 30% savings rate)
  const savingsScore = Math.min(100, Math.max(0, (savingsRate / 30) * 100));

  // 2. Emergency Score (Target: 1 year of annual income in Liquid assets/Savings)
  const annualIncomeForScore = totalMonthlyIncome * 12;
  const liquidAssets = data.savings.savingsAccount + data.savings.cash + data.savings.liquidFunds + data.savings.emergencySavings;
  const targetEmergency = annualIncomeForScore; // 1 year of annual income
  const emergencyScore = targetEmergency > 0 ? Math.min(100, (liquidAssets / targetEmergency) * 100) : 100;

  // 3. Debt Score (Target: EMI <= 30% of income)
  const emiRatio = totalMonthlyIncome > 0 ? (data.expenses.emi / totalMonthlyIncome) * 100 : 0;
  // If EMI is 0, score is 100. If EMI is >= 50%, score is 0.
  const debtScore = Math.max(0, 100 - (emiRatio * 2));

  // 4. Protection (Insurance) Score
  // Life Cover Target: 20x Annual Income
  // Health Cover Target: 10 Lakh minimum
  let totalLifeCover = 0;
  let totalHealthCover = 0;
  
  data.insurance.forEach(ins => {
    if (ins.type === 'Life Insurance' || ins.type === 'Term Insurance') totalLifeCover += ins.coverage;
    if (ins.type === 'Health Insurance' || ins.type === 'Critical Illness') totalHealthCover += ins.coverage;
  });

  const annualIncome = totalMonthlyIncome * 12;
  const targetLifeCover = annualIncome * 20;
  const targetHealthCover = 1000000; // 10 Lakhs
  
  const lifeScore = targetLifeCover > 0 ? Math.min(100, (totalLifeCover / targetLifeCover) * 100) : 100;
  const healthInsuranceScore = Math.min(100, (totalHealthCover / targetHealthCover) * 100);
  const protectionScore = (lifeScore * 0.6) + (healthInsuranceScore * 0.4);
  const insuranceScore = protectionScore; // Alias

  // 5. Investment Score (SIPs / Monthly Savings)
  let totalSIP = 0;
  let totalInvestmentValue = 0;
  data.investments.forEach(inv => {
    totalSIP += inv.monthlySIP;
    totalInvestmentValue += inv.currentValue;
  });
  
  // Good if investing at least 50% of savings
  const investmentRatio = monthlySavings > 0 ? (totalSIP / monthlySavings) * 100 : 0;
  const investmentScore = Math.min(100, (investmentRatio / 50) * 100);

  // 6. Liquidity Score
  const totalAssets = liquidAssets + data.savings.fixedDeposit + data.savings.gold + data.savings.silver + data.savings.epf + data.savings.ppf + totalInvestmentValue;
  const liquidityRatio = totalAssets > 0 ? (liquidAssets / totalAssets) * 100 : 0;
  // Target ~15% in liquid assets
  const liquidityScore = Math.min(100, (liquidityRatio / 15) * 100);

  // 7. Goal Planning Score
  const goalPlanningScore = data.goals.length > 0 ? 100 : 0; // Simple for now

  // 8. Retirement Score (Age vs EPF/PPF/Retirement Corpus)
  // Target: Net worth should be Age * Income / 10
  const expectedNetWorth = (data.personal.age || 30) * annualIncome / 10;
  const retirementScore = expectedNetWorth > 0 ? Math.min(100, (totalAssets / expectedNetWorth) * 100) : 0;

  // Aggregate Health Score
  const healthScore = Math.round(
    (emergencyScore * 0.20) +
    (protectionScore * 0.20) +
    (debtScore * 0.15) +
    (savingsScore * 0.15) +
    (investmentScore * 0.15) +
    (retirementScore * 0.15)
  );

  return {
    healthScore,
    savingsScore: Math.round(savingsScore),
    insuranceScore: Math.round(insuranceScore),
    investmentScore: Math.round(investmentScore),
    liquidityScore: Math.round(liquidityScore),
    debtScore: Math.round(debtScore),
    emergencyScore: Math.round(emergencyScore),
    retirementScore: Math.round(retirementScore),
    protectionScore: Math.round(protectionScore),
    goalPlanningScore: Math.round(goalPlanningScore),
    overallReadinessScore: healthScore
  };
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}
