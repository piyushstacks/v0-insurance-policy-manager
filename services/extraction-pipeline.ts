/**
 * Enterprise 2-Stage AI Extraction Pipeline for Insurance CRM
 */

import {
  METADATA_DETECTION_PROMPT,
  CLASSIFICATION_PROMPT,
  COMPANY_DETECTION_PROMPT,
  POLICY_TYPE_DETECTION_PROMPT,
  getExtractionPrompt,
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

// Tiered model strategy:
//   FAST model  (llama-3.1-8b-instant on Groq)   → steps 2/3/4: classify, company, type
//   SMART model (gemini-2.5-flash on Google API)  → step 6: full field extraction
const GROQ_FAST_MODEL  = 'llama-3.1-8b-instant';
const GROQ_SMART_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL     = 'gemini-2.5-flash';

// Groq model name map — translates OpenRouter-style slugs to Groq model IDs
const GROQ_MODEL_MAP: Record<string, string> = {
  'openrouter/free'                           : GROQ_SMART_MODEL,
  'google/gemma-4-31b-it:free'                : GROQ_SMART_MODEL,
  'meta-llama/llama-3.3-70b-instruct:free'    : 'llama-3.3-70b-versatile',
  'meta-llama/llama-3.2-3b-instruct:free'     : 'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile'                   : 'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'                      : 'llama-3.1-8b-instant',
};

// ── Provider detection ───────────────────────────────────────────────────────
// Priority: Google Gemini API (Direct) → Groq → OpenRouter
function getProvider(modelType: 'fast' | 'smart'): { endpoint: string; key: string; type: 'gemini' | 'groq' | 'openrouter' } | null {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const orKey = process.env.OPENROUTER_API_KEY;

  // Force Groq usage as requested by user
  if (groqKey) {
    return {
      type: 'groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqKey,
    };
  }

  // Fallback to Groq if key is present
  if (groqKey) {
    return {
      type: 'groq',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      key: groqKey,
    };
  }

  // Fallback to OpenRouter as last resort
  const activeOrKey = orKey || (geminiKey && geminiKey.startsWith('sk-or-') ? geminiKey : null);
  if (activeOrKey) {
    return {
      type: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      key: activeOrKey,
    };
  }

  return null;
}

// Unified LLM Caller supporting both Google generateContent & OpenAI formats
async function callLLMWithProvider(
  prompt: string,
  modelType: 'fast' | 'smart',
  provider: { endpoint: string; key: string; type: 'gemini' | 'groq' | 'openrouter' }
): Promise<any> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  // Resolve model name
  let modelName = '';
  if (provider.type === 'gemini') {
    modelName = GEMINI_MODEL;
  } else if (provider.type === 'groq') {
    modelName = modelType === 'fast' ? GROQ_FAST_MODEL : GROQ_SMART_MODEL;
  } else {
    modelName = process.env.EXTRACTION_MODEL || 'google/gemma-4-31b-it:free';
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let response: Response;

      if (provider.type === 'gemini') {
        const url = `${provider.endpoint}/${modelName}:generateContent?key=${provider.key}`;
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            systemInstruction: {
              parts: [{ text: "You are a JSON extraction assistant. Always respond with valid JSON only. No explanation, no markdown, no code fences — just the raw JSON object." }]
            },
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: modelType === 'fast' ? 500 : 8192
            }
          })
        });
      } else {
        response = await fetch(provider.endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${provider.key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              {
                role: "system",
                content: "You are a JSON extraction assistant. Always respond with valid JSON only. No explanation, no markdown, no code fences — just the raw JSON object."
              },
              { role: "user", content: prompt }
            ],
            max_tokens: modelType === 'fast' ? 500 : 4500,
            temperature: 0.1
          })
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`[${provider.type}] API error ${response.status}: ${errText}`);
        if (response.status === 429 || response.status >= 500) {
          lastError = err;
          let delay = attempt * 4000;
          
          // Parse Google's exact requested retry delay (e.g., "retry in 43.2s")
          if (response.status === 429 && provider.type === 'gemini') {
            const match = errText.match(/retry in (\d+(?:\.\d+)?)s/i);
            if (match && match[1]) {
              const requestedSeconds = parseFloat(match[1]);
              delay = (requestedSeconds * 1000) + 1500; // Add 1.5s buffer
              console.log(`[LLM] Gemini API requested exact backoff: ${requestedSeconds}s`);
            }
          }
          
          // Parse Groq's exact requested retry delay (e.g., "Please try again in 14.53s")
          if (response.status === 429 && provider.type === 'groq') {
            const match = errText.match(/try again in (\d+(?:\.\d+)?)s/i);
            if (match && match[1]) {
              const requestedSeconds = parseFloat(match[1]);
              delay = (requestedSeconds * 1000) + 1500; // Add 1.5s buffer
              console.log(`[LLM] Groq API requested exact backoff: ${requestedSeconds}s`);
            }
          }

          console.warn(`[LLM] Attempt ${attempt}/${MAX_RETRIES} failed (${response.status}). Retrying in ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }

      const result = await response.json();
      let rawContent = '';

      if (provider.type === 'gemini') {
        rawContent = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        rawContent = result?.choices?.[0]?.message?.content || '';
      }

      if (!rawContent || rawContent.trim() === '') {
        lastError = new Error("Empty response from LLM");
        console.warn(`[LLM] Attempt ${attempt}/${MAX_RETRIES} returned empty content. Retrying in ${attempt * 4000}ms...`);
        await new Promise(r => setTimeout(r, attempt * 4000));
        continue;
      }

      const rawText = rawContent.trim();
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

async function callLLMRateLimited(prompt: string, modelType: 'fast' | 'smart'): Promise<any> {
  const provider = getProvider(modelType);
  if (!provider) {
    throw new Error("No LLM provider configured. Please set GEMINI_API_KEY or GROQ_API_KEY in env.");
  }
  const res = await callLLMWithProvider(prompt, modelType, provider);
  
  // Throttle slightly to keep within safe request limits
  if (provider.type === 'gemini') {
    await new Promise(resolve => setTimeout(resolve, 800));
  } else if (provider.type === 'groq') {
    await new Promise(resolve => setTimeout(resolve, 1500));
  } else if (provider.type === 'openrouter') {
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

  if (!ocrText || ocrText.trim().length < 50) {
    return {
      store: false,
      reason: 'Upload rejected: Document appears to be a scanned image or photograph (no readable text). Please upload a digital PDF.',
    };
  }

  // Step 1: Format OCR text into page structure (if not already formatted)
  // For simplicity, we split by common PDF form feeds or treat as page 1
  const pages: PageText[] = ocrText.split(/\f|\bPage\b/i).map((text, idx) => ({
    page: idx + 1,
    text: text.trim()
  })).filter(p => p.text.length > 0);

  const fullText = pages.map(p => p.text).join('\n');
  const firstPageText = pages[0]?.text || '';

  // Step 2: Document Classification & Metadata Detection
  console.log(`[Pipeline] Step 2: Detecting document type, company, and category...`);
  const metaResult = await callLLMRateLimited(
    `${METADATA_DETECTION_PROMPT}\n\nDocument Text:\n${firstPageText.substring(0, 3000)}`,
    'fast'
  );
  console.log('[Pipeline] Metadata result:', metaResult);

  if (!metaResult.is_policy) {
    return {
      store: false,
      reason: `Document classified as '${metaResult.document_type || 'Unknown'}'. Only final issued policies are stored. Reason: ${metaResult.reason}`,
      document_type: metaResult.document_type
    };
  }

  const detectedCompany = metaResult.company || 'Other';
  const detectedType = (metaResult.policy_type || 'Other').toLowerCase();

  // Step 5: Template selection
  console.log(`[Pipeline] Step 5: Template selection for ${detectedCompany} + ${detectedType}`);
  const profileKeywords = COMPANY_PROFILES[detectedCompany] || [];

  // Step 6: AI Field Extraction using selected template profile
  console.log(`[Pipeline] Step 6: Running template extraction...`);
  const extractionPrompt = getExtractionPrompt(detectedCompany, detectedType) + 
    `\n\nDocument Text:\n${fullText.substring(0, 8000)}`;

  const extracted = await callLLMRateLimited(extractionPrompt, 'smart');

  // Step 7: Validation & Confidence Scoring
  console.log('[Pipeline] Step 7: Validating extracted fields...');
  
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

  const finalConfidence = typeof extracted.overall_confidence === 'number' ? extracted.overall_confidence : 80;

  function cleanNumLocal(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const cleaned = val.replace(/[₹$,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  }

  // Extract common top-level fields
  for (const [key, value] of Object.entries(extracted)) {
    if (key === 'overall_confidence' || key === 'reasoning' || key === 'life' || key === 'health' || key === 'motor' || key === 'commercial') {
      continue;
    }

    flatData[key] = value;
    if (value !== null && value !== undefined && value !== '') {
      filledCount++;
    } else {
      if (requiredFields.includes(key)) {
        missingFields.push(key);
      }
    }
  }

  // Populate type-specific blocks
  if (detectedType === 'life' && extracted.life) {
    flatData.life = { ...extracted.life };
  } else if (detectedType === 'health' && extracted.health) {
    flatData.health = { ...extracted.health };
  } else if (detectedType === 'motor' && extracted.motor) {
    flatData.motor = { ...extracted.motor };
  } else if (detectedType === 'commercial' && extracted.commercial) {
    flatData.commercial = { ...extracted.commercial };
  }

  // Determine if manual review required
  // If we're missing critical fields or confidence is low, flag it
  const premiumVal = cleanNumLocal(flatData.premium_amount);
  const gstVal = cleanNumLocal(flatData.gst_amount);
  const totalVal = cleanNumLocal(flatData.total_premium) || premiumVal;

  let mathMismatch = false;
  let mathWarning = '';

  if (detectedType === 'life' || detectedType === 'health') {
    // Life & Health policies don't have GST validation. Premium should equal Total Premium.
    if (premiumVal > 0 && Math.abs(premiumVal - totalVal) > 1.5) {
      mathMismatch = true;
      mathWarning = `⚠️ AI FLAG: Premium mismatch. Premium (${premiumVal}) does not equal Total Premium (${totalVal}).\n\n`;
    }
  } else {
    // Commercial and Motor have GST. Premium + GST should equal Total Premium.
    if (premiumVal > 0 && Math.abs((premiumVal + gstVal) - totalVal) > 1.5) {
      mathMismatch = true;
      mathWarning = `⚠️ AI FLAG: GST math mismatch. Premium (${premiumVal}) + GST (${gstVal}) does not equal Total Premium (${totalVal}).\n\n`;
    }
  }

  let finalNotes = '';
  if (mathWarning) {
    finalNotes += mathWarning;
  }
  if (extracted.reasoning) {
    finalNotes += `🧠 AI Extraction Reasoning:\n${extracted.reasoning}\n\n`;
  }
  if (extracted.agent_notes || extracted.notes) {
    finalNotes += (extracted.agent_notes || extracted.notes);
  }
  flatData.agent_notes = finalNotes;

  const requiresManual = missingFields.length > 0 || finalConfidence < 70 || mathMismatch;
  flatData.requires_manual_entry = requiresManual;

  console.log(`[Pipeline] Extraction finished with confidence ${finalConfidence}%. Requires review: ${requiresManual} (Math mismatch: ${mathMismatch})`);

  return {
    store: true,
    document_type: metaResult.document_type,
    company: detectedCompany,
    policy_type: detectedType as any,
    extracted_data: flatData,
    ai_confidence: finalConfidence / 100,
    missing_fields: missingFields
  };
}
