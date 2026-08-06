export type EmploymentType = 'Salaried' | 'Self Employed' | 'Business Owner' | 'Professional';
export type MaritalStatus = 'Single' | 'Married' | 'Divorced' | 'Widowed';
export type RiskProfile = 'Very Conservative' | 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive';
export type InvestmentHorizon = 'Less than 3 Years' | '3-5 Years' | '5-10 Years' | '10+ Years';
export type PriorityLevel = 'Low' | 'Medium' | 'High';

export interface PersonalDetails {
  fullName: string;
  age: number | '';
  dob: string;
  gender: string;
  occupation: string;
  employmentType: EmploymentType | '';
  maritalStatus: MaritalStatus | '';
  dependents: number;
}

export interface IncomeDetails {
  monthlyIncome: number;
  annualIncome: number;
  bonus: number;
  otherIncome: number;
  rentalIncome: number;
  businessIncome: number;
  passiveIncome: number;
}

export interface ExpenseDetails {
  homeExpense: number;
  food: number;
  emi: number;
  education: number;
  medical: number;
  transportation: number;
  insurancePremium: number;
  entertainment: number;
  utilities: number;
  otherExpenses: number;
}

export interface SavingsDetails {
  savingsAccount: number;
  currentAccount: number;
  cash: number;
  fixedDeposit: number;
  recurringDeposit: number;
  liquidFunds: number;
  emergencySavings: number; // Dedicated emergency fund
  gold: number;
  silver: number;
  epf: number;
  ppf: number;
  nps: number;
  providentFund: number;
  gratuity: number;
}

export interface InvestmentItem {
  id: string;
  type: 'Mutual Funds' | 'Stocks' | 'Bonds' | 'Real Estate' | 'Crypto' | 'SGB' | 'ULIP' | 'PMS' | 'AIF' | 'Others';
  name?: string;
  currentValue: number;
  monthlySIP: number;
  annualInvestment: number;
  expectedReturnRate: number; // percentage
}

export interface InsuranceItem {
  id: string;
  type: 'Life Insurance' | 'Health Insurance' | 'Term Insurance' | 'Critical Illness' | 'Accident Cover' | 'Vehicle Insurance' | 'Home Insurance' | 'Travel Insurance';
  company: string;
  coverage: number;
  premium: number;
  expiry: string;
  nominee: string;
}

export interface LoanItem {
  id: string;
  type: 'Home Loan' | 'Car Loan' | 'Personal Loan' | 'Business Loan' | 'Credit Card' | 'Education Loan';
  totalOutstanding: number;
  monthlyEmi: number;
  interestRate?: number;
}

export interface FinancialGoal {
  id: string;
  type: 'Emergency Fund' | 'Child Education' | 'Child Marriage' | 'House Purchase' | 'Car Purchase' | 'Vacation' | 'Business Expansion' | 'Retirement' | 'Passive Income' | 'Other Goals';
  targetAmount: number;
  targetYear: number | ''; // e.g. 2035
  priority: PriorityLevel;
}

export interface FinancialPlanData {
  id: string; // unique ID for local storage
  customerId?: string; // Optional if tied to CRM
  updatedAt: string;
  
  personal: PersonalDetails;
  income: IncomeDetails;
  expenses: ExpenseDetails;
  savings: SavingsDetails;
  investments: InvestmentItem[];
  insurance: InsuranceItem[];
  loans: LoanItem[];
  goals: FinancialGoal[];
  
  riskProfile: RiskProfile | '';
  investmentHorizon: InvestmentHorizon | '';
  taxBracket: string;
  existingSIPs: number;
  existingSWPs: number;
  existingFinancialAdvisor: boolean;
}

export interface FinancialScores {
  healthScore: number;
  savingsScore: number;
  insuranceScore: number;
  investmentScore: number;
  liquidityScore: number;
  debtScore: number;
  emergencyScore: number;
  retirementScore: number;
  protectionScore: number;
  goalPlanningScore: number;
  overallReadinessScore: number;
}
