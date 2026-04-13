/**
 * Free Local OCR Engine — pdf-parse v1 (server-external, loaded at runtime)
 * next.config.mjs lists pdf-parse in serverExternalPackages so Next.js
 * does NOT bundle it. Node.js loads it natively at runtime via require.
 */

import { ExtractionResult } from '@/lib/schemas';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Safe runtime require — works because pdf-parse is serverExternalPackages
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
  require('pdf-parse');

export interface OCRProvider {
  name: string;
  extractText(fileUrl: string): Promise<string>;
  extractStructuredData(text: string): Promise<ExtractionResult>;
}

class PDFParseProvider implements OCRProvider {
  name = 'pdf-parse-regex';

  async extractText(fileUrl: string): Promise<string> {
    console.log(`[v0/OCR] Fetching document: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document (HTTP ${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Image files — no server-side text extraction without a GPU
    if (/\.(jpe?g|png)(\?|$)/i.test(fileUrl)) {
      console.warn('[v0/OCR] Image file — using placeholder.');
      return 'IMAGE_UPLOAD_NO_TEXT_EXTRACTED';
    }

    console.log('[v0/OCR] Parsing PDF with pdf-parse v1...');
    try {
      const result = await pdfParse(buffer);
      const text = result.text?.trim() ?? '';
      if (!text || text.length < 20) {
        console.warn('[v0/OCR] Scanned/image-only PDF (no embedded text) — placeholder.');
        return 'SCANNED_PDF_NO_TEXT_EXTRACTED';
      }
      console.log(`[v0/OCR] Extracted ${text.length} chars, ${result.numpages} pages.`);
      return text;
    } catch (err: any) {
      console.error('[v0/OCR] pdf-parse error:', err.message);
      throw new Error(`PDF parsing failed: ${err.message}`);
    }
  }

  async extractStructuredData(text: string): Promise<ExtractionResult> {
    console.log('[v0/OCR] Running regex extraction...');

    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    if (text === 'IMAGE_UPLOAD_NO_TEXT_EXTRACTED' || text === 'SCANNED_PDF_NO_TEXT_EXTRACTED') {
      return {
        policy_number: `IMG-${Date.now()}`,
        policy_type: 'Unknown (Scanned Upload)',
        coverage_start: now.toISOString(),
        coverage_end: nextYear.toISOString(),
        premium_amount: 0,
        insurer_name: 'Unknown',
        customer_name: 'Unknown',
      };
    }

    // Normalize whitespace but keep newlines for multi-line matching
    const t = text.replace(/[ \t]+/g, ' ');
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean);

    const grab = (regex: RegExp): string | null => {
      const m = t.match(regex);
      return m?.[1]?.trim() ?? null;
    };

    // Helper: parse DD/MM/YYYY to ISO
    const parseDMY = (s: string): Date | null => {
      const m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
      if (!m) return null;
      const d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
      return isNaN(d.getTime()) ? null : d;
    };

    // ── Policy Number ──────────────────────────────────────────────────────
    const policyNumber =
      (grab(/[Pp]olicy\s*[Nn]o\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 \/\-]{5,40})/i) ??
       grab(/[Pp]olicy\s*[Nn]umber\s*[:\-]?\s*([A-Z0-9][A-Z0-9 \/\-]{5,40})/i))
      ?.replace(/\s+/g, ' ').trim() ?? `OCR-${Date.now()}`;

    // ── Policy Type ────────────────────────────────────────────────────────
    let policyType = 'General Insurance';
    for (const line of lines.slice(0, 50)) {
      const m = line.match(/([A-Za-z][A-Za-z ]{5,80}?(?:Insurance|Health|Motor|Life|Travel|Fire|Marine|Policy|Plan|Cover))(?:\s|,|$)/i);
      if (m && !m[1].toLowerCase().includes('welcome') && !m[1].toLowerCase().includes('please') && !m[1].toLowerCase().includes('renewal of your')) {
        policyType = m[1].trim();
        break;
      }
    }
    const typeFromRenewal = grab(/[Rr]enewal of [Yy]our\s+([A-Za-z][A-Za-z ]{3,60}?)\s+(?:[Ii]nsurance\s+)?[Pp]olicy/i);
    if (typeFromRenewal) policyType = typeFromRenewal + ' Insurance Policy';
    
    const typeFromLabel = grab(/[Pp]olicy\s+[Ss]chedule\s*[-–]\s*([A-Za-z][A-Za-z ]{3,60}?)(?:\n|$)/i);
    if (typeFromLabel) policyType = typeFromLabel.trim();

    // ── Dates: Target 'Policy Period From X To Y' (most reliable) ──────────
    let coverageStart = now.toISOString();
    let coverageEnd   = nextYear.toISOString();

    const periodMatch = t.match(
      /[Pp]olicy\s*[Pp]eriod[^\n]*?(?:From|from)[\s\S]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})[\s\S]*?(?:To|to)[\s\S]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
    );
    if (periodMatch) {
      const s = parseDMY(periodMatch[1]);
      const e = parseDMY(periodMatch[2]);
      if (s) coverageStart = s.toISOString();
      if (e) coverageEnd   = e.toISOString();
    } else {
      const periodFallback = t.match(
        /for\s+period\s+of\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*to\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
      );
      if (periodFallback) {
        const s = parseDMY(periodFallback[1]);
        const e = parseDMY(periodFallback[2]);
        if (s) coverageStart = s.toISOString();
        if (e) coverageEnd   = e.toISOString();
      }
    }

    // ── Premium: Target 'Net Premium  XXXXX' or 'Gross Premium  XXXXX' ─────
    let premium = 0;
    const netPrem  = grab(/[Nn]et\s+[Pp]remium\s+([\d,]+(?:\.\d{1,2})?)/i);
    const grossPrem = grab(/[Gg]ross\s+[Pp]remium\s+([\d,]+(?:\.\d{1,2})?)/i);
    const rsPrem   = grab(/paid\s*Rs\.\s*([\d,]+)/i);
    const raw = netPrem ?? rsPrem ?? grossPrem;
    if (raw) premium = parseFloat(raw.replace(/,/g, ''));

    // ── Insurer: HDFC ERGO / Company name ─────────────────────────────────
    const insurer =
      grab(/(?:issued by|underwriter|administrator)[:\-\s]+([A-Za-z][A-Za-z ]{3,80}?(?:Insurance|Assurance)\s+(?:Company|Co\.?|Ltd\.?|Limited))/i) ??
      (() => {
        for (const line of lines) {
          const m = line.match(/^([A-Za-z][A-Za-z ]{5,80}?(?:Insurance|Assurance)\s+(?:Company|Co\.?|Ltd\.?|Limited))$/i);
          if (m) return m[1].trim();
        }
        return grab(/([A-Za-z][A-Za-z ]+?(?:Insurance|Assurance)\s+(?:Company|Co\.?|Ltd\.?|Limited))/i);
      })() ??
      'Unknown Insurer';

    // ── Customer: From 'Dear Mr/Ms X' or policy holder label ──────────────
    const customer =
      grab(/[Dd]ear\s+(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*([A-Z][a-zA-Z ]{2,60}?)(?:\s*,|\s*\n|$)/i) ??
      grab(/(?:[Pp]olicy\s*[Hh]older|[Ii]nsured\s*(?:[Nn]ame)?|[Pp]roposer)\s*[:\-]?\s*(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)?\s*([A-Z][a-zA-Z ]{2,60}?)(?:\n|,|$)/i) ??
      'Unknown Customer';

    const result: ExtractionResult = {
      policy_number:  policyNumber,
      policy_type:    policyType.trim(),
      coverage_start: coverageStart,
      coverage_end:   coverageEnd,
      premium_amount: premium,
      insurer_name:   insurer.trim(),
      customer_name:  customer.trim(),
    };

    console.log('[v0/OCR] Result:', JSON.stringify(result, null, 2));
    return result;
  }
}

class GoogleDocumentAIProvider implements OCRProvider {
  name = 'google-document-ai';
  client: DocumentProcessorServiceClient | null = null;
  
  constructor() {
    try {
       // Only initialize if Google Cloud is properly set up in environment
       if (process.env.GOOGLE_CLOUD_PROJECT_ID) {
          this.client = new DocumentProcessorServiceClient();
       }
    } catch (err: any) {
       console.warn('[v0/GCP] Document AI Client failed to init (likely missing CREDENTIALS):', err.message);
    }
  }

  async extractText(fileUrl: string): Promise<string> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us';
    const processorId = process.env.GOOGLE_CLOUD_PROCESSOR_ID;

    // Soft fallback if user forgot to configure GCP Env variables
    if (!this.client || !projectId || !processorId) {
       console.warn('[v0/GCP] Configurations missing. Falling back to local pdf-parse.');
       const fb = new PDFParseProvider();
       return fb.extractText(fileUrl);
    }

    console.log(`[v0/GCP] Fetching document for Google Cloud processing: ${fileUrl}`);
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let mimeType = 'application/pdf';
    if (/\.(jpe?g)(\?|$)/i.test(fileUrl)) mimeType = 'image/jpeg';
    else if (/\.(png)(\?|$)/i.test(fileUrl)) mimeType = 'image/png';

    console.log(`[v0/GCP] Sending ${mimeType} to Google Document AI (${location}/${processorId})...`);

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const request = {
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType,
      },
    };

    try {
      const [result] = await this.client.processDocument(request);
      const text = result.document?.text?.trim() ?? '';
      
      console.log(`[v0/GCP] Google Cloud extracted ${text.length} chars natively.`);
      return text;
    } catch (err: any) {
      console.error('[v0/GCP] Google Cloud Document AI processing failed:', err.message);
      throw new Error(`Google Cloud OCR Failed: ${err.message}`);
    }
  }

  async extractStructuredData(text: string): Promise<ExtractionResult> {
     // Regex data heuristics works beautifully on top of GCP text.
     const fallbackEngine = new PDFParseProvider();
     return fallbackEngine.extractStructuredData(text);
  }
}

const providerType = process.env.OCR_PROVIDER || 'google-document-ai';
export const ocrProvider = providerType === 'google-document-ai' 
  ? new GoogleDocumentAIProvider() 
  : new PDFParseProvider();

