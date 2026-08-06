'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { FinancialPlanData } from '@/types/financial-plan';
import { RefObject, useState } from 'react';
import html2canvas from 'html2canvas-pro';
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
      // Make the entire container block
      pdfRef.current.style.display = 'block';
      pdfRef.current.style.position = 'absolute';
      pdfRef.current.style.top = '-9999px';
      pdfRef.current.style.left = '-9999px';

      const pdf = new jsPDF('p', 'pt', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      // Render Page 1
      const page1 = pdfRef.current.querySelector('#pdf-page-1');
      if (page1) {
        const canvas1 = await html2canvas(page1 as HTMLElement, { scale: 2, useCORS: true, logging: false });
        const imgData1 = canvas1.toDataURL('image/jpeg', 1.0);
        const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
        pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, imgHeight1);
      }

      // Render Page 2
      const page2 = pdfRef.current.querySelector('#pdf-page-2');
      if (page2) {
        const canvas2 = await html2canvas(page2 as HTMLElement, { scale: 2, useCORS: true, logging: false });
        const imgData2 = canvas2.toDataURL('image/jpeg', 1.0);
        const imgHeight2 = (canvas2.height * pdfWidth) / canvas2.width;
        pdf.addPage();
        pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, imgHeight2);
      }
      
      const fileName = `Financial_Plan_${planData.personal.fullName || 'Client'}.pdf`;
      pdf.save(fileName);

      toast.success('PDF Generated successfully!', { id: toastId });

      // Try sharing if supported (Mobile devices / modern browsers)
      if (navigator.share && navigator.canShare) {
        try {
          const pdfBlob = pdf.output('blob');
          const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'My Financial Plan',
              text: `Hi ${planData.personal.fullName}, here is your personalized Financial Planning Report!`,
              files: [file]
            });
            toast.success('Shared successfully!');
          }
        } catch (shareError: any) {
          if (shareError.name !== 'AbortError') {
            console.error('Share failed', shareError);
          }
        }
      }
    } catch (error) {
      console.error('PDF Generation failed', error);
      toast.error('Failed to generate PDF. Make sure your browser supports this feature.', { id: toastId });
    } finally {
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
