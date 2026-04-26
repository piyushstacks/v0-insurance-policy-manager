'use client';

import { useState } from 'react';
import { Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export type ActionRequestType =
  | 'DELETE_POLICY' | 'EDIT_POLICY'
  | 'DELETE_CUSTOMER' | 'EDIT_CUSTOMER'
  | 'DELETE_DOCUMENT';

interface RoleActionButtonProps {
  /** If true (ADMIN or SUB_ADMIN), executes directAction immediately.
   *  If false (MEMBER only), creates an action request for approval. */
  canDirectlyAct: boolean;
  /** The action type for approval workflow */
  requestType: ActionRequestType;
  entityId: string;
  entityType: string;
  /** Called immediately when admin/sub-admin performs action */
  directAction: () => Promise<void>;
  /** Label for the button */
  label?: string;
  icon?: React.ElementType;
  className?: string;
  variant?: 'destructive' | 'outline' | 'ghost' | 'default';
  size?: 'sm' | 'default' | 'icon';
  metadata?: Record<string, any>;
  /** Custom prompt for member reason input */
  reasonPrompt?: string;
}

/**
 * RoleActionButton
 *
 * - Admin: executes directAction() immediately (same as before)
 * - Member: sends an ActionRequest to /api/team/requests (approval needed)
 */
export function RoleActionButton({
  canDirectlyAct,
  requestType,
  entityId,
  entityType,
  directAction,
  label = 'Delete',
  icon: Icon,
  className,
  variant = 'outline',
  size = 'sm',
  metadata,
  reasonPrompt = 'Reason for this request (optional):',
}: RoleActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'submitted'>('idle');

  async function handleClick() {
    if (canDirectlyAct) {
      // Admin: direct execution
      setLoading(true);
      try {
        await directAction();
      } catch (e: any) {
        toast.error(e.message || 'Action failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Member: create approval request
    const reason = prompt(reasonPrompt) ?? '';
    setLoading(true);
    try {
      const res = await fetch('/api/team/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: requestType,
          entityId,
          entityType,
          reason,
          metadata,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRequestStatus('pending');
      toast.success('✅ Request submitted for admin approval', {
        description: 'You\'ll be notified when approved.',
      });
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  }

  // Show status badge for members after submission
  if (!canDirectlyAct && requestStatus === 'pending') {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
        <Clock className="w-3 h-3" />
        Pending Approval
      </span>
    );
  }

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
      title={canDirectlyAct ? label : `Request ${label} (Needs Approval)`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5" />
      ) : null}
      {size !== 'icon' && (
        <span className="ml-1">
          {canDirectlyAct ? label : `Request ${label}`}
        </span>
      )}
    </Button>
  );
}
