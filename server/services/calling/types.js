const { getSetting } = require('../../db');

// Normalized calling statuses supported across all providers
const NormalizedCallStatus = {
  QUEUED: 'queued',
  INITIATING: 'initiating',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  NO_ANSWER: 'no_answer',
  BUSY: 'busy',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Build unified business context and prompt variables from database settings.
 * Ensures identical business knowledge, pricing, and guidelines across Vapi, Retell, and OmniDimension.
 */
function buildUnifiedBusinessContext(lead, customScript = null) {
  const companyName = getSetting('CALLING_COMPANY_NAME') || 'Sneharmony Music & Creator Academy';
  const callerName = getSetting('CALLING_AGENT_NAME') || 'Aria';
  const businessDesc = getSetting('CALLING_BUSINESS_DESCRIPTION') || '';
  const productDetails = getSetting('CALLING_PRODUCT_DETAILS') || '';
  const pricing = getSetting('CALLING_PRICING') || '';
  const offers = getSetting('CALLING_OFFERS') || '';
  const eligibility = getSetting('CALLING_ELIGIBILITY') || '';
  const faqs = getSetting('CALLING_FAQS') || '';
  const salesObjectives = getSetting('CALLING_SALES_OBJECTIVES') || '';
  const qualQuestions = getSetting('CALLING_QUALIFICATION_QUESTIONS') || '';
  const objections = getSetting('CALLING_OBJECTION_HANDLING') || '';
  const handoff = getSetting('CALLING_HUMAN_HANDOFF_CONTACT') || '';
  const closingMsg = getSetting('CALLING_CLOSING_MESSAGE') || '';

  const rawScript = customScript || getSetting('CALLING_DEFAULT_SCRIPT') || `Hello {name}! This is {agent_name} calling on behalf of {company_name}.`;

  const leadName = lead.name || 'there';
  const leadInterest = lead.interest || 'our programs';

  const greeting = rawScript
    .replace(/\{name\}/gi, leadName)
    .replace(/\{company_name\}/gi, companyName)
    .replace(/\{agent_name\}/gi, callerName)
    .replace(/\{interest\}/gi, leadInterest);

  const closing = closingMsg
    .replace(/\{name\}/gi, leadName)
    .replace(/\{company_name\}/gi, companyName);

  const systemPrompt = `You are ${callerName}, a professional, friendly, and honest outbound AI telecaller calling on behalf of ${companyName}.

BUSINESS OVERVIEW:
${businessDesc}

PRODUCTS / SERVICES / COURSES:
${productDetails}

PRICING & PACKAGES:
${pricing}

OFFERS & PROMOTIONS:
${offers}

TARGET AUDIENCE:
${eligibility}

FREQUENTLY ASKED QUESTIONS:
${faqs}

CALL OBJECTIVES:
${salesObjectives}

QUALIFICATION QUESTIONS:
${qualQuestions}

OBJECTION PROTOCOLS:
${objections}

HUMAN ADVISOR CONTACT:
${handoff}

CLOSING:
${closing}

CORE RULES:
1. Honestly introduce yourself as an AI assistant representing ${companyName}.
2. Check if now is a good time for a quick 2 minutes. If busy, driving, or in a meeting, schedule a callback.
3. Keep turns concise and conversational (1-2 sentences per response). Do not monologue.
4. Listen carefully and never interrupt the customer.
5. Never invent prices or discounts not listed above.
6. If the customer is not interested or asks not to be called, respect immediately, thank them, and end.
7. Lead Context: Name: ${leadName}, Interest: ${leadInterest}, Notes: ${lead.notes || 'None'}`;

  const dynamicVariables = {
    customer_name: leadName,
    lead_name: leadName,
    company_name: companyName,
    agent_name: callerName,
    interest: leadInterest,
    phone_number: lead.phone_number,
    notes: lead.notes || '',
    greeting: greeting,
    closing: closing
  };

  return {
    companyName,
    callerName,
    greeting,
    closing,
    systemPrompt,
    dynamicVariables
  };
}

module.exports = {
  NormalizedCallStatus,
  buildUnifiedBusinessContext
};
