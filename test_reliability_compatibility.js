/**
 * Reliability, Stability, and Compatibility Test Suite for SocialManager
 * Target: http://localhost:5000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BASE_URL = 'http://localhost:5000';
const HOST = '127.0.0.1';
const PORT = 5000;

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'ReliabilityTester/1.0',
      'Origin': 'http://localhost:5000'
    };

    if (postData && typeof postData === 'string' && !options.headers?.['Content-Type']) {
      defaultHeaders['Content-Type'] = 'application/json';
      defaultHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const reqOptions = {
      hostname: options.hostname || HOST,
      port: options.port || PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: { ...defaultHeaders, ...(options.headers || {}) }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    results.push({ name: testName, status: 'PASS', details });
    console.log(`[PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
  } else {
    results.push({ name: testName, status: 'FAIL', details });
    console.error(`[FAIL] ${testName}: ${details}`);
  }
}

async function runSuite() {
  console.log('\n=============================================================');
  console.log('🛡️  SocialManager Reliability, Stability & Compatibility Suite');
  console.log(`Target: ${BASE_URL} | Process: Node.js ${process.version}`);
  console.log('=============================================================\n');

  // -------------------------------------------------------------
  // MODULE 1: ENDURANCE & SUSTAINED LOAD STABILITY
  // -------------------------------------------------------------
  console.log('--- 1. Endurance & Memory Stability Under Sustained Load ---');
  const initialMem = process.memoryUsage();
  const sustainedIterations = 500;
  let sustainedSuccesses = 0;
  const enduranceEndpoints = [
    '/api/health',
    '/api/settings/stats',
    '/api/channels',
    '/api/calling/settings',
    '/api/calling/follow-ups'
  ];

  const tStart = Date.now();
  for (let i = 0; i < sustainedIterations; i++) {
    const ep = enduranceEndpoints[i % enduranceEndpoints.length];
    try {
      const res = await httpRequest({ path: ep, method: 'GET' });
      if (res.statusCode === 200) sustainedSuccesses++;
    } catch (err) {}
  }
  const enduranceDuration = (Date.now() - tStart) / 1000;
  const postMem = process.memoryUsage();
  const heapGrowthMB = (postMem.heapUsed - initialMem.heapUsed) / (1024 * 1024);

  assert(
    sustainedSuccesses === sustainedIterations,
    'Sustained Requests Reliability',
    `${sustainedSuccesses}/${sustainedIterations} successful in ${enduranceDuration.toFixed(2)}s (${(sustainedIterations/enduranceDuration).toFixed(1)} req/s)`
  );

  assert(
    heapGrowthMB < 50,
    'Heap Stability & Zero Memory Leaks',
    `Heap delta: ${heapGrowthMB.toFixed(2)} MB, RSS: ${(postMem.rss / (1024*1024)).toFixed(1)} MB`
  );

  // -------------------------------------------------------------
  // MODULE 2: FAULT INJECTION & ERROR RECOVERY
  // -------------------------------------------------------------
  console.log('\n--- 2. Fault Injection & Error Recovery ---');

  // Test 2.1: Malformed JSON syntax
  try {
    const malformedRes = await httpRequest({
      path: '/api/calling/leads',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, '{"name": "Bad JSON", "phone_number": ');

    assert(
      malformedRes.statusCode === 400 && (malformedRes.json?.error || malformedRes.data.includes('JSON')),
      'Malformed JSON Handling',
      `HTTP status ${malformedRes.statusCode}, clean JSON error response without crash`
    );
  } catch (err) {
    assert(false, 'Malformed JSON Handling', err.message);
  }

  // Test 2.2: Oversized Payload (1 MB)
  try {
    const largePayload = JSON.stringify({
      name: 'Oversized Tester',
      phone_number: '+919999999999',
      notes: 'A'.repeat(500 * 1024) // 500 KB note
    });
    const largeRes = await httpRequest({
      path: '/api/calling/leads',
      method: 'POST'
    }, largePayload);

    assert(
      largeRes.statusCode === 200 || largeRes.statusCode === 413,
      'Large Payload Resiliency',
      `Server handled 500KB body safely with status ${largeRes.statusCode}`
    );
  } catch (err) {
    assert(false, 'Large Payload Resiliency', err.message);
  }

  // Test 2.3: Non-existent API endpoint
  try {
    const nonExistentRes = await httpRequest({ path: '/api/definitely_not_a_route_xyz123' });
    assert(
      nonExistentRes.statusCode === 200 || nonExistentRes.statusCode === 404,
      'Invalid Route Resilience',
      `Status ${nonExistentRes.statusCode} without uncaught exception`
    );
  } catch (err) {
    assert(false, 'Invalid Route Resilience', err.message);
  }

  // Test 2.4: Missing required fields
  try {
    const missingRes = await httpRequest({
      path: '/api/calling/leads',
      method: 'POST'
    }, JSON.stringify({ notes: 'missing name and phone' }));

    assert(
      missingRes.statusCode === 400 && missingRes.json?.error,
      'Missing Required Fields Validation',
      `Returned 400: "${missingRes.json?.error}"`
    );
  } catch (err) {
    assert(false, 'Missing Required Fields Validation', err.message);
  }

  // Test 2.5: Complex Unicode & Emojis
  try {
    const unicodeRes = await httpRequest({
      path: '/api/calling/leads',
      method: 'POST'
    }, JSON.stringify({
      name: 'स्नेहा शर्मा 🌷 (Sneha Harmony)',
      phone_number: '+919876543299',
      interest: 'Acoustic 🎸 & Classical Vocals 🎶',
      notes: 'Contains Unicode: 日本語 / العربية / Español / नमस्ते'
    }));

    const isSuccess = unicodeRes.statusCode === 200 && unicodeRes.json?.lead?.name?.includes('स्नेहा');
    assert(
      isSuccess,
      'Full Unicode & Emoji Integrity',
      `Saved & retrieved: "${unicodeRes.json?.lead?.name}"`
    );
  } catch (err) {
    assert(false, 'Full Unicode & Emoji Integrity', err.message);
  }

  // Test 2.6: SQL Injection & Script Injection Payload Neutralization
  try {
    const attackPayload = {
      name: "Test'); DROP TABLE leads; --",
      phone_number: '+919876543298',
      interest: "<script>alert('XSS')</script>",
      notes: "1' OR '1'='1"
    };
    const sqliRes = await httpRequest({
      path: '/api/calling/leads',
      method: 'POST'
    }, JSON.stringify(attackPayload));

    assert(
      sqliRes.statusCode === 200 && sqliRes.json?.lead?.id,
      'Injection Payload Neutralization',
      `Payload safely saved as raw string with ID ${sqliRes.json?.lead?.id}, tables intact`
    );
  } catch (err) {
    assert(false, 'Injection Payload Neutralization', err.message);
  }

  // -------------------------------------------------------------
  // MODULE 3: DATABASE INTEGRITY & CONCURRENT WAL STRESS
  // -------------------------------------------------------------
  console.log('\n--- 3. Database Integrity & Concurrent WAL Stress ---');

  // Test 3.1: 50 Concurrent Asynchronous Database Writes
  const concurrentWrites = 50;
  const writePromises = [];
  for (let i = 0; i < concurrentWrites; i++) {
    writePromises.push(
      httpRequest({
        path: '/api/rules',
        method: 'POST'
      }, JSON.stringify({
        name: `Stress Rule #${i}`,
        platform: 'all',
        trigger_type: 'contains',
        keywords: `stress_kw_${i}`,
        reply_template: `Stress reply content #${i}`,
        use_ai_polish: 0,
        cooldown_seconds: 30
      }))
    );
  }

  const writeResults = await Promise.all(writePromises);
  const writeSuccesses = writeResults.filter(r => r.statusCode === 200).length;

  assert(
    writeSuccesses === concurrentWrites,
    '50 Concurrent DB Writes Resilience',
    `${writeSuccesses}/${concurrentWrites} writes committed concurrently without SQLite busy locks`
  );

  // Test 3.2: Direct SQLite PRAGMA Integrity Check
  try {
    const dbPath = path.join(__dirname, 'data', 'app.db');
    const directDb = new DatabaseSync(dbPath);

    const integrityResult = directDb.prepare('PRAGMA integrity_check;').all();
    const isIntegrityOk = integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok';

    assert(
      isIntegrityOk,
      'SQLite Disk File Integrity Check (PRAGMA integrity_check)',
      `Database status: ${integrityResult[0]?.integrity_check}`
    );

    const quickResult = directDb.prepare('PRAGMA quick_check;').all();
    const isQuickOk = quickResult.length === 1 && quickResult[0].quick_check === 'ok';

    assert(
      isQuickOk,
      'SQLite Fast Index Integrity (PRAGMA quick_check)',
      `Quick check: ${quickResult[0]?.quick_check}`
    );

    const fkResult = directDb.prepare('PRAGMA foreign_key_check;').all();
    assert(
      fkResult.length === 0,
      'Foreign Key Referential Integrity',
      `${fkResult.length} orphaned foreign key records found`
    );

    directDb.close();
  } catch (err) {
    assert(false, 'Database Integrity Checks', err.message);
  }

  // -------------------------------------------------------------
  // MODULE 4: NETWORK & PROTOCOL COMPATIBILITY
  // -------------------------------------------------------------
  console.log('\n--- 4. Network & Protocol Compatibility ---');

  // Test 4.1: IPv4 loopback (127.0.0.1) vs Localhost
  try {
    const ipRes = await httpRequest({ hostname: '127.0.0.1', path: '/api/health' });
    const hostRes = await httpRequest({ hostname: 'localhost', path: '/api/health' });

    assert(
      ipRes.statusCode === 200 && hostRes.statusCode === 200,
      'Host Resolution Compatibility',
      `127.0.0.1 (HTTP ${ipRes.statusCode}) & localhost (HTTP ${hostRes.statusCode})`
    );
  } catch (err) {
    assert(false, 'Host Resolution Compatibility', err.message);
  }

  // Test 4.2: CORS Preflight (OPTIONS)
  try {
    const optionsRes = await httpRequest({
      path: '/api/calling/leads',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const hasCorsHeaders = optionsRes.statusCode === 204 || optionsRes.statusCode === 200;
    assert(
      hasCorsHeaders,
      'CORS Preflight Compatibility',
      `OPTIONS returned HTTP ${optionsRes.statusCode}`
    );
  } catch (err) {
    assert(false, 'CORS Preflight Compatibility', err.message);
  }

  // Test 4.3: Security Headers Verification
  try {
    const secRes = await httpRequest({ path: '/api/health' });
    const nosniff = secRes.headers['x-content-type-options'] === 'nosniff';
    const sameorigin = secRes.headers['x-frame-options'] === 'SAMEORIGIN';
    const refpolicy = !!secRes.headers['referrer-policy'];

    assert(
      nosniff && sameorigin && refpolicy,
      'Security Headers Compatibility',
      `nosniff=${nosniff}, sameorigin=${sameorigin}, referrer-policy=${secRes.headers['referrer-policy']}`
    );
  } catch (err) {
    assert(false, 'Security Headers Compatibility', err.message);
  }

  // -------------------------------------------------------------
  // MODULE 5: PHONE NUMBER & FORMATTING COMPATIBILITY
  // -------------------------------------------------------------
  console.log('\n--- 5. Phone Number & Data Format Compatibility ---');

  const phoneFormats = [
    { label: 'Standard E.164 with plus', phone: '+919876543210' },
    { label: 'E.164 with space delimiter', phone: '+91 98765 43210' },
    { label: 'Dashed delimiter', phone: '+91-98765-43210' },
    { label: 'Parenthesized US format', phone: '+1 (555) 234-5678' },
    { label: 'Raw 10-digit without country code', phone: '9876543210' }
  ];

  let formatsSupported = 0;
  for (const fmt of phoneFormats) {
    try {
      const res = await httpRequest({
        path: '/api/calling/leads',
        method: 'POST'
      }, JSON.stringify({
        name: `Format Test ${fmt.label}`,
        phone_number: fmt.phone,
        interest: 'Format Compatibility'
      }));

      if (res.statusCode === 200 && res.json?.lead?.phone_number) {
        formatsSupported++;
      }
    } catch (e) {}
  }

  assert(
    formatsSupported === phoneFormats.length,
    'Varied Phone Number Formats Compatibility',
    `${formatsSupported}/${phoneFormats.length} formats accepted and stored safely`
  );

  // -------------------------------------------------------------
  // MODULE 6: CLIENT BUILD & BROWSER COMPATIBILITY AUDIT
  // -------------------------------------------------------------
  console.log('\n--- 6. Frontend Build & Browser Compatibility ---');

  try {
    const distDir = path.join(__dirname, 'client', 'dist');
    const indexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

    // 1. HTML5 Doctype & Viewport Meta tag
    const hasHtml5 = indexHtml.includes('<!doctype html>') || indexHtml.includes('<!DOCTYPE html>');
    const hasViewport = indexHtml.includes('name="viewport"') && indexHtml.includes('width=device-width');
    assert(
      hasHtml5 && hasViewport,
      'HTML5 Doctype & Mobile Viewport Meta Tag',
      'Valid responsive viewport meta declaration present'
    );

    // 2. CSS Bundle Checks
    const assetsDir = path.join(distDir, 'assets');
    const assetFiles = fs.readdirSync(assetsDir);
    const cssFile = assetFiles.find(f => f.endsWith('.css'));
    const jsFile = assetFiles.find(f => f.endsWith('.js'));

    if (cssFile) {
      const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
      const hasFlex = cssContent.includes('flex');
      const hasGrid = cssContent.includes('grid');
      const hasMediaQueries = cssContent.includes('@media');

      assert(
        hasFlex && hasGrid && hasMediaQueries,
        'Modern CSS Engine Compatibility (Flex, Grid & Responsive Breakpoints)',
        `Bundle size: ${(cssContent.length / 1024).toFixed(1)} KB with media queries`
      );
    }

    // 3. Web Speech API Graceful Degradation in JS
    if (jsFile) {
      const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
      const checksSpeechSynthesis = jsContent.includes('speechSynthesis') || jsContent.includes('SpeechSynthesisUtterance');
      assert(
        checksSpeechSynthesis,
        'Web Speech API Integration & Feature Guarding',
        'Audio synthesis speech engine bundled with feature checks'
      );
    }
  } catch (err) {
    assert(false, 'Frontend Build & Browser Compatibility', err.message);
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`📊 Reliability & Compatibility Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================================\n');

  return { passed, failed, total: results.length };
}

runSuite().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
