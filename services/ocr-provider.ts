/**
 * OCR Provider Interface
 * Abstraction layer for different OCR providers (Google Docs AI, Tesseract, etc.)
 * Currently uses mock provider for development
 */

import { ExtractionResult } from '@/lib/schemas';

export interface OCRProvider {
  name: string;
  extractText(fileUrl: string): Promise<string>;
  extractStructuredData(text: string): Promise<ExtractionResult>;
}

/**
 * Mock OCR Provider - Development/Testing
 * Parses mock document text and extracts structured data
 */
class MockOCRProvider implements OCRProvider {
  name = 'mock';

  async extractText(fileUrl: string): Promise<string> {
    // Simulate reading file and extracting text
    // In production, this would actually read the file from Supabase Storage
    return `
      INSURANCE POLICY DOCUMENT
      
      Policy Number: POL-2024-001234
      Policy Type: Comprehensive Home Insurance
      
      Insured: John Doe
      Coverage Period: January 1, 2024 - December 31, 2024
      
      Premium: $1,200.00 per annum
      
      Insurer: SafeGuard Insurance Co.
      Contact: claims@safeguard.com
      
      Coverage Details:
      - Dwelling: $500,000
      - Personal Property: $100,000
      - Liability: $500,000
    `;
  }

  async extractStructuredData(text: string): Promise<ExtractionResult> {
    // Simulate parsing and structuring data from OCR text
    const mockExtraction: ExtractionResult = {
      policy_number: 'POL-2024-001234',
      policy_type: 'Comprehensive Home Insurance',
      customer_name: 'John Doe',
      insurer_name: 'SafeGuard Insurance Co.',
      coverage_start: '2024-01-01',
      coverage_end: '2024-12-31',
      premium_amount: 1200,
      additional_fields: {
        dwelling_coverage: '$500,000',
        personal_property_coverage: '$100,000',
        liability_coverage: '$500,000',
        contact_email: 'claims@safeguard.com',
      },
    };

    return mockExtraction;
  }
}

/**
 * Google Document AI Provider - Production Ready
 * To use: Set up Google Cloud project with Document AI API enabled
 * Environment variables needed:
 * - GOOGLE_CLOUD_PROJECT_ID
 * - GOOGLE_CLOUD_LOCATION
 * - GOOGLE_DOCUMENT_AI_PROCESSOR_ID
 * - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)
 */
class GoogleDocumentAIProvider implements OCRProvider {
  name = 'google-docai';

  async extractText(fileUrl: string): Promise<string> {
    // Would use Google Document AI API to extract text
    // This is a placeholder for the implementation
    throw new Error('Google Document AI not configured');
  }

  async extractStructuredData(text: string): Promise<ExtractionResult> {
    // Would use Google Document AI to extract structured data
    throw new Error('Google Document AI not configured');
  }
}

// Get configured provider
function getOCRProvider(): OCRProvider {
  const providerName = process.env.OCR_PROVIDER || 'mock';

  switch (providerName) {
    case 'google-docai':
      return new GoogleDocumentAIProvider();
    case 'mock':
    default:
      return new MockOCRProvider();
  }
}

export const ocrProvider = getOCRProvider();
