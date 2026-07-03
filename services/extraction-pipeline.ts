/**
 * Enterprise 2-Stage AI Extraction Pipeline for Insurance CRM
 */

import {
  CLASSIFICATION_PROMPT,
  COMPANY_DETECTION_PROMPT,
  POLICY_TYPE_DETECTION_PROMPT,
  EXTRACTION_TEMPLATE_PROMPT,
  COMPANY_PROFILES,
  VALID_COMPANIES
} from './pipeline-prompts';

export interface PageText {
  page: number;
  text: string;
}

export interface OCRResult {
  pages: PageText[];
}

export interface PipelineResult {
  store: boolean;
  reason?: string;
  document_type?: string;
  company?: string;
  policy_type?: 'life' | 'health' | 'motor' | 'commercial' | 'other';
  extracted_data?: any;
  ai_confidence?: number;
  missing_fields?: string[];
}

const DEFAULT_MODEL = process.env.EXTRACTION_MODEL || "google/gemini-2.5-flash:free";

// OpenRouter LLM Helper — with 3-attempt retry + exponential backoff
async function callLLM(prompt: string, model: string = DEFAULT_MODEL): Promise<any> {
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;

  if (!openRouterKey) {
    throw new Error("Missing OpenRouter / Gemini API Key in environment.");
  }

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a JSON extraction assistant. Always respond with valid JSON only. No explanation, no markdown, no code fences — just the raw JSON object."
            },
            { role: "user", content: prompt }
          ],
          // NOTE: response_format is intentionally omitted — many free models
          // return empty content when forced into json_object mode.
          max_tokens: 4500
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`OpenRouter API error ${response.status}: ${errText}`);
        // Retry on 429 rate limit or 5xx server errors
        if (response.status === 429 || response.status >= 500) {
          lastError = err;
          const delay = attempt * 4000; // 4s, 8s, 12s
          console.warn(`[LLM] Attempt ${attempt}/${MAX_RETRIES} failed (${response.status}). Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }

      const result = await response.json();
      const rawContent = result?.choices?.[0]?.message?.content;

      if (!rawContent || rawContent.trim() === '') {
        // Empty response — free model overloaded, retry
        lastError = new Error("Empty response from LLM");
        console.warn(`[LLM] Attempt ${attempt}/${MAX_RETRIES} returned empty content. Retrying in ${attempt * 4000}ms...`);
        await new Promise(r => setTimeout(r, attempt * 4000));
        continue;
      }

      const rawText = rawContent.trim();
      // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
      const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        lastError = new Error(`No valid JSON in LLM response: ${rawText.substring(0, 200)}`);
        console.warn(`[LLM] Attempt ${attempt}/${MAX_RETRIES} — no JSON found. Retrying...`);
        await new Promise(r => setTimeout(r, attempt * 3000));
        continue;
      }

      return JSON.parse(jsonMatch[0]);

    } catch (err: any) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM] Attempt ${attempt}/${MAX_RETRIES} threw: ${err.message}. Retrying in ${attempt * 4000}ms...`);
        await new Promise(r => setTimeout(r, attempt * 4000));
      }
    }
  }

  throw lastError ?? new Error("LLM call failed after max retries.");
}

