'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialPlanData } from '@/types/financial-plan';

interface StepProps {
  data: FinancialPlanData;
  updateData: (section: keyof FinancialPlanData, field: string, value: any) => void;
}

export function PersonalStep({ data, updateData }: StepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Full Name <span className="text-red-500">*</span></Label>
          <Input 
            value={data.personal.fullName} 
            onChange={e => updateData('personal', 'fullName', e.target.value)} 
            placeholder="John Doe" 
            className="h-12 bg-background border-border/50 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>Age</Label>
          <Input 
            type="number"
            value={data.personal.age} 
            onChange={e => updateData('personal', 'age', parseInt(e.target.value) || '')} 
            placeholder="35" 
            className="h-12 bg-background border-border/50 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label>Employment Type</Label>
          <Select 
            value={data.personal.employmentType} 
            onValueChange={v => updateData('personal', 'employmentType', v)}
          >
            <SelectTrigger className="h-12 bg-background border-border/50 text-base">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Salaried">Salaried</SelectItem>
              <SelectItem value="Self Employed">Self Employed</SelectItem>
              <SelectItem value="Business Owner">Business Owner</SelectItem>
              <SelectItem value="Professional">Professional</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Number of Dependents</Label>
          <Input 
            type="number"
            value={data.personal.dependents} 
            onChange={e => updateData('personal', 'dependents', parseInt(e.target.value) || 0)} 
            placeholder="0" 
            className="h-12 bg-background border-border/50 text-base"
          />
        </div>
      </div>
    </div>
  );
}

