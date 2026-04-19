'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Users, Search, IndianRupee, FileText,
  Phone, Mail, Trash2, ArrowUpDown,
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
  const { isAdmin } = useTeam();

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const res = await fetch('/api/customers');
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setCustomers(data.data || []);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return customers
      .filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.mobile?.includes(q)
      )
      .sort((a, b) => {
        let av: any = a[sortKey] ?? '';
        let bv: any = b[sortKey] ?? '';
        if (typeof av === 'string') av = av.toLowerCase();
        if (typeof bv === 'string') bv = bv.toLowerCase();
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
      });
  }, [customers, searchTerm, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const paginatedCustomers = useMemo(() => {
    return filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalPages = Math.ceil(filtered.length / pageSize);

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
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast.success('Customer deleted');
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
      toast.success(`Deleted ${selected.size} customers`);
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
            {isLoading ? '...' : `${customers.length} total clients`}
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
          {selected.size > 0 && isAdmin && (
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
          <Link href="/app/customers/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2 h-10 shrink-0">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Client</span>
            </Button>
          </Link>
        </div>
      </div>

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
                    {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)}
                  </span> of <span className="font-bold text-slate-700">{filtered.length}</span>
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
                            isAdmin={isAdmin}
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
    </div>
  );
}
