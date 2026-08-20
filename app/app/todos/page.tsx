'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar as CalendarIcon, CheckCircle2, Circle, ChevronLeft, ChevronRight, GripVertical, Trash2, Edit2, ListTodo, MoreHorizontal, UserPlus, Clock, Search, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from '@/components/ui/context-menu';
import { AddTodoModal } from '@/components/todos/add-todo-modal';
import { AddFollowupModal } from '@/components/followups/add-followup-modal';
import { VoiceRecorder } from '@/components/ui/voice-recorder';

export default function TodosPage() {
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
  
  // For cross-navigation conversion
  const [isConvertToFollowupOpen, setIsConvertToFollowupOpen] = useState(false);
  const [conversionData, setConversionData] = useState<any>(null);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      
      if (e.key.toLowerCase() === 'n' && !isAddModalOpen && !isConvertToFollowupOpen) {
        e.preventDefault();
        setEditItem(null);
        setIsAddModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen, isConvertToFollowupOpen]);

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
    queryKey: ['todos', selectedDate, debouncedSearch, filter],
    queryFn: async () => {
      let url = '';
      if (filter === 'Archived') {
        url = `/api/todos?status=archived`;
      } else {
        const localToday = new Date().toISOString().split('T')[0];
        url = debouncedSearch 
          ? `/api/todos?search=${encodeURIComponent(debouncedSearch)}` 
          : `/api/todos?date=${selectedDate}&localToday=${localToday}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['todos', selectedDate] });
      const previous = queryClient.getQueryData(['todos', selectedDate]);
      
      queryClient.setQueryData(['todos', selectedDate], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map((item: any) => item.id === id ? { ...item, status } : item)
        };
      });
      return { previous };
    },
    onError: (err, newTodo, context: any) => {
      queryClient.setQueryData(['todos', selectedDate], context?.previous);
      toast.error('Failed to update status');
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todos', selectedDate, debouncedSearch] });
      if (!error) {
        if (variables.status === 'archived') toast.success('Task archived');
        else if (variables.status === 'completed') toast.success('Task marked as completed');
        else toast.success('Task restored to pending');
      }
    }
  });

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  
  const handleSaveNotes = async (id: string) => {
    setEditingNotesId(null);
    const item = todos.find((f:any) => f.id === id);
    if (item && item.description !== tempNotes) {
      queryClient.setQueryData(['todos', selectedDate], (old: any) => {
        if (!old) return old;
        return { ...old, data: old.data.map((f:any) => f.id === id ? { ...f, description: tempNotes } : f) };
      });
      fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: tempNotes })
      }).then(res => {
        if (res.ok) toast.success('Description saved');
      }).catch(() => {
        toast.error('Failed to save description');
        queryClient.invalidateQueries({ queryKey: ['todos', selectedDate, debouncedSearch] });
      });
    }
  };

  const executeDelete = async (id: string) => {
    const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    if (!res.ok) toast.error('Failed to delete task');
    queryClient.invalidateQueries({ queryKey: ['todos', selectedDate, debouncedSearch] });
  };

  const handleQuickDelete = (item: any) => {
    setDeletedIds(prev => new Set(prev).add(item.id));
    const timerId = setTimeout(() => executeDelete(item.id), 5000);
    
    toast.success('Task deleted', {
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

  const reorderTodos = useMutation({
    mutationFn: async (items: any[]) => {
      const res = await fetch('/api/todos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map((t, i) => ({ id: t.id, order_index: i })) })
      });
      if (!res.ok) throw new Error('Reorder failed');
    }
  });

  const todos = (data?.data || []).filter((f: any) => !deletedIds.has(f.id));
  let filteredTodos = todos;
  const localTodayStr = new Date().toISOString().split('T')[0];

  if (filter === 'Pending') filteredTodos = todos.filter((f: any) => f.status === 'pending');
  if (filter === 'Completed') filteredTodos = todos.filter((f: any) => f.status === 'completed');
  if (filter === 'Archived') filteredTodos = todos.filter((f: any) => f.status === 'archived');
  if (filter === 'Overdue') filteredTodos = todos.filter((f: any) => f.status === 'pending' && f.scheduled_date < localTodayStr);
  if (filter === 'High Priority') filteredTodos = todos.filter((f: any) => f.status === 'pending' && f.priority === 'High');
  if (['Personal', 'Business', 'Development', 'Finance', 'Health', 'Meeting', 'Learning', 'Other'].includes(filter)) {
    filteredTodos = todos.filter((f: any) => f.category?.split(',').map((c:string)=>c.trim()).includes(filter));
  }

  // Ensure default view excludes archived unless specifically requested
  if (filter !== 'Archived') {
    filteredTodos = filteredTodos.filter((f: any) => f.status !== 'archived');
  }

  const pending = filteredTodos.filter((f: any) => f.status === 'pending');
  const completed = filteredTodos.filter((f: any) => f.status === 'completed');
  const archived = filteredTodos.filter((f: any) => f.status === 'archived');
  
  const pastPending = pending.filter((f: any) => f.scheduled_date && f.scheduled_date < localTodayStr);
  const todayPending = pending.filter((f: any) => !f.scheduled_date || f.scheduled_date >= localTodayStr);

  const pastPendingByDate = pastPending.reduce((acc: any, item: any) => {
    const date = item.scheduled_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});
  const sortedPastDates = Object.keys(pastPendingByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const overdueCount = todos.filter((f: any) => f.status === 'pending' && f.scheduled_date < localTodayStr).length;
  const highPriorityCount = todos.filter((f: any) => f.status === 'pending' && f.priority === 'High').length;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index && result.source.droppableId === result.destination.droppableId) return;

    // Only allow reordering within the same list for simplicity
    if (result.source.droppableId !== result.destination.droppableId) return;

    const isPast = result.source.droppableId.startsWith('past-pending-todos-');
    let list: any[];
    if (isPast) {
      const date = result.source.droppableId.replace('past-pending-todos-', '');
      list = Array.from(pastPendingByDate[date] || []);
    } else {
      list = Array.from(todayPending);
    }

    const [moved] = list.splice(result.source.index, 1);
    list.splice(result.destination.index, 0, moved);

    let newPending;
    if (isPast) {
      const date = result.source.droppableId.replace('past-pending-todos-', '');
      const otherPast = pastPending.filter((f: any) => f.scheduled_date !== date);
      newPending = [...otherPast, ...list, ...todayPending];
    } else {
      newPending = [...pastPending, ...list];
    }

    queryClient.setQueryData(['todos', selectedDate], (old: any) => {
      if (!old || !old.data) return old;
      const newData = [...newPending, ...completed];
      return { ...old, data: newData };
    });

    reorderTodos.mutate(newPending);
  };

  const TodoCard = ({ item, dragHandleProps }: { item: any, dragHandleProps?: any }) => {
    const isCompleted = item.status === 'completed';

    const getPriorityColor = (p: string) => {
      if (p === 'High') return 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50';
      if (p === 'Medium') return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50';
      return 'text-green-600 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800/50';
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            className={`group flex flex-col md:flex-row md:items-center justify-between p-3 sm:p-4 bg-card hover:bg-accent/40 border border-border shadow-sm rounded-xl transition-all duration-200 ${item.status !== 'pending' ? 'bg-muted/30 border-muted opacity-80' : 'hover:shadow-md'}`}
          >
            {/* Left side */}
            <div className="flex items-start md:items-center gap-3 md:gap-4 overflow-hidden w-full md:w-auto">
              <div className="flex items-center gap-2 mt-1 md:mt-0 shrink-0">
                <div {...dragHandleProps} className="text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent transition-colors hidden sm:block">
                  <GripVertical className="w-4 h-4" />
                </div>
                
                <button
                  onClick={(e) => { e.stopPropagation(); toggleStatus.mutate({ id: item.id, status: isCompleted ? 'pending' : 'completed' }); }}
                  aria-label={isCompleted ? 'Mark as pending' : 'Mark as completed'}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all shrink-0
                    ${isCompleted 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-inner shadow-emerald-700/50' 
                      : 'border-muted-foreground/30 text-transparent hover:border-emerald-500 hover:text-emerald-500 bg-card hover:bg-emerald-50 dark:hover:bg-emerald-950 shadow-sm'
                    }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>
              </div>
              
              <div className={`min-w-0 truncate ${isCompleted ? 'opacity-50' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-semibold text-foreground truncate tracking-tight">{item.title}</h3>
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Tags */}
            <div className={`flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 md:pb-0 hide-scrollbar w-full md:w-auto mt-2 md:mt-0 ${isCompleted ? 'opacity-50' : ''}`}>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shadow-sm border ${getPriorityColor(item.priority)}`}>
                {item.priority}
              </span>
              {item.category && item.category.split(',').map((cat: string) => (
                <span key={cat.trim()} className="text-[10px] font-bold bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border/50 shadow-sm whitespace-nowrap">
                  {cat.trim()}
                </span>
              ))}
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
                    className="text-[13px] text-muted-foreground truncate w-full md:w-[250px] cursor-text hover:text-foreground transition-colors group/note px-1"
                    onClick={() => {
                      setTempNotes(item.description || '');
                      setEditingNotesId(item.id);
                    }}
                    title={item.description || 'Add description...'}
                  >
                    {item.description ? (
                      <span>{item.description}</span>
                    ) : (
                      <span className="opacity-0 group-hover/note:opacity-100 flex items-center gap-1 italic text-[12px]">
                        <Edit2 className="w-3 h-3" /> Add description...
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex items-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 bg-card sm:bg-transparent">
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
                  onClick={(e) => { e.stopPropagation(); setConversionData(item); setIsConvertToFollowupOpen(true); }}
                  className="p-1.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors ml-0.5"
                  title="Convert to Follow-up"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => toggleStatus.mutate({ id: item.id, status: isCompleted ? 'pending' : 'completed' })}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> {isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
            <ContextMenuShortcut>C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { setEditItem(item); setIsAddModalOpen(true); }}>
            <Edit2 className="mr-2 h-4 w-4" /> Edit Todo
            <ContextMenuShortcut>E</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { setConversionData(item); setIsConvertToFollowupOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" /> Convert to Follow-up
          </ContextMenuItem>
          <ContextMenuItem onClick={() => toggleStatus.mutate({ id: item.id, status: item.status === 'archived' ? 'pending' : 'archived' })}>
            {item.status === 'archived' ? <ArchiveRestore className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />} 
            {item.status === 'archived' ? 'Unarchive' : 'Archive'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-red-600 dark:text-red-400" onClick={() => handleQuickDelete(item)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="bg-background w-full" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}>
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 p-4 sm:p-6 lg:p-8">
        
        {/* Header & Date Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Personal Todos</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your independent tasks and lists.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search throughout todos..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border shadow-sm h-10 w-full"
              />
            </div>
            
            {!debouncedSearch && (
              <div className="flex items-center bg-card border border-border rounded-lg p-1 shadow-sm">
                <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} className="h-8 w-8 hover:bg-accent rounded-md text-foreground">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center justify-center w-36 px-2">
                  <CalendarIcon className="w-4 h-4 text-muted-foreground mr-2" />
                  <span className="text-sm font-bold text-foreground">{getDayLabel(selectedDate)}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => changeDate(1)} className="h-8 w-8 hover:bg-accent rounded-md text-foreground">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <VoiceRecorder 
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ['todos'] })} 
              target="todo" 
            />
            <Button onClick={() => { setEditItem(null); setIsAddModalOpen(true); }} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 px-4">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Add Todo</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div className="sm:hidden relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search throughout todos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border shadow-sm h-10 w-full"
          />
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Today's Tasks</span>
              <ListTodo className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{todos.length}</span>
              <span className="text-xs text-muted-foreground font-medium">total</span>
            </div>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{todos.filter((f:any)=>f.status==='completed').length}</span>
              <span className="text-xs text-muted-foreground font-medium">tasks</span>
            </div>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Overdue</span>
              <Clock className="w-4 h-4 text-red-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{overdueCount}</span>
              <span className="text-xs text-muted-foreground font-medium">past due</span>
            </div>
          </div>
          <div className="bg-card border border-border p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow hidden md:block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">High Priority</span>
              <Circle className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{highPriorityCount}</span>
              <span className="text-xs text-muted-foreground font-medium">pending</span>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {['All', 'Pending', 'Completed', 'Archived', 'Overdue', 'High Priority', 'Personal', 'Business', 'Development'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all shadow-sm ${
                filter === f 
                  ? 'bg-blue-600 text-white shadow-blue-500/20' 
                  : 'bg-card text-muted-foreground hover:bg-accent border border-border'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Todo List */}
        <div className="space-y-4 sm:space-y-6 pb-10">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="pt-8">
              <EmptyState
                icon={ListTodo}
                title={debouncedSearch ? 'No matches found' : `No tasks ${filter !== 'All' ? `matching "${filter}"` : 'for this date'}`}
                description={debouncedSearch ? 'Try a different search term.' : "Hit the Add Todo button or press 'N' to create one."}
                action={
                  <Button onClick={() => { setEditItem(null); setIsAddModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    Add Todo (N)
                  </Button>
                }
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
                    <Droppable droppableId="today-pending-todos">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2.5 sm:space-y-3">
                          {todayPending.map((item: any, index: number) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={{ ...provided.draggableProps.style }}
                                  className={`${snapshot.isDragging ? 'z-50 shadow-2xl opacity-90 scale-[1.02]' : ''} transition-transform`}
                                >
                                  <TodoCard item={item} dragHandleProps={provided.dragHandleProps} />
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
                          <Droppable droppableId={`past-pending-todos-${date}`}>
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2.5 sm:space-y-3">
                                {items.map((item: any, index: number) => (
                                  <Draggable key={item.id} draggableId={item.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        style={{ ...provided.draggableProps.style }}
                                        className={`${snapshot.isDragging ? 'z-50 shadow-2xl opacity-90 scale-[1.02]' : ''} transition-transform`}
                                      >
                                        <TodoCard item={item} dragHandleProps={provided.dragHandleProps} />
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
                  <div className="space-y-2.5 sm:space-y-3">
                    {completed.map((item: any) => (
                      <TodoCard key={item.id} item={item} />
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
                  <div className="space-y-2.5 sm:space-y-3">
                    {archived.map((item: any) => (
                      <TodoCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <AddTodoModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={() => {}}
        initialDate={selectedDate}
        editItem={editItem}
      />

      <AddFollowupModal
        open={isConvertToFollowupOpen}
        onOpenChange={setIsConvertToFollowupOpen}
        onSuccess={() => {
          if (conversionData) {
            // Optionally auto-delete or mark completed
            toggleStatus.mutate({ id: conversionData.id, status: 'completed' });
          }
        }}
        initialData={conversionData}
        initialDate={selectedDate}
      />
    </div>
  );
}
