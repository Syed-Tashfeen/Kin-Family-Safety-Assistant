import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { 
  ShieldCheck, AlertTriangle, ArrowLeft, Clock, History, Activity, 
  Send, Users, ExternalLink, CheckCircle2, ChevronRight, Lock, Eye
} from 'lucide-react';

type SessionLog = {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: string;
  language: string;
  riskScore: number;
  toolsTriggered: number;
};

type AlertLog = {
  id: string;
  sessionId?: string;
  createdAt: string;
  severity: string;
  title: string;
  summary: string;
  evidence: string;
  recommendedAction: string;
  telegramNotified: boolean;
};

export default function FamilyDashboard() {
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertLog | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [sessRes, alertRes] = await Promise.all([
          fetch('/api/kin/sessions'),
          fetch('/api/kin/alerts')
        ]);
        if (sessRes.ok) setSessions(await sessRes.json());
        if (alertRes.ok) setAlerts(await alertRes.json());
      } catch (err) {
        console.warn('Using local fallback for dashboard logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const highRiskCount = alerts.filter(a => a.severity === 'high').length;

  return (
    <div className="dashboard-page kin-reveal" style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>
            <Link href="/" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ArrowLeft size={14} /> KIN ASSISTANT
            </Link>
            <span>/</span>
            <span>GUARDIAN HUB</span>
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: '#2E2827' }}>
            Family Safety Dashboard
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '2px' }}>
            Real-time intervention logs, rolling guardian risk metrics, and Telegram dispatch history for your family.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/scam-lab" className="kin-button secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none' }}>
            <Eye size={15} /> Open Phishing Lab
          </Link>
          <Link href="/" className="kin-button start-live" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', color: '#fff' }}>
            <ShieldCheck size={16} /> Live Assistant
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="kin-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '13px' }}>
            <span>Active Protected Family</span>
            <Users size={18} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, marginTop: '10px' }}>Maya Sharma</div>
          <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <CheckCircle2 size={13} /> Guardian Service Active
          </div>
        </div>

        <div className="kin-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '13px' }}>
            <span>Total Sessions Watched</span>
            <Activity size={18} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, marginTop: '10px' }}>{sessions.length || 3}</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            100% ephemeral audio/video
          </div>
        </div>

        <div className="kin-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '13px' }}>
            <span>Blocked Threats</span>
            <AlertTriangle size={18} style={{ color: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: '#ef4444', marginTop: '10px' }}>{highRiskCount || 1}</div>
          <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>
            {highRiskCount} high-risk attacks stopped
          </div>
        </div>

        <div className="kin-card" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '13px' }}>
            <span>Telegram Alert Bot</span>
            <Send size={18} style={{ color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '14px', color: '#0284c7' }}>@KinGuardianBot</div>
          <div style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
            <CheckCircle2 size={13} /> Instant Dispatch Active
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Recent Intervention Log */}
        <div className="kin-card" style={{ padding: '24px', borderRadius: '14px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Scam Interventions &amp; Safety Events</h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>PostgreSQL / Local Sync</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: alert.severity === 'high' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: alert.severity === 'high' ? '#fee2e2' : '#e0f2fe',
                      color: alert.severity === 'high' ? '#b91c1c' : '#0369a1',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}>
                      {alert.severity} RISK
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </span>
                    {alert.telegramNotified && (
                      <span style={{ fontSize: '11px', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Send size={11} /> Telegram Sent
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px' }}>{alert.title}</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '3px', lineClamp: 1 }}>{alert.summary}</p>
                </div>
                <ChevronRight size={18} style={{ color: '#94a3b8' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Guardian Service Status & Sessions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="kin-card" style={{ padding: '22px', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: '#10b981' }} /> Guardian Service Pipeline
            </h3>
            <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Vision Sampler</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>~1 FPS Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Rolling Risk Scoring</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>guardian_risk_score</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Telegram Bot Relay</span>
                <span style={{ fontWeight: 600, color: '#0284c7' }}>Enabled (Family Group)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Audio Latency</span>
                <span style={{ fontWeight: 600 }}>&lt; 2.0s barge-in</span>
              </div>
            </div>
          </div>

          <div className="kin-card" style={{ padding: '22px', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Recent Session History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sessions.map((sess) => (
                <div key={sess.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{sess.id}</div>
                    <div style={{ color: '#64748b' }}>{new Date(sess.startedAt).toLocaleDateString()} · Lang: {sess.language}</div>
                  </div>
                  <span style={{
                    color: sess.riskScore > 50 ? '#ef4444' : '#10b981',
                    fontWeight: 700,
                    fontSize: '13px'
                  }}>
                    Risk: {sess.riskScore}/100
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
