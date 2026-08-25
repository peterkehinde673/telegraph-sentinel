import axios from 'axios';
import { config } from './config';

export async function saveAnalysis(record: any): Promise<void> {
  try {
    await axios.post(`${config.pythonEngineUrl}/analyze`, record, { timeout: 2000 });
  } catch (err: any) {
    // Graceful fallback if python engine is temporarily offline
  }
}

export async function listAnalyses(limit: number = 25): Promise<any[]> {
  try {
    const res = await axios.get(`${config.pythonEngineUrl}/analyses`, { timeout: 2000 });
    return res.data?.analyses || [];
  } catch {
    return [];
  }
}
