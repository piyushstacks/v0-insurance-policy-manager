'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Calendar as CalendarIcon, CheckCircle2, Circle, ChevronLeft, ChevronRight, User, Phone, Tag, GripVertical, Trash2, Edit2, CalendarDays, X, UserPlus, Download, ListTodo, Search, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { AddFollowupModal } from '@/components/followups/add-followup-modal';
import { AddTodoModal } from '@/components/todos/add-todo-modal';
import { VoiceRecorder } from '@/components/ui/voice-recorder';
import { toast } from 'sonner';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import { useTeam } from '@/hooks/use-team';

export default function FollowupsPage() {
  const { members, user, canDirectlyAct } = useTeam();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [filter, setFilter] = useState('All');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  const [isConvertToTodoOpen, setIsConvertToTodoOpen] = useState(false);
  const [conversionData, setConversionData] = useState<any>(null);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key.toLowerCase() === 'n' && !isAddModalOpen) {
        e.preventDefault();
        setEditItem(null);
        setIsAddModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen]);

  // Navigation handlers
  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const { data, isLoading } = useQuery({
    queryKey: ['followups', selectedDate, debouncedSearch, filter],
    queryFn: async () => {
      let url = '';
      if (filter === 'Archived') {
        url = `/api/followups?status=archived`;
      } else {
        const localToday = new Date().toISOString().split('T')[0];
        url = debouncedSearch 
          ? `/api/followups?search=${encodeURIComponent(debouncedSearch)}` 
          : `/api/followups?date=${selectedDate}&localToday=${localToday}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/followups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['followups', selectedDate] });
      const previous = queryClient.getQueryData(['followups', selectedDate]);
      
      queryClient.setQueryData(['followups', selectedDate], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map((item: any) => 
            item.id === id ? { ...item, status } : item
          )
        };
      });
      
      return { previous };
    },
    onError: (err, newTodo, context: any) => {
      queryClient.setQueryData(['followups', selectedDate], context?.previous);
      toast.error('Failed to update status');
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['followups', selectedDate, debouncedSearch] });
      if (!error) {
        if (variables.status === 'archived') toast.success('Follow-up archived');
        else if (variables.status === 'completed') toast.success('Follow-up marked as completed');
        else toast.success('Follow-up restored to pending');
      }
    }
  });

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);

  const handleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    
    if (e.shiftKey && lastSelectedId) {
      // Find range
      const allIds = followups.map((f: any) => f.id);
      const start = allIds.indexOf(lastSelectedId);
      const end = allIds.indexOf(id);
      const [min, max] = [Math.min(start, end), Math.max(start, end)];
      
      if (newSelected.has(lastSelectedId)) {
        for (let i = min; i <= max; i++) newSelected.add(allIds[i]);
      } else {
        for (let i = min; i <= max; i++) newSelected.delete(allIds[i]);
      }
    } else {
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
    }
    
    setSelectedItems(newSelected);
    setLastSelectedId(id);
  };

  const handleSaveNotes = async (id: string) => {
    setEditingNotesId(null);
    const item = followups.find((f:any) => f.id === id);
    if (item && item.notes !== tempNotes) {
      queryClient.setQueryData(['followups', selectedDate], (old: any) => {
        if (!old) return old;
        return { ...old, data: old.data.map((f:any) => f.id === id ? { ...f, notes: tempNotes } : f) };
      });
      fetch(`/api/followups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: tempNotes })
      }).then(res => {
        if (res.ok) toast.success('Notes saved');
      }).catch(() => {
        toast.error('Failed to save notes');
        queryClient.invalidateQueries({ queryKey: ['followups', selectedDate, debouncedSearch] });
      });
    }
  };

  const executeDelete = async (id: string) => {
    const res = await fetch(`/api/followups/${id}`, { method: 'DELETE' });
    if (!res.ok) toast.error('Failed to delete follow-up');
    queryClient.invalidateQueries({ queryKey: ['followups', selectedDate, debouncedSearch] });
  };

  const handleQuickDelete = (item: any) => {
    setDeletedIds(prev => new Set(prev).add(item.id));
    const timerId = setTimeout(() => executeDelete(item.id), 5000);
    
    toast.success('Follow-up deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timerId);
          setDeletedIds(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      },
      duration: 5000
    });
  };

  const deleteFollowup = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/followups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups', selectedDate, debouncedSearch] });
      toast.success('Follow-up deleted');
    }
  });

  const reorderFollowups = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await fetch('/api/followups/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((t, i) => ({ id: t.id, order_index: i })) })
      });
      if (!res.ok) throw new Error('Reorder failed');
    }
  });

  const followups = (data?.data || []).filter((f: any) => !deletedIds.has(f.id));
  let filteredFollowups = followups;
  const localTodayStr = new Date().toISOString().split('T')[0];

  if (filter === 'Pending') filteredFollowups = followups.filter((f: any) => f.status === 'pending');
  if (filter === 'Completed') filteredFollowups = followups.filter((f: any) => f.status === 'completed');
  if (filter === 'Archived') filteredFollowups = followups.filter((f: any) => f.status === 'archived');
  if (filter === 'Overdue') filteredFollowups = followups.filter((f: any) => f.status === 'pending' && f.scheduled_date < localTodayStr);
  if (filter === 'High Priority') filteredFollowups = followups.filter((f: any) => f.status === 'pending' && f.category?.toLowerCase().includes('high'));
  if (['Renewal', 'Cross-sell', 'Claim', 'General', 'Meeting'].includes(filter)) {
    filteredFollowups = followups.filter((f: any) => f.category === filter);
  }

  // Ensure default view excludes archived unless specifically requested
  if (filter !== 'Archived') {
    filteredFollowups = filteredFollowups.filter((f: any) => f.status !== 'archived');
  }

  const pending = filteredFollowups.filter((f: any) => f.status === 'pending');
  const completed = filteredFollowups.filter((f: any) => f.status === 'completed');
  const archived = filteredFollowups.filter((f: any) => f.status === 'archived');
  
  const pastPending = pending.filter((f: any) => f.scheduled_date && f.scheduled_date < localTodayStr);
  const todayPending = pending.filter((f: any) => !f.scheduled_date || f.scheduled_date >= localTodayStr);

  const pastPendingByDate = pastPending.reduce((acc: any, item: any) => {
    const date = item.scheduled_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
  const sortedPastDates = Object.keys(pastPendingByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const overdueCount = followups.filter((f: any) => f.status === 'pending' && f.scheduled_date < localTodayStr).length;
  const highPriorityCount = followups.filter((f: any) => f.status === 'pending' && f.category?.toLowerCase().includes('high')).length;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index && result.source.droppableId === result.destination.droppableId) return;

    // Only allow reordering within the same list for simplicity
    if (result.source.droppableId !== result.destination.droppableId) return;

    const isPast = result.source.droppableId.startsWith('past-pending-list-');
    let list: any[];
    if (isPast) {
      const date = result.source.droppableId.replace('past-pending-list-', '');
      list = Array.from(pastPendingByDate[date] || []);
    } else {
      list = Array.from(todayPending);
    }
    
    const [moved] = list.splice(result.source.index, 1);
    list.splice(result.destination.index, 0, moved);

    let newPending;
    if (isPast) {
      const date = result.source.droppableId.replace('past-pending-list-', '');
      const otherPast = pastPending.filter((f: any) => f.scheduled_date !== date);
      newPending = [...otherPast, ...list, ...todayPending];
    } else {
      newPending = [...pastPending, ...list];
    }

    queryClient.setQueryData(['followups', selectedDate], (old: any) => {
      if (!old || !old.data) return old;
      const newData = [...newPending, ...completed];
      return { ...old, data: newData };
    });

    reorderFollowups.mutate(newPending);
  };

    const FollowupCard = ({ item, dragHandleProps }: { item: any, dragHandleProps?: any }) => {
    const isCompleted = item.status === 'completed';
    const isProspect = !item.customer_id;
    const displayName = isProspect ? item.prospect_name : item.customer?.name;
    const displayMobile = isProspect ? item.prospect_mobile : item.customer?.mobile;

    const isSelected = selectedItems.has(item.id);
    const isSelectionMode = isSelectionModeActive || selectedItems.size > 0;

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            className={`group flex flex-col md:flex-row md:items-center justify-between p-3 sm:p-4 bg-card hover:bg-accent/40 border shadow-sm rounded-xl transition-all duration-200 cursor-pointer 
              ${isSelected ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 border-indigo-500 dark:border-indigo-400 bg-indigo-50/10 dark:bg-indigo-900/20' : item.status !== 'pending' ? 'bg-muted/30 border-muted opacity-80' : 'border-border hover:shadow-md'}`}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, a, input, textarea, .prevent-select')) return;
              
              if (isSelectionMode || e.shiftKey || e.metaKey || e.ctrlKey) {
                handleSelect(e, item.id);
              } else {
                setEditItem(item);
                setIsAddModalOpen(true);
              }
            }}
          >
            {/* Left side */}
            <div className="flex items-start md:items-center gap-3 md:gap-4 overflow-hidden w-full md:w-auto">
              {/* Completion button — always visible on all screen sizes */}
              <div className={`flex items-center gap-2 mt-1 md:mt-0 shrink-0`}>
                <div {...dragHandleProps} className={`text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent transition-colors hidden sm:block ${(!isCompleted && !isSelectionMode) ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                  <GripVertical className="w-4 h-4" />
                </div>
                
                {isSelectionMode ? (
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={(e) => handleSelect(e as any, item.id)}
                    className="w-5 h-5 rounded border-border/80 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStatus.mutate({ id: item.id, status: isCompleted ? 'pending' : 'completed' }); }}
                    aria-label={isCompleted ? 'Mark as pending' : 'Mark as completed'}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all shrink-0 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white shadow-inner shadow-emerald-700/50' : 'border-muted-foreground/30 text-transparent hover:border-emerald-500 hover:text-emerald-500 bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950 shadow-sm'}`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                )}
              </div>

              
              <div className={`min-w-0 truncate ${isCompleted ? 'opacity-50' : ''}`}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    {isProspect ? (
                        <h3 className="text-[15px] font-semibold text-foreground truncate tracking-tight">{displayName}</h3>
                    ) : (
                        <Link href={`/app/customers/${item.customer_id}`} onClick={e => e.stopPropagation()} className="text-[15px] font-semibold text-foreground truncate tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline">
                          {displayName}
                        </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.assignees && item.assignees.length > 0 && !item.assignees.every((id: string) => id === user?.id) && (
                      <div className="flex items-center gap-1">
                        {item.assignees.filter((id: string) => id !== user?.id).map((assigneeId: string) => {
                          const assigneeMember = members.find(m => m.user_id === assigneeId);
                          const name = assigneeMember?.user_profiles?.full_name || assigneeMember?.email?.split('@')[0] || 'Member';
                          return (
                            <span key={assigneeId} className="flex items-center gap-1 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1 py-0 rounded border border-indigo-200/60 dark:border-indigo-800/50" title={`Assigned to ${name}`}>
                              <User className="w-3 h-3" /> 
                              {name.length > 10 ? name.substring(0, 10) + '...' : name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {displayMobile && (
                      <span className={`text-[10px] text-muted-foreground font-medium flex items-center gap-1 opacity-80 ${item.assignees?.some((id: string) => id !== user?.id) ? 'border-l pl-2 border-border' : ''}`}>
                        <Phone className="w-3 h-3" /> {displayMobile}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Tags */}
            <div className={`flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full md:w-auto mt-2 md:mt-0 ${isCompleted ? 'opacity-50' : ''}`}>
               {isProspect ? (
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-800/50 px-1.5 py-0.5 rounded shadow-sm">Prospect</span>
                ) : (
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-800/50 px-1.5 py-0.5 rounded shadow-sm">Customer</span>
                )}
                {(() => {
                  const rawCategories = item.category?.split(',').map((cat: string) => cat.trim()).filter(Boolean) || [];
                  const isHigh = rawCategories.some((c: string) => c.toLowerCase().includes('high'));
                  const isLow = rawCategories.some((c: string) => c.toLowerCase().includes('low'));
                  const priorityString = isHigh ? 'High' : isLow ? 'Low' : 'Medium';
                  const normalCategories = rawCategories.filter((c: string) => !c.toLowerCase().includes('priority') && !['high', 'medium', 'low'].includes(c.toLowerCase()));
                  
                  return (
                    <>
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shadow-sm border ${
                        isHigh ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-red-200/60 dark:border-red-800/50' :
                        isLow ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200/60 dark:border-green-800/50' :
                        'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 border-orange-200/60 dark:border-orange-800/50'
                      }`}>
                        {priorityString} Priority
                      </span>
                      {normalCategories.map((category: string) => (
                        <span key={category} className="text-[10px] uppercase font-bold tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border/50 shadow-sm whitespace-nowrap">
                          {category}
                        </span>
                      ))}
                    </>
                  );
                })()}
            </div>
            
            {/* Right side */}
            <div className={`flex items-center justify-between w-full md:w-auto mt-3 md:mt-0 ${isCompleted ? 'opacity-50' : ''}`}>
              <div className="flex items-center">
                {editingNotesId === item.id ? (
                  <div className="flex items-center gap-1 w-full md:w-[250px]">
                    <input
                      autoFocus
                      className="flex-1 text-[13px] bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                      value={tempNotes}
                      onChange={e => setTempNotes(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveNotes(item.id);
                        if (e.key === 'Escape') setEditingNotesId(null);
                      }}
                      onBlur={() => handleSaveNotes(item.id)}
                    />
                  </div>
                ) : (
                  <div 
                    className="text-[13px] text-muted-foreground truncate w-full md:w-[250px] cursor-text hover:text-foreground transition-colors group/note px-1 prevent-select"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTempNotes(item.notes || '');
                      setEditingNotesId(item.id);
                    }}
                    title={item.notes || 'Add notes...'}
                  >
                    {item.notes ? (
                      <span>{item.notes}</span>
                    ) : (
                      <span className="opacity-0 group-hover/note:opacity-100 flex items-center gap-1 italic text-[12px]">
                        <Edit2 className="w-3 h-3" /> Add notes...
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 bg-card sm:bg-transparent">
                 <div className={`flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mr-3 ${isCompleted ? 'opacity-50' : ''}`}>
                   <CalendarDays className="w-3 h-3" />
                   {new Date(item.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                 </div>

                 {displayMobile && (
                   <>
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-7 w-7 text-muted-foreground hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                       onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${displayMobile.replace(/\D/g, '')}`, '_blank'); }}
                       title="WhatsApp"
                     >
                       <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                     </Button>
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-7 w-7 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                       onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${displayMobile.replace(/\D/g, '')}`; }}
                       title="Call"
                     >
                       <Phone className="w-3.5 h-3.5" />
                     </Button>
                   </>
                 )}
                <button
                  onClick={(e) => { e.stopPropagation(); setEditItem(item); setIsAddModalOpen(true); }}
                  className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStatus.mutate({ id: item.id, status: item.status === 'archived' ? 'pending' : 'archived' }); }}
                  className={`p-1.5 rounded transition-colors ml-0.5 ${item.status === 'archived' ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30' : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30'}`}
                  title={item.status === 'archived' ? "Unarchive" : "Archive"}
                >
                  {item.status === 'archived' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleQuickDelete(item); }}
                  className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors ml-0.5"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConversionData(item); setIsConvertToTodoOpen(true); }}
                  className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors ml-0.5"
                  title="Create Todo"
                >
                  <ListTodo className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => toggleStatus.mutate({ id: item.id, status: isCompleted ? 'pending' : 'completed' })}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> {isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
            <ContextMenuShortcut>C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { setEditItem(item); setIsAddModalOpen(true); }}>
            <Edit2 className="mr-2 h-4 w-4" /> Edit Follow-up
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toggleStatus.mutate({ id: item.id, status: item.status === 'archived' ? 'pending' : 'archived' })}>
            {item.status === 'archived' ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />} 
            {item.status === 'archived' ? 'Unarchive' : 'Archive'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => { setConversionData(item); setIsConvertToTodoOpen(true); }}>
            <ListTodo className="mr-2 h-4 w-4" /> Create Todo
          </ContextMenuItem>
          {displayMobile && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => window.location.href = `tel:${displayMobile.replace(/\D/g, '')}`}>
                <Phone className="mr-2 w-4 h-4" /> Call
              </ContextMenuItem>
              <ContextMenuItem onClick={() => window.open(`https://wa.me/${displayMobile.replace(/\D/g, '')}`, '_blank')}>
                WhatsApp
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem className="text-red-600 dark:text-red-400" onClick={() => handleQuickDelete(item)}>
            <Trash2 className="mr-2 w-4 h-4" /> Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background relative font-sans transition-colors duration-200" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 md:px-8 xl:px-12 py-4 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center hidden md:flex border border-indigo-100 dark:border-indigo-800/50 shadow-sm">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold text-foreground tracking-tight leading-tight">Business Follow-ups</h1>
            <p className="text-[11px] text-muted-foreground font-medium tracking-wide hidden md:block">Manage your daily priorities</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              if (isSelectionModeActive || selectedItems.size > 0) {
                setIsSelectionModeActive(false);
                setSelectedItems(new Set());
              } else {
                setIsSelectionModeActive(true);
              }
            }} 
            size="sm" 
            className={`shadow-sm flex rounded-md h-8 px-3 sm:px-4 text-[11px] sm:text-xs font-semibold tracking-wide ${isSelectionModeActive || selectedItems.size > 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50' : 'text-foreground/90 border-border dark:bg-slate-800 dark:hover:bg-slate-700'}`}
          >
            {isSelectionModeActive || selectedItems.size > 0 ? 'Cancel' : 'Select'}
          </Button>

          {(isSelectionModeActive || selectedItems.size > 0) && (
            <Button
              variant="outline"
              onClick={() => {
                if (selectedItems.size === followups.length) {
                  setSelectedItems(new Set());
                } else {
                  setSelectedItems(new Set(followups.map((f: any) => f.id)));
                }
              }}
              size="sm"
              className="shadow-sm flex rounded-md h-8 px-3 sm:px-4 text-[11px] sm:text-xs font-semibold tracking-wide text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100"
            >
              {selectedItems.size === followups.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}

          <VoiceRecorder 
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['followups'] })} 
            target="followup" 
          />
          <Button onClick={() => { setEditItem(null); setIsAddModalOpen(true); }} size="sm" className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white shadow-sm hidden md:flex rounded-md h-8 px-4 text-xs font-semibold tracking-wide border-0">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Follow-up
          </Button>
          <Button onClick={() => { setEditItem(null); setIsAddModalOpen(true); }} size="icon" className="bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white shadow-sm md:hidden rounded-full border-0 h-8 w-8">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto w-full px-4 md:px-8 xl:px-12 py-6 space-y-6">
        
        {/* KPI Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           <div className="bg-card p-3 rounded-lg border border-border shadow-sm flex flex-col cursor-pointer hover:border-border/80 transition-colors" onClick={() => setFilter('Pending')}>
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pending</span>
             <span className="text-2xl font-bold text-foreground">{followups.filter((f: any) => f.status === 'pending').length}</span>
           </div>
           <div className="bg-card p-3 rounded-lg border border-border shadow-sm flex flex-col cursor-pointer hover:border-border/80 transition-colors" onClick={() => setFilter('Completed')}>
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Completed</span>
             <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{followups.filter((f: any) => f.status === 'completed').length}</span>
           </div>
           <div className="bg-card p-3 rounded-lg border border-border shadow-sm flex flex-col cursor-pointer hover:border-border/80 transition-colors" onClick={() => setFilter('Overdue')}>
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Overdue</span>
             <span className="text-2xl font-bold text-red-600 dark:text-red-400">{overdueCount}</span>
           </div>
           <div className="bg-card p-3 rounded-lg border border-border shadow-sm flex flex-col cursor-pointer hover:border-border/80 transition-colors" onClick={() => setFilter('High Priority')}>
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">High Priority</span>
             <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{highPriorityCount}</span>
           </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {['All', 'Pending', 'Completed', 'Archived', 'Overdue', 'High Priority', 'Renewal', 'Cross-sell', 'Claim', 'General', 'Meeting'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-foreground/80 border border-border hover:bg-accent/50'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search & Date Navigator */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search throughout follow-ups..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border shadow-sm h-10 w-full"
            />
          </div>

          {!debouncedSearch && (
            <div className="bg-card rounded-lg border border-border shadow-sm p-1.5 flex items-center justify-between w-full sm:max-w-[240px]">
              <Button variant="ghost" onClick={() => changeDate(-1)} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 px-3 text-xs font-semibold">
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              
              <div 
                className="flex items-center gap-1.5 relative px-2 cursor-pointer group"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector('input');
                  if (input && 'showPicker' in HTMLInputElement.prototype) {
                    input.showPicker();
                  }
                }}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground/90 transition-colors" />
                <span className="font-semibold text-[13px] text-foreground tracking-wide group-hover:text-foreground transition-colors">{getDayLabel(selectedDate)}</span>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              
              <Button variant="ghost" onClick={() => changeDate(1)} className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md h-8 px-3 text-xs font-semibold">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={3} />
          </div>
        ) : followups.length === 0 ? (
          <div className="pt-12 pb-24">
             <EmptyState 
               icon={Clock} 
               title={debouncedSearch ? 'No matches found' : 'Inbox Zero'} 
               description={debouncedSearch ? 'Try a different search term.' : `No follow-ups scheduled for ${getDayLabel(selectedDate).toLowerCase()}.`} 
             />
          </div>
        ) : (
          <div className="space-y-10">
            
            {/* Today's Pending Section */}
            {todayPending.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Today's Pending ({todayPending.length})
                </h2>
                
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="today-pending-list">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2.5">
                        {todayPending.map((item: any, index: number) => (
                          <Draggable 
                            key={item.id} 
                            draggableId={item.id} 
                            index={index}
                            isDragDisabled={isSelectionModeActive || selectedItems.size > 0}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                              >
                                {FollowupCard({ item, dragHandleProps: provided.dragHandleProps })}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}

            {/* Past Pending Section */}
            {sortedPastDates.length > 0 && (
              <div className="space-y-6">
                {sortedPastDates.map((date: string) => {
                  const items = pastPendingByDate[date];
                  return (
                    <div key={date} className="space-y-3">
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ({items.length})
                      </h2>
                      
                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId={`past-pending-list-${date}`}>
                          {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2.5">
                              {items.map((item: any, index: number) => (
                                <Draggable 
                                  key={item.id} 
                                  draggableId={item.id} 
                                  index={index}
                                  isDragDisabled={isSelectionModeActive || selectedItems.size > 0}
                                >
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      style={{
                                        ...provided.draggableProps.style,
                                        opacity: snapshot.isDragging ? 0.8 : 1,
                                      }}
                                    >
                                      <FollowupCard item={item} dragHandleProps={provided.dragHandleProps} />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed Section */}
            {completed.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-50" /> Completed ({completed.length})
                </h2>
                <div className="space-y-2.5">
                  {completed.map((item: any) => (
                    <FollowupCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Archived Section */}
            {archived.length > 0 && filter === 'Archived' && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 opacity-50" /> Archived ({archived.length})
                </h2>
                <div className="space-y-2.5">
                  {archived.map((item: any) => (
                    <FollowupCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>

      <AddFollowupModal 
        open={isAddModalOpen} 
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) setEditItem(null);
        }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['followups', selectedDate] })}
        initialDate={selectedDate}
        editItem={editItem}
      />

      {/* Bulk Action Toolbar */}
      {selectedItems.size > 0 && (() => {
        const allSelectedAreCompleted = Array.from(selectedItems).every(id => {
          const item = followups.find((f:any) => f.id === id);
          return item?.status === 'completed';
        });
        const targetStatus = allSelectedAreCompleted ? 'pending' : 'completed';

        return (
          <div className="fixed left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 w-max max-w-[calc(100vw-32px)]" style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
            <div className="bg-primary text-primary-foreground px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-4 border border-primary/20">
              <span className="text-xs sm:text-sm font-medium bg-primary-foreground/20 px-2 py-1 rounded-md shrink-0">{selectedItems.size} <span className="hidden sm:inline">selected</span></span>
              <div className="w-px h-6 bg-primary-foreground/20 shrink-0" />
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground px-2 sm:px-3"
                  onClick={async () => {
                    await Promise.all(Array.from(selectedItems).map(id => fetch(`/api/followups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: targetStatus }) })));
                    queryClient.invalidateQueries({ queryKey: ['followups', selectedDate, debouncedSearch] });
                    setSelectedItems(new Set());
                    setIsSelectionModeActive(false);
                    toast.success(`Marked ${selectedItems.size} items as ${targetStatus}`);
                  }}
                >
                  {allSelectedAreCompleted ? (
                    <Circle className="w-4 h-4 lg:mr-2 text-amber-400" /> 
                  ) : (
                    <CheckCircle2 className="w-4 h-4 lg:mr-2 text-emerald-400" />
                  )}
                  <span className="hidden lg:inline">{allSelectedAreCompleted ? 'Mark Pending' : 'Complete'}</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-red-400 px-2 sm:px-3"
                  onClick={() => {
                    Array.from(selectedItems).forEach(id => {
                      const item = followups.find((f:any) => f.id === id);
                      if (item) handleQuickDelete(item);
                    });
                    setSelectedItems(new Set());
                    setIsSelectionModeActive(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 lg:mr-2" /> <span className="hidden lg:inline">Delete</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground px-2 sm:px-3" onClick={() => toast.info('Reschedule selected items (Coming soon)')}>
                  <CalendarDays className="w-4 h-4 lg:mr-2" /> <span className="hidden lg:inline">Reschedule</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground px-2 sm:px-3" onClick={() => toast.info('Assign to teammate (Coming soon)')}>
                  <UserPlus className="w-4 h-4 lg:mr-2" /> <span className="hidden lg:inline">Assign</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground px-2 sm:px-3" onClick={() => toast.info('Export selected items (Coming soon)')}>
                  <Download className="w-4 h-4 lg:mr-2" /> <span className="hidden lg:inline">Export</span>
                </Button>
              </div>
              <div className="w-px h-6 bg-primary-foreground/20 shrink-0" />
              <Button variant="ghost" size="sm" onClick={() => { setSelectedItems(new Set()); setIsSelectionModeActive(false); }} className="text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        );
      })()}
      
      <AddTodoModal
        open={isConvertToTodoOpen}
        onOpenChange={setIsConvertToTodoOpen}
        onSuccess={() => {
          if (conversionData) {
            // Optional: delete or complete follow-up
            toggleStatus.mutate({ id: conversionData.id, status: 'completed' });
          }
        }}
        initialData={{
          title: conversionData?.prospect_name || conversionData?.customer?.name ? `Follow-up: ${conversionData?.prospect_name || conversionData?.customer?.name}` : '',
          description: conversionData?.notes || '',
          scheduled_date: conversionData?.scheduled_date,
        }}
        initialDate={selectedDate}
      />
    </div>
  );
}
