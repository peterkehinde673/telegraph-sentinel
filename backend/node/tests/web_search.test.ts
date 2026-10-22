import axios from 'axios';
import { calculateWebRisk } from '../src/web_search';
import { searchWeb } from '../src/web_search';
import { generateDefaultSentinelYaml } from '../src/telegraph/yaml';

const webSearchSpec = generateDefaultSentinelYaml().endpoints
  .find((endpoint) => endpoint.intent === 'WEB_SEARCH');
if (!webSearchSpec?.description.includes('Gemini Google Search grounding')
  || !webSearchSpec.description.includes('Tavily as a fallback')) {
  throw new Error('WEB_SEARCH spec must describe its primary provider and fallback');
}

const clean = {
  query: 'What is the latest Ethereum upgrade?',
  answer: 'Ethereum developers announced a routine network upgrade.',
  results: [{ title: 'Ethereum update', url: 'https://example.com/eth', content: 'Routine network upgrade information.', score: 0.9 }],
  timestamp: new Date().toISOString(),
  source: 'tavily' as const,
};

const incident = {
  ...clean,
  answer: 'A protocol was hacked and drained after a vulnerability was exploited.',
};

if (calculateWebRisk(clean) !== 10) throw new Error('Clean web-risk classification failed');
if (calculateWebRisk(incident) !== 85) throw new Error('Incident web-risk classification failed');

async function runFallbackTests() {
  const originalPost = axios.post;
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  const previousTavilyKey = process.env.TAVILY_API_KEY;
  const previousModel = process.env.GEMINI_SEARCH_MODEL;
  const calls: string[] = [];
  const warnings: string[] = [];
  const originalWarn = console.warn;

  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.TAVILY_API_KEY = 'test-tavily-key';
  process.env.GEMINI_SEARCH_MODEL = 'gemini-2.5-flash';
  (axios as any).post = async (url: string) => {
    calls.push(url);
    if (url.includes('generativelanguage.googleapis.com')) {
      throw {
        response: { status: 404, data: { error: { message: 'Model gemini-2.5-flash not found' } } },
        message: 'Request failed with status code 404',
        config: { headers: { 'x-goog-api-key': 'test-gemini-key' } },
      };
    }
    return {
      data: {
        answer: 'A grounded answer from the fallback provider.',
        results: [{ title: 'Fallback source', url: 'https://example.com/fallback', content: 'Fallback evidence.', score: 0.9 }],
      },
    };
  };

  console.warn = (...args: any[]) => { warnings.push(args.map(String).join(' ')); };

  try {
    const fallback = await searchWeb('fallback regression query 1');
    if (fallback?.source !== 'tavily' || calls.length !== 2
      || !calls[0].includes('/v1beta/models/gemini-2.5-flash:generateContent')
      || calls[1] !== 'https://api.tavily.com/search') {
      throw new Error('Tavily must be attempted and returned after Gemini fails with HTTP 404');
    }
    const diagnostic = warnings.join(' ');
    if (!diagnostic.includes('gemini-2.5-flash') || !diagnostic.includes('Model gemini-2.5-flash not found')) {
      throw new Error('Gemini diagnostics must include the configured model and provider error message');
    }
    if (diagnostic.includes('test-gemini-key') || diagnostic.includes('x-goog-api-key')) {
      throw new Error('Gemini diagnostics must not expose API keys or request headers');
    }

    (axios as any).post = async () => {
      throw { response: { status: 404 }, message: 'Provider unavailable' };
    };
    const unavailable = await searchWeb('fallback regression query 2');
    if (unavailable !== null) throw new Error('WEB_SEARCH must return unavailable when both providers fail');
  } finally {
    (axios as any).post = originalPost;
    console.warn = originalWarn;
    if (previousGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousGeminiKey;
    if (previousTavilyKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = previousTavilyKey;
    if (previousModel === undefined) delete process.env.GEMINI_SEARCH_MODEL;
    else process.env.GEMINI_SEARCH_MODEL = previousModel;
  }
}

console.log('✓ Web search risk classification tests passed.');
runFallbackTests().then(() => {
  console.log('✓ Gemini 404 → Tavily fallback and dual-provider failure tests passed.');
}).catch((error) => {
  console.error('✗ Web search fallback test failed:', error.message);
  process.exit(1);
});