export function IncomeExpenseStep({ data, updateData }: StepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Monthly Income</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Monthly Take-Home Pay</Label>
            <Input type="number" value={data.income.monthlyIncome || ''} onChange={e => updateData('income', 'monthlyIncome', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Annual Bonus (Average)</Label>
            <Input type="number" value={data.income.bonus || ''} onChange={e => updateData('income', 'bonus', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Rental Income (Monthly)</Label>
            <Input type="number" value={data.income.rentalIncome || ''} onChange={e => updateData('income', 'rentalIncome', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Passive/Other Income (Monthly)</Label>
            <Input type="number" value={data.income.passiveIncome || ''} onChange={e => updateData('income', 'passiveIncome', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Monthly Expenses</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Home / Rent</Label>
            <Input type="number" value={data.expenses.homeExpense || ''} onChange={e => updateData('expenses', 'homeExpense', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Food & Groceries</Label>
            <Input type="number" value={data.expenses.food || ''} onChange={e => updateData('expenses', 'food', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Total EMIs (Loans)</Label>
            <Input type="number" value={data.expenses.emi || ''} onChange={e => updateData('expenses', 'emi', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Education</Label>
            <Input type="number" value={data.expenses.education || ''} onChange={e => updateData('expenses', 'education', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Insurance Premiums</Label>
            <Input type="number" value={data.expenses.insurancePremium || ''} onChange={e => updateData('expenses', 'insurancePremium', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Other / Discretionary</Label>
            <Input type="number" value={data.expenses.otherExpenses || ''} onChange={e => updateData('expenses', 'otherExpenses', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetsStep({ data, updateData }: StepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Savings & Liquid Assets</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Savings Account Balance</Label>
            <Input type="number" value={data.savings.savingsAccount || ''} onChange={e => updateData('savings', 'savingsAccount', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Dedicated Emergency Fund</Label>
            <Input type="number" value={data.savings.emergencySavings || ''} onChange={e => updateData('savings', 'emergencySavings', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Fixed Deposits (FDs)</Label>
            <Input type="number" value={data.savings.fixedDeposit || ''} onChange={e => updateData('savings', 'fixedDeposit', parseFloat(e.target.value) || 0)} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>EPF / PPF Balance</Label>
            <Input type="number" value={(data.savings.epf + data.savings.ppf) || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              updateData('savings', 'epf', val / 2);
              updateData('savings', 'ppf', val / 2);
            }} className="h-12" placeholder="₹0" />
          </div>
        </div>
      </div>
      
      {/* Investments simplified for wizard speed */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Investments Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Total Mutual Fund Value</Label>
            <Input type="number" onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const mf = data.investments.find(i => i.type === 'Mutual Funds');
              if (mf) {
                const newInvs = data.investments.map(i => i.type === 'Mutual Funds' ? { ...i, currentValue: val } : i);
                updateData('investments', '', newInvs); // root update handled via custom logic in container usually, but here we'll pass full array
              } else {
                updateData('investments', '', [...data.investments, { id: 'mf', type: 'Mutual Funds', currentValue: val, monthlySIP: 0, annualInvestment: 0, expectedReturnRate: 12 }]);
              }
            }} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Total Monthly SIPs</Label>
            <Input type="number" onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const mf = data.investments.find(i => i.type === 'Mutual Funds');
              if (mf) {
                const newInvs = data.investments.map(i => i.type === 'Mutual Funds' ? { ...i, monthlySIP: val } : i);
                updateData('investments', '', newInvs);
              } else {
                updateData('investments', '', [...data.investments, { id: 'mf', type: 'Mutual Funds', currentValue: 0, monthlySIP: val, annualInvestment: 0, expectedReturnRate: 12 }]);
              }
            }} className="h-12" placeholder="₹0" />
          </div>
          <div className="space-y-2">
            <Label>Direct Stocks Value</Label>
            <Input type="number" onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const st = data.investments.find(i => i.type === 'Stocks');
              if (st) {
                const newInvs = data.investments.map(i => i.type === 'Stocks' ? { ...i, currentValue: val } : i);
                updateData('investments', '', newInvs);
              } else {
                updateData('investments', '', [...data.investments, { id: 'st', type: 'Stocks', currentValue: val, monthlySIP: 0, annualInvestment: 0, expectedReturnRate: 15 }]);
              }
            }} className="h-12" placeholder="₹0" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProtectionStep({ data, updateData }: StepProps) {
  // Simplified for speed
  const lifeCover = data.insurance.filter(i => i.type === 'Life Insurance' || i.type === 'Term Insurance').reduce((a, b) => a + b.coverage, 0);
  const healthCover = data.insurance.filter(i => i.type === 'Health Insurance').reduce((a, b) => a + b.coverage, 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Insurance & Protection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Total Life/Term Cover (Sum Assured)</Label>
            <Input type="number" value={lifeCover || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const existing = data.insurance.filter(i => i.type !== 'Term Insurance');
              updateData('insurance', '', [...existing, { id: 'term', type: 'Term Insurance', company: '', coverage: val, premium: 0, expiry: '', nominee: '' }]);
            }} className="h-12" placeholder="₹0" />
            <p className="text-xs text-muted-foreground">Ideally 10x - 15x of annual income</p>
          </div>
          <div className="space-y-2">
            <Label>Total Health Cover (Mediclaim)</Label>
            <Input type="number" value={healthCover || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const existing = data.insurance.filter(i => i.type !== 'Health Insurance');
              updateData('insurance', '', [...existing, { id: 'health', type: 'Health Insurance', company: '', coverage: val, premium: 0, expiry: '', nominee: '' }]);
            }} className="h-12" placeholder="₹0" />
            <p className="text-xs text-muted-foreground">Base + Super Top-up combined</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoalsRiskStep({ data, updateData }: StepProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Investor Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Risk Profile</Label>
            <Select value={data.riskProfile} onValueChange={v => updateData('riskProfile', '', v)}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select risk tolerance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Conservative">Conservative</SelectItem>
                <SelectItem value="Moderate">Moderate</SelectItem>
                <SelectItem value="Aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Investment Horizon</Label>
            <Select value={data.investmentHorizon} onValueChange={v => updateData('investmentHorizon', '', v)}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Less than 3 Years">Less than 3 Years</SelectItem>
                <SelectItem value="3-5 Years">3-5 Years</SelectItem>
                <SelectItem value="5-10 Years">5-10 Years</SelectItem>
                <SelectItem value="10+ Years">10+ Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Top Goals</h3>
        <p className="text-sm text-muted-foreground">What are you primarily planning for? (Select one for quick setup)</p>
        <div className="flex flex-wrap gap-3">
          {['Retirement', 'Child Education', 'House Purchase', 'Wealth Creation'].map(goal => {
            const isSelected = data.goals.some(g => g.type === goal || (goal === 'Wealth Creation' && g.type === 'Other Goals'));
            return (
              <button
                key={goal}
                onClick={() => {
                  if (isSelected) {
                    updateData('goals', '', data.goals.filter(g => g.type !== goal && g.type !== 'Other Goals'));
                  } else {
                    updateData('goals', '', [...data.goals, { id: goal, type: goal === 'Wealth Creation' ? 'Other Goals' : goal, targetAmount: 10000000, targetYear: 2035, priority: 'High' }]);
                  }
                }}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-card text-foreground/80 hover:bg-accent hover:border-border'}`}
              >
                {goal}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}
