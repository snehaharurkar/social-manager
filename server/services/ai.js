const { getSetting } = require('../db');

/**
 * AI Response & Rephrasing Service
 * Uses Google Gemini API (free tier) or OpenAI/Groq compatible endpoints
 */

async function polishReplyWithAi(baseTemplate, incomingComment, customPrompt = '') {
  const geminiKey = getSetting('GEMINI_API_KEY');
  const openAiKey = getSetting('OPENAI_API_KEY');
  const aiBaseUrl = getSetting('AI_BASE_URL') || 'https://api.openai.com/v1';
  const aiModel = getSetting('AI_MODEL') || 'gpt-4o-mini';

  // 1. Try Gemini first if key is present
  if (geminiKey) {
    try {
      const systemInstruction = customPrompt
        ? `Tone instruction: ${customPrompt}`
        : 'Tone: Warm, conversational, human, and authentic.';

      const prompt = `You are an AI assistant managing comments for a creator.
${systemInstruction}
The viewer commented: "${incomingComment}"
The base response message to deliver is: "${baseTemplate}"

Task: Rephrase this response naturally in response to their comment. Keep any links or important specifics intact. Return ONLY the final reply text to be sent directly to the user, with no quotation marks or meta commentary.`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 250
          }
        })
      });

      const data = await res.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText && candidateText.trim()) {
        return candidateText.trim();
      }
    } catch (err) {
      console.error('[AI] Gemini rephrasing error:', err.message);
    }
  }

  // 2. Try OpenAI / Groq compatible endpoint if key is present
  if (openAiKey) {
    try {
      const res = await fetch(`${aiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            {
              role: 'system',
              content: `You are an AI assistant helping a creator reply to comments. ${customPrompt || 'Keep it friendly, human, and concise.'} Output only the exact reply text.`
            },
            {
              role: 'user',
              content: `User comment: "${incomingComment}"\nTemplate to send: "${baseTemplate}"`
            }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && content.trim()) {
        return content.trim();
      }
    } catch (err) {
      console.error('[AI] OpenAI/Groq rephrasing error:', err.message);
    }
  }

  // Fallback: return base template unchanged if no AI key or if API call fails
  return baseTemplate;
}

module.exports = {
  polishReplyWithAi
};
