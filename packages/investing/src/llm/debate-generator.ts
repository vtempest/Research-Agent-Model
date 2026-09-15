import { TavilyClient } from "tavily"; // Tavily JS SDK [web:70][web:80]
import { ChatGroq } from "@langchain/groq";

interface MarketData {
  question: string;
  description?: string;
  currentYesPrice: number;
  currentNoPrice: number;
  volume24hr?: number;
  volumeTotal?: number;
  tags?: string[];
}

interface DebateAnalysis {
  yesArguments: string[];
  noArguments: string[];
  yesSummary: string;
  noSummary: string;
  keyFactors: string[];
  uncertainties: string[];
}

// --- Tavily helpers ---

let _tavily: TavilyClient | null = null;

function getTavilyClient(): TavilyClient {
  if (!_tavily) {
    _tavily = new TavilyClient({
      apiKey: process.env.TAVILY_API_KEY || "",
    });
  }
  return _tavily;
}

async function researchQuestionWithTavily(question: string): Promise<string> {
  try {
    const tavily = getTavilyClient();

    if (!process.env.TAVILY_API_KEY) {
      console.warn('TAVILY_API_KEY not set, skipping web research');
      return 'Web research unavailable: API key not configured';
    }

    // Step 1: search for the question
    const searchRes = await tavily.search({
      query: question,
      search_depth: "advanced",
      max_results: 5,
      include_raw_content: true, // so we can skip a separate extract call if desired [web:71][web:75][web:80]
    });

    // Fallback if API doesn't support includeRawContent in your plan/version:
    // collect URLs and call tavily.extract(urls) instead. [web:70][web:76][web:80]

    const summaryParts: string[] = [];

    if (searchRes?.answer) {
      summaryParts.push(`High-level answer: ${searchRes.answer}`);
    }

    if (searchRes?.results?.length) {
      for (const r of searchRes.results.slice(0, 3)) {
        const snippet = (r.content ?? "").slice(0, 800); // keep it short for prompt [web:70][web:83]
        summaryParts.push(
          `Source: ${r.url}\nRelevance: ${r.score}\nSnippet:\n${snippet}`
        );
      }
    }

    return summaryParts.join("\n\n");
  } catch (error: any) {
    console.error('Error researching with Tavily:', error.message);
    return `Web research failed: ${error.message}. Analysis will proceed with limited context.`;
  }
}

// --- Prompt builder using Tavily context ---

interface DebateAnalysis {
  yesArguments: string[];
  noArguments: string[];
  yesSummary: string;
  noSummary: string;
  keyFactors: string[];
  uncertainties: string[];
  // new fields
  modelYesProbability: number; // 0–1
  modelNoProbability: number; // 0–1
  commentaryOnDiscrepancy: string;
}

function buildPrompt(
  marketData: MarketData,
  researchContext: string,
  strict: boolean
): string {
  const base = `You are an expert analyst tasked with providing a balanced debate analysis for a prediction market question.

Market Question: ${marketData.question}
${marketData.description ? `Description: ${marketData.description}` : ""}

Current Polymarket displayed odds:
- YES: ${marketData.currentYesPrice}
- NO: ${marketData.currentNoPrice}

Note: These displayed odds are a UI placeholder and do NOT necessarily reflect true market probabilities. Use them only as a reference for comparison, not as ground truth. [web:89][web:92][web:96]

${marketData.volume24hr ? `24h Volume: $${marketData.volume24hr.toLocaleString()}` : ""}
${marketData.volumeTotal ? `Total Volume: $${marketData.volumeTotal.toLocaleString()}` : ""}

You have the following external research about this question from web search (via Tavily). Use it heavily for factual grounding:

${researchContext}

Your tasks:
1. Infer your own best-estimate probability for YES and NO based on the research, expressed as numbers between 0 and 1 that sum to 1.0.
2. Provide a full debate analysis (arguments, summaries, key factors, uncertainties).
3. Explain how and why your inferred probabilities differ from the displayed 50/50 odds.

Respond with valid JSON in this format:

{
  "yesArguments": ["argument 1", "argument 2", "argument 3"],
  "noArguments": ["argument 1", "argument 2", "argument 3"],
  "yesSummary": "2-3 sentence summary of the strongest case for YES",
  "noSummary": "2-3 sentence summary of the strongest case for NO",
  "keyFactors": ["factor 1", "factor 2", "factor 3"],
  "uncertainties": ["uncertainty 1", "uncertainty 2"],
  "modelYesProbability": 0.63,
  "modelNoProbability": 0.37,
  "commentaryOnDiscrepancy": "2-4 sentences explaining why your inferred odds differ from the 50/50 displayed odds."
}

Guidelines:
1. Be intellectually honest and balanced - present the strongest arguments for BOTH sides.
2. Base arguments primarily on the provided research, plus relevant facts, data, historical precedent, and logical reasoning. [web:85][web:87][web:90]
3. Explicitly justify your probability estimates using the research (e.g., base rates, polls, fundamentals, historical analogies).
4. Highlight structural reasons the displayed 50/50 odds might deviate from “true odds” (e.g., low liquidity, retail bias, information lags). [web:89][web:92][web:94][web:99]
5. Each argument should be specific and substantive (2-3 sentences).
6. Key factors should be concrete, measurable events or conditions.
7. Focus on factors that are actually relevant to the prediction timeframe.
8. Avoid simply repeating the 50/50 odds; your probabilities should reflect your best judgment based on the research, even if far from 50/50.

`;
  return strict
    ? base +
        "\nReturn ONLY the JSON object, with no additional text or explanation."
    : base;
}

