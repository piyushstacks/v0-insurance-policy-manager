/**
 * Configuration & Prompt Templates for 2-Stage AI Extraction Pipeline
 */

export interface FieldExtractionRule {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  labels: string[]; // Synonyms/labels to search for
  description: string;
}

export const SYNONYM_DICTIONARY: Record<string, string[]> = {
  policy_number: ['Policy No', 'Certificate No', 'Policy ID', 'Policy Number', 'Certificate Number'],
  sum_assured: ['Basic SA', 'Sum Assured', 'Base Cover', 'Basic Sum Assured'],
  sum_insured: ['SI', 'Base SI', 'Coverage Amount', 'Sum Insured', 'Limit of Indemnity'],
  premium: ['Gross Premium', 'Modal Premium', 'Annual Premium', 'Total Premium', 'Premium Amount', 'Premium Payable'],
  nominee: ['Nominee Name', 'Nominee', 'Beneficiary', 'Nominee Details'],
  policy_start: ['Commencement Date', 'Risk Start Date', 'From', 'Policy Start Date', 'Risk Commencement Date'],
  policy_end: ['Expiry Date', 'To', 'Policy End', 'Policy End Date', 'Expiry'],
  vehicle_number: ['Registration No', 'Reg No', 'Vehicle No', 'Registration Number', 'Vehicle Number'],
  idv: ['Insured Declared Value', 'Vehicle IDV', 'IDV'],
  ncb: ['No Claim Bonus', 'Bonus %', 'NCB', 'NCB %'],
  customer_id: ['Client ID', 'Customer Number', 'Member ID', 'Customer ID', 'Insured Code'],
};

export const DOCUMENT_CLASSES = [
  'Life Policy',
  'Health Policy',
  'Motor Policy',
  'Business Policy',
  'Renewal Notice',
  'Premium Receipt',
  'Quote',
  'Invoice',
  'Health Card',
  'Claim Form'
];

export const VALID_COMPANIES = [
  'LIC', 'Tata AIA', 'HDFC Life', 'ICICI Prudential Life', 'SBI Life', 'Max Life', 'Bajaj Allianz Life', 'Aditya Birla Sun Life', 'Kotak Life', 'PNB MetLife', 'Canara HSBC Life', 'Axis Max Life',
  'Star Health', 'Care Health', 'Niva Bupa', 'HDFC ERGO', 'Tata AIG', 'ICICI Lombard', 'New India Assurance', 'Digit', 'Reliance', 'ManipalCigna', 'Aditya Birla Health',
  'Bajaj Allianz', 'Oriental', 'United India', 'National Insurance'
];

export const COMPANY_PROFILES: Record<string, string[]> = {
  'LIC': ['Plan', 'Term', 'DOC', 'Maturity', 'Sum Assured', 'Premium', 'Mode', 'Bonus', 'Loan', 'Nominee'],
  'Tata AIA': ['Basic Sum Assured', 'Policy Number', 'Nominee', 'Life Assured', 'Premium', 'Risk Commencement', 'Premium Paying Term', 'Policy Term', 'Fund Allocation', 'Fund Value', 'NAV', 'Units', 'Riders'],
  'Star Health': ['Proposer', 'Insured Persons', 'Bonus', 'PED', 'Waiting Period', 'Plan', 'Policy Number', 'TPA', 'Premium'],
  'Care Health': ['Bonus', 'Inflation Shield', 'Members', 'PED', 'Policy Since', 'Claim History', 'Premium'],
  'Niva Bupa': ['Safeguard', 'Booster', 'ReAssure', 'Cash Bag', 'Members', 'Base SI', 'Premium', 'Nominee'],
  'HDFC ERGO': ['Insured Members', 'Sum Insured', 'Room Rent', 'Co-pay', 'Policy Period', 'Product', 'Customer ID', 'Bonus', 'Restore', 'Waiting Period'],
  'ICICI Lombard': ['Vehicle Number', 'Engine', 'Chassis', 'IDV', 'NCB', 'Previous Policy', 'PA Cover', 'Zero Dep', 'RSA', 'Premium'],
  'Tata AIG': ['Vehicle', 'Make', 'Model', 'IDV', 'Addons', 'Policy Period', 'NCB', 'Engine', 'Chassis', 'Owner'],
  'Digit': ['IDV', 'Partner', 'Policy', 'Vehicle', 'Addons', 'Consumables', 'RSA', 'EV Shield', 'Zero Dep']
};