async function callLLMRateLimited(prompt: string, model: string = DEFAULT_MODEL): Promise<any> {
  const res = await callLLM(prompt, model);
  if (model.endsWith(':free') || model === 'openrouter/free') {
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  return res;
}


/**
 * Main AI Extraction Pipeline
 */
export async function runExtractionPipeline(
  ocrText: string,
  existingInsurers: string[] = [],
  existingCustomers: string[] = []
): Promise<PipelineResult> {
  console.log('[Pipeline] Starting 2-stage AI pipeline processing...');

  // Step 1: Format OCR text into page structure (if not already formatted)
  // For simplicity, we split by common PDF form feeds or treat as page 1
  const pages: PageText[] = ocrText.split(/\f|\bPage\b/i).map((text, idx) => ({
    page: idx + 1,
    text: text.trim()
  })).filter(p => p.text.length > 0);

  const fullText = pages.map(p => p.text).join('\n');
  const firstPageText = pages[0]?.text || '';

  // Step 2: Document Classification
  console.log('[Pipeline] Step 2: Classifying document type...');
  const classResult = await callLLMRateLimited(
    `${CLASSIFICATION_PROMPT}\n\nDocument Text:\n${fullText.substring(0, 8000)}`
  );
  console.log('[Pipeline] Class result:', classResult);

  if (!classResult.is_policy) {
    return {
      store: false,
      reason: `Document classified as '${classResult.document_type || 'Unknown'}'. Only final issued policies are stored. Reason: ${classResult.reason}`,
      document_type: classResult.document_type
    };
  }

  // Step 3: Detect Company (mainly first page)
  console.log('[Pipeline] Step 3: Detecting company...');
  const companyResult = await callLLMRateLimited(
    `${COMPANY_DETECTION_PROMPT}\n\nFirst Page Text:\n${firstPageText.substring(0, 4000)}`
  );
  console.log('[Pipeline] Company result:', companyResult);

  // Step 4: Detect Policy Type
  console.log('[Pipeline] Step 4: Detecting policy type...');
  const policyTypeResult = await callLLMRateLimited(
    `${POLICY_TYPE_DETECTION_PROMPT}\n\nFirst Page Text:\n${firstPageText.substring(0, 4000)}`
  );
  console.log('[Pipeline] Policy type result:', policyTypeResult);

  const detectedCompany = companyResult.company || 'Other';
  const detectedType = (policyTypeResult.policy_type || 'Other').toLowerCase();

  // Step 5: Template selection
  console.log(`[Pipeline] Step 5: Template selection for ${detectedCompany} + ${detectedType}`);
  const profileKeywords = COMPANY_PROFILES[detectedCompany] || [];

  // Step 6: AI Field Extraction using selected template profile
  console.log('[Pipeline] Step 6: Running template extraction...');
  const extractionPrompt = EXTRACTION_TEMPLATE_PROMPT
    .replace('${company_profile}', profileKeywords.map(k => `- ${k}`).join('\n')) + 
    `\n\nDetected Company: ${detectedCompany}\nDetected Policy Type: ${detectedType}\n\nDocument Text:\n${fullText.substring(0, 15000)}`;

  const extracted = await callLLMRateLimited(extractionPrompt);


  // Step 7: Validation & Confidence Scoring
  console.log('[Pipeline] Step 7: Validating extracted fields...');
  
  // Calculate average confidence score of filled fields
  let totalConfidence = 0;
  let filledCount = 0;
  const missingFields: string[] = [];

  const requiredFields = ['policy_number', 'premium_amount', 'customer_name', 'policy_start_date'];
  
  // Flatten and validate fields, pulling the raw values
  const flatData: any = {
    store: true,
    insurance_type: detectedType === 'commercial' ? 'commercial' : detectedType,
    company: detectedCompany,
    is_quotation: false
  };

  // Extract common top-level fields
  for (const [key, obj] of Object.entries(extracted)) {
    if (obj && typeof obj === 'object' && 'value' in obj) {
      const fieldObj = obj as { value: any; confidence: number };
      flatData[key] = fieldObj.value;
      if (fieldObj.value !== null && fieldObj.value !== undefined) {
        totalConfidence += fieldObj.confidence || 50;
        filledCount++;
      } else {
        if (requiredFields.includes(key)) {
          missingFields.push(key);
        }
      }
    }
  }

  // Populate type-specific blocks
  if (detectedType === 'life' && extracted.life) {
    flatData.life = {};
    for (const [key, obj] of Object.entries(extracted.life)) {
      if (obj && typeof obj === 'object' && 'value' in obj) {
        flatData.life[key] = (obj as any).value;
      }
    }
  } else if (detectedType === 'health' && extracted.health) {
    flatData.health = {};
    for (const [key, obj] of Object.entries(extracted.health)) {
      if (obj && typeof obj === 'object' && 'value' in obj) {
        flatData.health[key] = (obj as any).value;
      }
    }
  } else if (detectedType === 'motor' && extracted.motor) {
    flatData.motor = {};
    for (const [key, obj] of Object.entries(extracted.motor)) {
      if (obj && typeof obj === 'object' && 'value' in obj) {
        flatData.motor[key] = (obj as any).value;
      }
    }
  } else if (detectedType === 'commercial' && extracted.commercial) {
    flatData.commercial = {};
    for (const [key, obj] of Object.entries(extracted.commercial)) {
      if (obj && typeof obj === 'object' && 'value' in obj) {
        flatData.commercial[key] = (obj as any).value;
      }
    }
  }

  const finalConfidence = filledCount > 0 ? Math.round(totalConfidence / filledCount) : 0;
  
  // Determine if manual review required
  // If we're missing critical fields or confidence is low, flag it
  const requiresManual = missingFields.length > 0 || finalConfidence < 70;
  flatData.requires_manual_entry = requiresManual;

  console.log(`[Pipeline] Extraction finished with confidence ${finalConfidence}%. Requires review: ${requiresManual}`);

  return {
    store: true,
    document_type: classResult.document_type,
    company: detectedCompany,
    policy_type: detectedType as any,
    extracted_data: flatData,
    ai_confidence: finalConfidence / 100,
    missing_fields: missingFields
  };
}
