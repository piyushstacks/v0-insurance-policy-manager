/**
 * Policies List Page - Advanced DataTable with Filters (Mobile First)
 */
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/loader';
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  // Data Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Fetch logic wrapped in useCallback so it's stable for realtime effects
  const fetchPolicies = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!supabase) return;

    console.log('[v0/Realtime] Subscribing to policy updates...');
    const channel = supabase
      .channel('public:policies')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'policies' },
        (payload) => {
          console.log('[v0/Realtime] Policy change detected:', payload.eventType);
          // Refresh the whole list to catch updated joins (customer/insurer names)
          fetchPolicies();
        }
      )
      .subscribe();

    return () => {
      console.log('[v0/Realtime] Unsubscribing...');
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchPolicies]);

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

  // Derive Paginated Context
  const totalPages = Math.ceil(filteredPolicies.length / pageSize);
  const paginatedPolicies = useMemo(() => {
    return filteredPolicies.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredPolicies, currentPage, pageSize]);

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

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Are you absolutely sure you want to delete ${selected.size} policies?\n\nThis will permanently remove the underlying document files from Cloud Storage and erase all associated database records. This action cannot be undone.`)) {
       return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch('/api/policies/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Successfully deleted', { description: data.message });
      setSelected(new Set());
      setPolicies(prev => prev.filter(p => !selected.has(p.id))); // Optimistic UI update
    } catch (err: any) {
      toast.error('Bulk deletion failed', { description: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const isPending = (p: Policy) => p.policy_number.startsWith('PENDING_OCR');

  return (
    <div className="flex flex-col p-4 md:p-8 min-h-full max-w-[1600px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">Policies Directory</h1>
          <p className="text-slate-500 font-medium">Manage and explore {filteredPolicies.length} extracted policies</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button 
             variant={showMobileFilters ? "default" : "outline"}
             className={showMobileFilters ? "bg-indigo-600 text-white" : "text-slate-600 border-slate-300 bg-white shadow-sm"}
             onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <Filter className="w-4 h-4 mr-2" /> 
            {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>

          {selected.size > 0 && (
             <>
               <Button variant="secondary" onClick={handleReExtract} disabled={reExtracting || isDeleting} className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200">
                 <RefreshCw className={`w-4 h-4 mr-2 ${reExtracting ? 'animate-spin' : ''}`} />
                 Re-extract ({selected.size})
               </Button>
               <Button variant="destructive" onClick={handleBulkDelete} disabled={isDeleting} className="shadow-sm">
                 <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : 'mr-2'}`} />
                 <span className="hidden sm:inline">Delete Selected</span>
               </Button>
             </>
          )}

          <Link href="/app/policies/new" className="ml-auto md:ml-0">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
              <Plus className="w-4 h-4 mr-2 hidden sm:inline" /> Upload Policies
            </Button>
          </Link>
        </div>
      </div>

      {/* --- TOP COLLAPSIBLE FILTERS --- */}
      {showMobileFilters && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="space-y-1.5 lg:col-span-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Search Query</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <Input 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Policy No, Client..." 
                  className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
                />
              </div>
            </div>

            {/* Product Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
              <select 
                className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={filterProduct} 
                onChange={e => setFilterProduct(e.target.value)}
              >
                <option value="">All Categories ({uniqueProducts.length})</option>
                {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Company Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Insurer</label>
              <select 
                className="flex h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={filterCompany} 
                onChange={e => setFilterCompany(e.target.value)}
              >
                <option value="">All Companies ({uniqueCompanies.length})</option>
                {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Dates */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">From</label>
              <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 text-sm bg-slate-50 border-slate-200" />
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">To</label>
              <div className="flex gap-2">
                 <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 text-sm bg-slate-50 border-slate-200" />
                 <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-slate-400 hover:text-slate-800 bg-slate-100" onClick={clearFilters} title="Clear Filters">
                   <X className="w-4 h-4" />
                 </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FULL WIDTH TABLE --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Header: Pagination Toolbar */}
        <div className="p-3 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-slate-500 z-20">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                   <span className="font-medium">Rows per page:</span>
                   <select 
                     value={pageSize} 
                     onChange={(e) => {
                       setPageSize(Number(e.target.value));
                       setCurrentPage(1);
                     }} 
                     className="border border-slate-200 rounded px-2 py-1 bg-white font-medium text-slate-700 outline-none hover:border-indigo-300 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                   >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                   </select>
               </div>
               <div className="hidden sm:block ml-2 px-3 py-1 border-l border-slate-200">
                   Showing <span className="font-bold text-slate-700">{filteredPolicies.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-slate-700">{Math.min(currentPage * pageSize, filteredPolicies.length)}</span> of <span className="font-bold text-slate-700">{filteredPolicies.length}</span> entries
               </div>
            </div>
            
            <div className="flex items-center gap-1 w-full sm:w-auto justify-between sm:justify-end">
               <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-2.5 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
               >
                 Prev
               </Button>
               <span className="font-bold text-slate-700 px-3 bg-white border border-slate-200 py-1.5 rounded-md shadow-sm">
                 {currentPage} <span className="text-slate-400 font-medium mx-1">/</span> {totalPages || 1}
               </span>
               <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-2.5 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages || totalPages === 0}
               >
                 Next
               </Button>
            </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-auto bg-white">
          {isLoading ? (
            <PageLoader words={['policies', 'documents', 'schedules', 'records', 'policies']} label="loading" />
          ) : filteredPolicies.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 items-center justify-center flex mx-auto mb-3">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-1">No policies found</h3>
              <p className="text-sm text-slate-500">Try clearing your filters or adding a new policy.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', minWidth: '900px' }}>
                <thead>
                  <tr className="bg-slate-100 border-b text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="w-12 px-4 py-3"><input type="checkbox" className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer align-middle" checked={selected.size === paginatedPolicies.length && paginatedPolicies.length > 0} onChange={toggleAll} /></th>
                    <th className="px-4 py-3 border-r border-slate-200" style={{ width: '160px', resize: 'horizontal', overflow: 'hidden' }}>Policy No</th>
                    <th className="px-4 py-3 border-r border-slate-200" style={{ width: '180px', resize: 'horizontal', overflow: 'hidden' }}>Insured</th>
                    <th className="px-4 py-3 border-r border-slate-200" style={{ width: '250px', resize: 'horizontal', overflow: 'hidden' }}>Company</th>
                    <th className="px-4 py-3 border-r border-slate-200" style={{ width: '200px', resize: 'horizontal', overflow: 'hidden' }}>Product</th>
                    <th className="px-4 py-3 border-r border-slate-200" style={{ width: '140px', resize: 'horizontal', overflow: 'hidden' }}>Dates</th>
                    <th className="px-4 py-3 text-right border-r border-slate-200" style={{ width: '120px', resize: 'horizontal', overflow: 'hidden' }}>Gross Prem</th>
                    <th className="px-4 py-3 text-center" style={{ width: '80px' }}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPolicies.map((p) => {
                    const pending = isPending(p);
                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors text-sm ${pending ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3 align-middle"><input type="checkbox" className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer align-middle" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                        <td className="px-4 py-3 font-medium text-slate-900 truncate">
                          {pending ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-widest">Pending</span>
                          ) : (
                            <Link href={`/app/policies/${p.id}`} className="hover:text-blue-600 hover:underline">{p.policy_number}</Link>
                          )}
                        </td>
                        <td className="px-4 py-3 truncate text-slate-700">{p.customer?.name || '—'}</td>
                        <td className="px-4 py-3 truncate text-slate-700">{p.insurer?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs truncate">
                          {p.policy_type ? (
                            <div className="flex flex-col gap-1 min-w-0">
                               <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-sm w-max uppercase text-[9px] tracking-wider border border-indigo-100">{p.policy_type.split(' | ')[0] || 'General'}</span>
                               <span className="text-[11px] truncate" title={p.policy_type.split(' | ')[1] || ''}>{p.policy_type.split(' | ')[1] || ''}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          <div className="font-medium text-slate-700 mb-0.5">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</div>
                          <div className="opacity-70 text-[10px] uppercase">to {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-GB') : '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 font-medium whitespace-nowrap">
                          {!pending && p.premium_amount ? <span>₹{p.premium_amount.toLocaleString('en-IN')}</span> : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link href={`/app/policies/${p.id}`}>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 inline-flex">
                               <FilePenLine className="w-4 h-4" />
                             </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
