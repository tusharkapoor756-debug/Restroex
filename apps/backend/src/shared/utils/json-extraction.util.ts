import { logger } from '../../infrastructure/logger/logger';

/**
 * Extracts a JSON payload from a raw LLM response.
 * Handles markdown code fences and extraneous text before/after the JSON.
 *
 * @param rawContent The raw text from the LLM
 * @returns The parsed JSON object, or null if parsing fails
 */
export function extractJsonFromLlmResponse<T = unknown>(rawContent: string): T | null {
  if (!rawContent || rawContent.trim() === '') {
    return null;
  }

  let jsonStr = rawContent.trim();

  // Try to find content within markdown code fences
  // This regex matches optionally ```json (or just ```), then non-greedily captures content until ```
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim();
  } else {
    // Fallback: try to find the first '{' or '[' and the last '}' or ']'
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    
    let startIndex = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIndex = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
      startIndex = firstBrace;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
    }

    if (startIndex !== -1) {
      const isObject = jsonStr[startIndex] === '{';
      const lastIndex = jsonStr.lastIndexOf(isObject ? '}' : ']');
      
      if (lastIndex !== -1 && lastIndex > startIndex) {
        jsonStr = jsonStr.substring(startIndex, lastIndex + 1);
      }
    }
  }

  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    logger.error({ err, rawContent, attemptedParseString: jsonStr }, 'Failed to parse JSON from LLM response');
    return null;
  }
}
