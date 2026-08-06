'use client';

import { useState, useRef } from 'react';
import { WizardContainer } from '@/components/financial-planning/wizard/wizard-container';
import { ReportView } from '@/components/financial-planning/report/report-view';
import { PdfRenderer } from '@/components/financial-planning/pdf/pdf-renderer';
import { FinancialPlanData } from '@/types/financial-plan';
import { calculateFinancialScores } from '@/lib/financial-scoring';

export default function FinancialPlanningPage() {
  const [mode, setMode] = useState<'wizard' | 'report'>('wizard');
  const [planData, setPlanData] = useState<FinancialPlanData | null>(null);
  
  // Ref for the hidden PDF container
  const pdfRef = useRef<HTMLDivElement>(null);
  // PDF generation moved to dynamic client component to avoid SSR issues

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      {mode === 'wizard' ? (
        <WizardContainer 
          initialData={planData || undefined} 
          onComplete={(data) => {
            setPlanData(data);
            setMode('report');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
        />
      ) : (
        planData && (
          <ReportView 
            data={planData} 
            onEdit={() => setMode('wizard')} 
            pdfRef={pdfRef}
          />
        )
      )}

      {/* Hidden Container for PDF Rendering */}
      <div style={{ display: 'none' }}>
        {planData && (
          <PdfRenderer 
            ref={pdfRef} 
            data={planData} 
            scores={calculateFinancialScores(planData)} 
          />
        )}
      </div>
    </div>
  );
}
