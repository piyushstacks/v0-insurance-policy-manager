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
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  const [pendingPolicies, setPendingPolicies] = useState<Policy[]>([]);
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
  const [uniqueProducts, setUniqueProducts] = useState<string[]>([]);
  const [uniqueCompanies, setUniqueCompanies] = useState<string[]>([]);

  const fetchPolicies = useCallback(async (background = false) => {
    if (!background) setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        excludePending: 'true',
        _t: Date.now().toString(), // Force bypass cache
      });
      if (searchTerm) params.set('search', searchTerm.trim());
      if (filterProduct) params.set('productName', filterProduct);
      if (filterCompany) params.set('companyName', filterCompany);
      if (dateStart) params.set('dateStart', dateStart);
      if (dateEnd) params.set('dateEnd', dateEnd);

      const response = await fetch(`/api/policies?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPolicies(data.data || []);
      setTotalRecords(data.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error loading policies');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, filterProduct, filterCompany, dateStart, dateEnd]);

  useEffect(() => {
    fetch('/api/policies/filters')
      .then(r => r.json())
      .then(data => {
        if (data.products) setUniqueProducts(data.products);
        if (data.companies) setUniqueCompanies(data.companies);
      }).catch(console.error);
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const response = await fetch('/api/policies?onlyPending=true&pageSize=100');
      if (response.ok) {
        const data = await response.json();
        setPendingPolicies(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending', err);
    }
  }, []);

  useEffect(() => {
    fetchPolicies(false);
    fetchPending();
  }, [fetchPolicies, fetchPending]);

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
          fetchPolicies(true);
          fetchPending();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchPolicies, fetchPending]);

  // Bulletproof fallback
  useEffect(() => {
    if (pendingPolicies.length === 0) return;

    const interval = setInterval(() => {
      fetchPolicies(true);
      fetchPending();
    }, 3000);

    return () => clearInterval(interval);
  }, [pendingPolicies.length, fetchPolicies, fetchPending]);


  // Derived Paginated Context
  const filteredPolicies = policies;

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

      if (data.pendingApproval) {
        toast.success('Approval Requested', { description: data.message });
      } else {
        toast.success('Successfully deleted', { description: data.message });
        setPolicies(prev => prev.filter(p => !selected.has(p.id))); // Optimistic UI update
      }
      setSelected(new Set());
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');

      if (data.pendingApproval) {
        toast.success('Approval Requested', { description: data.message });
      } else {
        toast.success('Successfully deleted');
        setPolicies(prev => prev.filter(p => p.id !== id));
        setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
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
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-1">Policies Directory</h1>
          <p className="text-muted-foreground font-medium">Manage and explore {totalRecords} parsed policies</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search policies..."
              className="pl-9 h-10 rounded-xl bg-muted border-border w-full"
            />
          </div>
          <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
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
                 <Button variant="secondary" onClick={handleReExtract} disabled={reExtracting || isDeleting} className="shrink-0 bg-amber-100 hover:bg-amber-200 text-amber-800">
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

                        <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className={`ml-auto sm:ml-0 shrink-0 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 ${pendingPolicies.length === 0 ? 'hidden' : ''}`}>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin opacity-70" /> 
                  Pending ({pendingPolicies.length})
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-muted p-0 border-l border-border">
                <SheetHeader className="p-6 bg-card border-b border-border">
                  <SheetTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                    <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />
                    Pending Extractions
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground font-normal">
                    These policies are currently being processed by the AI or require your manual review.
                  </p>
                </SheetHeader>
                <div className="p-4 flex flex-col gap-3">
                  {pendingPolicies.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No pending extractions.</div>
                  ) : (
                    pendingPolicies.map(p => {
                      const docName = p.documents?.[0]?.file_name || 'Policy Document';
                      const isManual = p.policy_number?.includes('MANUAL');
                      return (
                        <div key={p.id} className="bg-card rounded-xl p-4 border border-border shadow-sm flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <FileText className="w-8 h-8 text-indigo-100 fill-indigo-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                               <p className="font-semibold text-foreground truncate text-sm">{docName}</p>
                               <div className="flex items-center gap-2 mt-1.5">
                                 {isManual ? (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 uppercase tracking-wide">
                                     Requires Manual Entry
                                   </span>
                                 ) : (
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 uppercase tracking-wide">
                                     Processing OCR...
                                   </span>
                                 )}
                               </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-3 border-t border-border justify-end">
                             {isManual && (
                               <Link href={`/app/policies/${p.id}/edit`}>
                                 <Button variant="default" size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                                   Enter Details
                                 </Button>
                               </Link>
                             )}
                             <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => deleteSingle(p.id, e)}>
                               Cancel & Delete
                             </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/app/policies/new" className="ml-auto sm:ml-0 shrink-0">
              <Button variant="primary">
                <Plus className="w-4 h-4 mr-2 hidden sm:inline" /> <span className="hidden sm:inline">Upload Policies</span><span className="sm:hidden">Upload</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* --- TOP COLLAPSIBLE FILTERS --- */}
      {showMobileFilters && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-5 mb-6 animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Product Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Category</label>
              <select 
                className="flex h-9 w-full rounded-md border border-border bg-muted px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={filterProduct} 
                onChange={e => { setFilterProduct(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Categories ({uniqueProducts.length})</option>
                {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Company Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Insurer</label>
              <select 
                className="flex h-9 w-full rounded-md border border-border bg-muted px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={filterCompany} 
                onChange={e => { setFilterCompany(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Companies ({uniqueCompanies.length})</option>
                {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Dates */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">From</label>
              <Input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); setCurrentPage(1); }} className="h-9 text-sm bg-muted border-border" />
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">To</label>
              <div className="flex gap-2">
                 <Input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); setCurrentPage(1); }} className="h-9 text-sm bg-muted border-border" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground bg-muted" onClick={clearFilters} title="Clear Filters">
                    <X className="w-4 h-4" />
                  </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FULL WIDTH TABLE --- */}
      <main className="flex-1 flex flex-col min-w-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        
        {/* Header: Pagination Toolbar */}
        <div className="p-3 border-b bg-muted flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-muted-foreground z-20">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5">
                   <span className="font-medium">Rows per page:</span>
                   <select 
                     value={pageSize} 
                     onChange={(e) => {
                       setPageSize(Number(e.target.value));
                       setCurrentPage(1);
                     }} 
                     className="border border-border rounded px-2 py-1 bg-card font-medium text-foreground outline-none hover:border-indigo-300 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                   >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                   </select>
               </div>
               <div className="block sm:block ml-0 sm:ml-2 mt-2 sm:mt-0 px-0 sm:px-3 py-1 border-none sm:border-solid sm:border-l border-border text-[10px] sm:text-xs">
                   Showing <span className="font-bold text-foreground">{totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="font-bold text-foreground">{(currentPage - 1) * pageSize + filteredPolicies.length}</span> of <span className="font-bold text-foreground">{totalRecords}</span> entries
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
               <span className="font-bold text-foreground px-3 bg-card border border-border py-1.5 rounded-md shadow-sm">
                 {currentPage} <span className="text-muted-foreground font-medium mx-1">/</span> {totalPages || 1}
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
        <div className="flex-1 overflow-auto bg-card">
          {isLoading ? (
            <PageLoader words={['policies', 'documents', 'schedules', 'records', 'policies']} label="loading" />
          ) : filteredPolicies.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-muted items-center justify-center flex mx-auto mb-3">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">No policies found</h3>
              <p className="text-sm text-muted-foreground">Try clearing your filters or adding a new policy.</p>
            </div>
          ) : (
            <>
            <div className="w-full overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-full table-auto">
                <thead>
                  <tr className="bg-muted border-b text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="w-8 px-2 py-3 text-center"><input type="checkbox" className="rounded border-border/80 accent-blue-600 w-3.5 h-3.5 cursor-pointer align-middle" checked={selected.size === paginatedPolicies.length && paginatedPolicies.length > 0} onChange={toggleAll} /></th>
                    <th className="px-3 py-3 border-r border-border min-w-[100px]">Policy No</th>
                    <th className="px-3 py-3 border-r border-border min-w-[100px]">Insured</th>
                    <th className="px-3 py-3 border-r border-border min-w-[120px]">Company</th>
                    <th className="px-2 py-3 border-r border-border min-w-[80px]">Product</th>
                    <th className="px-2 py-3 border-r border-border w-20">Dates</th>
                    <th className="px-2 py-3 text-right border-r border-border w-24">Gross Prem</th>
                    <th className="px-2 py-3 text-center w-14">Details</th>
                    <th className="px-2 py-3 text-center w-14">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPolicies.map((p) => {
                    const baseUrl = process.env.NEXT_PUBLIC_B2_PUBLIC_URL || '';
                    const fileUrl = p.documents?.[0]?.file_path ? `${baseUrl}/${p.documents[0].file_path}` : `/app/policies/${p.id}`;
                    
                    return (
                      <tr key={p.id} className="hover:bg-muted/80 transition-colors text-sm">
                        <td className="px-3 py-3 align-middle text-center"><input type="checkbox" className="rounded border-border/80 accent-blue-600 w-4 h-4 cursor-pointer align-middle" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                        <td className="px-3 py-3 font-medium text-foreground truncate max-w-[140px]">
                          <div className="flex items-center gap-2">
                            <span 
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                p.status === 'active' || p.status === 'renewed' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                                p.status === 'expired' ? 'bg-amber-500' : 
                                'bg-red-500'
                              }`} 
                              title={p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Unknown'}
                            />
                            {p.documents?.[0]?.file_path ? (
                              <a href={fileUrl} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline truncate">{p.policy_number}</a>
                            ) : (
                              <Link href={`/app/policies/${p.id}`} prefetch={true} className="hover:text-blue-600 hover:underline truncate">{p.policy_number}</Link>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 truncate text-foreground max-w-[140px]">{p.customer?.name || '—'}</td>
                        <td className="px-3 py-3 truncate text-foreground max-w-[160px]">{p.insurer?.name || '—'}</td>
                        <td className="px-3 py-3 text-foreground/90 text-xs truncate max-w-[120px]">
                          {p.policy_type ? (
                            <div className="flex flex-col gap-1 min-w-0">
                               <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-sm w-max uppercase text-[9px] tracking-wider border border-indigo-100">{p.policy_type.split(' | ')[0] || 'General'}</span>
                               <span className="text-[11px] truncate" title={p.policy_type.split(' | ')[1] || ''}>{p.policy_type.split(' | ')[1] || ''}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="font-medium text-foreground mb-0.5">{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '—'}</div>
                          <div className="opacity-70 text-[10px] uppercase">to {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-GB') : '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-right text-foreground font-medium whitespace-nowrap">
                          {p.premium_amount ? (
                            <span className="flex items-center justify-end gap-0.5 text-emerald-600 dark:text-emerald-400">
                              <IndianRupee className="w-3.5 h-3.5" />
                              {p.premium_amount.toLocaleString('en-IN')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-2 py-3 text-center">
                           <Link href={`/app/policies/${p.id}`} prefetch={true}>
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
              <div className="p-4 border-t bg-muted flex items-center justify-between">
                <div className="text-xs text-muted-foreground font-medium">
                  Page <span className="font-bold text-foreground">{currentPage}</span> of <span className="font-bold text-foreground">{totalPages}</span>
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
