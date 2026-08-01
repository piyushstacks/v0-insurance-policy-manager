'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Users, Search, IndianRupee, FileText,
  Phone, Mail, Trash2, ArrowUpDown, Sparkles, ChevronRight, X, ArrowRight, Info, Crown
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SkeletonRow } from '@/components/ui/skeleton-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Fab } from '@/components/ui/fab';
import { useTeam } from '@/hooks/use-team';
import { RoleActionButton } from '@/components/role-action-button';

interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  policiesCount: number;
  totalPremium: number;
  nextRenewal?: string | null;
}

type SortKey = 'name' | 'policiesCount' | 'totalPremium' | 'nextRenewal';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const { canDirectlyAct } = useTeam();

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isMerging, setIsMerging] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/customers/suggestions');
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      if (searchTerm) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setCustomers(data.data || []);
      setTotalRecords(data.total || 0);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    fetchCustomers();
    fetchSuggestions();
  }, [fetchCustomers, fetchSuggestions]);

  async function handleMerge(sourceId: string, targetId: string) {
    setIsMerging(`${sourceId}:${targetId}`);
    try {
      const res = await fetch('/api/customers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceCustomerId: sourceId, targetCustomerId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Merge failed');
      
      toast.success('Customers merged successfully!', {
        description: data.message
      });
      
      fetchCustomers();
      fetchSuggestions();
      
      if (suggestions.length <= 1) {
        setIsSuggestionsOpen(false);
      }
    } catch (err: any) {
      toast.error('Merge failed', { description: err.message });
    } finally {
      setIsMerging(null);
    }
  }

  const filtered = useMemo(() => {
    // Search is handled server-side now. We only need client-side aggregation sorting for the current fetched slice.
    return [...customers].sort((a, b) => {
        let av: any = a[sortKey] ?? '';
        let bv: any = b[sortKey] ?? '';
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
  }, [customers, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const paginatedCustomers = useMemo(() => {
    return filtered;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  async function deleteSingle(id: string) {
    try {
      const res = await fetch('/api/customers/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: [id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (data.pendingApproval) {
        toast.success('Approval Requested', { description: data.message });
      } else {
        setCustomers(prev => prev.filter(c => c.id !== id));
        toast.success('Customer deleted');
      }
    } catch (e: any) {
      throw e; // Let RoleActionButton handle the error
    }
  }

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selected.size} customer(s)?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/customers/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (data.pendingApproval) {
        toast.success('Approval Requested', { description: data.message });
      } else {
        toast.success(`Deleted ${selected.size} customers`);
        setCustomers(prev => prev.filter(c => !selected.has(c.id)));
      }
      setSelected(new Set());
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsDeleting(false);
    }
  }

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortKey === col ? 'text-blue-600' : 'text-slate-300'}`} />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-muted max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? '...' : `${totalRecords} total clients`}
          </p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset page on query
              }}
              placeholder="Search name, email, phone..."
              className="pl-9 h-10 rounded-xl bg-muted border-border"
            />
          </div>
          {selected.size > 0 && canDirectlyAct && (
            <Button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* AI Suggestions Banner */}
      {suggestions.length > 0 && (
        <div className="mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">AI Customer Mapping Suggestions</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                We found {suggestions.length} pair{suggestions.length > 1 ? 's' : ''} of similar customer profiles that can be merged.
              </p>
            </div>
          </div>
          <Button 
            onClick={() => setIsSuggestionsOpen(true)}
            size="sm" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold gap-1.5 shadow-sm text-xs py-2 px-4 h-9"
          >
            Review Suggestions
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Table / Card Area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 pb-32">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonRow key={i} className="bg-card rounded-xl border border-border" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchTerm ? 'No clients match your search' : 'No clients yet — add your first customer to begin 👋'}
            description={searchTerm ? 'Try a different name, email, or phone number.' : undefined}
          />
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            {/* Pagination Size Selector Bar */}
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
                    className="border border-border rounded px-2 py-1 bg-card font-medium text-foreground outline-none hover:border-blue-300 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="hidden sm:block ml-2 px-3 py-1 border-l border-border">
                  Showing <span className="font-bold text-foreground">
                    {totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {(currentPage - 1) * pageSize + filtered.length}
                  </span> of <span className="font-bold text-foreground">{totalRecords}</span>
                </div>
              </div>
            </div>

            {/* ─── Mobile card list (< lg) ─────────────────────── */}
            <div className="lg:hidden flex flex-col gap-3 p-3 bg-muted/30">
              {paginatedCustomers.map(c => (
                <div key={c.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3 relative">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {c.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        {c.totalPremium >= 500000 && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 shadow-sm">
                            <Crown className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <Link href={`/app/customers/${c.id}`} className="font-bold text-foreground text-sm truncate hover:text-blue-600 transition-colors">
                          {c.name}
                        </Link>
                        <span className="text-xs text-muted-foreground truncate">{c.mobile || c.email || 'No contact info'}</span>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="rounded border-border/80 accent-blue-600 w-5 h-5 cursor-pointer mt-1" 
                      checked={selected.has(c.id)} 
                      onChange={(e) => toggleSelect(c.id, e as any)} 
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Premium</span>
                      <span className="font-bold text-foreground">₹{c.totalPremium.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Policies</span>
                      <span className="font-medium text-foreground">{c.policiesCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Desktop table (≥ lg) ────────────────────────── */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-full table-auto">
                <thead>
                  <tr className="bg-muted border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={() => {
                          if (selected.size === filtered.length) setSelected(new Set());
                          else setSelected(new Set(filtered.map(c => c.id)));
                        }}
                        className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3"><SortBtn col="name" label="Name" /></th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3"><SortBtn col="policiesCount" label="Policies" /></th>
                    <th className="px-4 py-3"><SortBtn col="totalPremium" label="Premium" /></th>
                    <th className="px-4 py-3"><SortBtn col="nextRenewal" label="Next Renewal" /></th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map(c => (
                    <tr
                      key={c.id}
                      className={`hover:bg-background transition-colors ${selected.has(c.id) ? 'bg-blue-50/30' : ''}`}
                    >
                      <td className="px-4 py-3.5" onClick={e => toggleSelect(c.id, e)}>
                        <input
                          type="checkbox"
                          checked={selected.has(c.id)}
                          readOnly
                          className="rounded accent-blue-600 w-4 h-4 cursor-pointer pointer-events-none"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/app/customers/${c.id}`} prefetch={true} className="flex items-center gap-3 min-w-0 group">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {c.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            {c.totalPremium >= 500000 && (
                              <div className="absolute -top-1 -right-1 bg-amber-400 text-white rounded-full p-0.5 shadow-sm" title="VIP Client (High Premium)">
                                <Crown className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                          <span className="font-semibold text-foreground text-sm truncate group-hover:text-blue-600 transition-colors">
                            {c.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="min-w-0 space-y-1">
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground group/contact">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{c.email}</span>
                              <a href={`mailto:${c.email}`} title="Send Email" onClick={e => e.stopPropagation()} className="opacity-0 group-hover/contact:opacity-100 p-0.5 bg-muted hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-foreground hover:text-blue-600 transition-all ml-1"><Mail className="w-3 h-3" /></a>
                            </div>
                          )}
                          {c.mobile && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground group/contact">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span>{c.mobile}</span>
                              <a href={`tel:${c.mobile}`} title="Call" onClick={e => e.stopPropagation()} className="opacity-0 group-hover/contact:opacity-100 p-0.5 bg-muted hover:bg-green-100 dark:hover:bg-green-900 rounded text-foreground hover:text-green-600 transition-all ml-1"><Phone className="w-3 h-3" /></a>
                            </div>
                          )}
                          {!c.email && !c.mobile && <span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                          <FileText className="w-4 h-4 text-slate-300" />
                          {c.policiesCount}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-0.5 text-sm font-semibold text-foreground">
                          <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" />
                          {c.totalPremium.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-muted-foreground">
                          {c.nextRenewal
                            ? new Date(c.nextRenewal).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : <span className="text-slate-300">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <RoleActionButton
                            canDirectlyAct={canDirectlyAct}
                            requestType="DELETE_CUSTOMER"
                            entityId={c.id}
                            entityType="customer"
                            directAction={() => deleteSingle(c.id)}
                            label="Delete"
                            icon={Trash2}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                            reasonPrompt="Why do you want to delete this customer?"
                            metadata={{ customer_name: c.name }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer Pagination Navigation */}
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
          </div>
        )}
      </div>

      <Fab />
      
      {/* AI Suggestions Modal */}
      {isSuggestionsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">Smart Mapping</h2>
                  <p className="text-xs text-muted-foreground">AI found {suggestions.length} similar customer pairs to merge.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSuggestionsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-muted">
              {suggestions.map((sug, idx) => {
                const isLoading = isMerging === `${sug.source.id}:${sug.target.id}`;
                return (
                  <div key={idx} className="bg-card rounded-xl border border-border p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {sug.similarity}% Match
                      </span>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-4">
                      {/* Source (Will be deleted/merged) */}
                      <div className="flex-1 w-full bg-red-50/50 rounded-xl p-4 border border-red-100 relative">
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600">
                          Duplicate
                        </div>
                        <h4 className="font-bold text-foreground">{sug.source.name}</h4>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {sug.source.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {sug.source.email}</div>}
                          {sug.source.mobile && <div className="flex items-center gap-1"><Phone className="w-3 h-3"/> {sug.source.mobile}</div>}
                          <div className="flex items-center gap-1 font-semibold text-foreground/90"><FileText className="w-3 h-3"/> {sug.source.policiesCount} policies</div>
                        </div>
                      </div>

                      <div className="hidden md:flex flex-col items-center justify-center px-2">
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">Merge into</span>
                      </div>

                      {/* Target (Will be kept) */}
                      <div className="flex-1 w-full bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 relative">
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-600">
                          Primary
                        </div>
                        <h4 className="font-bold text-foreground">{sug.target.name}</h4>
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {sug.target.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {sug.target.email}</div>}
                          {sug.target.mobile && <div className="flex items-center gap-1"><Phone className="w-3 h-3"/> {sug.target.mobile}</div>}
                          <div className="flex items-center gap-1 font-semibold text-foreground/90"><FileText className="w-3 h-3"/> {sug.target.policiesCount} policies</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex justify-end">
                      <RoleActionButton
                        canDirectlyAct={canDirectlyAct}
                        requestType="EDIT_CUSTOMER"
                        entityId={sug.target.id}
                        entityType="customer"
                        directAction={() => handleMerge(sug.source.id, sug.target.id)}
                        label={isLoading ? 'Merging...' : 'Merge Profiles'}
                        icon={Sparkles}
                        variant="default"
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-2"
                        reasonPrompt="Why do you want to merge these customers?"
                        metadata={{ 
                          action: 'merge',
                          source_id: sug.source.id, 
                          source_name: sug.source.name,
                          target_name: sug.target.name
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
