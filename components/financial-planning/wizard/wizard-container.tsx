'use client';

import { useState, useEffect } from 'react';
import { FinancialPlanData } from '@/types/financial-plan';
import { PersonalStep, IncomeExpenseStep, AssetsStep, ProtectionStep, GoalsRiskStep } from './wizard-steps';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = [
  { id: 'personal', title: 'Personal Details' },
  { id: 'income', title: 'Income & Expenses' },
  { id: 'assets', title: 'Assets & Liabilities' },
  { id: 'protection', title: 'Insurance & Protection' },
  { id: 'goals', title: 'Goals & Risk Profile' }
];

const INITIAL_DATA: FinancialPlanData = {
  id: '',
  updatedAt: new Date().toISOString(),
  personal: { fullName: '', age: '', dob: '', gender: 'Other', occupation: '', employmentType: '', maritalStatus: '', dependents: 0 },
  income: { monthlyIncome: 0, annualIncome: 0, bonus: 0, otherIncome: 0, rentalIncome: 0, businessIncome: 0, passiveIncome: 0 },
  expenses: { homeExpense: 0, food: 0, emi: 0, education: 0, medical: 0, transportation: 0, insurancePremium: 0, entertainment: 0, utilities: 0, otherExpenses: 0 },
  savings: { savingsAccount: 0, currentAccount: 0, cash: 0, fixedDeposit: 0, recurringDeposit: 0, liquidFunds: 0, emergencySavings: 0, gold: 0, silver: 0, epf: 0, ppf: 0, nps: 0, providentFund: 0, gratuity: 0 },
  investments: [],
  insurance: [],
  loans: [],
  goals: [],
  riskProfile: '',
  investmentHorizon: '',
  taxBracket: '',
  existingSIPs: 0,
  existingSWPs: 0,
  existingFinancialAdvisor: false
};

interface WizardContainerProps {
  initialData?: FinancialPlanData;
  onComplete: (data: FinancialPlanData) => void;
}

export function WizardContainer({ initialData, onComplete }: WizardContainerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<FinancialPlanData>(initialData || { ...INITIAL_DATA, id: crypto.randomUUID() });
  
  // Auto-save to local storage
  useEffect(() => {
    const timer = setTimeout(() => {
      const plans = JSON.parse(localStorage.getItem('financial_plans') || '{}');
      plans[data.id] = { ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem('financial_plans', JSON.stringify(plans));
    }, 1000);
    return () => clearTimeout(timer);
  }, [data]);

  const updateData = (section: keyof FinancialPlanData, field: string, value: any) => {
    setData(prev => {
      if (!field) {
        // Direct root replacement for arrays (investments, insurance, goals, riskProfile)
        return { ...prev, [section]: value };
      }
      return {
        ...prev,
        [section]: {
          ...(prev[section] as any),
          [field]: value
        }
      };
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(c => c + 1);
    else {
      toast.success('Discovery Complete! Generating Plan...');
      onComplete(data);
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto bg-card border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
      {/* Header & Progress */}
      <div className="bg-indigo-600 p-6 md:p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{STEPS[currentStep].title}</h2>
        <p className="text-indigo-100 font-medium">Step {currentStep + 1} of {STEPS.length}</p>
        
        <div className="mt-6 bg-indigo-900/40 rounded-full h-2 overflow-hidden">
          <div className="bg-white h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-background">
        {currentStep === 0 && <PersonalStep data={data} updateData={updateData} />}
        {currentStep === 1 && <IncomeExpenseStep data={data} updateData={updateData} />}
        {currentStep === 2 && <AssetsStep data={data} updateData={updateData} />}
        {currentStep === 3 && <ProtectionStep data={data} updateData={updateData} />}
        {currentStep === 4 && <GoalsRiskStep data={data} updateData={updateData} />}
      </div>

      {/* Footer Navigation */}
      <div className="p-4 md:p-6 border-t border-border bg-muted/20 flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep(c => c - 1)} 
          disabled={currentStep === 0}
          className="border-border text-foreground hover:bg-accent"
        >
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => toast.success('Progress saved!')} className="text-muted-foreground hidden sm:flex">
            <Save className="w-4 h-4 mr-2" /> Save Draft
          </Button>
          <Button onClick={handleNext} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-md px-6">
            {currentStep === STEPS.length - 1 ? 'Generate Plan' : 'Continue'} <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
