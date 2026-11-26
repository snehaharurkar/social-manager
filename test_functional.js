// Comprehensive Functional Test Suite for SocialManager
// Tests all backend API routes, services, and frontend bundle delivery.

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  const results = [];
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    const start = Date.now();
    try {
      await fn();
      const duration = Date.now() - start;
      results.push({ name, status: 'PASS', duration });
      passed++;
      console.log(`[PASS] ${name} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      results.push({ name, status: 'FAIL', duration, error: err.message });
      failed++;
      console.error(`[FAIL] ${name} (${duration}ms):`, err.message);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  console.log('====================================================');
  console.log('🚀 Running Functional Test Suite against SocialManager');
  console.log(`Target: ${BASE_URL}`);
  console.log('====================================================\n');

  // MODULE 1: System & Core Health
  await test('Healthcheck API (GET /api/health)', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.status === 'ok', `Expected status ok, got ${data.status}`);
  });

  await test('System Stats & Activity Logs (GET /api/settings/stats)', async () => {
    const res = await fetch(`${BASE_URL}/api/settings/stats`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.stats, 'Missing stats object');
    assert(Array.isArray(data.recentLogs), 'Expected recentLogs array');
  });

  // MODULE 2: Channels & Connected Accounts
  await test('Connected Channels List (GET /api/channels)', async () => {
    const res = await fetch(`${BASE_URL}/api/channels`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(Array.isArray(data.channels), 'Expected channels array');
    console.log(`       Active channels: ${data.channels.length}`);
  });

  // MODULE 3: Auto-Reply Rules
  await test('Auto-Reply Rules CRUD (GET & POST /api/rules)', async () => {
    const listRes = await fetch(`${BASE_URL}/api/rules`);
    assert(listRes.status === 200, 'GET /api/rules failed');
    const list = await listRes.json();
    assert(Array.isArray(list.rules), 'Expected rules array');

    // Create a temporary rule
    const createRes = await fetch(`${BASE_URL}/api/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Guitar Lesson Rule',
        platform: 'all',
        trigger_type: 'contains',
        keywords: 'testlesson, chords',
        reply_template: 'Hi! Thank you for inquiring about lessons. Message us for slots!'
      })
    });
    assert(createRes.status === 200, 'POST /api/rules failed');
    const created = await createRes.json();
    assert(created.success, 'Rule creation returned success: false');

    // Clean up test rule
    if (created.id) {
      await fetch(`${BASE_URL}/api/rules/${created.id}`, { method: 'DELETE' });
    }
  });

  // MODULE 4: Post Scheduler
  await test('Scheduled Posts List (GET /api/posts)', async () => {
    const res = await fetch(`${BASE_URL}/api/posts`);
    assert(res.status === 200, 'GET /api/posts failed');
    const data = await res.json();
    assert(Array.isArray(data.posts), 'Expected posts array');
  });

  // MODULE 5: Comments & Inbox
  await test('Comments & Viewer Feed (GET /api/comments?platform=all)', async () => {
    const res = await fetch(`${BASE_URL}/api/comments?platform=all`);
    assert(res.status === 200, 'GET /api/comments failed');
    const data = await res.json();
    assert(Array.isArray(data.comments), 'Expected comments array');
  });

  // MODULE 6: WhatsApp & Leads
  await test('WhatsApp Status & Contacts (GET /api/whatsapp/web/status, /contacts)', async () => {
    const statusRes = await fetch(`${BASE_URL}/api/whatsapp/web/status`);
    assert(statusRes.status === 200, 'GET /api/whatsapp/web/status failed');
    const status = await statusRes.json();
    assert(status.success === true, 'Expected status.success to be true');
    assert(typeof status.status === 'string', 'Expected status string in WhatsApp status');

    const contactsRes = await fetch(`${BASE_URL}/api/whatsapp/contacts`);
    assert(contactsRes.status === 200, 'GET /api/whatsapp/contacts failed');
    const contacts = await contactsRes.json();
    assert(Array.isArray(contacts.contacts), 'Expected contacts array');
  });

  // MODULE 7: Instagram & Leads
  await test('Instagram Leads & Settings (GET /api/instagram/leads, /settings)', async () => {
    const leadsRes = await fetch(`${BASE_URL}/api/instagram/leads`);
    assert(leadsRes.status === 200, 'GET /api/instagram/leads failed');
    const leads = await leadsRes.json();
    assert(Array.isArray(leads.leads), 'Expected instagram leads array');

    const setRes = await fetch(`${BASE_URL}/api/instagram/settings`);
    assert(setRes.status === 200, 'GET /api/instagram/settings failed');
  });

  // MODULE 8: Telegram & Leads
  await test('Telegram Leads & Settings (GET /api/telegram/leads, /settings)', async () => {
    const setRes = await fetch(`${BASE_URL}/api/telegram/settings`);
    assert(setRes.status === 200, 'GET /api/telegram/settings failed');
    const settings = await setRes.json();
    assert(settings.success, 'Expected telegram settings success');

    const leadsRes = await fetch(`${BASE_URL}/api/telegram/leads`);
    assert(leadsRes.status === 200, 'GET /api/telegram/leads failed');
    const leads = await leadsRes.json();
    assert(Array.isArray(leads.leads), 'Expected telegram leads array');
  });

  // MODULE 9: AI Outbound Calling Agent & Telephony
  let testCampaignId = null;
  let testLeadId = null;

  await test('Calling Settings (GET /api/calling/settings)', async () => {
    const res = await fetch(`${BASE_URL}/api/calling/settings`);
    assert(res.status === 200, 'GET /api/calling/settings failed');
    const data = await res.json();
    assert(data.success, 'Settings success should be true');
    assert(data.settings.agentName, 'Missing agentName in calling settings');
    assert(data.settings.callingMode, 'Missing callingMode in calling settings');
  });

  await test('Create Calling Campaign with Leads (POST /api/calling/campaigns)', async () => {
    const res = await fetch(`${BASE_URL}/api/calling/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Functional Test Guitar Campaign',
        fileName: 'test_leads.xlsx',
        leads: [
          { name: 'Test Lead Alpha', phone_number: '+919988001122', email: 'alpha@test.com', interest: 'Acoustic Beginner' },
          { name: 'Test Lead Beta', phone_number: '+919988003344', email: 'beta@test.com', interest: 'Fingerstyle Mastery' }
        ],
        delaySeconds: 5
      })
    });
    assert(res.status === 200, 'POST /api/calling/campaigns failed');
    const data = await res.json();
    assert(data.success, 'Campaign creation failed');
    assert(data.campaignId, 'Missing campaignId');
    testCampaignId = data.campaignId;
    console.log(`       Created Campaign ID: ${testCampaignId} with ${data.totalLeads} leads`);
  });

  await test('Fetch Campaign Leads (GET /api/calling/campaigns/:id/leads)', async () => {
    assert(testCampaignId, 'No campaign ID');
    const res = await fetch(`${BASE_URL}/api/calling/campaigns/${testCampaignId}/leads`);
    assert(res.status === 200, 'GET campaign leads failed');
    const data = await res.json();
    assert(data.success, 'Fetch leads returned success: false');
    assert(data.leads.length >= 2, `Expected at least 2 leads, got ${data.leads.length}`);
    testLeadId = data.leads[0].id;
  });

  await test('Add Individual Lead Manually (POST /api/calling/leads)', async () => {
    const res = await fetch(`${BASE_URL}/api/calling/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: testCampaignId,
        name: 'Manual Individual Contact',
        phone_number: '+919876543299',
        email: 'individual@music.com',
        interest: '1-on-1 Masterclass',
        notes: 'Requested online slot'
      })
    });
    assert(res.status === 200, 'POST /api/calling/leads failed');
    const data = await res.json();
    assert(data.success, 'Add lead returned success: false');
    assert(data.lead.name === 'Manual Individual Contact', 'Lead name mismatch');
  });

  await test('Direct Individual Quick Call (POST /api/calling/call-direct)', async () => {
    const res = await fetch(`${BASE_URL}/api/calling/call-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Quick Dial Contact',
        phone_number: '+919811223344',
        interest: 'Guitar Production',
        campaign_id: testCampaignId
      })
    });
    assert(res.status === 200, 'POST /api/calling/call-direct failed');
    const data = await res.json();
    assert(data.success, 'Direct call returned success: false');
    assert(data.callResult, 'Missing callResult');
    console.log(`       Outcome: ${data.callResult.status} (${data.callResult.duration}s)`);
  });

  await test('Trigger Call to Existing Lead (POST /api/calling/leads/:id/call)', async () => {
    assert(testLeadId, 'No test lead ID');
    const res = await fetch(`${BASE_URL}/api/calling/leads/${testLeadId}/call`, {
      method: 'POST'
    });
    assert(res.status === 200, 'Call lead failed');
    const data = await res.json();
    assert(data.success, 'Call lead returned success: false');
    assert(data.callResult.transcript, 'Missing transcript');
    console.log(`       Call Transcript generated: ${data.callResult.transcript.length} chars`);
  });

  await test('Update Lead Status & Follow-Up (PUT /api/calling/leads/:id)', async () => {
    assert(testLeadId, 'No test lead ID');
    const res = await fetch(`${BASE_URL}/api/calling/leads/${testLeadId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_status: 'interested',
        notes: 'Verified via automated test run'
      })
    });
    assert(res.status === 200, 'Update lead failed');
    const data = await res.json();
    assert(data.success, 'Update lead returned success: false');
    assert(data.lead.call_status === 'interested', `Expected interested, got ${data.lead.call_status}`);
  });

  await test('Schedule Follow-Up Callback (POST /api/calling/leads/:id/follow-up)', async () => {
    assert(testLeadId, 'No test lead ID');
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const res = await fetch(`${BASE_URL}/api/calling/leads/${testLeadId}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        followUpDate: tomorrowStr,
        notes: 'Follow-up on trial lesson fee package'
      })
    });
    assert(res.status === 200, 'Schedule follow-up failed');
    const data = await res.json();
    assert(data.success, 'Schedule follow-up returned success: false');
  });

  await test('Follow-Up Hub Aggregations (GET /api/calling/follow-ups)', async () => {
    const res = await fetch(`${BASE_URL}/api/calling/follow-ups`);
    assert(res.status === 200, 'GET /api/calling/follow-ups failed');
    const data = await res.json();
    assert(data.success, 'Follow-ups returned success: false');
    assert(data.counts, 'Missing counts');
    assert(typeof data.counts.total === 'number', 'Expected number for total followups');
    console.log(`       Total follow-ups: ${data.counts.total} (Overdue: ${data.counts.overdue}, Today: ${data.counts.today}, Upcoming: ${data.counts.upcoming})`);
  });

  await test('Export Campaign Results to Excel .xlsx (GET /api/calling/campaigns/:id/export)', async () => {
    assert(testCampaignId, 'No campaign ID');
    const res = await fetch(`${BASE_URL}/api/calling/campaigns/${testCampaignId}/export`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const contentType = res.headers.get('content-type');
    assert(contentType && contentType.includes('spreadsheetml'), `Expected excel content-type, got ${contentType}`);
    const buf = await res.arrayBuffer();
    assert(buf.byteLength > 1000, `Excel buffer too small (${buf.byteLength} bytes)`);
    console.log(`       Exported Excel file size: ${buf.byteLength} bytes`);
  });

  // Clean up test campaign
  if (testCampaignId) {
    await fetch(`${BASE_URL}/api/calling/campaigns/${testCampaignId}`, { method: 'DELETE' });
  }

  // MODULE 10: Frontend SPA & Static Bundle Delivery
  await test('Frontend HTML Entrypoint (GET /)', async () => {
    const res = await fetch(`${BASE_URL}/`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const html = await res.text();
    assert(html.includes('<div id="root"></div>'), 'HTML missing root element');
    assert(html.includes('/assets/index-'), 'HTML missing bundled Vite assets');

    const jsMatch = html.match(/src="(\/assets\/[^"]+\.js)"/);
    assert(jsMatch, 'Missing bundled JS in index.html');
    const jsRes = await fetch(`${BASE_URL}${jsMatch[1]}`);
    assert(jsRes.status === 200, `JS asset returned ${jsRes.status}`);
    const jsContent = await jsRes.text();
    assert(jsContent.length > 50000, `JS asset suspiciously small (${jsContent.length} bytes)`);

    const cssMatch = html.match(/href="(\/assets\/[^"]+\.css)"/);
    assert(cssMatch, 'Missing bundled CSS in index.html');
    const cssRes = await fetch(`${BASE_URL}${cssMatch[1]}`);
    assert(cssRes.status === 200, `CSS asset returned ${cssRes.status}`);
    const cssContent = await cssRes.text();
    assert(cssContent.length > 5000, `CSS asset suspiciously small (${cssContent.length} bytes)`);

    console.log(`       Bundled JS: ${jsMatch[1]} (${(jsContent.length / 1024).toFixed(1)} KB)`);
    console.log(`       Bundled CSS: ${cssMatch[1]} (${(cssContent.length / 1024).toFixed(1)} KB)`);
  });

  console.log('\n====================================================');
  console.log(`✅ Functional Test Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
