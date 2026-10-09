import React from 'react';
import { Link } from 'wouter';
import { 
  ShieldCheck, AlertTriangle, ArrowLeft, ExternalLink, Play, 
  Monitor, Send, Eye, HelpCircle, CheckCircle2 
} from 'lucide-react';

export default function ScamLab() {
  return (
    <div className="scam-lab-page kin-reveal" style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={14} /> KIN ASSISTANT
          </Link>
          <span>/</span>
          <span>DEMO WORKSPACE</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: 'var(--foreground, #0f172a)' }}>
          Kin Phishing &amp; Scam Test Lab
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '2px' }}>
          Pre-scripted test pages designed for live Gemini Multimodal screen-sharing demos and pitch evaluations.
        </p>
      </div>

      {/* Demo Instructions Banner */}
      <div className="kin-card" style={{ padding: '20px 24px', borderRadius: '12px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <HelpCircle size={18} /> How to Run the Pitch Demo (1-Minute Walkthrough)
        </h3>
        <ol style={{ paddingLeft: '20px', fontSize: '13.5px', color: '#334155', lineHeight: 1.7 }}>
          <li>Open <strong>Kin Live Assistant</strong> in one browser window and click <strong>"Start live session"</strong>.</li>
          <li>Click the button below to launch one of the <strong>Demo Scam Pages</strong> in a separate tab or window.</li>
          <li>In Kin, click <strong>"Share screen"</strong> and select that tab.</li>
          <li>
            Notice how Kin's <strong>Guardian Service</strong> samples the screen at ~1 FPS, performs 
            <strong> KIN AI ANALYSIS</strong>, flashes the alert, and automatically triggers the 
            <strong> Telegram Family Notification</strong>!
          </li>
        </ol>
      </div>

      {/* Scam Test Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '36px' }}>
        
        {/* Test Scenario 1: AnyDesk */}
        <div className="kin-card" style={{ padding: '24px', borderRadius: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px', borderRadius: '10px' }}>
              <Monitor size={24} />
            </div>
            <span style={{ background: '#fef2f2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', border: '1px solid #fecdd3' }}>
              CRITICAL / REMOTE ACCESS
            </span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '16px' }}>
            Scenario 1: AnyDesk Tech Support Scam
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '6px', lineHeight: 1.5, flex: 1 }}>
            Simulates an unexpected technician call instructing the parent to read aloud a 9-digit connection code 
            (<code>482 109 773</code>) to reverse bogus charges.
          </p>

          <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', margin: '16px 0', fontSize: '12.5px', color: '#475569' }}>
            <strong>Expected AI Behavior:</strong>
            <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
              <li>Recognizes remote takeover software</li>
              <li>Flags connection code prompt as HIGH RISK</li>
              <li>Instructs: <em>"Do not read the code, hang up immediately"</em></li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
            <a 
              href="/scam-lab/anydesk.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="kin-button start-live"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', textDecoration: 'none', color: '#fff', fontSize: '13px', fontWeight: 600 }}
            >
              <ExternalLink size={15} /> Launch AnyDesk Lab
            </a>
          </div>
        </div>

        {/* Test Scenario 2: Bank / UPI OTP */}
        <div className="kin-card" style={{ padding: '24px', borderRadius: '14px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ background: '#ffedd5', color: '#ea580c', padding: '10px', borderRadius: '10px' }}>
              <AlertTriangle size={24} />
            </div>
            <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
              HIGH RISK / CREDENTIAL PHISHING
            </span>
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 700, marginTop: '16px' }}>
            Scenario 2: Fake Bank &amp; UPI OTP Gateway
          </h2>
          <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '6px', lineHeight: 1.5, flex: 1 }}>
            Simulates a urgent fake netbanking cancellation portal with a countdown timer demanding 
            Debit Card PIN and 6-digit SMS OTP to reverse an unauthorized ₹1,49,000 transfer.
          </p>

          <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', margin: '16px 0', fontSize: '12.5px', color: '#475569' }}>
            <strong>Expected AI Behavior:</strong>
            <ul style={{ paddingLeft: '16px', marginTop: '4px' }}>
              <li>Identifies fake countdown timer &amp; pressure tactic</li>
              <li>Detects request for secret PIN and OTP</li>
              <li>Calls <code>raise_scam_alert</code> and highlights safe actions</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
            <a 
              href="/scam-lab/bank.html" 
              target="_blank" 
              rel="noopener noreferrer"
              className="kin-button start-live"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', textDecoration: 'none', color: '#fff', fontSize: '13px', fontWeight: 600 }}
            >
              <ExternalLink size={15} /> Launch Bank OTP Lab
            </a>
          </div>
        </div>

      </div>

      <div style={{ textAlign: 'center' }}>
        <Link href="/" className="kin-button secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', textDecoration: 'none' }}>
          <ArrowLeft size={15} /> Return to Kin Assistant
        </Link>
      </div>
    </div>
  );
}
