import React, { useState, useEffect } from 'react';
import { Shield, Activity, Radio, FileText, CheckCircle2, AlertTriangle, XCircle, ArrowRight, ExternalLink, RefreshCw, Trash2, Cpu, Database, Key } from 'lucide-react';

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
  mode?: string;
  action_type: string;
  risk_score: number;
  confidence_score: number;
  decision: 'APPROVE' | 'REVIEW' | 'HIGH_RISK_REVIEW' | 'BLOCK' | 'INSUFFICIENT_DATA';
  created_at: string;
  signals: Signal[];
  evidence: Evidence[];
  verification_metadata: Record<string, any>;
}

interface WatchRule {
  id: string;
  asset: string;
  mode?: string;
  riskThreshold: number;
  confidenceThreshold: number;
  intervalMinutes: number;
  lastChecked?: string;
  status: 'ACTIVE' | 'PAUSED';
}

interface YamlValidationResult {
  valid: boolean;
  spec?: any;
  errors: string[];
  hashes?: {
    sha256: string;
    keccak256: string;
    bytes32Hash: string;
    ipfsCidPlaceholder: string;
  };
}

export default function App() {
  const [asset, setAsset] = useState('ETH');
  const [actionType, setActionType] = useState('GENERAL_ANALYSIS');
  const [operatingMode, setOperatingMode] = useState<'ANALYZE' | 'PROTECT' | 'AUTOPILOT'>('ANALYZE');
  const [useFixture, setUseFixture] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [watchRules, setWatchRules] = useState<WatchRule[]>([]);
  const [activeTab, setActiveTab] = useState<'ANALYZE' | 'TRACK1' | 'WATCH' | 'HISTORY' | 'WS_EVENTS'>('ANALYZE');
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('CONNECTING');
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [wsEvents, setWsEvents] = useState<Array<{ text: string; time: string; type: string }>>([]);

  // Track 1 States
  const [minerYaml, setMinerYaml] = useState('');
  const [yamlValidation, setYamlValidation] = useState<YamlValidationResult | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ipfsUriInput, setIpfsUriInput] = useState('');
  const [regStatus, setRegStatus] = useState<{ status: string; message?: string; txHash?: string; explorerUrl?: string; error?: string } | null>(null);

  useEffect(() => {
    fetchRecentAnalyses();
    fetchWatchRules();
    loadDefaultYaml();

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${wsProtocol}//${window.location.host}`);
      ws.onopen = () => {
        setWsStatus('CONNECTED');
        addWsLog('WebSocket connection established.', 'SYSTEM');
      };
      ws.onclose = () => {
        setWsStatus('DISCONNECTED');
        addWsLog('WebSocket connection closed.', 'SYSTEM');
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          addWsLog(`Event received: ${msg.type}`, msg.type);
          if (msg.type === 'ANALYSIS_COMPLETED' || msg.type === 'MINER_INTELLIGENCE_DISPATCHED') {
            fetchRecentAnalyses();
          } else if (msg.type === 'WATCH_ALERT') {
            setAlertBanner(`🚨 Sentinel Watch Alert on ${msg.data.asset}: ${msg.data.trigger_reason}`);
          }
        } catch (e) {
          console.error('WS parsing error:', e);
        }
      };
    } catch {
      setWsStatus('DISCONNECTED');
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const addWsLog = (text: string, type: string = 'EVENT') => {
    setWsEvents((prev) => [{ text, time: new Date().toLocaleTimeString(), type }, ...prev.slice(0, 25)]);
  };

  const loadDefaultYaml = async () => {
    try {
      const res = await fetch('/api/v1/miner/spec.yaml');
      const text = await res.text();
      setMinerYaml(text);
      validateYamlText(text);
    } catch (e) {
      console.warn('Failed to load default YAML spec', e);
    }
  };

  const validateYamlText = async (text: string) => {
    try {
      const res = await fetch('/api/v1/miner/yaml/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawYaml: text }),
      });
      const data: YamlValidationResult = await res.json();
      setYamlValidation(data);
      if (data.hashes && !ipfsUriInput) {
        setIpfsUriInput(`ipfs://${data.hashes.ipfsCidPlaceholder}`);
      }
    } catch (e) {
      console.error('Validation error:', e);
    }
  };

  const fetchRecentAnalyses = async () => {
    try {
      const res = await fetch('/api/analyses');
      const data = await res.json();
      if (data.analyses) setHistory(data.analyses);
    } catch (e) {
      console.warn('Could not fetch analyses history', e);
    }
  };

  const fetchWatchRules = async () => {
    try {
      const res = await fetch('/api/watch');
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
      const res = await fetch(`/api/analyze?mode=${useFixture ? 'fixture' : 'live'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, mode: operatingMode, action_type: actionType }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setResult(data);
      fetchRecentAnalyses();
    } catch (e: any) {
      alert(`Analysis request failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addWatch = async () => {
    try {
      const res = await fetch('/api/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, mode: operatingMode, riskThreshold: 60, confidenceThreshold: 85, intervalMinutes: 15 }),
      });
      if (!res.ok) throw new Error('Failed to create watch rule');
      fetchWatchRules();
      alert(`Sentinel Watch monitoring activated for ${asset} (${operatingMode} mode)`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await fetch(`/api/watch/${id}`, { method: 'DELETE' });
      fetchWatchRules();
    } catch (e: any) {
      alert('Failed to delete rule: ' + e.message);
    }
  };

  const connectWallet = async () => {
    const win = window as any;
    if (typeof win.ethereum === 'undefined') {
      alert('MetaMask or Web3 wallet not detected in browser. Please install a Web3 wallet extension.');
      return;
    }
    try {
      const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
      const chain = await win.ethereum.request({ method: 'eth_chainId' });
      const parsedChain = parseInt(chain, 16);
      setWalletAddress(accounts[0]);
      setChainId(parsedChain);

      if (parsedChain !== 84532) {
        try {
          await win.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x14a34' }],
          });
          setChainId(84532);
        } catch (switchError) {
          console.warn('Network switch notice:', switchError);
        }
      }
    } catch (err: any) {
      alert('Wallet connection failed: ' + err.message);
    }
  };

  const submitOnchainRegistration = async () => {
    if (!yamlValidation || !yamlValidation.valid) {
      alert('Cannot register: YAML specification has validation errors.');
      return;
    }
    if (!walletAddress) {
      await connectWallet();
      return;
    }

    setRegStatus({ status: 'PENDING', message: 'Encoding registration transaction payload...' });

    try {
      const encodeRes = await fetch('/api/v1/miner/onchain/encode-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yamlHash: yamlValidation.hashes?.bytes32Hash,
          ipfsUri: ipfsUriInput,
          intents: yamlValidation.spec?.intents || ['CRYPTO_RISK_ASSESSMENT'],
          feeRecipient: walletAddress,
          floorPriceUsd: 0.001,
        }),
      });

      const txData = await encodeRes.json();
      if (txData.error) {
        throw new Error(txData.error);
      }

      setRegStatus({ status: 'PROMPT', message: 'Please confirm transaction in your Web3 wallet...' });

      const win = window as any;
      const txHash = await win.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: txData.to,
          data: txData.data,
          value: '0x0',
        }],
      });

      setRegStatus({
        status: 'SUCCESS',
        txHash,
        explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
        message: 'Miner registration submitted on Base Sepolia!',
      });
    } catch (err: any) {
      setRegStatus({
        status: 'FAILED',
        error: err.message || 'Transaction rejected or failed',
      });
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
    <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '24px 16px', minHeight: '100vh' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #30363d', paddingBottom: '18px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>TELEGRAPH SENTINEL</h1>
            <span style={{ fontSize: '11px', background: '#23863622', border: '1px solid #238636', color: '#3fb950', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>TRACK 1 MINER</span>
            <span style={{ fontSize: '11px', background: '#1f6feb22', border: '1px solid #1f6feb', color: '#58a6ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>BASE SEPOLIA</span>
          </div>
          <p style={{ color: '#8b949e', fontSize: '13px', marginTop: '4px' }}>Autonomous pre-flight DeFi risk intelligence and verifiable machine oracle</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#161b22', padding: '4px 10px', borderRadius: '20px', border: '1px solid #30363d' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: wsStatus === 'CONNECTED' ? '#2ea043' : '#f85149' }}></span>
            <span style={{ fontSize: '12px', color: '#8b949e' }}>WS: {wsStatus}</span>
          </div>
        </div>
      </header>

      {/* Alert Banner */}
      {alertBanner && (
        <div style={{ background: 'rgba(248, 81, 73, 0.15)', border: '1px solid #f85149', color: '#ff7b72', padding: '12px 16px', borderRadius: '6px', marginBottom: '18px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{alertBanner}</span>
          <button onClick={() => setAlertBanner(null)} style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '8px', marginBottom: '22px', flexWrap: 'wrap' }}>
        {[
          { id: 'ANALYZE', label: 'RISK ANALYZER' },
          { id: 'TRACK1', label: '⚡ TRACK 1: TELEGRAPH INTEGRATE' },
          { id: 'WATCH', label: `SENTINEL WATCH (${watchRules.length})` },
          { id: 'HISTORY', label: `AUDIT TRAIL (${history.length})` },
          { id: 'WS_EVENTS', label: `WS EVENTS (${wsEvents.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '9px 16px',
              backgroundColor: activeTab === tab.id ? '#21262d' : '#161b22',
              color: activeTab === tab.id ? '#58a6ff' : '#8b949e',
              border: '1px solid',
              borderColor: activeTab === tab.id ? '#388bfd' : '#30363d',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab: RISK ANALYZER */}
      {activeTab === 'ANALYZE' && (
        <div>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px' }}>TARGET ASSET</label>
                <input
                  type="text"
                  value={asset}
                  onChange={(e) => setAsset(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px', fontWeight: 600, fontSize: '14px' }}
                  placeholder="e.g. ETH, AAVE, SOL, BTC"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px' }}>ACTION CONTEXT</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="GENERAL_ANALYSIS">General Risk Analysis</option>
                  <option value="BUY_ENTER">Buy / Enter Position</option>
                  <option value="DEFI_ACTION">Execute DeFi Transaction</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px' }}>OPERATING POLICY</label>
                <select
                  value={operatingMode}
                  onChange={(e) => setOperatingMode(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="ANALYZE">Mode: ANALYZE (Observational)</option>
                  <option value="PROTECT">Mode: PROTECT (Block Critical Risks)</option>
                  <option value="AUTOPILOT">Mode: AUTOPILOT (Automated Guards)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px' }}>DATA SOURCE</label>
                <button
                  type="button"
                  onClick={() => setUseFixture(!useFixture)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: useFixture ? '#388bfd22' : '#0d1117',
                    border: `1px solid ${useFixture ? '#58a6ff' : '#30363d'}`,
                    color: useFixture ? '#58a6ff' : '#8b949e',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {useFixture ? 'Mode: Dev Fixtures' : 'Mode: Live Oracles'}
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
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading && <RefreshCw size={16} className="animate-spin" />}
                {loading ? 'CALCULATING RISK INTELLIGENCE...' : 'RUN SENTINEL ANALYSIS'}
              </button>

              <button
                onClick={addWatch}
                style={{
                  padding: '12px 20px',
                  background: '#21262d',
                  color: '#c9d1d9',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                + Add to Watch
              </button>
            </div>
          </div>

          {result && (
            <div>
              {/* Decision Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: '#161b22', border: `2px solid ${getDecisionColor(result.decision)}`, borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px', fontWeight: 600 }}>SENTINEL DECISION</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: getDecisionColor(result.decision), marginTop: '6px' }}>{result.decision}</div>
                  <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Mode: {result.mode || operatingMode}</div>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px', fontWeight: 600 }}>COMPOSITE RISK</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#e6edf3', marginTop: '6px' }}>
                    {result.risk_score} <span style={{ fontSize: '14px', color: '#8b949e' }}>/ 100</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Multi-source deterministic weight</div>
                </div>

                <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#8b949e', letterSpacing: '1px', fontWeight: 600 }}>CONFIDENCE SCORE</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#58a6ff', marginTop: '6px' }}>{result.confidence_score}%</div>
                  <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>Oracle completeness & verification</div>
                </div>
              </div>

              {/* Signals Grid */}
              <h2 style={{ fontSize: '15px', marginBottom: '12px', letterSpacing: '0.5px', fontWeight: 700 }}>TELEGRAPH INTELLIGENCE SIGNALS</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {result.signals.map((sig, idx) => (
                  <div key={idx} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{sig.miner_name}</span>
                      <span style={{ fontSize: '11px', background: '#21262d', padding: '2px 8px', borderRadius: '4px', color: '#8b949e' }}>Miner #{sig.miner_id}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '10px' }}>Intent: <code style={{ color: '#58a6ff' }}>{sig.intent}</code></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: '#8b949e' }}>Oracle Status:</span>
                      <strong style={{ color: sig.status === 'success' ? '#2ea043' : '#f85149' }}>{sig.status.toUpperCase()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ color: '#8b949e' }}>Risk Signal:</span>
                      <strong>{sig.risk_signal} / 100</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px' }}>
                      <span style={{ color: '#8b949e' }}>Confidence:</span>
                      <strong>{sig.confidence}%</strong>
                    </div>
                    <div style={{ background: '#0d1117', padding: '8px 10px', borderRadius: '4px', fontSize: '11px', color: '#c9d1d9', overflowX: 'auto' }}>
                      {JSON.stringify(sig.data)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Evidence & Reasoning */}
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '15px', marginBottom: '14px', fontWeight: 700 }}>EVIDENCE & DETERMINISTIC REASONING</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0' }}>
                  {result.evidence.map((item, idx) => (
                    <li key={idx} style={{ padding: '10px 0', borderBottom: '1px solid #21262d', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong style={{ color: '#58a6ff' }}>[{item.category}]</strong> {item.summary}</span>
                      <span style={{ color: '#8b949e', background: '#0d1117', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>+{item.risk_contribution} risk pts</span>
                    </li>
                  ))}
                </ul>

                <h3 style={{ fontSize: '13px', marginBottom: '8px', color: '#58a6ff', fontWeight: 600 }}>VERIFICATION METADATA</h3>
                <pre style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', fontSize: '11px', color: '#7ee787', overflowX: 'auto', border: '1px solid #21262d' }}>
                  {JSON.stringify(result.verification_metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: TRACK 1 TELEGRAPH INTEGRATION */}
      {activeTab === 'TRACK1' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* Left Column: YAML Specification */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700 }}>MINER YAML SPECIFICATION</h2>
              <button
                onClick={loadDefaultYaml}
                style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}
              >
                Reset Default
              </button>
            </div>
            <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '12px' }}>
              Telegraph Sentinel miner specification compliant with Track 1 standard.
            </p>
            <textarea
              value={minerYaml}
              onChange={(e) => {
                setMinerYaml(e.target.value);
                validateYamlText(e.target.value);
              }}
              rows={16}
              style={{
                width: '100%',
                background: '#0d1117',
                border: `1px solid ${yamlValidation?.valid ? '#238636' : '#f85149'}`,
                color: '#e6edf3',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '12px',
                borderRadius: '6px',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
            {yamlValidation && (
              <div style={{ marginTop: '12px' }}>
                {yamlValidation.valid ? (
                  <div style={{ color: '#3fb950', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} /> YAML spec format is valid & ready for registration
                  </div>
                ) : (
                  <div style={{ color: '#f85149', fontSize: '12px' }}>
                    <strong>Validation errors:</strong>
                    <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                      {yamlValidation.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Onchain Hashes & Registration */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>BASE SEPOLIA ONCHAIN REGISTRATION</h2>
            <p style={{ color: '#8b949e', fontSize: '12px', marginBottom: '16px' }}>
              Verify cryptographic hash and register this miner with the Telegraph Registry contract.
            </p>

            {yamlValidation?.hashes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>CALCULATED KECCAK256 (bytes32 yamlHash)</label>
                  <div style={{ background: '#0d1117', padding: '8px 10px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', color: '#58a6ff', wordBreak: 'break-all', border: '1px solid #21262d' }}>
                    {yamlValidation.hashes.bytes32Hash}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>IPFS METADATA URI</label>
                  <input
                    type="text"
                    value={ipfsUriInput}
                    onChange={(e) => setIpfsUriInput(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: '#0d1117', border: '1px solid #30363d', color: '#fff', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#8b949e', fontWeight: 600 }}>REGISTRY CONTRACT (Base Sepolia 84532)</label>
                  <div style={{ background: '#0d1117', padding: '8px 10px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace', color: '#e6edf3', border: '1px solid #21262d' }}>
                    0x4020000000000000000000000000000000008453
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid #21262d', paddingTop: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#8b949e' }}>Connected Signer</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: walletAddress ? '#3fb950' : '#8b949e' }}>
                    {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : 'Wallet not connected'}
                  </div>
                </div>

                <button
                  onClick={connectWallet}
                  style={{
                    padding: '8px 14px',
                    background: '#21262d',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    color: '#c9d1d9',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  {walletAddress ? 'Switch Wallet' : 'Connect Web3 Wallet'}
                </button>
              </div>

              <button
                onClick={submitOnchainRegistration}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#1f6feb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                SUBMIT ONCHAIN MINER REGISTRATION
              </button>

              {regStatus && (
                <div style={{ marginTop: '14px', padding: '12px', background: '#0d1117', borderRadius: '6px', border: '1px solid #30363d', fontSize: '13px' }}>
                  {regStatus.message && <div style={{ color: '#58a6ff' }}>{regStatus.message}</div>}
                  {regStatus.txHash && (
                    <div style={{ marginTop: '8px' }}>
                      <a href={regStatus.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3fb950', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                        View BaseScan Transaction <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                  {regStatus.error && <div style={{ color: '#f85149' }}>Error: {regStatus.error}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: SENTINEL WATCH */}
      {activeTab === 'WATCH' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>SENTINEL WATCH ACTIVE MONITORING RULES</h2>
          {watchRules.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: '13px' }}>No active monitoring rules. Add assets to watch from the Risk Analyzer tab.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {watchRules.map((rule) => (
                <div key={rule.id} style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '16px', color: '#fff' }}>{rule.asset}</strong>
                      <span style={{ fontSize: '11px', background: '#23863622', color: '#3fb950', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{rule.status}</span>
                      <span style={{ fontSize: '11px', background: '#388bfd22', color: '#58a6ff', padding: '2px 8px', borderRadius: '4px' }}>Mode: {rule.mode || 'AUTOPILOT'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '6px' }}>
                      Alert if Risk ≥ <strong>{rule.riskThreshold}</strong> OR Confidence &lt; <strong>{rule.confidenceThreshold}%</strong> | Polling Interval: {rule.intervalMinutes}m
                    </div>
                  </div>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    style={{ background: 'transparent', border: '1px solid #30363d', color: '#f85149', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: AUDIT TRAIL / HISTORY */}
      {activeTab === 'HISTORY' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>PERSISTENT AUDIT TRAIL</h2>
          {history.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: '13px' }}>No historical analyses recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #30363d', textAlign: 'left', color: '#8b949e' }}>
                    <th style={{ padding: '10px 8px' }}>Asset</th>
                    <th style={{ padding: '10px 8px' }}>Action</th>
                    <th style={{ padding: '10px 8px' }}>Decision</th>
                    <th style={{ padding: '10px 8px' }}>Risk</th>
                    <th style={{ padding: '10px 8px' }}>Confidence</th>
                    <th style={{ padding: '10px 8px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.analysis_id} style={{ borderBottom: '1px solid #21262d' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{row.asset}</td>
                      <td style={{ padding: '10px 8px', color: '#8b949e' }}>{row.action_type || 'GENERAL_ANALYSIS'}</td>
                      <td style={{ padding: '10px 8px', color: getDecisionColor(row.decision), fontWeight: 700 }}>{row.decision}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.risk_score}</td>
                      <td style={{ padding: '10px 8px' }}>{row.confidence_score}%</td>
                      <td style={{ padding: '10px 8px', color: '#8b949e' }}>{new Date(row.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: REAL-TIME WEBSOCKET EVENTS */}
      {activeTab === 'WS_EVENTS' && (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>REAL-TIME WEBSOCKET STREAM</h2>
            <button
              onClick={() => setWsEvents([])}
              style={{ padding: '4px 10px', background: '#21262d', border: '1px solid #30363d', borderRadius: '4px', color: '#8b949e', fontSize: '12px', cursor: 'pointer' }}
            >
              Clear Logs
            </button>
          </div>
          {wsEvents.length === 0 ? (
            <p style={{ color: '#8b949e', fontSize: '13px' }}>Listening for live broadcasts...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {wsEvents.map((evt, idx) => (
                <div key={idx} style={{ background: '#0d1117', border: '1px solid #21262d', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                  <span style={{ color: evt.type === 'WATCH_ALERT' ? '#ff7b72' : '#7ee787' }}>{evt.text}</span>
                  <span style={{ color: '#8b949e', fontSize: '11px' }}>{evt.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
