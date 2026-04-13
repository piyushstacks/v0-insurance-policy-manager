'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  coverage_start: string;
  coverage_end: string;
  premium_amount: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending_renewal';
  created_at: string;
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function fetchPolicies() {
      try {
        const response = await fetch('/api/policies');
        if (!response.ok) throw new Error('Failed to fetch policies');
        const data = await response.json();
        setPolicies(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load policies');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPolicies();
  }, []);

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Policies</h1>
          <p className="text-muted-foreground">Manage your insurance policies</p>
        </div>
        <Link href="/app/policies/new">
          <Button>
            <Plus className="w-5 h-5 mr-2" />
            Add Policy
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-md bg-red-50 border border-red-200 text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading policies...</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 rounded-lg border border-dashed bg-muted/50">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No policies yet</h3>
          <p className="text-muted-foreground mb-4">Create your first policy to get started</p>
          <Link href="/app/policies/new">
            <Button variant="outline">Create Policy</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <Link key={policy.id} href={`/app/policies/${policy.id}`}>
              <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{policy.policy_number}</h3>
                    <p className="text-sm text-muted-foreground">{policy.policy_type}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      policy.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : policy.status === 'expired'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {policy.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(policy.coverage_start).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(policy.coverage_end).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span>${policy.premium_amount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-3">
                  Added {formatDistanceToNow(new Date(policy.created_at), { addSuffix: true })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
