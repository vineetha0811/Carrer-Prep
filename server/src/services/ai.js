// AI service layer - supports both live LLM (OpenRouter/OpenAI-compatible) and offline mode
// In offline mode (no API key), the app uses the built-in structured question bank
// and heuristic evaluation engines, so every feature remains fully functional.

let cachedConfig = null;

export function getAIConfig() {
  if (cachedConfig) return cachedConfig;
  cachedConfig = {
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.AI_MODEL || 'openai/gpt-4o-mini',
  };
  return cachedConfig;
}

export function aiEnabled() {
  return Boolean(getAIConfig().apiKey);
}

// Validate JSON output robustly
export function parseJSON(text) {
  if (!text) return null;
  const t = text.trim();
  try {
    return JSON.parse(t);
  } catch (err) {
    // Try to extract a JSON block fenced with ```json
    const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1].trim());
      } catch (err2) { /* fallthrough */ }
    }
    // Try first { ... last }
    const s = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (s >= 0 && end > s) {
      try {
        return JSON.parse(t.slice(s, end + 1));
      } catch (err3) { /* fallthrough */ }
    }
    // Try first [ ... last ]
    const bs = t.indexOf('[');
    const be = t.lastIndexOf(']');
    if (bs >= 0 && be > bs) {
      try {
        return JSON.parse(t.slice(bs, be + 1));
      } catch (err4) { /* fallthrough */ }
    }
    return null;
  }
}

const MAX_RETRIES = 2;

// Simple chat completion call. Returns parsed JSON when the model promises JSON.
export async function callAI({ system, user, json = true, temperature = 0.7, maxTokens = 3000 }) {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error('AI configured, but no api key provided.');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);

      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ];

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          // 'HTTP-Referer' and 'X-Title' help OpenRouter display the app - optional
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          response_format: json ? { type: 'json_object' } : undefined,
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = new Error(`AI API error ${res.status}: ${errText.slice(0, 300)}`);
        throw lastError;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      if (json) {
        const parsed = parseJSON(content);
        if (parsed === null) {
          lastError = new Error('AI returned non-JSON content');
          throw lastError;
        }
        return parsed;
      }
      return content;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        lastError = new Error('AI request timed out');
        break; // timeout - don't retry
      }
      // brief backoff for transient errors
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

// Ask a freeform question and return text
export async function askAI({ system, user, temperature = 0.7, maxTokens = 2000 }) {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error('AI not configured');
  }
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    throw new Error(`AI API error ${res.status}`);
  }
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content || '').trim();
}

// Simple word-based approximation for token counting (used for roadmap display etc.)
export function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}