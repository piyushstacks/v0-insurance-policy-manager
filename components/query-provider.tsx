'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

// Polyfill to prevent Next.js / React Turbopack dev overlay crash:
// "Failed to execute 'releasePointerCapture' on 'Element': No active pointer with the given id is found"
if (typeof window !== 'undefined') {
  const originalReleasePointerCapture = Element.prototype.releasePointerCapture;
  Element.prototype.releasePointerCapture = function(pointerId) {
    if (this.hasPointerCapture(pointerId)) {
      originalReleasePointerCapture.call(this, pointerId);
    }
  };
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
