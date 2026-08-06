'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Loader2, Check, ChevronsUpDown, X, Save } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import * as chrono from 'chrono-node';
import { useTeam } from '@/hooks/use-team';

interface AddFollowupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: string;
  editItem?: any;
  initialData?: any;
}

export function AddFollowupModal({ open, onOpenChange, onSuccess, initialDate, editItem, initialData }: AddFollowupModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExisting, setIsExisting] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  
  const { members, user: currentUser } = useTeam();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<{
    customer_id: string;
    prospect_name: string;
    prospect_mobile: string;
    notes: string;
    scheduled_date: string;
    assignees: string[];
  }>({
    customer_id: '',
    prospect_name: '',
    prospect_mobile: '',
    notes: '',
    scheduled_date: initialDate || new Date().toISOString().split('T')[0],
    assignees: []
  });
  
  const [categories, setCategories] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [priority, setPriority] = useState('Medium');
  
  const [magicInput, setMagicInput] = useState('');

  const handleMagicInput = (val: string) => {
    setMagicInput(val);
    const parsed = chrono.parse(val);
    if (parsed && parsed.length > 0) {
      const parsedDate = parsed[0].start.date();
      
      // Update form data scheduled_date
      const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, scheduled_date: localDate }));
      
      // If time was specified, append to notes
      if (parsed[0].start.isCertain('hour')) {
         const timeStr = parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
         const text = val.replace(parsed[0].text, '').trim();
         setFormData(prev => ({ ...prev, notes: text ? text + ' @ ' + timeStr : '@ ' + timeStr }));
      } else {
         const text = val.replace(parsed[0].text, '').trim();
         setFormData(prev => ({ ...prev, notes: text }));
      }
    } else {
       setFormData(prev => ({ ...prev, notes: val }));
    }
  };

  // Fetch customers when modal opens
  useEffect(() => {
    if (open && customers.length === 0) {
      setIsLoadingCustomers(true);
      fetch('/api/customers')
        .then(res => res.json())
        .then(data => {
          if (data.data) {
             const sorted = data.data.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
             setCustomers(sorted);
          }
        })
        .catch(e => console.error('Failed to load customers', e))
        .finally(() => setIsLoadingCustomers(false));
    }
    
    // Set form data based on editItem or initial defaults
    if (open) {
       setTimeout(() => inputRef.current?.focus(), 100);
       if (editItem) {
          setIsExisting(!!editItem.customer_id);
          setFormData({
            customer_id: editItem.customer_id || '',
            prospect_name: editItem.prospect_name || '',
            prospect_mobile: editItem.prospect_mobile || '',
            notes: editItem.notes || '',
            scheduled_date: editItem.scheduled_date || new Date().toISOString().split('T')[0],
            assignees: editItem.assignees || (editItem.user_id ? [editItem.user_id] : [])
          });
          const cats = editItem.category ? editItem.category.split(',').map((s: string) => s.trim()) : [];
          const hasHigh = cats.some((c: string) => c.toLowerCase() === 'high priority' || c.toLowerCase() === 'high');
          const hasLow = cats.some((c: string) => c.toLowerCase() === 'low priority' || c.toLowerCase() === 'low');
          setPriority(hasHigh ? 'High' : hasLow ? 'Low' : 'Medium');
          setCategories(cats.filter((c: string) => !c.toLowerCase().includes('priority') && c.toLowerCase() !== 'high' && c.toLowerCase() !== 'low'));
       } else if (initialData) {
          setIsExisting(false);
          setFormData({
            customer_id: '',
            prospect_name: initialData.title || '',
            prospect_mobile: '',
            notes: initialData.description || '',
            scheduled_date: initialData.scheduled_date || initialDate || new Date().toISOString().split('T')[0],
            assignees: currentUser?.id ? [currentUser.id] : []
          });
          setCategories(initialData.category ? [initialData.category] : []);
          setPriority(initialData.priority || 'Medium');
       } else {
          setFormData({
            customer_id: '',
            prospect_name: '',
            prospect_mobile: '',
            notes: '',
            scheduled_date: initialDate || new Date().toISOString().split('T')[0],
            assignees: currentUser?.id ? [currentUser.id] : []
          });
          setCategories([]);
          setPriority('Medium');
       }
    }
  }, [open, editItem, initialDate, initialData, currentUser?.id]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setCategories(categories.filter(t => t !== tagToRemove));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && categories.length > 0) {
      removeTag(categories[categories.length - 1]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isExisting && !formData.customer_id) {
      toast.error('Please select an existing customer');
      return;
    }
    if (!isExisting && !formData.prospect_name.trim()) {
      toast.error('Please enter a prospect name');
      return;
    }
    if (!formData.scheduled_date) {
      toast.error('Please select a scheduled date');
      return;
    }

    setIsSubmitting(true);
    try {
      const finalCategories = [...categories, priority !== 'Medium' ? `${priority} Priority` : ''].filter(Boolean);
      
      const payload = {
        ...formData,
        customer_id: isExisting ? formData.customer_id : null,
        prospect_name: !isExisting ? formData.prospect_name : null,
        prospect_mobile: !isExisting ? formData.prospect_mobile : null,
        category: finalCategories.length > 0 ? finalCategories.join(', ') : null
      };

      const url = editItem ? `/api/followups/${editItem.id}` : '/api/followups';
      const method = editItem ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || `Failed to ${editItem ? 'update' : 'create'} follow-up`);
      
      toast.success(`Follow-up ${editItem ? 'updated' : 'created'} successfully`);
      
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{editItem ? 'Edit' : 'Add'} Business Follow-up</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {editItem ? 'Update the details for this follow-up.' : 'Schedule a follow-up for an existing customer or a new prospect.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-5">
          {/* Magic Input for Natural Language Parsing */}
          {!editItem && (
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground flex justify-between">
                <span>Magic Add ✨</span>
                <span className="text-[10px] text-muted-foreground font-normal">Try "Call Rahul tomorrow at 5pm"</span>
              </Label>
              <Input
                ref={inputRef}
                placeholder="Type naturally to parse date/time..."
                value={magicInput}
                onChange={(e) => handleMagicInput(e.target.value)}
                className="bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 placeholder:text-indigo-300 dark:placeholder:text-indigo-700 text-foreground"
              />
            </div>
          )}
          {/* Toggle Type */}
          <div className="flex bg-accent p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${isExisting ? 'bg-card transition-colors dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-muted-foreground hover:text-foreground dark:hover:text-slate-200'}`}
              onClick={() => setIsExisting(true)}
            >
              Existing Customer
            </button>
            <button
              type="button"
              className={`flex-1 text-xs font-bold py-2 rounded-md transition-colors ${!isExisting ? 'bg-card transition-colors dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-muted-foreground hover:text-foreground dark:hover:text-slate-200'}`}
              onClick={() => setIsExisting(false)}
            >
              New Prospect
            </button>
          </div>

          {/* Target Selection */}
          {isExisting ? (
            <div className="space-y-2 flex flex-col">
              <Label className="text-xs font-bold text-foreground">Search Customer <span className="text-red-500">*</span></Label>
              {isLoadingCustomers ? (
                <div className="h-10 border border-border rounded-md flex items-center justify-center bg-muted transition-colors dark:bg-slate-800/50">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Popover open={isCustomerDropdownOpen} onOpenChange={setIsCustomerDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCustomerDropdownOpen}
                      className="w-full justify-between font-normal text-left truncate bg-card border-border text-foreground hover:bg-accent/50"
                    >
                      {formData.customer_id
                        ? customers.find((customer) => customer.id === formData.customer_id)?.name
                        : "Type to search customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 border-border bg-card" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name or mobile..." />
                      <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.name}
                              onSelect={() => {
                                setFormData(prev => ({ ...prev, customer_id: customer.id }));
                                setIsCustomerDropdownOpen(false);
                              }}
                              className="flex items-center justify-between cursor-pointer text-foreground hover:bg-accent"
                            >
                              <span className="truncate">{customer.name}</span>
                              <Check
                                className={`mr-2 h-4 w-4 shrink-0 ${formData.customer_id === customer.id ? "opacity-100 text-indigo-600 dark:text-indigo-400" : "opacity-0"}`}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Prospect Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="E.g. Rajesh Kumar"
                  value={formData.prospect_name}
                  onChange={e => setFormData(prev => ({ ...prev, prospect_name: e.target.value }))}
                  required={!isExisting}
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Contact Number</Label>
                <Input
                  placeholder="+91..."
                  value={formData.prospect_mobile}
                  onChange={e => setFormData(prev => ({ ...prev, prospect_mobile: e.target.value }))}
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground"
                />
              </div>
            </div>
          )}

          {/* Details Row */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Category Tags</Label>
            <div className="flex flex-wrap gap-2 p-2 border border-border rounded-md bg-transparent min-h-[42px] items-center focus-within:ring-1 focus-within:ring-indigo-500">
              {categories.map(tag => (
                <span key={tag} className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-rose-500 dark:hover:text-rose-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground dark:placeholder:text-muted-foreground text-foreground min-w-[120px]"
                placeholder="Type and press Enter..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) addTag(tagInput);
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">Press enter or comma to add a tag. Backspace to remove.</p>
          </div>
            
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Scheduled Date <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  required
                  className="bg-card border-border text-foreground"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Priority</Label>
              <div className="flex bg-accent p-1 rounded-md h-[40px]">
                {['Low', 'Medium', 'High'].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`flex-1 text-[11px] font-bold py-1 rounded transition-colors ${priority === p ? 'bg-card transition-colors dark:bg-slate-700 shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground dark:hover:text-slate-200'}`}
                    onClick={() => setPriority(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Assign To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between bg-card border-border text-foreground font-normal min-h-[40px] h-auto p-2">
                  <div className="flex flex-wrap gap-1">
                    {formData.assignees.length > 0 ? (
                      formData.assignees.map(id => {
                        const m = members.find(mbr => mbr.user_id === id);
                        return (
                          <span key={id} className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded flex items-center">
                            {m?.user_profiles?.full_name || m?.email || 'Unknown User'} {id === currentUser?.id && '(Me)'}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-muted-foreground">Select team members...</span>
                    )}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[380px] p-0 bg-card border-border" align="start">
                <Command>
                  <CommandInput placeholder="Search team member..." />
                  <CommandEmpty>No team member found.</CommandEmpty>
                  <CommandGroup>
                    <CommandList>
                      {members.map(member => (
                        <CommandItem
                          key={member.user_id}
                          onSelect={() => {
                            setFormData(prev => {
                              const newAssignees = prev.assignees.includes(member.user_id)
                                ? prev.assignees.filter(id => id !== member.user_id)
                                : [...prev.assignees, member.user_id];
                              return { ...prev, assignees: newAssignees };
                            });
                          }}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <span>{member.user_profiles?.full_name || member.email || 'Unknown User'} {member.user_id === currentUser?.id && '(Me)'}</span>
                          <Check
                            className={`h-4 w-4 ${formData.assignees.includes(member.user_id) ? "opacity-100 text-indigo-600" : "opacity-0"}`}
                          />
                        </CommandItem>
                      ))}
                    </CommandList>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Notes & Context</Label>
            <textarea
              className="w-full flex min-h-[80px] rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground dark:placeholder:text-muted-foreground text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 resize-none"
              placeholder="E.g. Met at the networking event, interested in term plan for family..."
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          </div>
          <DialogFooter className="px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border text-foreground hover:bg-accent">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : editItem ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {editItem ? 'Save Changes' : 'Save Follow-up'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
