'use client';

import { Button } from '@/components/ui/button';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';

export default function CustomersPage() {
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Customers</h1>
          <p className="text-muted-foreground">Manage customer information</p>
        </div>
        <Button>
          <Plus className="w-5 h-5 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="text-center py-12 rounded-lg border border-dashed bg-muted/50">
        <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
        <p className="text-muted-foreground mb-4">Create your first customer to get started</p>
        <Button variant="outline">Create Customer</Button>
      </div>
    </div>
  );
}
