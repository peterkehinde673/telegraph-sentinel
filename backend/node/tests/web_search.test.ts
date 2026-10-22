import { calculateWebRisk } from '../src/web_search';
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

console.log('✓ Web search risk classification tests passed.');
console.log('Note: live Tavily calls require TAVILY_API_KEY and are intentionally not executed by this deterministic test.');
