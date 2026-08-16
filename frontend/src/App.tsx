import React, { useState, useEffect } from 'react';

interface Signal {
  miner_id: number;
  miner_name: string;
  intent: string;
  status: string;
  timestamp: string;
  risk_signal: number;
  confidence: number;
  data: Record<string, any>;
  verification: Record<string, any>;
  payment: Record<string, any>;
}

interface Evidence {
  category: string;
  miner_id: number;
  summary: string;
  risk_contribution: number;
  status: string;
}

interface AnalysisResult {
  analysis_id: string;
  asset: string;
  action_type: string;
  risk_score: number;
  confidence_score: number;
  decision: 'APPROVE' | 'REVIEW' | 'HIGH_RISK_REVIEW' | 'BLOCK' | 'INSUFFICIENT_DATA';
  created_at: string;
  signals: Signal[];
  evidence: Evidence[];
  verification_metadata: Record<string, any>;
}

export default function App() {
  const [asset, setAsset] = useState('ETH');
  const [actionType, setActionType] = useState('GENERAL_ANALYSIS');
  const [useFixture, setUseFixture] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [watchRules, setWatchRules] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ANALYZE' | 'WATCH' | 'HISTORY'>('ANALYZE');
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  const API_BASE = 'http://localhost:4000';

  useEffect(() => {
    // Initial fetch of recent analyses and watch rules
    fetchRecentAnalyses();
    fetchWatchRules();

    // Setup WebSocket
    const ws = new WebSocket('ws://localhost:4000');
    ws.onopen = () => setWsStatus('CONNECTED');
    ws.onclose = () => setWsStatus('DISCONNECTED');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ANALYSIS_COMPLETED') {
          fetchRecentAnalyses();
        } else if (msg.type === 'WATCH_ALERT') {
          setAlertBanner(`🚨 Sentinel Watch Alert on ${msg.data.asset}: ${msg.data.trigger_reason}`);
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    return () => ws.close();
  }, []);

  const fetchRecentAnalyses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analyses`);
      const data = await res.json();
      if (data.analyses) setHistory(data.analyses);
    } catch (e) {
      console.warn('Could not fetch analyses history', e);
    }
  };

  const fetchWatchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/watch`);
      const data = await res.json();
      if (data.rules) setWatchRules(data.rules);
    } catch (e) {
      console.warn('Could not fetch watch rules', e);
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setAlertBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/analyze?mode=${useFixture ? 'fixture' : 'live'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, action_type: actionType }),
      });
      const data = await res.json();
      setResult(data);
      fetchRecentAnalyses();
    } catch (e: any) {
      alert(`Analysis failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addWatch = async () => {
    try {
      await fetch(`${API_BASE}/api/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, riskThreshold: 60, confidenceThreshold: 85 }),
      });
      fetchWatchRules();
      alert(`Monitoring rule created for ${asset}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getDecisionColor = (decision?: string) => {
    switch (decision) {
      case 'APPROVE': return '#2ea043';
      case 'REVIEW': return '#d29922';
      case 'HIGH_RISK_REVIEW': return '#db6d28';
      case 'BLOCK': return '#f85149';
      default: return '#8b949e';
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>TELEGRAPH SENTINEL</h1>
          <p style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>Verified machine intelligence before every critical crypto decision</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: wsStatus === 'CONNECTED' ? '#2ea043' : '#f85149', marginRight: '6px' }}></span>
          <span style={{ fontSize: '12px', color: '#8b949e' }}>WS: {wsStatus}</span>
        </div>
      </header>

      {/* Alert Banner */}
      {alertBanner && (
        <div style={{ background: 'rgba(248, 81, 73, 0.15)', border: '1px solid #f85149', color: '#ff7b72', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
          {alertBanner}
        </div>
      )}

      {/* Navigation */}
      <nav style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['ANALYZE', 'WATCH', 'HISTORY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab ? '#21262d' : 'transparent',
              color: activeTab === tab ? '#58a6ff' : '#8b949e',
              border: '1px solid',
              borderColor: activeTab === tab ? '#388bfd' : '#30363d',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'ANALYZE' && (
        <div>
          {/* Controls Card */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>TARGET ASSET</label>
                <input
                  type="text"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px', fontWeight: 600 }}
                  placeholder="e.g. ETH, AAVE, SOL"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>CONSIDERING ACTION</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px' }}
                >
                  <option value="GENERAL_ANALYSIS">General Risk Analysis</option>
                  <option value="BUY_ENTER">Buy / Enter Position</option>
                  <option value="DEFI_ACTION">Execute DeFi Transaction</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>MODE SELECTION</label>
                <button
                  type="button"
                  onClick={() => setUseFixture(!useFixture)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: useFixture ? '#388bfd22' : '#0d1117',
                    border: `1px solid ${useFixture ? '#58a6ff' : '#30363d'}`,
                    color: useFixture ? '#58a6ff' : '#8b949e',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {useFixture ? 'Mode: UI Dev Fixtures' : 'Mode: Live Telegraph Miners'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={runAnalysis}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#238636',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'QUERYING TELEGRAPH MINERS...' : 'RUN SENTINEL ANALYSIS'}
              </button>

              <button
                onClick={addWatch}
                style={{
                  padding: '12px 18px',
                  background: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Add to Watch
              </button>
            </div>
          </div>

          {/* Results Display */}
          {result && (
            <div>
              {/* Top Hierarchy: DECISION -> RISK -> CONFIDENCE */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#161b22', border: `2px solid ${getDecisionColor(result.decision)}`, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px' }}>SENTINEL DECISION</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: getDecisionColor(result.decision), marginTop: '6px' }}>{result.decision}</div>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px' }}>COMPOSITE RISK</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#e6edf3', marginTop: '6px' }}>{result.risk_score} <span style={{ fontSize: '14px', color: '#8b949e' }}>/ 100</span></div>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px' }}>CONFIDENCE SCORE</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#58a6ff', marginTop: '6px' }}>{result.confidence_score}%</div>
                </div>
              </div>

              {/* Signals Cards */}
              <h2 style={{ fontSize: '16px', marginBottom: '12px', letterSpacing: '0.5px' }}>TELEGRAPH MINER SIGNALS</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {result.signals.map((sig, idx) => (
                  <div key={idx} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{sig.miner_name}</span>
                      <span style={{ fontSize: '10px', background: '#21262d', padding: '2px 6px', borderRadius: '4px', color: '#8b949e' }}>Miner {sig.miner_id}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '12px' }}>Intent: {sig.intent}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span>Status:</span>
                      <strong style={{ color: sig.status === 'success' ? '#2ea043' : '#f85149' }}>{sig.status.toUpperCase()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span>Risk Signal:</span>
                      <strong>{sig.risk_signal} / 100</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>Confidence:</span>
                      <strong>{sig.confidence}%</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* Evidence & Verification Panel */}
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                <h2 style={{ fontSize: '16px', marginBottom: '14px' }}>EVIDENCE & DETERMINISTIC REASONING</h2>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {result.evidence.map((item, idx) => (
                    <li key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #21262d', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>• [{item.category}] {item.summary}</span>
                      <span style={{ color: '#8b949e' }}>+{item.risk_contribution} risk pts</span>
                    </li>
                  ))}
                </ul>

                <h3 style={{ fontSize: '14px', marginTop: '16px', marginBottom: '8px', color: '#58a6ff' }}>TELEGRAPH PROTOCOL VERIFICATION & RECEIPTS</h3>
                <pre style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', fontSize: '11px', color: '#7ee787', overflowX: 'auto' }}>
                  {JSON.stringify(result.verification_metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'WATCH' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>SENTINEL WATCH ACTIVE RULES</h2>
          {watchRules.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: '13px' }}>No active monitoring rules. Add assets from the Analyze tab.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {watchRules.map(rule => (
                <div key={rule.id} style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '15px' }}>{rule.asset}</strong>
                    <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                      Alert if Risk ≥ {rule.riskThreshold} OR Confidence &lt; {rule.confidenceThreshold}% | Interval: {rule.intervalMinutes}m
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', background: '#23863622', color: '#3fb950', padding: '4px 8px', borderRadius: '4px' }}>{rule.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>PERSISTENT SQLite AUDIT TRAIL</h2>
          {history.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: '13px' }}>No historical analyses recorded yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d', textAlign: 'left', color: '#8b949e' }}>
                  <th style={{ padding: '8px' }}>Asset</th>
                  <th style={{ padding: '8px' }}>Decision</th>
                  <th style={{ padding: '8px' }}>Risk</th>
                  <th style={{ padding: '8px' }}>Confidence</th>
                  <th style={{ padding: '8px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.analysis_id} style={{ borderBottom: '1px solid #21262d' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{row.asset}</td>
                    <td style={{ padding: '8px', color: getDecisionColor(row.decision), fontWeight: 700 }}>{row.decision}</td>
                    <td style={{ padding: '8px' }}>{row.risk_score}</td>
                    <td style={{ padding: '8px' }}>{row.confidence_score}%</td>
                    <td style={{ padding: '8px', color: '#8b949e' }}>{new Date(row.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
