'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Users, Search, IndianRupee, FileText } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  policiesCount: number;
  totalPremium: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
     async function fetchCustomers() {
       try {
         const res = await fetch('/api/customers');
         if (!res.ok) throw new Error('Fetch failed');
         const data = await res.json();
         setCustomers(data.data || []);
       } catch (err: any) {
         toast.error('Failed to load customers');
       } finally {
         setIsLoading(false);
       }
     }
     fetchCustomers();
  }, []);

  const filtered = useMemo(() => {
    return customers.filter(c => 
       c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
       c.mobile?.includes(searchTerm)
    );
  }, [customers, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 md:px-8 border-b bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Customers</h1>
          <p className="text-sm text-slate-500">Manage your entire client portfolio</p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3">
          <div className="relative w-full md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <Input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search clients..." 
                className="pl-9 h-9 w-full bg-slate-50/50" 
             />
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 shadow-sm">
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Add Client</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-slate-500">
             <div className="animate-pulse">Loading Customers Library...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-slate-300 bg-slate-50">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-700 mb-1">No customers found</h3>
            <p className="text-sm text-slate-500">Try a different search or add a new client.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {filtered.map(c => (
                <Link href={`/app/customers/${c.id}`} key={c.id}>
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                     <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                           {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="min-w-0">
                           <h3 className="font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                              {c.name}
                           </h3>
                           <p className="text-xs text-slate-500 truncate">{c.email || c.mobile || 'No contact config'}</p>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                        <div>
                           <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Policies</p>
                           <p className="font-medium text-slate-700 flex items-center gap-1.5">
                             <FileText className="w-3.5 h-3.5 text-slate-400" /> {c.policiesCount}
                           </p>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Net Premium</p>
                           <p className="font-medium text-slate-700 flex items-center gap-1">
                             <IndianRupee className="w-3.5 h-3.5 text-slate-400" /> {c.totalPremium.toLocaleString('en-IN')}
                           </p>
                        </div>
                     </div>
                  </div>
                </Link>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
