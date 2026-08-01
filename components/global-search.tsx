'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, Users, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: 'policy' | 'customer';
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

interface GlobalSearchProps {
  className?: string;
  placeholder?: string;
}

export function GlobalSearch({ className, placeholder = 'Search customers, policies…' }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setQuery('');
  }, [pathname]);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      const mapped: SearchResult[] = [
        ...(data.customers || []).map((c: any) => ({
          type: 'customer' as const,
          id: c.id,
          label: c.name,
          sublabel: c.mobile || c.email || 'No contact info',
          href: `/app/customers/${c.id}`,
        })),
        ...(data.policies || []).map((p: any) => ({
          type: 'policy' as const,
          id: p.id,
          label: p.policy_number,
          sublabel: `${p.insurer?.name || 'Unknown'} · ${p.status}`,
          href: `/app/policies/${p.id}`,
        })),
      ];
      setResults(mapped);
      setIsOpen(mapped.length > 0);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Input */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-muted transition-colors border border-border rounded-xl py-2 pl-9 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all font-medium text-foreground placeholder:text-muted-foreground"
        />
        {!isLoading && !query && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-200 transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <>
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-card transition-colors rounded-xl shadow-xl border border-border overflow-hidden z-50 max-h-80 overflow-y-auto">
            {/* Group: Customers */}
            {results.filter(r => r.type === 'customer').length > 0 && (
              <div>
                <p className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted transition-colors border-b border-border">
                  Customers
                </p>
                {results.filter(r => r.type === 'customer').map(r => (
                  <Link
                    key={r.id}
                    href={r.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50 transition-colors group/item"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs font-bold">
                      {r.label.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate group-hover/item:text-blue-600">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                    <Users className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
            {/* Group: Policies */}
            {results.filter(r => r.type === 'policy').length > 0 && (
              <div>
                <p className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted transition-colors border-b border-border border-t">
                  Policies
                </p>
                {results.filter(r => r.type === 'policy').map(r => (
                  <Link
                    key={r.id}
                    href={r.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 hover:bg-blue-50 transition-colors group/item"
                  >
                    <div className="w-7 h-7 rounded-lg bg-muted transition-colors text-muted-foreground flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground font-mono truncate group-hover/item:text-blue-600">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          {/* Click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  );
}
