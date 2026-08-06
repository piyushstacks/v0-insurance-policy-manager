'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { FinancialPlanData } from '@/types/financial-plan';
import { RefObject, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PdfExportButtonProps {
  planData: FinancialPlanData | null;
  pdfRef: RefObject<HTMLDivElement | null>;
}

export default function PdfExportButton({ planData, pdfRef }: PdfExportButtonProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
    if (!pdfRef.current || !planData) return;
    
    setIsGeneratingPdf(true);
    const toastId = toast.loading('Generating premium PDF report...');

    try {
      // Temporarily make the ref visible but off-screen to render accurately
      pdfRef.current.style.display = 'block';
      pdfRef.current.style.position = 'absolute';
      pdfRef.current.style.top = '-9999px';
      pdfRef.current.style.left = '-9999px';

      // Capture high-res canvas
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      // A4 dimensions at 72 DPI (Standard)
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Financial_Plan_${planData.personal.fullName || 'Client'}.pdf`);

      toast.success('PDF Generated successfully!', { id: toastId });
    } catch (error) {
      console.error('PDF Generation failed', error);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      // Hide the ref again
      if (pdfRef.current) {
        pdfRef.current.style.display = 'none';
      }
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Button 
      className="bg-indigo-600 hover:bg-indigo-700 text-white" 
      size="sm" 
      onClick={handleGeneratePdf}
      disabled={isGeneratingPdf || !planData}
    >
      <Download className="w-4 h-4 mr-2" /> 
      {isGeneratingPdf ? 'Generating...' : 'Export PDF'}
    </Button>
  );
}