export const METADATA_DETECTION_PROMPT = `
Analyze the first few pages of this document to classify it, detect the insurer, and identify the policy category.

1. Classify the document. Possible types:
${DOCUMENT_CLASSES.map(c => `- ${c}`).join('\n')}

2. Identify the insurance provider company. Possible companies:
${VALID_COMPANIES.map(c => `- ${c}`).join('\n')}

3. Identify the policy category. Possible values: "Life", "Health", "Motor", "Commercial"

Return a JSON object with keys:
"document_type": string (one of the document types listed above)
"is_policy": boolean (true ONLY if it is Life Policy, Health Policy, Motor Policy, or Business Policy)
"company": string (exact match from the company list above, or "Other" if not listed)
"policy_type": string (exactly one of the policy categories listed above)
"reason": string (short reason for classification)
`;

export const CLASSIFICATION_PROMPT = `
Classify this document based on the text contents.
Possible types:
${DOCUMENT_CLASSES.map(c => `- ${c}`).join('\n')}

Analyze carefully and return a JSON object with keys:
"document_type": string (one of the above types)
"is_policy": boolean (true ONLY if it is Life Policy, Health Policy, Motor Policy, or Business Policy)
"reason": string (short reason for classification)
`;

export const COMPANY_DETECTION_PROMPT = `
Look at this document text and identify the insurance provider company.
Possible companies:
${VALID_COMPANIES.map(c => `- ${c}`).join('\n')}

Return a JSON object with keys:
"company": string (exact match from the list above, or "Other" if not listed)
"confidence": number (0-100)
`;

export const POLICY_TYPE_DETECTION_PROMPT = `
Look at the document text and identify the policy category.
Possible values: "Life", "Health", "Motor", "Commercial"

Return a JSON object with keys:
"policy_type": string (exactly one of the above)
"confidence": number (0-100)
`;

export function getExtractionPrompt(company: string, policyType: string): string {
  const profileKeywords = COMPANY_PROFILES[company] || [];
  
  let typeSpecificSchema = '';
  if (policyType === 'life') {
    typeSpecificSchema = `
  "life": {
    "plan_name": string,
    "sum_assured": number,
    "premium_paying_term": number,
    "policy_term": number,
    "risk_commencement_date": string,
    "maturity_date": string,
    "riders": array,
    "nominees": array
  },`;
  } else if (policyType === 'health') {
    typeSpecificSchema = `
  "health": {
    "plan": string,
    "policy_type": "individual" | "floater" | "group",
    "base_sum_insured": number,
    "total_sum_insured": number,
    "room_rent_limit": number,
    "icu_limit": number,
    "deductible": number,
    "members": array
  },`;
  } else if (policyType === 'motor') {
    typeSpecificSchema = `
  "motor": {
    "registration_number": string,
    "engine_number": string,
    "chassis_number": string,
    "make": string,
    "model": string,
    "variant": string,
    "fuel_type": string,
    "idv": number,
    "current_ncb_percent": number
  },`;
  } else if (policyType === 'commercial') {
    typeSpecificSchema = `
  "commercial": {
    "business_name": string,
    "proprietor": string,
    "business_gst": string,
    "business_address": string,
    "sum_insured_building": number,
    "sum_insured_stock": number
  },`;
  }

  return `
Extract structured data from the document text based on the detected Company (${company}) and Policy Type (${policyType}).
Follow these field-level rules and map synonyms to output fields.

Return ONLY the extracted values. Do not wrap fields in an object. If a field is missing, return null.
At the very end of the JSON object, include an "overall_confidence" field (0-100) representing how confident you are in the extraction overall.

SYNONYMS DICTIONARY FOR MAPPING:
${JSON.stringify(SYNONYM_DICTIONARY, null, 2)}

COMPANY-SPECIFIC PROFILE KEYWORDS TO SEARCH FOR:
${profileKeywords.join(', ')}

OUTPUT FORMAT SPECIFICATION:
Respond ONLY with a valid JSON object matching this schema structure:
{
  "reasoning": string,
  "policy_number": string,
  "product_name": string,
  "premium_amount": number,
  "sum_insured": number,
  "customer_name": string,
  "customer_mobile": string,
  "customer_email": string,
  "customer_dob": string,
  "customer_gender": string,
  "customer_pan": string,
  "customer_aadhaar": string,
  "policy_start_date": string,
  "policy_end_date": string,
  "payment_mode": string,
  "nominee_name": string,
  "nominee_relationship": string,
  ${typeSpecificSchema}
  "overall_confidence": number
}
`;
}