async function callGroqAsJson(
  prompt: string,
  apiKey?: string,
  {
    model = "llama-3.3-70b-versatile",
    temperature = 0.7,
  }: { model?: string; temperature?: number } = {}
): Promise<DebateAnalysis> {
  try {
    const finalApiKey = apiKey || process.env.GROQ_API_KEY;

    if (!finalApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const llm = new ChatGroq({
      apiKey: finalApiKey,
      model,
      temperature,
    });

    console.log(`Calling Groq API with model ${model}...`);

    const aiMsg = await llm.invoke(
      [
        {
          role: "system",
          content:
            "You are an expert analyst who provides balanced, fact-based debate analysis. Always respond with valid JSON matching the requested schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        response_format: { type: "json_object" },
      } as any
    ); // [web:2][web:13][web:57]

    const rawContent =
      typeof aiMsg.content === "string"
        ? aiMsg.content
        : Array.isArray(aiMsg.content)
          ? aiMsg.content.map((c: any) => c?.text ?? "").join("")
          : String(aiMsg.content);

    let jsonText = rawContent.trim();

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.error('Failed to parse Groq response as JSON:', jsonText.substring(0, 200));
      throw new Error(`Invalid JSON response from Groq: ${parseError.message}`);
    }

    // Validate required fields
    const requiredFields = [
      'yesArguments',
      'noArguments',
      'yesSummary',
      'noSummary',
      'keyFactors',
      'uncertainties'
    ];

    const missingFields = requiredFields.filter(field => !parsed[field]);

    if (missingFields.length > 0) {
      console.error('Missing fields in Groq response:', missingFields);
      throw new Error(`Missing required fields in analysis: ${missingFields.join(', ')}`);
    }

    return parsed as DebateAnalysis;
  } catch (error: any) {
    console.error('Error calling Groq API:', error.message);
    throw error;
  }
}

// --- Public functions ---

export async function generateDebateAnalysis(
  marketData: MarketData,
  apiKey?: string
): Promise<DebateAnalysis> {
  try {
    console.log(`Generating debate analysis for: ${marketData.question}`);

    // Research with Tavily
    const research = await researchQuestionWithTavily(marketData.question);

    // Build prompt
    const prompt = buildPrompt(marketData, research, true);

    // Call Groq to generate analysis
    const analysis = await callGroqAsJson(prompt, apiKey);

    console.log(`Successfully generated debate analysis`);
    return analysis;
  } catch (error: any) {
    console.error('Error generating debate analysis:', error.message);
    throw new Error(`Failed to generate debate analysis: ${error.message}`);
  }
}

export async function generateDebateAnalysisWithOpenAI(
  marketData: MarketData,
  apiKey?: string
): Promise<DebateAnalysis> {
  const research = await researchQuestionWithTavily(marketData.question);
  const prompt = buildPrompt(marketData, research, false);
  return callGroqAsJson(prompt, apiKey);
}
