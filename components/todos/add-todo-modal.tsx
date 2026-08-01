'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import * as chrono from 'chrono-node';
import { useQueryClient } from '@tanstack/react-query';

interface AddTodoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: string;
  editItem?: any;
  initialData?: any; // Used when converting from Follow-up
}

const CATEGORIES = ['Personal', 'Business', 'Development', 'Finance', 'Health', 'Meeting', 'Learning', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High'];

export function AddTodoModal({ open, onOpenChange, onSuccess, initialDate, editItem, initialData }: AddTodoModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_date: initialDate || new Date().toISOString().split('T')[0],
  });
  
  const [categories, setCategories] = useState<string[]>(['Personal']);
  const [priority, setPriority] = useState('Medium');
  const [magicInput, setMagicInput] = useState('');

  const handleMagicInput = (val: string) => {
    setMagicInput(val);
    const parsed = chrono.parse(val);
    if (parsed && parsed.length > 0) {
      const parsedDate = parsed[0].start.date();
      
      const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, scheduled_date: localDate }));
      
      if (parsed[0].start.isCertain('hour')) {
         const timeStr = parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
         const text = val.replace(parsed[0].text, '').trim();
         setFormData(prev => ({ ...prev, description: text ? text + ' @ ' + timeStr : '@ ' + timeStr }));
      } else {
         const text = val.replace(parsed[0].text, '').trim();
         setFormData(prev => ({ ...prev, description: text }));
      }
    } else {
       setFormData(prev => ({ ...prev, description: val }));
    }
  };

  useEffect(() => {
    if (open) {
       setTimeout(() => inputRef.current?.focus(), 100);
       if (editItem) {
          setFormData({
            title: editItem.title || '',
            description: editItem.description || '',
            scheduled_date: editItem.scheduled_date || new Date().toISOString().split('T')[0],
          });
          setCategories(editItem.category ? editItem.category.split(',').map((s: string) => s.trim()) : ['Personal']);
          setPriority(editItem.priority || 'Medium');
          setMagicInput(editItem.description || '');
       } else if (initialData) {
          setFormData({
            title: initialData.title || '',
            description: initialData.description || '',
            scheduled_date: initialData.scheduled_date || initialDate || new Date().toISOString().split('T')[0],
          });
          setCategories(initialData.category ? initialData.category.split(',').map((s: string) => s.trim()) : ['Personal']);
          setPriority(initialData.priority || 'Medium');
          setMagicInput(initialData.description || '');
       } else {
          setFormData({
            title: '',
            description: '',
            scheduled_date: initialDate || new Date().toISOString().split('T')[0]
          });
          setCategories(['Personal']);
          setPriority('Medium');
          setMagicInput('');
       }
    }
  }, [open, editItem, initialDate, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error('Please enter a task title');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        category: categories.join(', '),
        priority
      };

      const url = editItem ? `/api/todos/${editItem.id}` : '/api/todos';
      const method = editItem ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save todo');
      }

      toast.success(editItem ? 'Todo updated' : 'Todo created');
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl">
        <div className="px-6 py-5 bg-card border-b border-border flex flex-col gap-1 sticky top-0 z-[1] rounded-t-2xl">
          <DialogTitle className="text-xl font-bold text-foreground">
            {editItem ? 'Edit Todo' : 'New Todo'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editItem ? 'Update your personal task.' : 'Add a new personal task.'}
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Task Title <span className="text-red-500">*</span></Label>
              <Input
                ref={inputRef}
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What needs to be done?"
                className="bg-card border-border text-foreground font-semibold placeholder:font-normal"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs font-bold text-foreground">Description (Magic Add)</Label>
                <span className="text-[10px] text-muted-foreground font-medium bg-accent px-1.5 rounded">e.g., call mom tomorrow 3pm</span>
              </div>
              <Input
                value={magicInput}
                onChange={e => handleMagicInput(e.target.value)}
                placeholder="Type here to extract dates..."
                className="bg-card border-border text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Due Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={e => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  required
                  className="bg-card border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground">Priority</Label>
                <div className="flex bg-accent p-1 rounded-md h-[40px]">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`flex-1 text-[11px] font-bold py-1 rounded transition-colors ${priority === p ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setPriority(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (categories.includes(cat)) {
                        if (categories.length > 1) {
                          setCategories(categories.filter(c => c !== cat));
                        }
                      } else {
                        setCategories([...categories, cat]);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
                      categories.includes(cat)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                        : 'bg-card text-muted-foreground border-border hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border gap-2 sm:justify-end sticky bottom-0 bg-background shadow-[0_-4px_16px_rgba(0,0,0,0.06)] rounded-b-2xl">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="font-bold">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : (editItem ? 'Save Changes' : 'Create Task')}
              {!isSubmitting && <Save className="ml-2 w-4 h-4" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
