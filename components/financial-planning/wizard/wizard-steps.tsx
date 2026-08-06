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
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Let's Secure Your Family's Future</h3>
        <p className="text-sm text-muted-foreground mb-4">Protection is the foundation of any strong financial plan. Let's see where you stand.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Total Life/Term Cover (Sum Assured)</Label>
            <Input type="number" value={lifeCover || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const existing = data.insurance.filter(i => i.type !== 'Term Insurance');
              updateData('insurance', '', [...existing, { id: 'term', type: 'Term Insurance', company: '', coverage: val, premium: 0, expiry: '', nominee: '' }]);
            }} className="h-12" placeholder="₹0" />
            <p className="text-xs text-muted-foreground">Ideally 20x of your annual income</p>
          </div>
          <div className="space-y-2">
            <Label>Total Health Cover (Mediclaim)</Label>
            <Input type="number" value={healthCover || ''} onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              const existing = data.insurance.filter(i => i.type !== 'Health Insurance');
              updateData('insurance', '', [...existing, { id: 'health', type: 'Health Insurance', company: '', coverage: val, premium: 0, expiry: '', nominee: '' }]);
            }} className="h-12" placeholder="₹0" />
            <p className="text-xs text-muted-foreground">Base + Super Top-up combined (Min 10 Lakh)</p>
          </div>
        </div>

        <div className="pt-4 mt-6 border-t border-border">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Personal Accident Policy</Label>
              <p className="text-sm text-muted-foreground">Do you currently hold an active personal accident and disability policy?</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => updateData('hasPersonalAccident', '', true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${data.hasPersonalAccident ? 'bg-indigo-600 text-white' : 'bg-background border border-border hover:bg-muted'}`}
              >
                Yes
              </button>
              <button 
                onClick={() => updateData('hasPersonalAccident', '', false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!data.hasPersonalAccident ? 'bg-rose-500 text-white' : 'bg-background border border-border hover:bg-muted'}`}
              >
                No
              </button>
            </div>
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
        <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2">Financial Goals</h3>
        <p className="text-sm text-muted-foreground">Add specific goals you want to achieve.</p>
        
        {data.goals.map((goal, index) => (
          <div key={goal.id} className="p-4 border rounded-xl bg-card space-y-4 relative">
            <button 
              onClick={() => updateData('goals', '', data.goals.filter(g => g.id !== goal.id))}
              className="absolute top-4 right-4 text-rose-500 text-sm font-semibold hover:underline"
            >
              Remove
            </button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pr-16">
              <div className="space-y-2">
                <Label>Goal Name</Label>
                <Select value={goal.type} onValueChange={v => {
                  const newGoals = [...data.goals];
                  newGoals[index] = { ...goal, type: v as any };
                  updateData('goals', '', newGoals);
                }}>
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Child Education">Child Education</SelectItem>
                    <SelectItem value="House Purchase">House Purchase</SelectItem>
                    <SelectItem value="Retirement">Retirement</SelectItem>
                    <SelectItem value="Vacation">Vacation</SelectItem>
                    <SelectItem value="Car Purchase">Car Purchase</SelectItem>
                    <SelectItem value="Other Goals">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Amount (₹)</Label>
                <Input 
                  type="number" 
                  value={goal.targetAmount || ''} 
                  onChange={e => {
                    const newGoals = [...data.goals];
                    newGoals[index] = { ...goal, targetAmount: parseFloat(e.target.value) || 0 };
                    updateData('goals', '', newGoals);
                  }}
                  className="h-10 bg-background" 
                  placeholder="e.g. 5000000" 
                />
              </div>
              <div className="space-y-2">
                <Label>Years to Achieve</Label>
                <Input 
                  type="number" 
                  value={goal.targetYear || ''} 
                  onChange={e => {
                    const newGoals = [...data.goals];
                    newGoals[index] = { ...goal, targetYear: parseInt(e.target.value) || 0 };
                    updateData('goals', '', newGoals);
                  }}
                  className="h-10 bg-background" 
                  placeholder="e.g. 10" 
                />
              </div>
            </div>
          </div>
        ))}
        
        <button
          onClick={() => updateData('goals', '', [...data.goals, { id: crypto.randomUUID(), type: 'Other Goals', targetAmount: 0, targetYear: '', priority: 'Medium' }])}
          className="px-4 py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition-colors w-full"
        >
          + Add New Goal
        </button>
      </div>
    </div>
  );
}
