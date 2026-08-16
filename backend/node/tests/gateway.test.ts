import axios from 'axios';

async function runGatewayTests() {
  console.log('\n--- Starting Gateway Foundation Tests ---');
  const GATEWAY_URL = 'http://127.0.0.1:4000';

  try {
    // 1. Health
    console.log('1. Testing GET /health...');
    const healthRes = await axios.get(`${GATEWAY_URL}/health`);
    if (healthRes.status !== 200 || healthRes.data.status !== 'healthy') {
      throw new Error('Health check failed');
    }
    console.log('   ✓ Gateway OK. Python downstream status:', healthRes.data.downstream.python_risk_engine.status);

    // 2. Status
    console.log('2. Testing GET /api/status...');
    const statusRes = await axios.get(`${GATEWAY_URL}/api/status`);
    if (statusRes.status !== 200 || statusRes.data.miners.length !== 3) {
      throw new Error('Status check failed');
    }
    console.log('   ✓ Status endpoint OK with 3 configured miners.');

    // 3. Validation
    console.log('3. Testing POST /api/analyze validation...');
    try {
      await axios.post(`${GATEWAY_URL}/api/analyze`, { asset: '' });
      throw new Error('Expected 400 validation error');
    } catch (err: any) {
      if (err.response?.status === 400) {
        console.log('   ✓ Empty input correctly rejected (HTTP 400)');
      } else {
        throw err;
      }
    }

    // 4. End-to-End Analyze execution
    console.log('4. Testing POST /api/analyze with asset=ETH...');
    const analyzeRes = await axios.post(`${GATEWAY_URL}/api/analyze`, {
      asset: 'ETH',
      action_type: 'GENERAL_ANALYSIS',
    });

    if (analyzeRes.status === 200 && analyzeRes.data.analysis_id) {
      console.log(`   ✓ Pipeline complete! ID=${analyzeRes.data.analysis_id}, Decision=${analyzeRes.data.decision}`);
    } else {
      throw new Error('Analyze response missing analysis_id');
    }

    console.log('--- All Gateway Tests Passed Successfully! ---\n');
    process.exit(0);
  } catch (error: any) {
    console.error('✗ Gateway Test Failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

runGatewayTests();
