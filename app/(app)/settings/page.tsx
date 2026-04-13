'use client';

import { Cog } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="mt-8">
        <div className="space-y-6">
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="font-semibold mb-2">OCR Provider Configuration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Currently using: <span className="font-medium">Mock Provider</span>
            </p>
            <p className="text-xs text-muted-foreground">
              To use a production OCR provider like Google Document AI, configure environment variables
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <h3 className="font-semibold mb-2">API Integration</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Background worker endpoint: <code className="bg-muted px-2 py-1 rounded text-xs">/api/extract/process</code>
            </p>
            <p className="text-xs text-muted-foreground">
              Schedule this endpoint to run periodically to process pending extraction jobs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
