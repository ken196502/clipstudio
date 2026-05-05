/**
 * LLM Service using RESTful API calls
 * Replaces OpenAI SDK with direct HTTP requests
 */

function llmEnv() {
  return {
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: (process.env.OPENAI_API_KEY || '').trim(),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

export interface ClipAnalysis {
  title: string;
  summary: string;
  keywords: string[];
  topic_category: 'opinion' | 'analysis' | 'tutorial' | 'story' | 'other';
}

const TOPIC_SET = new Set(['opinion', 'analysis', 'tutorial', 'story', 'other']);

function extractAssistantText(response: any): string {
  const msg = response?.choices?.[0]?.message;
  const content = msg?.content;
  if (typeof content === 'string' && content.trim()) return content;

  // Some providers return text in non-standard fields.
  const reasoning = msg?.reasoning;
  if (typeof reasoning === 'string' && reasoning.trim()) return reasoning;

  const details = msg?.reasoning_details;
  if (Array.isArray(details)) {
    const joined = details
      .map((d: any) => (typeof d?.text === 'string' ? d.text : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (joined) return joined;
  }

  return '';
}

function parseJsonObject(content: string): unknown {
  let s = content.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/m, '');
  }
  try {
    return JSON.parse(s);
  } catch {
    // try to salvage the first JSON object if the model returned extra text
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw new Error('Failed to parse JSON from LLM response');
  }
}

function normalizeAnalysis(raw: unknown): ClipAnalysis {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid analysis shape');
  }
  const o = raw as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  const summary = typeof o.summary === 'string' ? o.summary.trim() : '';
  const kw = o.keywords;
  let keywords: string[] = [];
  if (Array.isArray(kw)) {
    keywords = kw.filter((k): k is string => typeof k === 'string').map((k) => k.trim()).filter(Boolean);
  }
  let topic = typeof o.topic_category === 'string' ? o.topic_category.trim().toLowerCase() : 'other';
  if (!TOPIC_SET.has(topic)) {
    topic = 'other';
  }
  if (!title) {
    throw new Error('Empty title from model');
  }
  return {
    title: title.slice(0, 120),
    summary: summary.slice(0, 400) || title,
    keywords: keywords.length ? keywords.slice(0, 8) : ['素材'],
    topic_category: topic as ClipAnalysis['topic_category'],
  };
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Make a RESTful API call to the LLM endpoint
 */
async function callLLM(
  messages: Array<{ role: string; content: string }>,
  opts?: { responseFormat?: boolean }
): Promise<any> {
  const cfg = llmEnv();
  const useResponseFormat = opts?.responseFormat !== false;
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      ...(useResponseFormat ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0.35,
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
 * @param startSec Segment start (seconds)
 * @param endSec Segment end (seconds)
 * @returns Analysis result with title, summary, keywords, and category
 */
export async function analyzeClip(
  text: string,
  videoTitle: string,
  kolName: string,
  startSec: number,
  endSec: number
): Promise<ClipAnalysis> {
  const timeRange = `${formatTime(startSec)}–${formatTime(endSec)}`;
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 400);
  const fallbackTitle = `${kolName} · ${timeRange} · ${snippet.slice(0, 40)}${snippet.length > 40 ? '…' : ''}`;

  try {
    if (!llmEnv().apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `你是视频素材编辑。根据「本段字幕」生成用于素材库展示的元数据，输出 JSON。
标题 title 要求（非常重要）：
- 使用简体中文。
- 8–24 个字，必须概括**本段字幕在讲什么**，读者不看画面也能区分这条素材。
- 禁止只重复整支视频标题；禁止空洞词如「精彩片段」「节选」「视频片段」「内容分析」等。
- 若本段信息不足，用字幕里出现的具体名词、动作或观点来写。

summary：简体中文 1–3 句，≤120 字，概括本段要点。
keywords：3–6 个词或短语，简体中文或常见英文技术词均可。
topic_category：必须是 opinion、analysis、tutorial、story、other 之一。

只输出 JSON 对象，不要 markdown。结构：
{"title":"","summary":"","keywords":[],"topic_category":"other"}`;

    const userPrompt = `整支视频标题：${videoTitle}
博主：${kolName}
片段时间：${timeRange}（约 ${Math.round(endSec - startSec)} 秒）

本段字幕：
${text}

请严格按系统说明输出 JSON。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ] as const;

    let response: any;
    try {
      response = await callLLM([...messages], { responseFormat: true });
    } catch (e: any) {
      const msg = String(e?.message || e);
      // Some providers/models reject response_format with upstream 400.
      if (/LLM API error:\s*400\b/i.test(msg) || /upstream_error/i.test(msg)) {
        response = await callLLM([...messages], { responseFormat: false });
      } else {
        throw e;
      }
    }

    const content = extractAssistantText(response);
    if (!content) throw new Error('No text in LLM response');

    const parsed = parseJsonObject(content);
    return normalizeAnalysis(parsed);
  } catch (error) {
    console.error('Error analyzing clip:', error);
    console.warn('Using fallback analysis for clip');
    return {
      title: fallbackTitle.slice(0, 120),
      summary: (text.replace(/\s+/g, ' ').trim().slice(0, 200) || '（无字幕摘要）') + (text.length > 200 ? '…' : ''),
      keywords: [kolName, timeRange, '字幕片段'].filter(Boolean),
      topic_category: 'other',
    };
  }
}

/**
 * Batch analyze multiple clips with concurrency control
 */
export async function batchAnalyzeClips(
  clips: Array<{ text: string; videoTitle: string; kolName: string; startSec: number; endSec: number }>,
  concurrency: number = 5
): Promise<ClipAnalysis[]> {
  const results: ClipAnalysis[] = [];
  const chunks: (typeof clips)[] = [];

  for (let i = 0; i < clips.length; i += concurrency) {
    chunks.push(clips.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map((clip) =>
        analyzeClip(clip.text, clip.videoTitle, clip.kolName, clip.startSec, clip.endSec)
      )
    );
    results.push(...chunkResults);
  }

  return results;
}
