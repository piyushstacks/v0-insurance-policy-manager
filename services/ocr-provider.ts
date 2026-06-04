/**
 * Free Local OCR Engine — pdf-parse v1 (server-external, loaded at runtime)
 * next.config.mjs lists pdf-parse in serverExternalPackages so Next.js
 * does NOT bundle it. Node.js loads it natively at runtime via require.
 */

import { ExtractionResultInput } from '@/lib/schemas';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Safe runtime require — works because pdf-parse is serverExternalPackages
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> =
  require('pdf-parse');

export interface OCRProvider {
  name: string;
  extractText(fileUrl: string): Promise<string>;
  extractStructuredData(text: string, existingInsurers?: string[], existingCustomers?: string[]): Promise<ExtractionResultInput>;
  consensusExtract(text: string, existingInsurers?: string[], existingCustomers?: string[]): Promise<ExtractionResultInput>;
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

  async extractStructuredData(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
    console.log('[v0/OCR] Running AI extraction with Entity Resolution Maps...');

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
        insurer_name: 'Unknown Insurer',
        customer_name: 'Unknown Customer',
      };
    }

    // ── GEN AI INJECTION — OpenRouter API with free model fallback chain ──
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY; // fallback if user only provided one
    if (openRouterKey) {
      console.log('[v0/AI] OpenRouter API Key found. Routing raw text through LLM Intelligence...');
      
      let parsed: any = null;
      let finalCat = 'General';
      let finalSubCat = 'Standard Policy';
      let aiErrLog = null;
      
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      // Fallback model list requested by user
      const models = [
         "openai/gpt-oss-120b:free",
         "nvidia/nemotron-3-super-120b-a12b:free",
         "minimax/minimax-m2.5:free"
      ];
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const modelName = models[attempt];
          console.log(`[v0/AI] Attempt ${attempt + 1} using openrouter model ${modelName}...`);

          const prompt = `
            You are an expert insurance document analyst specializing in Indian insurance policies (Star Health, HDFC Ergo, LIC, ICICI Lombard, Go Digit, Tata AIG, New India Assurance, Niva Bupa, Care Health, etc.).
            I am providing you with raw OCR text from a scanned policy schedule document.
            Extract all required fields carefully. Output EXCLUSIVELY a single pure JSON object — NO markdown, NO backticks, NO explanation.

            ENTITY RESOLUTION (prevent duplicates):
            - Existing Insurers in DB: [${existingInsurers.join(', ')}]
            - Existing Customers in DB: [${existingCustomers.join(', ')}]
            Map extracted names to the EXACT existing string if it is a variant/typo/substring of one above.

            CUSTOMER NAME RULES (CRITICAL):
            - Extract the ACTUAL human name of the policyholder / proposer / insured.
            - ICICI Lombard: Look for "Name of the Insured : FULL NAME" ending before "Policy No.". Also "Dear FULL NAME," in Risk Assumption Letter.
            - Star Health: Look for "Proposer Name : FULL NAME" OR "To,\nFULL NAME," OR "Customer Name : FULL NAME".
            - Go Digit: Look for "Name\nFULL NAME" in Insured & Policy Details. Business: extract owner after "PROP" keyword.
            - Tata AIG: Look for "Name\nMr/Mrs/Ms FULL NAME" OR "Insured's Name\nMr/Mrs/Ms FULL NAME" OR "Payer Name: FULL NAME" in receipt section.
            - Niva Bupa: Look for "Policyholder Name: MR./MRS. FULL NAME" OR "Dear MR./MRS. FULL NAME,".
            - New India Assurance: Look for "Name of Insured" in policy schedule table, or proposer block at top.
            - LIC: Look for "from policyholder Shri/Smt. FULL NAME" in receipt.
            - HDFC ERGO: Look for "Dear Mr/Ms FULL NAME" OR certificate line with MR./MS. name.
            - "Dear Customer" without a following name is NOT valid.
            - NEVER output labels: "Code", "Client ID", "UIN", "Insured Name", "Person Details", "Name", "Nominee", "Gender".
            - If not found, output null.

            CATEGORY RULES:
            - "policy_category": MUST be exactly one of: "Health", "Motor", "Life", "Travel", "Property", "General", "Business".
            - Use "Motor" for any vehicle/two-wheeler/car/commercial vehicle/goods carrying vehicle policy.
            - Use "Business" for shop, office, SME, Bharat Sookshma Udyam, fire+burglary.
            - Use "Life" for LIC, term, endowment, ULIP, annuity policies.
            - "policy_sub_category": Short plan name ONLY (e.g. "Commercial Vehicle", "Two-Wheeler OD", "Aspire", "Mediclaim", "Assure", "Care Advantage"). Max 30 chars.

            PREMIUM RULES:
            - Extract TOTAL amount paid/payable. Look for: "Total Premium Payable", "Final Premium", "Gross Premium", "Rs. X/-", "Grand Total".
            - Tata AIG: Use "Total Premium (₹)" from receipt table (e.g. 26138).
            - Niva Bupa: Use "Gross Premium (INR)" (e.g. 30322).
            - LIC Receipt: Use "Grand Total (Rs)" (e.g. 16542).
            - ICICI Lombard: Use "Total Premium Payable In \`X" (e.g. 1615).
            - Return as plain number (no currency symbol, no commas).

            MOTOR POLICY RULES (applies when policy_category = "Motor"):
            - "vehicle_idv": Total Insured Declared Value. For Tata AIG: the IDV columns are concatenated — the LAST 6-digit segment of the Total IDV string is the Vehicle IDV. Use the value from "Total Own Damage Premium" context, or look for the last distinct number in the IDV row. Return as number.
            - "ncb_percentage": Look for "No claim bonus (X%)", "NCB % (Current Policy) X%", "NCB: X". Return as number (e.g. 20).
            - "vehicle_registration_no": e.g. "GJ18BW2687". Look for "Registration No." label.
            - "vehicle_make_model": e.g. "MAHINDRA SUPRO PROFITTRUCK", "HONDA ACTIVA 3G".

            BUSINESS POLICY RULES:
            - "sum_insured": Total sum insured across all sections.

            HEALTH POLICY RULES:
            - "sum_insured": Extract "Base Sum Insured", "Sum Insured", "Cover Amount" as number.
            - Niva Bupa: "Base Sum Insured INR10,00,000" → 1000000.
            - New India: Sum Insured from policy schedule table.

            RENEWAL LETTER / RECEIPT DETECTION:
            - Renewal Notice / Renewal Letter / Renewal Invite: is_quotation=true (NOT a policy).
            - LIC Renewal Premium Receipt: is_quotation=false (IS valid for Life — extract policy nos + sum assured).
            - Care renewal letter with "Renewing your policy" text: is_quotation=true.

            CONTACT DATA RULES:
            - NEVER invent. Only extract if explicitly written. Masked values ("XXXXXX3059", "97******09") → output null.

            LIFE INSURANCE TERMS:
            - payment_term: Single Pay=1, Limited Pay=N years, Regular Pay=99.
            - policy_term: Extract "Policy Term" or "Term (yr)" in years.

            Return JSON:
            {
              "policy_number": "exact alphanumeric — Tata AIG: 6304056633/00/00, LIC: first policy no from table",
              "policy_category": "Health|Motor|Life|Travel|Property|General|Business",
              "policy_sub_category": "short plan name, max 30 chars",
              "coverage_start": "ISO8601 date",
              "coverage_end": "ISO8601 date",
              "premium_amount": 26138,
              "sum_insured": 1000000,
              "vehicle_idv": 0,
              "ncb_percentage": 0,
              "vehicle_registration_no": null,
              "vehicle_make_model": null,
              "payment_term": 99,
              "policy_term": 25,
              "insurer_name": "insurance company full name",
              "customer_name": "full name of proposer/policyholder or null",
              "customer_email": "email or null",
              "customer_mobile": "phone number or null",
              "key_important_details": "HTML <li> list of other key info, or empty string",
              "is_quotation": false
            }

            RAW DOCUMENT TEXT:
            ${text.substring(0, 15000)}
          `;

          // API call to OpenRouter with reasoning enabled
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openRouterKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              "model": modelName,
              "messages": [
                {
                  "role": "user",
                  "content": prompt
                }
              ],
              "reasoning": {"enabled": true}
            })
          });
          
          if (!res.ok) {
              const errBody = await res.text();
              throw new Error(`OpenRouter API error ${res.status}: ${errBody}`);
          }

          const result = await res.json();
          const assistantMessage = result.choices[0].message;
          let rawContent = assistantMessage.content.trim();
          
          // Fallback second reasoning loop if requested
          if (!rawContent.includes("{")) {
              console.log("[v0/AI] JSON not found, extending reasoning loop...");
              const res2 = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${openRouterKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  "model": modelName,
                  "messages": [
                    { "role": "user", "content": prompt },
                    { 
                        "role": "assistant", 
                        "content": assistantMessage.content,
                        "reasoning_details": assistantMessage.reasoning_details
                    },
                    { "role": "user", "content": "You did not output the final JSON requested. Are you sure? Think carefully and output strictly the final JSON."}
                  ]
                })
              });
              if (res2.ok) {
                  const r2 = await res2.json();
                  rawContent = r2.choices[0].message.content.trim();
              }
          }
          
          // Safely extract JSON object even if LLM adds preamble text
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON object found in AI response');
          rawContent = jsonMatch[0];
          
          parsed = JSON.parse(rawContent);
          
          // --- Validation ---
          const cName = (parsed.customer_name || '').trim();
          const cNameLower = cName.toLowerCase();
          const invalidTerms = ['details', 'gender', 'nominee', 'unknown', 'insured name', 'code', 'client id', 'uin', 'person', 'name'];
          const isInvalidName = !cName || cName.length < 3 || invalidTerms.some(t => cNameLower === t);

          if (parsed.customer_email) {
             const lowerE = parsed.customer_email.toLowerCase();
             if (lowerE.includes('.local') || lowerE.includes('auto@') || lowerE.includes('none') || lowerE.includes('test@') || !lowerE.includes('@')) {
                 parsed.customer_email = null;
             }
          }
          if (parsed.customer_mobile && String(parsed.customer_mobile).replace(/\D/g, '').length < 7) {
             parsed.customer_mobile = null;
          }
          
          const validCats = ['Health', 'Motor', 'Life', 'Travel', 'Property', 'General', 'Business'];
          finalCat = validCats.includes(parsed.policy_category) ? parsed.policy_category : 'General';
          finalSubCat = (parsed.policy_sub_category || 'Standard Policy').substring(0, 35);
          // Reject if sub_category is just the company name
          if (existingInsurers.some(i => finalSubCat.toLowerCase().includes(i.toLowerCase().substring(0, 8)))) {
            finalSubCat = 'Standard Policy';
          }
          
          if (isInvalidName) {
             console.warn(`[v0/AI] Customer name '${parsed.customer_name}' is invalid on attempt ${attempt + 1}.`);
             parsed.customer_name = null; // Will trigger regex supplementation below
          }
          
          const parseNum = (val: any) => typeof val === 'number' ? val : parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
          parsed.premium_amount = parseNum(parsed.premium_amount);
          parsed.vehicle_idv = parseNum(parsed.vehicle_idv);
          parsed.ncb_percentage = parseNum(parsed.ncb_percentage);
          // For Motor policies, IDV is the sum insured equivalent
          parsed.sum_insured = parseNum(
            parsed.sum_insured || parsed.sum_assured ||
            (finalCat === 'Motor' ? parsed.vehicle_idv : 0) ||
            parsed.additional_fields?.sum_insured
          );
          parsed.payment_term = parseNum(parsed.payment_term);
          parsed.policy_term = parseNum(parsed.policy_term);

          if (!parsed.policy_number || parsed.policy_number.length < 4) {
             parsed.policy_number = `REVIEW-${Date.now()}`;
          }

          // STRICT CHECK: Premium Amount & Sum Assured
          // For Motor: IDV satisfies sum insured; for Business: section sum insured satisfies it
          const hasPremium = parsed.premium_amount > 0;
          const hasMotorIDV = finalCat === 'Motor' && parsed.vehicle_idv > 0;
          const hasSumInsured = parsed.sum_insured > 0 || hasMotorIDV ||
            parsed.key_important_details?.toLowerCase().includes('sum insured') ||
            parsed.key_important_details?.toLowerCase().includes('idv');
          
          if (!hasPremium && !hasSumInsured) {
             throw new Error("Missing both Premium Amount and Sum Insured/IDV. Extraction is weak.");
          }

          // ── Motor: Enrich key_important_details with IDV, NCB, Vehicle details ──
          if (finalCat === 'Motor') {
            const motorDetails: string[] = [];
            if (parsed.vehicle_idv > 0) motorDetails.push(`<li><strong>IDV (Insured Declared Value):</strong> ₹${parsed.vehicle_idv.toLocaleString('en-IN')}</li>`);
            if (parsed.ncb_percentage > 0) motorDetails.push(`<li><strong>NCB (No Claim Bonus):</strong> ${parsed.ncb_percentage}%</li>`);
            if (parsed.vehicle_registration_no) motorDetails.push(`<li><strong>Vehicle Registration No:</strong> ${parsed.vehicle_registration_no}</li>`);
            if (parsed.vehicle_make_model) motorDetails.push(`<li><strong>Vehicle:</strong> ${parsed.vehicle_make_model}</li>`);
            if (motorDetails.length > 0) {
              parsed.key_important_details = (parsed.key_important_details || '') + motorDetails.join('');
            }
            // Sub-category: append NCB info
            if (parsed.ncb_percentage > 0) finalSubCat = finalSubCat.replace('Standard Policy', `NCB ${parsed.ncb_percentage}%`);
          }

          if (finalCat === 'Life' && parsed.payment_term) {
              finalSubCat += ` | ${parsed.payment_term}-Pay`;
          }

          console.log(`[v0/AI] ✅ Extraction Success! Customer: ${parsed.customer_name}, Policy: ${parsed.policy_number}`);
          break;

        } catch (aiErr: any) {
          const msg = aiErr.message || '';
          console.error(`[v0/AI] Attempt ${attempt + 1} failed:`, msg.substring(0, 300));
          
          // Wait briefly before falling back to the next model in the OpenRouter chain
          await sleep(2000);
          aiErrLog = aiErr;
          if (attempt === 2) parsed = null;
        }
      }

      if (parsed) {
        return {
          policy_number: parsed.policy_number || `OCR-${Date.now()}`,
          policy_type: `${finalCat} | ${finalSubCat}`,
          coverage_start: parsed.coverage_start || now.toISOString(),
          coverage_end: parsed.coverage_end || nextYear.toISOString(),
          premium_amount: Number(parsed.premium_amount) || 0,
          sum_insured: Number(parsed.sum_insured) || 0,
          vehicle_number: parsed.vehicle_registration_no || null,
          insurer_name: parsed.insurer_name || 'Unknown Insurer',
          customer_name: parsed.customer_name || null,
          customer_email: parsed.customer_email || null,
          customer_mobile: parsed.customer_mobile || null,
          agent_notes: parsed.key_important_details || null,
          additional_fields: {
            ...(parsed.vehicle_idv > 0 ? { idv: parsed.vehicle_idv } : {}),
            ...(parsed.ncb_percentage > 0 ? { ncb_percentage: parsed.ncb_percentage } : {}),
            ...(parsed.vehicle_make_model ? { vehicle_make_model: parsed.vehicle_make_model } : {}),
          },
          is_quotation: !!parsed.is_quotation,
          requires_manual_entry: (!parsed.premium_amount || parsed.premium_amount <= 0)
        };
      }
    }

    console.log('[v0/AI] Total AI Failure. Falling back to Regex engine...');
    return this.regexFallback(text);
  }

  async consensusExtract(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
    console.log('[v0/AI] 🧠 Entering Consensus Mode: Calling dual models for cross-verification...');
    
    // Run two models in parallel
    const [res1, res2] = await Promise.allSettled([
      this.extractStructuredData(text, existingInsurers, existingCustomers),
      this.extractStructuredData(text, existingInsurers, existingCustomers) 
    ]);

    const val1 = res1.status === 'fulfilled' ? res1.value : null;
    const val2 = res2.status === 'fulfilled' ? res2.value : null;

    if (!val1 && !val2) throw new Error('Consensus failed: Both extraction attempts failed.');
    if (!val1) return val2!;
    if (!val2) return val1;

    // Check if they agree on critical fields
    const agreeOnName = val1.customer_name === val2.customer_name;
    const agreeOnPolicy = val1.policy_number === val2.policy_number;

    if (agreeOnName && agreeOnPolicy) {
      console.log('[v0/AI] ✅ Models agree perfectly. Proceeding.');
      return val1;
    }

    console.log('[v0/AI] ⚖️ Models disagree on critical fields. Triggering Arbitration...');
    
    // Arbitration step: Ask a model to resolve the difference
    const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
    if (!openRouterKey) return val1;

    const arbiterPrompt = `
      I have two different extractions from the same insurance document. They disagree.
      Document snippet: ${text.substring(0, 3000)}
      
      Extraction A: ${JSON.stringify(val1)}
      Extraction B: ${JSON.stringify(val2)}
      
      Decide which one is more correct for the "customer_name" and "policy_number". 
      Think step-by-step. Return the final resolved JSON only.
    `;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openRouterKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini", // Use a fast but smart arbiter
          messages: [{ role: "user", content: arbiterPrompt }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const rawArb = data.choices[0].message.content;
        const clean = rawArb.match(/\{[\s\S]*\}/)?.[0];
        if (clean) return JSON.parse(clean);
      }
    } catch (e) {
      console.error('[v0/AI] Arbiter failed, defaulting to Model A');
    }

    return val1;
  }

  private regexFallback(text: string): ExtractionResultInput {
    const now = new Date();
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    console.log('[v0/Regex] Using structural RegEx fallback heuristics...');

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
    // Star Health uses 'Renewal Endorsement No:' label
    // ICICI Lombard uses 'Policy No. : 3005/290071787/03/000'
    // Go Digit uses 'Policy Number D264542155' or standalone D-series number
    const digitPolicyNoMatch = t.match(/\bPolicy\s+No\.?Policy\s+Issue\s+Date\s+([A-Z0-9][A-Z0-9\/\-]{3,40})/i) ||
                               t.match(/\b(D\d{8,12})\s*\/\s*\d{8}/);   // "D266729058 / 16052026"
    const policyNumber =
      grab(/[Rr]enewal\s+[Ee]ndorsement\s+[Nn]o\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{5,50})/i) ??
      (digitPolicyNoMatch?.[1]?.trim() || null) ??
      grab(/[Pp]olicy\s+[Nn]umber\s*([D][0-9]{8,12})/i) ??
      grab(/[Pp]olicy\s*(?:[Nn]o|[Nn]umber)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 \/\-]{5,40})/i) ??
      grab(/[Pp]olicy\s*[Nn]o\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 \/\-]{5,40})/i) ??
      grab(/[Pp]olicy\s+[Nn]umber\s*([A-Z0-9][A-Z0-9\/\-]{4,40})/i) ??
      grab(/[Pp]olicy\s*[Nn]o\.?([A-Z0-9]{8,15})/i) ?? // Tata AIG health concatenated
      grab(/([\d]{10}\s+\d{2}\s+\d{2})/i) ?? // Tata AIG format
      `OCR-${Date.now()}`;

    // ── Insurer ────────────────────────────────────────────────────────────
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

    // ── Policy Type: extract actual plan name ──────────────────────────────
    let policyType = 'General | Standard Cover';
    // Priority 1: Exact policy title from document
    if (/[Tt]wo\s+[Ww]heeler\s+[Vv]ehicles?\s+[Pp]ackage\s+[Pp]olicy/i.test(text)) {
      policyType = 'Motor | Two-Wheeler Package';
    } else if (/[Dd]igit\s+[Tt]wo.?[Ww]heeler/i.test(text) || /[Tt]wo.?[Ww]heeler\s+Insurance/i.test(text)) {
      policyType = 'Motor | Two-Wheeler OD';
    } else if (/[Dd]igit\s+My\s+[Bb]usiness/i.test(text) || /[Bb]harat\s+[Ss]ookshma\s+[Uu]dyam/i.test(text)) {
      policyType = 'Business | Bharat Sookshma Udyam';
    } else if (/\b(?:health|med|optima|assure|medicare|care|tataaig)\b/i.test(insurer) || /\b(?:medicare|health)\b/i.test(text)) {
      // Default to Health if insurer name contains Health keywords
      policyType = 'Health | Standard Cover';
      // Detect from plan name line e.g. "Star Health Assure Insurance Policy"
      const planNameMatch =
        grab(/Star\s+Health\s+(.+?)\s+Insurance\s+Policy/i) ??
        grab(/([A-Za-z][a-zA-Z ]{3,40}?)\s+Insurance\s+Policy/i);
      if (planNameMatch) {
        const words = planNameMatch.trim().split(/\s+/);
        const subCat = words.slice(-Math.min(words.length, 3)).join(' ');
        if (!subCat.toLowerCase().includes('health insurance') && subCat.length < 30) {
          policyType = `Health | ${subCat}`;
        }
      }
    } else {
      // Generic keyword-based detection
      if (/\b(?:motor|vehicle|car|two.?wheeler|commercial vehicle|motorcycle)\b/i.test(text)) policyType = 'Motor | Comprehensive';
      if (/\b(?:term|endowment|ulip|annuity)\b/i.test(text)) policyType = 'Life | Standard Cover';
      if (/\b(?:travel)\b/i.test(text)) policyType = 'Travel | Standard Cover';
      if (/\b(?:fire|burglary|sookshma|udyam|shop|business\s+insurance)\b/i.test(text)) policyType = 'Business | Fire & Burglary';
    }

    // ── Dates: 'Policy Period From X To Y' or 'Period of Insurance: May 20, 2026 to May 19, 2027' ─────
    let coverageStart = now.toISOString();
    let coverageEnd   = nextYear.toISOString();

    // ICICI Lombard format: "May 20, 2026 12:00:00 to Midnight of May 19, 2027"
    const icicDateMatch = t.match(
      /([A-Za-z]+ \d{1,2},\s*\d{4})\s*\d*:?\d*:?\d*\s*to\s*(?:Midnight of\s*)?([A-Za-z]+ \d{1,2},\s*\d{4})/i
    );
    if (icicDateMatch) {
      const s = new Date(icicDateMatch[1]);
      const e = new Date(icicDateMatch[2]);
      if (!isNaN(s.getTime())) coverageStart = s.toISOString();
      if (!isNaN(e.getTime())) coverageEnd = e.toISOString();
    }

    const periodMatch = !icicDateMatch ? t.match(
      /[Pp]olicy\s*[Pp]eriod[^\n]*?(?:From|from)[\s\S]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})[\s\S]*?(?:To|to)[\s\S]*?(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i
    ) : null;
    if (periodMatch) {
      const s = parseDMY(periodMatch[1]);
      const e = parseDMY(periodMatch[2]);
      if (s) coverageStart = s.toISOString();
      if (e) coverageEnd   = e.toISOString();
    } else {
      // Try 'renewed for a further period of DD-MM-YYYY to DD-MM-YYYY'
      const m2 = t.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\s*(?:to|To)\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i);
      if (m2) {
        const s = parseDMY(m2[1]);
        const e = parseDMY(m2[2]);
        if (s) coverageStart = s.toISOString();
        if (e) coverageEnd   = e.toISOString();
      }
    }

    // ── Premium: handles 'Rs. 28,955/-', 'Final Premium` 22254', 'Total Premium Payable In `1,615.00' ─
    let premium = 0;
    const totalPayable = grab(/[Tt]otal\s+[Pp]remium\s+[Pp]ayable\s+[Ii]n\s*`?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const finalPrem    = grab(/[Ff]inal\s+[Pp]remium`?\s+`?([\d,]+(?:\.\d{1,2})?)/i) ??
                         grab(/[Ff]inal\s+[Pp]remium[^\d]{0,10}([\d,]{4,}(?:\.\d{1,2})?)/i);
    const modalPrem    = grab(/[Mm]odal\s+[Pp]remium[^\d]{1,15}([\d,]+(?:\.\d{1,2})?)/i); // Tata AIG Health
    const nivaPrem     = text.match(/[Gg]ross\s+[Pp]remium[\s\S]{1,50}?([\d,]{4,}(?:\.\d{1,2})?)/i)?.[1]; // Niva Bupa Health
    const rsPremSlash  = grab(/[Rr]s\.\s*([\d,]+(?:\.\d{1,2})?)\/[-–]?/i);    // Rs. 28,955/-
    const rsPrem       = grab(/paid\s*Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const netPrem      = grab(/[Nn]et\s+[Pp]remium\s*[:\s]+([\d,]+(?:\.\d{1,2})?)/i);
    const grossPrem    = grab(/[Gg]ross\s+[Pp]remium\s*[:\s\(INR\)]*([\d,]+(?:\.\d{1,2})?)/i);
    const totalPrem    = grab(/[Tt]otal\s+[Pp]remium\s*[:\s\(₹\)]*([\d,]+(?:\.\d{1,2})?)/i);
    const grandTotal   = grab(/[Gg]rand\s+[Tt]otal\s*\(Rs\)\s*([\d,]+(?:\.\d{1,2})?)/i); // LIC
    
    // Go Digit-specific: CGST@9% = (`207.15) + SGST@9% = (`207.15) — calculate net+CGST+SGST = total
    let digitTotalPrem: string | null = null;
    const cgstLine = t.match(/CGST\s*@\s*9%\s*=\s*\(?`([\d.]+)\)?\s*\+\s*SGST[^\n]*`([\d.]+)\)?/i);
    if (cgstLine) {
      // Find net premium just before CGST line
      const cgstIdx = t.indexOf(cgstLine[0]);
      const preContext = t.substring(Math.max(0, cgstIdx - 300), cgstIdx);
      const netMatch = preContext.match(/([\d,]+\.\d{2})\s*\n[\d,]+\.\d{2}\s*\n0\.00\s*\n([\d,]+\.\d{2})\s*\n/);
      if (netMatch) digitTotalPrem = netMatch[2]; // the total in column dump
    }
    
    const rawPrem = totalPayable ?? modalPrem ?? nivaPrem ?? finalPrem ?? digitTotalPrem ?? rsPremSlash ?? netPrem ?? grandTotal ?? totalPrem ?? rsPrem ?? grossPrem;
    if (rawPrem) premium = parseFloat(rawPrem.replace(/,/g, ''));
    // Final sanity: reject suspiciously small values that are likely digits from other fields
    if (premium > 0 && premium < 100) premium = 0;


    // ── Customer: Multi-insurer pattern extraction ──────────────────────────
    // Pattern 1: Address block 'To,\nFULL NAME,' - Star Health
    const toBlockMatch = text.match(/\bTo,?\s*\n([A-Z][A-Z ]{3,60}(?:\n[A-Z][A-Z ]{2,60})?),/m);
    const toName = toBlockMatch?.[1]?.replace(/\n/g, ' ').trim();
    // Pattern 2: 'Proposer Name : NAME' - Star Health (may span 2 lines e.g. MUKESH NEWANDRAM\nCHANDWANI)
    const proposerMatch = text.match(/[Pp]roposer\s+[Nn]ame\s*[:\s]+([A-Z][A-Z\s]{3,70})(?=\n[A-Z]|\n[a-z]|$)/m);
    const proposerName = proposerMatch?.[1]?.trim().replace(/\s+/g, ' ');
    // Pattern 3: Star Health - 'Customer Name : NAME'
    const customerNameMatch = grab(/[Cc]ustomer\s+[Nn]ame\s*[:\-]?\s*([A-Z][A-Z ]{3,70})(?=\n|$)/i);
    // Pattern 4: ICICI Lombard - 'Name of the Insured : FULL NAME' (name ends before 'Policy No.' in same row)
    const icicNameRaw = text.match(/[Nn]ame\s+of\s+(?:the\s+)?[Ii]nsured\s*:\s*([A-Z][A-Z ]{3,60}?)(?:Policy\s*No\.|Address|E-Policy|\n)/m);
    const icicName = icicNameRaw?.[1]?.trim().replace(/\s+/g, ' ');
    // Pattern 5: ICICI Lombard - 'Dear FULL NAME,' at top of Risk Assumption Letter
    const icicDearMatch = text.match(/[Dd]ear\s+([A-Z][A-Z ]{5,70}?),\s*\n/m);
    const icicDearName = icicDearMatch?.[1]?.trim();
    // Pattern 6: Dear 'Mr. / Ms.' greeting - generic
    const dearMatch = grab(/[Dd]ear\s+(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+([A-Za-z][A-Za-z ]{2,60}?)(?:\s*,|\n)/i);
    // Pattern 7: Insured Name label - generic
    const insuredMatch = grab(/[Ii]nsured\s+[Nn]ame\s*[:\-]?\s*([A-Z][a-zA-Z ]{2,60}?)(?:\n|,|$)/i);
    // Pattern 8: Policy Holder label - generic
    const holderMatch = grab(/[Pp]olicy\s+[Hh]older\s*[:\-]?\s*([A-Z][a-zA-Z ]{2,60}?)(?:\n|,|$)/i);
    // Pattern 9: Go Digit - 'Name\nFULL NAME' in insured details block
    const digitNameMatch = text.match(/\bName\s*\n([A-Z][A-Z ]{3,60})\n/m);
    const digitName = digitNameMatch?.[1]?.trim();
    // Pattern 10: Go Digit Business - extract owner name after 'PROP' keyword (e.g. 'SHOP NAME PROP OWNER NAME')
    const propOwnerMatch = text.match(/\bPROP\s+([A-Z][A-Z ]{3,50})(?=\n|\r|$)/m);
    const propOwnerName = propOwnerMatch?.[1]?.trim();
    // Pattern 11: Care Health / HDFC - 'Mr/Ms/Mrs FULL NAME' on its own line
    const mrNameMatch = text.match(/^(?:Mr|Ms|Mrs)\.?\s+([A-Za-z][A-Za-z ]{4,60})$/m);
    const mrName = mrNameMatch?.[1]?.trim();
    // Pattern 12: Niva Bupa - 'Customer ID: 123456\nMR. FULL NAME' or 'Policyholder Name: MR. FULL NAME'
    const nivaMatch = text.match(/[Cc]ustomer\s+[Ii]D\s*[:\-]?\s*\d+\s*\n(?:MR\.|MRS\.|MS\.)?\s*([^\n\r]{3,60}?)\n/i)?.[1]?.trim() ??
                      grab(/[Pp]olicyholder\s+[Nn]ame\s*[:\-]?\s*(?:MR\.|MRS\.|MS\.)?\s*([A-Za-z][A-Za-z ]{3,60}?)(?:\n|$)/i);
    // Pattern 13: Tata AIG - 'Name\nMr FULL NAME' or 'Policyholder NameAMIT PRAKASHLAL CHAWLA'
    const tataMatch = text.match(/\bName\n(?:Mr|Mrs|Ms)\s+([A-Za-z][A-Za-z ]{3,60})/m)?.[1]?.trim() ??
                      grab(/[Pp]olicyholder\s+[Nn]ame\s*([A-Z][A-Z ]{3,60}?)(?:\n|$)/i);
    const tataName = tataMatch;
    // Pattern 14: LIC Receipt - 'policyholder Shri/Smt. FULL NAME towards'
    const licMatch = grab(/policyholder\s+Shri\/Smt\.\s+([A-Za-z][A-Za-z ]{3,60}?)\s+towards/i);

    const sanitizeName = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const n = raw.trim().replace(/\s+/g, ' ');
      const bad = ['code', 'name', 'insured', 'details', 'nominee', 'gender', 'unknown', 'dear customer', 'customer',
                   'insured policy details', 'policy details', 'vehicle details', 'your vehicle', 'your policy'];
      if (n.length < 3 || bad.some(b => n.toLowerCase() === b || n.toLowerCase().startsWith(b + ' '))) return null;
      // Reject if it looks like an address or company code
      if (/^\d/.test(n) || n.split(' ').length > 6) return null;
      return n;
    };
    
    const customer = 
      sanitizeName(toName) ??
      sanitizeName(proposerName) ??
      sanitizeName(customerNameMatch) ??
      sanitizeName(nivaMatch) ??
      sanitizeName(icicName) ??
      sanitizeName(icicDearName) ??
      sanitizeName(propOwnerName) ??
      sanitizeName(licMatch) ??
      sanitizeName(tataName) ??
      sanitizeName(dearMatch) ??
      sanitizeName(insuredMatch) ??
      sanitizeName(holderMatch) ??
      sanitizeName(digitName) ??
      sanitizeName(mrName) ??
      null;

    // ── Motor-specific: IDV, NCB, Vehicle Reg ─────────────────────────────
    let idv = 0;
    let ncb = 0;
    let vehicleReg: string | null = null;

    let tataIdv = 0;
    const tataIdvMatch = t.match(/[Tt]otal\s+IDV\s*([\d]{6,})/i);
    if (tataIdvMatch) {
        const idvStr = tataIdvMatch[1];
        // Tata AIG IDVs are often concatenated like 174160007416000000741600
        // the actual IDV is usually the last 6-7 digits. We can fallback to extracting the first reasonable 6-7 digit block.
        const possibleIdv = idvStr.match(/(\d{5,7})$/);
        if(possibleIdv) tataIdv = parseFloat(possibleIdv[1]);
    }

    const idvRaw = grab(/[Tt]otal\s+IDV\s*\(`?\)\s*([\d,]+(?:\.\d{1,2})?)/i) ??
                   grab(/[Vv]ehicle\s+IDV\s*\(`?\)\s*([\d,]+(?:\.\d{1,2})?)/i) ??
                   grab(/IDV\s*[:\(]\s*`?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (idvRaw) idv = parseFloat(idvRaw.replace(/,/g, ''));
    if (idv === 0 && tataIdv > 0) idv = tataIdv;

    const ncbRaw = grab(/[Nn]o\s+[Cc]laim\s+[Bb]onus\s+(\d+)%/i) ??
                   grab(/NCB\s*%?\s*\(?[Cc]urrent\s+[Pp]olicy\)?\s*[:\s]*(\d+)/i) ??
                   grab(/NCB\s+(\d+)%/i) ??
                   grab(/[Cc]urrent\s+[Yy]ear\s+NCB\(?%?\)?\s*(\d+)/i);
    if (ncbRaw) ncb = parseFloat(ncbRaw);

    const vehicleRegMatch = t.match(/[Vv]ehicle\s+[Rr]egistration\s*[Nn]o\.?\s*([A-Z]{2}\d{2}[A-Z]{0,3}\d{1,4})/i);
    vehicleReg = vehicleRegMatch?.[1]?.trim() ?? null;
    // Also try plain reg pattern after motor keywords
    if (!vehicleReg) {
      const regInline = t.match(/([A-Z]{2}\d{2}[A-Z]{1,3}\d{4})\s+(?:HONDA|BAJAJ|HERO|YAMAHA|TVS|SUZUKI|ROYAL)/i);
      vehicleReg = regInline?.[1]?.trim() ?? null;
    }

    // Enrich motor notes
    let motorNotes = '';
    if (policyType.includes('Motor')) {
      if (idv > 0) motorNotes += `<li><strong>IDV:</strong> ₹${idv.toLocaleString('en-IN')}</li>`;
      if (ncb > 0) motorNotes += `<li><strong>NCB:</strong> ${ncb}%</li>`;
      if (vehicleReg) motorNotes += `<li><strong>Vehicle Reg No:</strong> ${vehicleReg}</li>`;
    }

    const result: ExtractionResultInput = {
      policy_number:  policyNumber,
      policy_type:    policyType.trim(),
      coverage_start: coverageStart,
      coverage_end:   coverageEnd,
      premium_amount: premium,
      sum_insured:    idv > 0 ? idv : undefined,  // Use IDV as sum_insured for motor
      vehicle_number: vehicleReg ?? undefined,
      insurer_name:   insurer.trim(),
      customer_name:  customer?.trim() ?? undefined,
      agent_notes:    motorNotes || undefined,
      additional_fields: {
        ...(idv > 0 ? { idv } : {}),
        ...(ncb > 0 ? { ncb_percentage: ncb } : {}),
      },
      is_quotation:   (!/Renewal Premium Receipt/i.test(text) && /\b(?:quote|quotation|illustration|proposal|premium calculation|renewal notice|renewing your policy|renewal letter)\b/i.test(text) && premium <= 0),
      requires_manual_entry: premium <= 0,
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

  async extractStructuredData(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
     // Regex data heuristics works beautifully on top of GCP text.
     const fallbackEngine = new PDFParseProvider();
     return fallbackEngine.extractStructuredData(text, existingInsurers, existingCustomers);
  }

  async consensusExtract(text: string, existingInsurers: string[] = [], existingCustomers: string[] = []): Promise<ExtractionResultInput> {
     const fallbackEngine = new PDFParseProvider();
     return fallbackEngine.consensusExtract(text, existingInsurers, existingCustomers);
  }
}

const providerType = process.env.OCR_PROVIDER || 'google-document-ai';
export const ocrProvider = providerType === 'google-document-ai' 
  ? new GoogleDocumentAIProvider() 
  : new PDFParseProvider();

