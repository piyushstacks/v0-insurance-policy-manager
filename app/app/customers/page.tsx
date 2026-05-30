'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Users, Search, IndianRupee, FileText,
  Phone, Mail, Trash2, ArrowUpDown, Sparkles, ChevronRight, X, ArrowRight, Info
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageLoader } from '@/components/ui/loader';
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
    <div className="flex flex-col h-full bg-slate-50 max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customers</h1>
          <p className="text-sm text-slate-500">
            {isLoading ? '...' : `${totalRecords} total clients`}
          </p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset page on query
              }}
              placeholder="Search name, email, phone..."
              className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200"
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
              <h4 className="text-sm font-bold text-slate-800">AI Customer Mapping Suggestions</h4>
              <p className="text-xs text-slate-500 mt-0.5">
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

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 md:p-6 pb-32">
        {isLoading ? (
          <PageLoader words={['customers', 'clients', 'profiles']} label="loading" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-600 mb-1">No customers found</h3>
            <p className="text-sm text-slate-400">Try a different search or add a new client.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Pagination Size Selector Bar */}
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
                    className="border border-slate-200 rounded px-2 py-1 bg-white font-medium text-slate-700 outline-none hover:border-blue-300 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
                <div className="hidden sm:block ml-2 px-3 py-1 border-l border-slate-200">
                  Showing <span className="font-bold text-slate-700">
                    {totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {(currentPage - 1) * pageSize + filtered.length}
                  </span> of <span className="font-bold text-slate-700">{totalRecords}</span>
                </div>
              </div>
            </div>

            {/* Table header */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-full table-auto">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
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
                      className={`hover:bg-slate-50/50 transition-colors ${selected.has(c.id) ? 'bg-blue-50/30' : ''}`}
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
                        <Link href={`/app/customers/${c.id}`} className="flex items-center gap-3 min-w-0 group">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {c.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <span className="font-semibold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">
                            {c.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="min-w-0 space-y-0.5">
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {c.mobile && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Phone className="w-3 h-3 shrink-0" />
                              {c.mobile}
                            </div>
                          )}
                          {!c.email && !c.mobile && <span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <FileText className="w-4 h-4 text-slate-300" />
                          {c.policiesCount}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-0.5 text-sm font-semibold text-slate-700">
                          <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                          {c.totalPremium.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-sm text-slate-500">
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
          </div>
        )}
      </div>
      {/* AI Suggestions Modal */}
      {isSuggestionsOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">Smart Mapping</h2>
                  <p className="text-xs text-slate-500">AI found {suggestions.length} similar customer pairs to merge.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSuggestionsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {suggestions.map((sug, idx) => {
                const isLoading = isMerging === `${sug.source.id}:${sug.target.id}`;
                return (
                  <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
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
                        <h4 className="font-bold text-slate-800">{sug.source.name}</h4>
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          {sug.source.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {sug.source.email}</div>}
                          {sug.source.mobile && <div className="flex items-center gap-1"><Phone className="w-3 h-3"/> {sug.source.mobile}</div>}
                          <div className="flex items-center gap-1 font-semibold text-slate-600"><FileText className="w-3 h-3"/> {sug.source.policiesCount} policies</div>
                        </div>
                      </div>

                      <div className="hidden md:flex flex-col items-center justify-center px-2">
                        <ArrowRight className="w-5 h-5 text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">Merge into</span>
                      </div>

                      {/* Target (Will be kept) */}
                      <div className="flex-1 w-full bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 relative">
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-600">
                          Primary
                        </div>
                        <h4 className="font-bold text-slate-800">{sug.target.name}</h4>
                        <div className="mt-2 space-y-1 text-xs text-slate-500">
                          {sug.target.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3"/> {sug.target.email}</div>}
                          {sug.target.mobile && <div className="flex items-center gap-1"><Phone className="w-3 h-3"/> {sug.target.mobile}</div>}
                          <div className="flex items-center gap-1 font-semibold text-slate-600"><FileText className="w-3 h-3"/> {sug.target.policiesCount} policies</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
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
