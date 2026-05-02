/**
 * LLM Service using RESTful API calls
 * Replaces OpenAI SDK with direct HTTP requests
 */

const LLM_CONFIG = {
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

// Validate required config
if (!LLM_CONFIG.apiKey) {
  console.warn('OPENAI_API_KEY is not set. LLM calls will fail.');
}

export interface ClipAnalysis {
  title: string;
  summary: string;
  keywords: string[];
  topic_category: 'opinion' | 'analysis' | 'tutorial' | 'story' | 'other';
}

/**
 * Make a RESTful API call to the LLM endpoint
 */
async function callLLM(messages: Array<{ role: string; content: string }>): Promise<any> {
  const response = await fetch(`${LLM_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Analyze a clip segment using LLM
 * @param text The subtitle text of the clip
 * @param videoTitle The title of the source video
 * @param kolName The name of the KOL
 * @returns Analysis result with title, summary, keywords, and category
 */
export async function analyzeClip(
  text: string,
  videoTitle: string,
  kolName: string
): Promise<ClipAnalysis> {
  try {
    if (!LLM_CONFIG.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are a video content analysis expert. Your task is to analyze short video clips (30-90 seconds) and generate:
1. A concise title (max 10 words)
2. A brief summary (max 50 words)
3. 3-5 relevant keywords
4. A topic category: opinion, analysis, tutorial, story, or other

Respond in JSON format with this structure:
{
  "title": "string",
  "summary": "string",
  "keywords": ["string"],
  "topic_category": "opinion|analysis|tutorial|story|other"
}`;

    const userPrompt = `Analyze this video clip:

Source Video: ${videoTitle}
KOL: ${kolName}
Content: ${text}

Provide the analysis in the specified JSON format.`;

    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    const parsed = JSON.parse(content);

    // Validate and return the result
    return {
      title: parsed.title || 'Untitled',
      summary: parsed.summary || '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      topic_category: ['opinion', 'analysis', 'tutorial', 'story', 'other'].includes(parsed.topic_category)
        ? parsed.topic_category
        : 'other',
    };
  } catch (error) {
    console.error('Error analyzing clip:', error);
    throw new Error(`Failed to analyze clip: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Batch analyze multiple clips with concurrency control
 * @param clips Array of clips to analyze
 * @param concurrency Maximum number of concurrent requests
 * @returns Array of analysis results
 */
export async function batchAnalyzeClips(
  clips: Array<{ text: string; videoTitle: string; kolName: string }>,
  concurrency: number = 5
): Promise<ClipAnalysis[]> {
  const results: ClipAnalysis[] = [];
  const chunks: typeof clips = [];

  // Split into chunks based on concurrency
  for (let i = 0; i < clips.length; i += concurrency) {
    chunks.push(clips.slice(i, i + concurrency));
  }

  // Process chunks sequentially, but clips within each chunk in parallel
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(clip => analyzeClip(clip.text, clip.videoTitle, clip.kolName))
    );
    results.push(...chunkResults);
  }

  return results;
}
