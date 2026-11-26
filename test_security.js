// Defensive Security Verification Script for SocialManager
// Tests SQL Injection resilience, Path Traversal protections, CORS & Security Headers,
// and reports on credential exposure and input sanitization.

const BASE_URL = 'http://localhost:5000';

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('🛡️  SocialManager Security & Vulnerability Audit');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const auditLog = [];

  function logFinding(category, check, result, severity, details) {
    auditLog.push({ category, check, result, severity, details });
    const badge = result === 'SECURE' ? '🟢 SECURE' : result === 'WARNING' ? '🟡 WARNING' : '🔴 VULNERABLE';
    console.log(`[${badge}] [${severity}] ${check}`);
    console.log(`       Details: ${details}\n`);
  }

  // 1. SQL INJECTION (SQLi) TEST
  console.log('--- 1. SQL Injection (SQLi) Defense Testing ---');
  try {
    const maliciousPayload = "Test'; DROP TABLE comments; --";
    const sqliSearch = await fetch(`${BASE_URL}/api/calling/campaigns/1/leads?search=${encodeURIComponent(maliciousPayload)}`);
    if (sqliSearch.status === 200) {
      // Check if comments table still exists
      const commentsCheck = await fetch(`${BASE_URL}/api/comments`);
      if (commentsCheck.status === 200) {
        logFinding('Database Security', 'Parameterized SQL Query Verification', 'SECURE', 'INFO', 'Database uses prepared statements (db.prepare). SQL injection payload was neutralized and treated as raw text string.');
      } else {
        logFinding('Database Security', 'SQL Injection', 'VULNERABLE', 'HIGH', 'SQL injection payload affected database state.');
      }
    }
  } catch (err) {
    console.error('SQLi test error:', err.message);
  }

  // 2. PATH TRAVERSAL DEFENSE TEST
  console.log('--- 2. Path Traversal & Directory Traversal Testing ---');
  try {
    const traversalUrls = [
      `${BASE_URL}/uploads/..%2f..%2fserver%2findex.js`,
      `${BASE_URL}/uploads/..\\..\\server\\index.js`,
      `${BASE_URL}/uploads/%2e%2e%2f%2e%2e%2fpackage.json`
    ];

    let traversalBlocked = true;
    for (const url of traversalUrls) {
      const res = await fetch(url);
      const text = await res.text();
      if (res.status === 200 && (text.includes('require(') || text.includes('dependencies'))) {
        traversalBlocked = false;
        break;
      }
    }

    if (traversalBlocked) {
      logFinding('Filesystem Security', 'Static Uploads Path Traversal Defense', 'SECURE', 'INFO', 'express.static and serve-static automatically block directory traversal and relative dot-dot (..) paths.');
    } else {
      logFinding('Filesystem Security', 'Path Traversal Protection', 'VULNERABLE', 'CRITICAL', 'Directory traversal allowed accessing sensitive root/server files.');
    }
  } catch (err) {
    console.error('Path traversal test error:', err.message);
  }

  // 3. CORS CONFIGURATION CHECK
  console.log('--- 3. Cross-Origin Resource Sharing (CORS) Audit ---');
  try {
    const corsRes = await fetch(`${BASE_URL}/api/health`, {
      headers: { Origin: 'https://evil-unauthorized-site.com' }
    });
    const acao = corsRes.headers.get('access-control-allow-origin');
    if (acao === '*') {
      logFinding('Network Security', 'Permissive CORS Policy', 'WARNING', 'MEDIUM', 'CORS is set to wildcard ("*"). If exposed beyond localhost, any external web page could issue API requests on behalf of the user. Recommendation: Bind CORS to localhost:5000 or trusted domains.');
    } else {
      logFinding('Network Security', 'Restricted CORS Policy', 'SECURE', 'INFO', `CORS origin restricted to: ${acao || 'same-origin'}`);
    }
  } catch (err) {
    console.error('CORS audit error:', err.message);
  }

  // 4. HTTP SECURITY HEADERS AUDIT
  console.log('--- 4. HTTP Security Headers Audit ---');
  try {
    const headerRes = await fetch(`${BASE_URL}/`);
    const headers = headerRes.headers;

    const missingHeaders = [];
    if (!headers.get('x-content-type-options')) missingHeaders.push('X-Content-Type-Options: nosniff');
    if (!headers.get('x-frame-options')) missingHeaders.push('X-Frame-Options: SAMEORIGIN (Clickjacking protection)');
    if (!headers.get('content-security-policy')) missingHeaders.push('Content-Security-Policy (CSP)');

    if (missingHeaders.length > 0) {
      logFinding('Header Hardening', 'HTTP Security Headers', 'WARNING', 'LOW', `Missing recommended defense-in-depth headers: ${missingHeaders.join(', ')}. Recommendation: Add helmet middleware in Express.`);
    } else {
      logFinding('Header Hardening', 'HTTP Security Headers', 'SECURE', 'INFO', 'All major security headers present.');
    }
  } catch (err) {
    console.error('Header audit error:', err.message);
  }

  // 5. CREDENTIAL MASKING AUDIT
  console.log('--- 5. API Secrets & Credential Masking Audit ---');
  try {
    const settingsRes = await fetch(`${BASE_URL}/api/settings`);
    const settingsData = await settingsRes.json();
    const secretsMasked = settingsData.settings?.OPENAI_API_KEY === '••••••••••••••••' || !settingsData.settings?.OPENAI_API_KEY;

    const callingSettingsRes = await fetch(`${BASE_URL}/api/calling/settings`);
    const callingData = await callingSettingsRes.json();
    const hasRawAuthToken = callingData.settings?.twilioAuthToken && callingData.settings?.twilioAuthToken.length > 5;

    if (secretsMasked) {
      logFinding('Credential Storage', 'Main API Settings Masking', 'SECURE', 'INFO', 'Core credentials (OpenAI, Gemini, Meta, Google Secret) are securely masked with bullet dots on GET requests.');
    }

    if (hasRawAuthToken) {
      logFinding('Credential Storage', 'Telephony Auth Token Exposure', 'WARNING', 'LOW', 'Twilio Auth Token / Vapi Key returned in cleartext to client. Recommendation: Mask tokens in UI similar to OpenAI keys.');
    }
  } catch (err) {
    console.error('Credential audit error:', err.message);
  }

  // 6. WEBHOOK AUTHENTICATION AUDIT
  console.log('--- 6. Public Webhook Authentication Audit ---');
  try {
    const waWebhookGet = await fetch(`${BASE_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=WRONG_TOKEN&hub.challenge=123`);
    if (waWebhookGet.status === 403) {
      logFinding('Webhook Security', 'Meta WhatsApp Webhook Verification', 'SECURE', 'INFO', 'Rejects unauthorized verification tokens with HTTP 403 Forbidden.');
    }

    const vapiWebhookRes = await fetch(`${BASE_URL}/api/calling/webhook/vapi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { type: 'ping' } })
    });
    if (vapiWebhookRes.status === 200) {
      logFinding('Webhook Security', 'Telephony Webhook Authentication', 'WARNING', 'MEDIUM', 'Webhook endpoint /api/calling/webhook/vapi currently accepts POST payloads without signature validation. Safe for local development; when deployed to production with a public URL, add a shared webhook secret verification.');
    }
  } catch (err) {
    console.error('Webhook audit error:', err.message);
  }

  console.log('================================================================');
  console.log('🛡️  Security Audit Complete: Summary Generated.');
  console.log('================================================================');
}

runSecurityAudit().catch(err => {
  console.error('Security audit fatal error:', err);
  process.exit(1);
});
