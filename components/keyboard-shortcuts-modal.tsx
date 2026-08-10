import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, Search, Plus, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  {
    name: 'Global Search',
    description: 'Open the quick search command palette from anywhere',
    keys: ['⌘', 'K'],
    icon: <Search className="w-4 h-4" />
  },
  {
    name: 'New Item',
    description: 'Quickly create a new task when on the Follow-ups or Todo pages',
    keys: ['N'],
    icon: <Plus className="w-4 h-4" />
  },
  {
    name: 'Close Dialogs',
    description: 'Close the current modal, sheet, or overlay',
    keys: ['Esc'],
    icon: <X className="w-4 h-4" />
  }
];

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Command className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Work faster with these keyboard shortcuts available across the application.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {SHORTCUTS.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-accent/30 hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                  {shortcut.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{shortcut.name}</h4>
                  <p className="text-xs text-muted-foreground">{shortcut.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {shortcut.keys.map(k => (
                  <kbd key={k} className="px-2 py-1 bg-background border border-border rounded-md text-xs font-mono font-bold shadow-sm text-foreground">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
