'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, User, Phone, Mail, MapPin, IndianRupee, FileText, Calendar, Building, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/loader';

interface Insurer { name: string }
interface CustomerPolicy {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  expiry_date: string;
  premium_amount: number;
  status: string;
  insurer?: Insurer;
}
interface CustomerDetails {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  address: string | null;
  created_at: string;
  policies: CustomerPolicy[];
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

  if (isLoading) return <PageLoader words={['profile', 'policies', 'history', 'data', 'profile']} label="loading" />;
  if (!customer) return <div className="p-8 text-center pt-24">Customer strictly not found.</div>;

  const totalPremium = customer.policies?.reduce((sum, p) => sum + (p.premium_amount || 0), 0) || 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header Bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
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
               <h1 className="font-bold text-slate-800 tracking-tight leading-tight">{customer.name}</h1>
               <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Client Profile</p>
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

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-6">
        
        {/* Core Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
           <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Personal Information
           </h2>
           {isEditing && (
              <div className="mb-6 p-4 bg-slate-50 border rounded-lg space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase">Full Name</label>
                       <Input value={formData.name} onChange={e => setFormData(f => ({...f, name: e.target.value}))} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                       <Input value={formData.email} onChange={e => setFormData(f => ({...f, email: e.target.value}))} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                       <Input value={formData.mobile} onChange={e => setFormData(f => ({...f, mobile: e.target.value}))} />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-500 uppercase">Physical Address</label>
                       <Input value={formData.address} onChange={e => setFormData(f => ({...f, address: e.target.value}))} />
                    </div>
                 </div>
              </div>
           )}
           <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${isEditing ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
              <div className="flex gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                 <Mail className="w-5 h-5 text-slate-400" />
                 <div className="min-w-0"><p className="text-xs text-slate-500">Email Address</p><p className="font-medium text-slate-800 truncate" title={customer.email || '—'}>{customer.email || '—'}</p></div>
              </div>
              <div className="flex gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                 <Phone className="w-5 h-5 text-slate-400" />
                 <div className="min-w-0"><p className="text-xs text-slate-500">Phone</p><p className="font-medium text-slate-800 truncate">{customer.mobile || '—'}</p></div>
              </div>
              <div className="flex gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                 <MapPin className="w-5 h-5 text-slate-400" />
                 <div className="min-w-0"><p className="text-xs text-slate-500">Address</p><p className="font-medium text-slate-800 truncate" title={customer.address || '—'}>{customer.address || '—'}</p></div>
              </div>
           </div>
        </div>

        {/* Global Policy Stats */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-linear-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-sm p-6 text-white flex justify-between items-center relative overflow-hidden">
             <FileText className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
             <div>
                <p className="text-sm text-blue-100 font-medium mb-1">Total Maintained Policies</p>
                <h3 className="text-3xl font-black">{customer.policies?.length || 0}</h3>
             </div>
           </div>
           <div className="bg-linear-to-br from-slate-800 to-slate-900 rounded-2xl shadow-sm p-6 text-white flex justify-between items-center relative overflow-hidden">
             <IndianRupee className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
             <div>
                <p className="text-sm text-slate-400 font-medium mb-1">Total Net Premiums</p>
                <h3 className="text-3xl font-black flex items-center gap-1">₹{totalPremium.toLocaleString('en-IN')}</h3>
             </div>
           </div>
        </div>

        {/* Client Policies Grouped by Financial Year and Category */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
           <div className="border-b p-5 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                 <Building className="w-4 h-4" /> Policies by Financial Year & Category
              </h2>
           </div>
           
           <div className="flex flex-col">
              {(!customer.policies || customer.policies.length === 0) ? (
                 <div className="p-12 text-center">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No policies linked to this customer yet.</p>
                 </div>
              ) : (
                 <PoliciesGroupedView policies={customer.policies} />
              )}
           </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Component to display policies grouped by financial year and category
 */
function PoliciesGroupedView({ policies }: { policies: CustomerPolicy[] }) {
  const [expandedYear, setExpandedYear] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<Record<string, boolean>>({});

  // Group policies by financial year and category
  const grouped: Record<string, Record<string, CustomerPolicy[]>> = {};

  policies.forEach((policy) => {
    // Calculate financial year (Apr to Mar)
    const date = new Date(policy.start_date);
    let financialYear = date.getFullYear();
    if (date.getMonth() < 3) {
      financialYear -= 1;
    }
    const fyStart = financialYear;
    const fyEnd = financialYear + 1;
    const yearLabel = `${fyStart}-${fyEnd}`;

    // Extract category from policy_type
    const category = policy.policy_type?.split('|')[0]?.trim() || 'General';

    if (!grouped[yearLabel]) {
      grouped[yearLabel] = {};
    }
    if (!grouped[yearLabel][category]) {
      grouped[yearLabel][category] = [];
    }

    grouped[yearLabel][category].push(policy);
  });

  // Sort years in descending order (newest first)
  const sortedYears = Object.keys(grouped).sort((a, b) => {
    const aStart = parseInt(a.split('-')[0]);
    const bStart = parseInt(b.split('-')[0]);
    return bStart - aStart;
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Health': 'bg-green-50 border-green-200',
      'Motor': 'bg-blue-50 border-blue-200',
      'Life': 'bg-purple-50 border-purple-200',
      'Travel': 'bg-orange-50 border-orange-200',
      'Property': 'bg-yellow-50 border-yellow-200',
      'General': 'bg-slate-50 border-slate-200',
      'Business': 'bg-indigo-50 border-indigo-200',
    };
    return colors[category] || 'bg-slate-50 border-slate-200';
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      'Health': 'bg-green-100 text-green-800',
      'Motor': 'bg-blue-100 text-blue-800',
      'Life': 'bg-purple-100 text-purple-800',
      'Travel': 'bg-orange-100 text-orange-800',
      'Property': 'bg-yellow-100 text-yellow-800',
      'General': 'bg-slate-100 text-slate-800',
      'Business': 'bg-indigo-100 text-indigo-800',
    };
    return colors[category] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="divide-y divide-slate-200">
      {sortedYears.map((year) => (
        <div key={year} className="border-b last:border-b-0">
          {/* Financial Year Header */}
          <div
            className="px-5 py-4 bg-linear-to-r from-slate-800 to-slate-900 text-white cursor-pointer hover:from-slate-700 hover:to-slate-800 transition-all flex items-center justify-between"
            onClick={() => setExpandedYear(expandedYear === year ? null : year)}
          >
            <h3 className="font-bold text-lg">📅 FY {year}</h3>
            <span className="text-sm font-medium">
              {Object.values(grouped[year]).reduce((sum, cats) => sum + cats.length, 0)} policies
            </span>
          </div>

          {/* Categories within this year */}
          {expandedYear === year && (
            <div className="bg-slate-50 divide-y">
              {Object.entries(grouped[year]).map(([category, policiesList]) => (
                <div key={category} className={`border border-l-4 ${getCategoryColor(category)} m-3 rounded-lg overflow-hidden`}>
                  {/* Category Header */}
                  <div
                    className="px-4 py-3 bg-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      const key = `${year}-${category}`;
                      setExpandedCategory(prev => ({
                        ...prev,
                        [key]: !prev[key]
                      }));
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryBadgeColor(category)}`}>
                        {category}
                      </span>
                      <span className="text-sm text-slate-600 font-medium">
                        {policiesList.length} {policiesList.length === 1 ? 'policy' : 'policies'}
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {expandedCategory[`${year}-${category}`] ? '▼' : '▶'}
                    </span>
                  </div>

                  {/* Policies List */}
                  {expandedCategory[`${year}-${category}`] && (
                    <div className="divide-y bg-white">
                      {policiesList.map((policy) => (
                        <Link key={policy.id} href={`/app/policies/${policy.id}`}>
                          <div className="px-4 py-3 hover:bg-slate-50 transition-colors group flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 group-hover:text-blue-600">
                                {policy.policy_number}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-600">
                                <span>{policy.insurer?.name || 'Unknown'}</span>
                                <span>
                                  {new Date(policy.start_date).toLocaleDateString()} → {new Date(policy.expiry_date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <p className="font-semibold text-slate-800">₹{(policy.premium_amount || 0).toLocaleString('en-IN')}</p>
                              <p className={`text-xs font-medium ${
                                policy.status === 'active' ? 'text-green-600' :
                                policy.status === 'expired' ? 'text-red-600' :
                                'text-slate-600'
                              }`}>
                                {policy.status?.toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
