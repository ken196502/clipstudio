import { config } from "dotenv"
import { z } from "zod"

config()

const LLM_CONFIG = {
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
}

// Validate required config
if (!LLM_CONFIG.apiKey) {
  console.warn("OPENAI_API_KEY is not set. LLM calls will fail.")
}

/**
 * Schema for LLM response with structured JSON output
 */
const LLMResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.any()).optional(),
  error: z.string().optional(),
})

type LLMResponse<T = Record<string, any>> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Generic LLM call function that returns parsed JSON
 * @param messages Array of messages to send to the LLM
 * @param systemPrompt Optional system prompt to set context
 * @param responseSchema Optional Zod schema to validate and parse response
 * @returns Parsed JSON response or error
 */
export async function callLLM<T = Record<string, any>>(
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  systemPrompt?: string,
  responseSchema?: z.ZodType<T>
): Promise<LLMResponse<T>> {
  try {
    if (!LLM_CONFIG.apiKey) {
      return { success: false, error: "OPENAI_API_KEY is not configured" }
    }

    const body: any = {
      model: LLM_CONFIG.model,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...messages,
      ],
      response_format: { type: "json_object" },
    }

    const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_CONFIG.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `API error: ${response.statusText}`,
      }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { success: false, error: "No content in response" }
    }

    let parsedData: T | Record<string, any>
    try {
      parsedData = JSON.parse(content)
    } catch (e) {
      return { success: false, error: "Failed to parse JSON response" }
    }

    // Validate against schema if provided
    if (responseSchema) {
      const validation = responseSchema.safeParse(parsedData)
      if (!validation.success) {
        return {
          success: false,
          error: `Validation failed: ${validation.error.message}`,
        }
      }
      parsedData = validation.data
    }

    return { success: true, data: parsedData }
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown error" }
  }
}

/**
 * Helper function to call LLM with a simple prompt
 */
export async function callLLMSimple<T = Record<string, any>>(
  userMessage: string,
  systemPrompt?: string,
  responseSchema?: z.ZodType<T>
): Promise<LLMResponse<T>> {
  return callLLM(
    [{ role: "user", content: userMessage }],
    systemPrompt,
    responseSchema
  )
}
