/**
 * Policies List Page - Advanced DataTable with Filters (Mobile First)
 */
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  FilePenLine,
  IndianRupee,
  MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';

interface Customer { name: string; email: string; }
interface Insurer { name: string; }
interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  expiry_date: string;
  premium_amount: number;
  status: 'active' | 'expired' | 'cancelled' | 'renewed';
  customer?: Customer;
  insurer?: Insurer;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reExtracting, setReExtracting] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Fetch logic
  useEffect(() => {
    async function fetchPolicies() {
      try {
        const response = await fetch('/api/policies');
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setPolicies(data.data || []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error loading policies');
      } finally {
        setIsLoading(false);
      }
    }
    fetchPolicies();
  }, []);

  // Unique values for dropdowns
  const uniqueProducts = useMemo(() => Array.from(new Set(policies.map(p => p.policy_type).filter(Boolean))), [policies]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(policies.map(p => p.insurer?.name).filter(Boolean))), [policies]);

  // Derived Filtered Data
  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      // Search
      const searchStr = `${p.policy_number} ${p.customer?.name} ${p.insurer?.name}`.toLowerCase();
      if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;
      
      // Selects
      if (filterProduct && p.policy_type !== filterProduct) return false;
      if (filterCompany && p.insurer?.name !== filterCompany) return false;
      
      // Dates
      if (dateStart && p.start_date && new Date(p.start_date) < new Date(dateStart)) return false;
      if (dateEnd && p.start_date && new Date(p.start_date) > new Date(dateEnd)) return false;
      
      return true;
    });
  }, [policies, searchTerm, filterProduct, filterCompany, dateStart, dateEnd]);

  // Actions
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filteredPolicies.length) setSelected(new Set());
    else setSelected(new Set(filteredPolicies.map(p => p.id)));
  };

  const clearFilters = () => {
    setSearchTerm(''); setFilterProduct(''); setFilterCompany(''); setDateStart(''); setDateEnd('');
  };

  const handleReExtract = async () => {
    if (selected.size === 0) return toast.warning('Select at least one policy');
    setReExtracting(true);
    try {
      const res = await fetch('/api/extract/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Successfully started', { description: data.message });
      setSelected(new Set());
    } catch (err: any) {
      toast.error('Re-extraction failed', { description: err.message });
    } finally {
      setReExtracting(false);
    }
  };

  const isPending = (p: Policy) => p.policy_number.startsWith('PENDING_OCR');

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-8 h-full">
      {/* Mobile Filter Toggle */}
      <div className="md:hidden flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Policies</h1>
        <Button variant="outline" size="sm" onClick={() => setShowMobileFilters(!showMobileFilters)}>
          <Filter className="w-4 h-4 mr-2" /> Filters
        </Button>
      </div>

      {/* --- LEFT SIDEBAR: FILTERS --- */}
      <aside className={`md:w-72 flex-shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${showMobileFilters ? 'block' : 'hidden md:flex'}`}>
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filters
          </h2>
          {showMobileFilters && (
            <Button variant="ghost" size="icon" onClick={() => setShowMobileFilters(false)}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <Input 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Policy No, Insured..." 
                className="pl-9 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Product Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Products</label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-slate-50/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={filterProduct} 
              onChange={e => setFilterProduct(e.target.value)}
            >
              <option value="">All Products ({uniqueProducts.length})</option>
              {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Company Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Companies</label>
            <select 
              className="flex h-10 w-full rounded-md border border-input bg-slate-50/50 px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              value={filterCompany} 
              onChange={e => setFilterCompany(e.target.value)}
            >
              <option value="">All Companies ({uniqueCompanies.length})</option>
              {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Issue Date (Start) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Policy Start (From)</label>
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-slate-50/50" />
          </div>

          {/* Policy End */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Policy Start (Up To)</label>
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-slate-50/50" />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 mt-auto">
          <Button variant="outline" className="w-full" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </aside>

      {/* --- RIGHT PANEL: TABLE --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
          <div className="hidden md:block">
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Policies Directory</h1>
            <p className="text-sm text-slate-500">{filteredPolicies.length} entries found</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {selected.size > 0 && (
               <Button size="sm" variant="secondary" onClick={handleReExtract} disabled={reExtracting} className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none shadow-none">
                 <RefreshCw className={`w-4 h-4 mr-2 ${reExtracting ? 'animate-spin' : ''}`} />
                 Re-extract ({selected.size})
               </Button>
            )}
            
            <Button size="sm" variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hidden md:flex">
              <Download className="w-4 h-4 mr-2" /> Export Excel
            </Button>

            <Link href="/app/policies/new" className="ml-auto flex-shrink-0">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="w-4 h-4 mr-2 md:inline hidden" /> Add Policy
              </Button>
            </Link>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-white">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500">Loading directory...</div>
          ) : filteredPolicies.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center flex mx-auto mb-3">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">No policies found</h3>
              <p className="text-sm text-slate-500">Try clearing your filters or adding a new policy.</p>
            </div>
          ) : (
            <div className="min-w-max">
              {/* Header */}
              <div className="grid grid-cols-[auto_minmax(120px,1fr)_minmax(150px,1.5fr)_minmax(150px,2fr)_minmax(120px,1.5fr)_130px_130px_90px] gap-3 px-4 py-3 bg-slate-100 border-b text-xs font-semibold text-slate-600 uppercase tracking-wider sticky top-0 z-10 items-center shadow-sm">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 mx-1 accent-blue-600 w-4 h-4"
                  checked={selected.size === filteredPolicies.length && filteredPolicies.length > 0} 
                  onChange={toggleAll} 
                />
                <div>Policy No</div>
                <div>Insured</div>
                <div>Company</div>
                <div>Product</div>
                <div>Dates</div>
                <div className="text-right">Gross Prem</div>
                <div className="text-center">Action</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {filteredPolicies.map((p) => {
                  const pending = isPending(p);
                  return (
                    <div 
                      key={p.id} 
                      className={`grid grid-cols-[auto_minmax(120px,1fr)_minmax(150px,1.5fr)_minmax(150px,2fr)_minmax(120px,1.5fr)_130px_130px_90px] gap-3 px-4 py-3 items-center hover:bg-slate-50/80 transition-colors text-sm ${pending ? 'bg-amber-50/30' : ''}`}
                    >
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 mx-1 accent-blue-600 w-4 h-4 shrink-0 mt-0.5"
                        checked={selected.has(p.id)} 
                        onChange={() => toggleSelect(p.id)} 
                      />
                      
                      <div className="font-medium text-slate-900 truncate pr-2">
                        {pending ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-widest">
                            Pending OCR
                          </span>
                        ) : (
                          <Link href={`/app/policies/${p.id}`} className="hover:text-blue-600 hover:underline">
                            {p.policy_number}
                          </Link>
                        )}
                      </div>
                      
                      <div className="truncate text-slate-700 pr-2">
                        {p.customer?.name || '—'}
                      </div>
                      
                      <div className="truncate text-slate-700 pr-2">
                        {p.insurer?.name || '—'}
                      </div>
                      
                      <div className="truncate text-slate-600 text-xs">
                        {p.policy_type || '—'}
                      </div>
                      
                      <div className="text-xs text-slate-500 whitespace-nowrap">
                        <div className="font-medium text-slate-700 mb-0.5">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</div>
                        <div className="opacity-70 text-[10px] uppercase">to {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-GB') : '—'}</div>
                      </div>
                      
                      <div className="text-right text-slate-700 font-medium whitespace-nowrap flex items-center justify-end gap-1">
                        {!pending && p.premium_amount ? (
                          <>
                           ₹{p.premium_amount.toLocaleString('en-IN')}
                          </>
                        ) : '—'}
                      </div>

                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/app/policies/${p.id}`}>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                             <FilePenLine className="w-4 h-4" />
                           </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
            <span>Showing {Math.min(1, filteredPolicies.length)} to {filteredPolicies.length} of {filteredPolicies.length} entries</span>
            <span>PolicyVault v2.0</span>
        </div>
      </main>
    </div>
  );
}
