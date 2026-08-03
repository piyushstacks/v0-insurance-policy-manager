'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const listboxId = useId();

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }, [pathname]);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
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
      setActiveIndex(-1);
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

  // Keyboard navigation inside results
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const result = results[activeIndex];
      if (result) window.location.href = result.href;
    }
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Combobox input */}
      <div className="relative group">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          aria-label="Search customers and policies"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-muted border border-border rounded-xl py-2.5 pl-9 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all font-medium text-foreground placeholder:text-muted-foreground h-11"
          autoComplete="off"
        />
        {!isLoading && !query && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100" aria-hidden="true">
            <span className="text-xs">⌘</span>K
          </kbd>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin" aria-hidden="true" />
        )}
        {!isLoading && query && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none min-w-[24px] min-h-[24px] flex items-center justify-center"
          >
            <X className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Results listbox */}
      {isOpen && results.length > 0 && (
        <>
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Search results"
            className="absolute top-full left-0 right-0 mt-1.5 bg-card rounded-xl shadow-xl border border-border overflow-hidden z-50 max-h-80 overflow-y-auto custom-scrollbar"
          >
            {/* Group: Customers */}
            {results.filter(r => r.type === 'customer').length > 0 && (
              <div role="group" aria-label="Customers">
                <p className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted border-b border-border" aria-hidden="true">
                  Customers
                </p>
                {results.filter(r => r.type === 'customer').map((r, idx) => (
                  <Link
                    key={r.id}
                    id={`search-result-${idx}`}
                    href={r.href}
                    role="option"
                    aria-selected={activeIndex === idx}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 transition-colors group/item focus-visible:outline-none focus-visible:bg-blue-50',
                      activeIndex === idx ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-accent'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs font-bold" aria-hidden="true">
                      {r.label.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate group-hover/item:text-blue-600">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                    </div>
                    <Users className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            )}
            {/* Group: Policies */}
            {results.filter(r => r.type === 'policy').length > 0 && (
              <div role="group" aria-label="Policies">
                <p className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted border-b border-border border-t" aria-hidden="true">
                  Policies
                </p>
                {results.filter(r => r.type === 'policy').map((r, idx) => {
                  const globalIdx = results.filter(r => r.type === 'customer').length + idx;
                  return (
                    <Link
                      key={r.id}
                      id={`search-result-${globalIdx}`}
                      href={r.href}
                      role="option"
                      aria-selected={activeIndex === globalIdx}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 transition-colors group/item focus-visible:outline-none focus-visible:bg-blue-50',
                        activeIndex === globalIdx ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-accent'
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0" aria-hidden="true">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground font-mono truncate group-hover/item:text-blue-600">{r.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
          {/* Click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
        </>
      )}
    </div>
  );
}
