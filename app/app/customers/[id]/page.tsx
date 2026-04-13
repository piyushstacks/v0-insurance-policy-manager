'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, User, Phone, Mail, MapPin, IndianRupee, FileText, Calendar, Building, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';

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

export default function CustomerProfilePage({ params }: { params: { id: string } }) {
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
       try {
          const res = await fetch(`/api/customers/${params.id}`);
          if (!res.ok) throw new Error('Data rejected');
          const data = await res.json();
          setCustomer(data.data);
       } catch (e) {
          toast.error("Failed to load customer profile");
       } finally {
          setIsLoading(false);
       }
    }
    load();
  }, [params.id]);

  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse text-center pt-24 font-medium">Loading Client Profile...</div>;
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
             <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm hidden md:flex">
               {customer.name?.charAt(0).toUpperCase()}
             </div>
             <div>
               <h1 className="font-bold text-slate-800 tracking-tight leading-tight">{customer.name}</h1>
               <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Client Profile</p>
             </div>
          </div>
        </div>
        <Button size="sm" variant="outline">Edit Details</Button>
      </div>

      <div className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-6">
        
        {/* Core Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
           <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Personal Information
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                 <Mail className="w-5 h-5 text-slate-400" />
                 <div><p className="text-xs text-slate-500">Email Address</p><p className="font-medium text-slate-800">{customer.email || '—'}</p></div>
              </div>
              <div className="flex gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                 <Phone className="w-5 h-5 text-slate-400" />
                 <div><p className="text-xs text-slate-500">Phone</p><p className="font-medium text-slate-800">{customer.mobile || '—'}</p></div>
              </div>
              <div className="flex gap-3 items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                 <MapPin className="w-5 h-5 text-slate-400" />
                 <div><p className="text-xs text-slate-500">Address</p><p className="font-medium text-slate-800 truncate">{customer.address || '—'}</p></div>
              </div>
           </div>
        </div>

        {/* Global Policy Stats */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-sm p-6 text-white flex justify-between items-center relative overflow-hidden">
             <FileText className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
             <div>
                <p className="text-sm text-blue-100 font-medium mb-1">Total Maintained Policies</p>
                <h3 className="text-3xl font-black">{customer.policies?.length || 0}</h3>
             </div>
           </div>
           <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-sm p-6 text-white flex justify-between items-center relative overflow-hidden">
             <IndianRupee className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
             <div>
                <p className="text-sm text-slate-400 font-medium mb-1">Total Net Premiums</p>
                <h3 className="text-3xl font-black flex items-center gap-1">₹{totalPremium.toLocaleString('en-IN')}</h3>
             </div>
           </div>
        </div>

        {/* Client Policies Table Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
           <div className="border-b p-5 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                 <Building className="w-4 h-4" /> Policies From All Insurance Companies
              </h2>
           </div>
           
           <div className="overflow-x-auto w-full">
              {(!customer.policies || customer.policies.length === 0) ? (
                 <div className="p-12 text-center">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">No policies linked to this customer yet.</p>
                 </div>
              ) : (
                 <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-5 py-3 border-b">Policy No</th>
                        <th className="px-5 py-3 border-b">Company (Insurer)</th>
                        <th className="px-5 py-3 border-b">Type</th>
                        <th className="px-5 py-3 border-b">Coverage Dates</th>
                        <th className="px-5 py-3 border-b text-right">Premium</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customer.policies.map(p => (
                         <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-5 py-4 font-medium">
                              <Link href={`/app/policies/${p.id}`} className="text-slate-900 group-hover:text-blue-600">
                                {p.policy_number}
                              </Link>
                           </td>
                           <td className="px-5 py-4 text-slate-700">{p.insurer?.name || '—'}</td>
                           <td className="px-5 py-4 text-slate-500 text-xs">{p.policy_type}</td>
                           <td className="px-5 py-4 text-slate-500 text-xs">
                              {p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'} <span className="opacity-50 mx-1">→</span> {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : '—'}
                           </td>
                           <td className="px-5 py-4 font-medium text-slate-800 text-right">
                              ₹{(p.premium_amount || 0).toLocaleString('en-IN')}
                           </td>
                         </tr>
                      ))}
                    </tbody>
                 </table>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
