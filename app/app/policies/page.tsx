/**
 * Policies List Page - Advanced DataTable with Filters (Mobile First)
 */
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Button as ActionButton } from '@/components/base/buttons/button';
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
  Eye,
  IndianRupee,
  FileText
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
  documents?: { file_path: string, file_name: string }[];
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

  const [totalRecords, setTotalRecords] = useState(0);

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      if (searchTerm) params.set('search', searchTerm.trim());

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPolicies(data.data || []);
      setTotalRecords(data.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading policies');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // --- REALTIME POLLING FALLBACK & SUBSCRIPTION ---
  useEffect(() => {
    if (!supabase) return;

    // Realtime channel
    const channel = supabase
      .channel('public:policies')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'policies' },
        (payload) => {
          fetchPolicies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchPolicies]);

  // Bulletproof fallback: If there are pending objects, poll the table every 3 seconds.
  // This guarantees UI sync even if the user hasn't enabled Supabase Realtime yet!
  useEffect(() => {
    // Only derived variables like pendingPolicies.length aren't in scope unless evaluated inside
    // Because pendingPolicies relies on policies state, we must check policies directly or just use a boolean
    const hasPending = policies.some(p => 
      p.policy_number?.startsWith('PENDING_OCR') || 
      p.policy_number?.startsWith('BULK_OCR') || 
      p.policy_number?.startsWith('IMG-') ||
      p.policy_number?.startsWith('doc_')
    );

    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchPolicies();
    }, 3000);

    return () => clearInterval(interval);
  }, [policies, fetchPolicies]);


  // Unique values for dropdowns
  const uniqueProducts = useMemo(() => Array.from(new Set(policies.map(p => p.policy_type).filter(Boolean))), [policies]);
  const uniqueCompanies = useMemo(() => Array.from(new Set(policies.map(p => p.insurer?.name).filter(Boolean))), [policies]);

  const isPending = useCallback((p: Policy) => 
    p.policy_number?.startsWith('PENDING_OCR') || 
    p.policy_number?.startsWith('BULK_OCR') || 
    p.policy_number?.startsWith('IMG-') ||
    p.policy_number?.startsWith('doc_')
  , []);

  // Split Data
  const pendingPolicies = useMemo(() => policies.filter(isPending), [policies, isPending]);

  // Derived Filtered Data
  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      if (isPending(p)) return false; // Hide pending from main list

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
  }, [policies, searchTerm, filterProduct, filterCompany, dateStart, dateEnd, isPending]);

  // Derive Paginated Context
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedPolicies = useMemo(() => {
    return filteredPolicies;
  }, [filteredPolicies]);

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

  const deleteSingle = async (id: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!window.confirm("Delete this policy permanently?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/policies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Successfully deleted');
      setPolicies(prev => prev.filter(p => p.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col p-4 md:p-8 min-h-full max-w-[1600px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-1">Policies Directory</h1>
          <p className="text-slate-500 font-medium">Manage and explore {totalRecords} parsed policies</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <ActionButton 
             color={showMobileFilters ? "primary" : "secondary"}
             size="md"
             onClick={() => setShowMobileFilters(!showMobileFilters)}
             iconLeading={Filter}
          >
            {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
          </ActionButton>

          {selected.size > 0 && (
            <>
               <Button variant="secondary" onClick={handleReExtract} disabled={reExtracting || isDeleting} className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200">
                 <RefreshCw className={`w-4 h-4 mr-2 ${reExtracting ? 'animate-spin' : ''}`} />
                 Re-extract ({selected.size})
               </Button>
               <ActionButton 
                 color="primary-destructive" 
                 onClick={handleBulkDelete} 
                 isLoading={isDeleting}
                 iconLeading={Trash2}
               >
                 Delete Selected
               </ActionButton>
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

      {/* --- EXTRACTING QUEUE SECTION --- */}
      {pendingPolicies.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-amber-100/50 px-4 py-3 border-b border-amber-200">
            <h2 className="font-bold text-amber-900 text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin opacity-70" /> 
              Pending Extractions ({pendingPolicies.length})
            </h2>
          </div>
          <div className="p-0">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-amber-100">
                {pendingPolicies.map(p => {
                  const docName = p.documents?.[0]?.file_name || 'Policy Document';
                  return (
                    <tr key={p.id} className="hover:bg-amber-100/30 transition-colors">
                      <td className="w-12 px-4 py-3">
                        <input type="checkbox" className="rounded border-amber-300 accent-amber-600 w-4 h-4 cursor-pointer" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                      <td className="px-4 py-3 font-medium text-amber-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="truncate max-w-xs">{docName}</span>
                      </td>
                      <td className="px-4 py-3 text-amber-700 text-xs">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold bg-amber-200/50 uppercase tracking-widest">
                          Processing OCR...
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-800 hover:bg-amber-100 inline-flex" onClick={(e) => deleteSingle(p.id, e)} title="Cancel upload">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                   Showing <span className="font-bold text-slate-700">{totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-slate-700">{(currentPage - 1) * pageSize + filteredPolicies.length}</span> of <span className="font-bold text-slate-700">{totalRecords}</span> entries
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
            <>
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-full table-auto">
                <thead>
                  <tr className="bg-slate-100 border-b text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="w-8 px-2 py-3 text-center"><input type="checkbox" className="rounded border-slate-300 accent-blue-600 w-3.5 h-3.5 cursor-pointer align-middle" checked={selected.size === paginatedPolicies.length && paginatedPolicies.length > 0} onChange={toggleAll} /></th>
                    <th className="px-3 py-3 border-r border-slate-200 min-w-[100px]">Policy No</th>
                    <th className="px-3 py-3 border-r border-slate-200 min-w-[100px]">Insured</th>
                    <th className="px-3 py-3 border-r border-slate-200 min-w-[120px]">Company</th>
                    <th className="px-2 py-3 border-r border-slate-200 min-w-[80px]">Product</th>
                    <th className="px-2 py-3 border-r border-slate-200 w-20">Dates</th>
                    <th className="px-2 py-3 text-right border-r border-slate-200 w-24">Gross Prem</th>
                    <th className="px-2 py-3 text-center w-14">Details</th>
                    <th className="px-2 py-3 text-center w-14">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPolicies.map((p) => {
                    const fileUrl = p.documents?.[0]?.file_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/policy-documents/${p.documents[0].file_path}` : `/app/policies/${p.id}`;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors text-sm">
                        <td className="px-3 py-3 align-middle text-center"><input type="checkbox" className="rounded border-slate-300 accent-blue-600 w-4 h-4 cursor-pointer align-middle" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                        <td className="px-3 py-3 font-medium text-slate-900 truncate max-w-[140px]">
                          {p.documents?.[0]?.file_path ? (
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">{p.policy_number}</a>
                          ) : (
                            <Link href={`/app/policies/${p.id}`} className="hover:text-blue-600 hover:underline">{p.policy_number}</Link>
                          )}
                        </td>
                        <td className="px-3 py-3 truncate text-slate-700 max-w-[140px]">{p.customer?.name || '—'}</td>
                        <td className="px-3 py-3 truncate text-slate-700 max-w-[160px]">{p.insurer?.name || '—'}</td>
                        <td className="px-3 py-3 text-slate-600 text-xs truncate max-w-[120px]">
                          {p.policy_type ? (
                            <div className="flex flex-col gap-1 min-w-0">
                               <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-sm w-max uppercase text-[9px] tracking-wider border border-indigo-100">{p.policy_type.split(' | ')[0] || 'General'}</span>
                               <span className="text-[11px] truncate" title={p.policy_type.split(' | ')[1] || ''}>{p.policy_type.split(' | ')[1] || ''}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">
                          <div className="font-medium text-slate-700 mb-0.5">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</div>
                          <div className="opacity-70 text-[10px] uppercase">to {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-GB') : '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700 font-medium whitespace-nowrap">
                          {p.premium_amount ? <span>₹{p.premium_amount.toLocaleString('en-IN')}</span> : '—'}
                        </td>
                        <td className="px-2 py-3 text-center">
                           <Link href={`/app/policies/${p.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 inline-flex" title="View Details">
                                <Eye className="w-4 h-4" />
                              </Button>
                           </Link>
                        </td>
                        <td className="px-2 py-3 text-center">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 inline-flex" onClick={(e) => deleteSingle(p.id, e)} title="Delete Policy">
                             <Trash2 className="w-4 h-4" />
                           </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  Page <span className="font-bold text-slate-700">{currentPage}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
