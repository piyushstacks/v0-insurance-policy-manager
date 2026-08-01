'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, User, Phone, Mail, MapPin, IndianRupee, FileText, Calendar, Building, Info, AlertTriangle, Users, History, FileDown, Activity, Sparkles, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { SkeletonCard, SkeletonRow } from '@/components/ui/skeleton-card';
import { CustomerGapDetection } from '@/components/customers/customer-gap-detection';

interface PolicyDocument {
  id: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface CustomerPolicy {
  id: string;
  policy_number: string;
  policy_type: string;
  insurance_type: string;
  start_date: string;
  expiry_date: string;
  premium_amount: number;
  sum_insured: number;
  commission_rate: number;
  status: string;
  insurer?: { name: string };
  life_policies?: { sum_assured: number }[];
  policy_documents?: PolicyDocument[];
}

interface FamilyMember {
  id: string;
  name: string;
  mobile: string;
  related_customer_id: string;
}

interface ActivityLog {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  changes: any;
}

interface CustomerDetails {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  address: string | null;
  related_customer_id: string | null;
  created_at: string;
  policies: CustomerPolicy[];
  family_members: FamilyMember[];
  activity_logs: ActivityLog[];
}

export default function CustomerProfilePage() {
  const params = useParams();
  const id = params?.id as string;

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', mobile: '', address: '' });

  useEffect(() => {
    if (!id) return;
    async function load() {
       try {
          const res = await fetch(`/api/customers/${id}`);
          if (!res.ok) throw new Error('Data rejected');
          const data = await res.json();
          setCustomer(data.data);
          setFormData({
            name: data.data.name || '',
            email: data.data.email || '',
            mobile: data.data.mobile || '',
            address: data.data.address || ''
          });
       } catch (e) {
          toast.error("Failed to load customer profile");
       } finally {
          setIsLoading(false);
       }
    }
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} lines={2} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard lines={6} />
          <div className="lg:col-span-2"><SkeletonCard lines={8} /></div>
        </div>
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4 pt-24">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Customer Profile Not Found</h2>
        <p className="text-muted-foreground max-w-md mx-auto text-sm">
          We couldn't load this customer's profile. If you recently updated the app, please ensure you have executed the latest SQL migrations (`features-schema-migration.sql`) in your Supabase project.
        </p>
      </div>
    );
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  
  const activePolicies = customer.policies.filter(p => !p.policy_number?.startsWith('PENDING_OCR'));

  // Aggregations
  const totalPremiumLifetime = activePolicies.reduce((acc, p) => acc + (p.premium_amount || 0), 0);
  
  const totalPremiumThisYear = activePolicies.reduce((acc, p) => {
    if (!p.start_date) return acc;
    if (new Date(p.start_date).getFullYear() === currentYear) {
      return acc + (p.premium_amount || 0);
    }
    return acc;
  }, 0);

  const totalActiveCover = activePolicies.reduce((acc, p) => {
    if (p.status === 'active' || p.status === 'renewed') {
      const lifeCover = p.life_policies?.[0]?.sum_assured || 0;
      const genCover = p.sum_insured || 0;
      return acc + lifeCover + genCover;
    }
    return acc;
  }, 0);

  const estimatedCommission = activePolicies.reduce((acc, p) => {
    if (p.commission_rate && p.premium_amount) {
      return acc + (p.premium_amount * (p.commission_rate / 100));
    }
    return acc;
  }, 0);

  // Cross-sell Gap Analysis
  const insuranceTypes = new Set(activePolicies.map(p => p.insurance_type).filter(Boolean));
  const hasLife = insuranceTypes.has('life');
  const hasHealth = insuranceTypes.has('health');
  const hasMotor = insuranceTypes.has('motor');
  
  const gaps = [];
  if (hasLife && !hasHealth) gaps.push('Health Insurance');
  if (hasHealth && !hasLife) gaps.push('Life Insurance');
  if ((hasLife || hasHealth) && !hasMotor) gaps.push('Motor Insurance');

  // Renewal Calendar (Next 12 months)
  const renewals = activePolicies
    .filter(p => p.status === 'active' && p.expiry_date)
    .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

  // All Documents
  const allDocuments = activePolicies.flatMap(p => p.policy_documents?.map(d => ({ ...d, policy: p })) || []);

  return (
    <div className="flex flex-col h-full bg-muted relative">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-card border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/app/customers">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full md:mr-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-blue-600 text-white items-center justify-center font-bold text-sm hidden md:flex">
               {customer.name?.charAt(0).toUpperCase()}
             </div>
             <div>
               <h1 className="font-bold text-foreground tracking-tight leading-tight">{customer.name}</h1>
               <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Customer 360 View</p>
             </div>
          </div>
        </div>
        {!isEditing ? (
           <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Edit Details</Button>
        ) : (
           <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => {
                 setIsEditing(false);
                 setFormData({ name: customer.name || '', email: customer.email || '', mobile: customer.mobile || '', address: customer.address || '' });
              }} disabled={isSaving}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                 setIsSaving(true);
                 try {
                    const res = await fetch(`/api/customers/${id}`, {
                       method: 'PATCH',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify(formData)
                    });
                    const d = await res.json();
                    if (!res.ok) throw new Error(d.error || 'Failed to save');
                    setCustomer(prev => ({ ...prev!, ...formData }));
                    toast.success('Profile updated successfully');
                    setIsEditing(false);
                 } catch (e: any) {
                    toast.error(e.message);
                 } finally {
                    setIsSaving(false);
                 }
              }} disabled={isSaving}>
                 {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
           </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto w-full p-4 md:p-8 space-y-6">
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex flex-col justify-between">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Lifetime Premium</p>
            <h3 className="text-2xl font-black text-foreground mt-2">₹{totalPremiumLifetime.toLocaleString('en-IN')}</h3>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex flex-col justify-between">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{currentYear} Premium</p>
            <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">₹{totalPremiumThisYear.toLocaleString('en-IN')}</h3>
          </div>
          <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex flex-col justify-between">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Active Cover</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">₹{totalActiveCover.toLocaleString('en-IN')}</h3>
          </div>

        </div>

        {/* AI Gap Detection */}
        <CustomerGapDetection policies={customer.policies || []} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Details & Household */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted">
                 <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" /> Client Info
                 </h2>
              </div>
              <div className="p-4 space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Name</label>
                    {isEditing ? <Input value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} className="h-8" /> : <p className="font-bold text-sm text-foreground">{customer.name}</p>}
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email</label>
                    {isEditing ? <Input value={formData.email} onChange={e => setFormData(f => ({...f, email: e.target.value}))} className="h-8" /> : <p className="font-bold text-sm text-foreground break-words">{customer.email || '—'}</p>}
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Mobile</label>
                    {isEditing ? <Input value={formData.mobile} onChange={e => setFormData(f => ({...f, mobile: e.target.value}))} className="h-8" /> : <p className="font-bold text-sm text-foreground">{customer.mobile || '—'}</p>}
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Address</label>
                    {isEditing ? <Input value={formData.address} onChange={e => setFormData(f => ({...f, address: e.target.value}))} className="h-8" /> : <p className="font-bold text-sm text-foreground">{customer.address || '—'}</p>}
                 </div>
              </div>
            </div>

            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted flex justify-between items-center">
                 <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" /> Household & Family
                 </h2>
              </div>
              <div className="p-4">
                 {customer.family_members.length > 0 ? (
                   <ul className="space-y-3">
                     {customer.family_members.map(member => (
                       <li key={member.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border">
                         <div>
                           <Link href={`/app/customers/${member.id}`} className="font-semibold text-sm text-blue-600 hover:underline">{member.name}</Link>
                           <p className="text-xs text-muted-foreground">{member.mobile || 'No mobile'}</p>
                         </div>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p className="text-sm text-muted-foreground text-center py-4">No linked family members.</p>
                 )}
              </div>
            </div>

            {gaps.length > 0 && (
              <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                <div className="p-4">
                   <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4" /> Cross-Sell Opportunities
                   </h2>
                   <p className="text-xs text-amber-800 mb-3">Based on their portfolio, this client might need:</p>
                   <div className="flex flex-wrap gap-2">
                     {gaps.map(gap => (
                       <span key={gap} className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">{gap}</span>
                     ))}
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle & Right Column: Timelines and Data */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Timeline */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted">
                 <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Policy Timeline
                 </h2>
              </div>
              <div className="p-0 max-h-[400px] overflow-y-auto">
                 {activePolicies.length === 0 ? (
                   <p className="text-center text-muted-foreground py-8 text-sm">No policies recorded.</p>
                 ) : (
                   <div className="divide-y divide-slate-100">
                     {activePolicies.sort((a,b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()).map(policy => (
                       <Link href={`/app/policies/${policy.id}`} key={policy.id} className="block hover:bg-muted transition-colors p-4">
                         <div className="flex justify-between items-start">
                           <div>
                             <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-foreground/90 uppercase mb-2 inline-block tracking-wider">
                               {policy.insurance_type || 'General'}
                             </span>
                             <h4 className="font-bold text-foreground text-sm">{policy.insurer?.name || 'Unknown Insurer'} - {policy.policy_number}</h4>
                             <p className="text-xs text-muted-foreground mt-1">{new Date(policy.start_date).toLocaleDateString()} to {new Date(policy.expiry_date).toLocaleDateString()}</p>
                           </div>
                           <div className="text-right">
                             <p className="font-black text-foreground">₹{(policy.premium_amount || 0).toLocaleString('en-IN')}</p>
                             <p className={`text-[9px] px-1.5 py-0.5 rounded-full border inline-block font-black uppercase mt-1 ${policy.status === 'active' ? 'bg-[var(--status-healthy-bg)] text-[var(--status-healthy)] border-[var(--status-healthy-border)]' : policy.status === 'expired' ? 'bg-[var(--status-risk-bg)] text-[var(--status-risk)] border-[var(--status-risk-border)]' : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)] border-[var(--status-neutral-border)]'}`}>{policy.status}</p>
                           </div>
                         </div>
                       </Link>
                     ))}
                   </div>
                 )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Renewals */}
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-muted">
                   <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Upcoming Renewals
                   </h2>
                </div>
                <div className="p-4 space-y-3">
                   {renewals.slice(0,5).map(policy => {
                     const isOverdue = new Date(policy.expiry_date) < new Date();
                     return (
                       <div key={policy.id} className="flex justify-between items-center p-3 rounded-lg border border-border bg-muted">
                         <div>
                           <p className="font-semibold text-sm text-foreground truncate">{policy.policy_number}</p>
                           <p className={`text-xs font-bold mt-0.5 ${isOverdue ? 'text-[var(--status-risk)]' : 'text-[var(--status-attention)]'}`}>
                             {isOverdue ? 'Expired ' : 'Expires '}{new Date(policy.expiry_date).toLocaleDateString()}
                           </p>
                         </div>
                         <Button size="sm" variant="outline" className="text-xs h-7" asChild>
                           <Link href={`/app/policies/${policy.id}`}>View</Link>
                         </Button>
                       </div>
                     );
                   })}
                   {renewals.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No upcoming renewals.</p>}
                </div>
              </div>

              {/* Documents */}
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-muted">
                   <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <FileDown className="w-4 h-4" /> Policy Documents
                   </h2>
                </div>
                <div className="p-4 space-y-2">
                   {allDocuments.slice(0, 5).map(doc => (
                     <a href={doc.file_url} target="_blank" rel="noreferrer" key={doc.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border group">
                       <div className="w-8 h-8 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                         <FileText className="w-4 h-4" />
                       </div>
                       <div className="min-w-0 flex-1">
                         <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-600">{doc.file_name}</p>
                         <p className="text-[10px] text-muted-foreground">{doc.policy.policy_number}</p>
                       </div>
                     </a>
                   ))}
                   {allDocuments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No documents found.</p>}
                </div>
              </div>

            </div>

            {/* Activity Log */}
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted">
                 <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <History className="w-4 h-4" /> Activity Log
                 </h2>
              </div>
              <div className="p-4">
                 <div className="space-y-4">
                    {customer.activity_logs.map(log => (
                      <div key={log.id} className="flex gap-4">
                        <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-300 shrink-0"></div>
                        <div>
                          <p className="text-sm text-foreground">
                            <span className="font-bold capitalize">{log.action.toLowerCase()}</span> on <span className="font-semibold">{log.table_name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    {customer.activity_logs.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
                 </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
