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
  
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

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

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selected.size} clients?\n\nIf they have active policies attached, the database will safely block the deletion to prevent data loss.`)) {
       return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch('/api/customers/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Successfully deleted', { description: data.message });
      setSelected(new Set());
      setCustomers(prev => prev.filter(c => !selected.has(c.id)));
    } catch (err: any) {
      toast.error('Deletion operation halted', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

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
                className="pl-9 h-9 w-full bg-slate-50/50 border-slate-200" 
             />
          </div>
          <div className="flex items-center gap-2 px-3 h-9 bg-slate-100 rounded-md border border-slate-200 shadow-sm">
             <input 
               type="checkbox" 
               className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer"
               checked={selected.size === filtered.length && filtered.length > 0} 
               onChange={toggleAll} 
             />
             <span className="text-xs font-bold text-slate-600 tracking-wider">ALL</span>
          </div>
          {selected.size > 0 && (
             <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isDeleting} className="shrink-0 shadow-sm">
               <span className="hidden md:inline mr-2">Delete ({selected.size})</span>
             </Button>
          )}
          <Link href="/app/customers/new">
             <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-sm">
               <Plus className="w-4 h-4 md:mr-2" />
               <span className="hidden md:inline">Add Client</span>
             </Button>
          </Link>
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
                <div key={c.id} className="relative group">
                  <Link href={`/app/customers/${c.id}`} className="block">
                    <div className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-all ${selected.has(c.id) ? 'border-red-400 bg-red-50/10 ring-1 ring-red-400' : 'border-slate-200 hover:border-indigo-300'}`}>
                       <div className="flex items-start justify-between mb-4 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                             <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-lg ${selected.has(c.id) ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-700'}`}>
                                {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                             </div>
                             <div className="min-w-0">
                                <h3 className="font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                   {c.name}
                                </h3>
                                <p className="text-xs text-slate-500 truncate">{c.email || c.mobile || 'No contact config'}</p>
                             </div>
                          </div>
                          <div onClick={(e) => toggleSelect(c.id, e)} className="p-1 cursor-pointer shrink-0">
                             <input 
                               type="checkbox" 
                               checked={selected.has(c.id)} 
                               readOnly
                               className="w-4 h-4 rounded border-slate-300 accent-red-600 cursor-pointer pointer-events-none" 
                             />
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
              </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
}
