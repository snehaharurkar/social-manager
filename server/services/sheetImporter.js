const XLSX = require('xlsx');
const fs = require('fs');
const { db, logActivity } = require('../db');
const { formatPhoneNumber, isNumberSuppressed } = require('./vapi');

/**
 * Inspect an uploaded spreadsheet (.xlsx, .xls, .csv), detect columns, and suggest mappings.
 */
function inspectSpreadsheet(filePath, customMapping = null) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Spreadsheet file not found on disk.');
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!rawMatrix || rawMatrix.length === 0) {
    throw new Error('The uploaded spreadsheet contains no data.');
  }

  // 1. Locate the header row (first row with at least 2 non-empty values)
  let headerIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const row = rawMatrix[i];
    if (Array.isArray(row)) {
      const nonBlankCount = row.filter(c => String(c || '').trim() !== '').length;
      if (nonBlankCount >= 2) {
        headerIndex = i;
        break;
      }
    }
  }

  const headerRow = rawMatrix[headerIndex] || [];
  const detectedColumns = [];
  const colIndexMap = {};

  headerRow.forEach((col, idx) => {
    const str = String(col || '').trim();
    const cleanName = str || `Column_${idx + 1}`;
    detectedColumns.push(cleanName);
    colIndexMap[cleanName] = idx;
  });

  // 2. Intelligent column auto-mapping helper
  const findBestCol = (candidates) => {
    for (const cand of candidates) {
      const match = detectedColumns.find(c => {
        const clean = c.toLowerCase().replace(/[_\s-]+/g, '');
        return clean === cand || clean.includes(cand);
      });
      if (match) return match;
    }
    return '';
  };

  const suggestedMapping = {
    nameCol: findBestCol(['name', 'fullname', 'contactname', 'leadname', 'student', 'candidate', 'client', 'customer']),
    phoneCol: findBestCol(['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'cell', 'whatsapp', 'tel']),
    emailCol: findBestCol(['email', 'mail', 'emailaddress', 'emailid']),
    companyCol: findBestCol(['company', 'organization', 'business', 'firm', 'school', 'college']),
    interestCol: findBestCol(['interest', 'course', 'service', 'subject', 'program', 'topic', 'inquiry', 'query', 'product']),
    sourceCol: findBestCol(['source', 'leadsource', 'platform', 'channel', 'origin']),
    notesCol: findBestCol(['notes', 'remark', 'remarks', 'comment', 'description', 'message']),
    consentCol: findBestCol(['consent', 'permission', 'optin', 'agree', 'allowcall', 'status'])
  };

  const activeMapping = customMapping ? { ...suggestedMapping, ...customMapping } : suggestedMapping;

  // 3. Extract sample preview rows (top 5 rows)
  const sampleRows = [];
  const maxSample = Math.min(rawMatrix.length, headerIndex + 6);
  for (let i = headerIndex + 1; i < maxSample; i++) {
    const rawR = rawMatrix[i];
    if (Array.isArray(rawR) && rawR.some(c => String(c || '').trim() !== '')) {
      const rowObj = {};
      detectedColumns.forEach((col, idx) => {
        rowObj[col] = rawR[idx] !== undefined ? String(rawR[idx]).trim() : '';
      });
      sampleRows.push(rowObj);
    }
  }

  // 4. Validate and parse all data rows
  const parsedRows = [];
  const phoneSeenInSheet = new Set();

  let validCallableCount = 0;
  let invalidPhoneCount = 0;
  let duplicateCount = 0;
  let dndSuppressedCount = 0;
  let optOutCount = 0;

  const dataRows = rawMatrix.slice(headerIndex + 1);

  dataRows.forEach((rawR, rowIdx) => {
    if (!Array.isArray(rawR) || !rawR.some(c => String(c || '').trim() !== '')) {
      return;
    }

    const getVal = (colName) => {
      if (!colName) return '';
      const idx = colIndexMap[colName];
      return idx !== undefined && rawR[idx] !== undefined ? String(rawR[idx]).trim() : '';
    };

    const rawName = getVal(activeMapping.nameCol);
    const rawPhone = getVal(activeMapping.phoneCol);
    const rawEmail = getVal(activeMapping.emailCol);
    const rawCompany = getVal(activeMapping.companyCol);
    const rawInterest = getVal(activeMapping.interestCol);
    const rawSource = getVal(activeMapping.sourceCol);
    const rawNotes = getVal(activeMapping.notesCol);
    const rawConsent = getVal(activeMapping.consentCol);

    // Skip entirely empty row
    if (!rawName && !rawPhone && !rawEmail && !rawInterest) {
      return;
    }

    // Preserve all custom unmapped columns in customFields JSON
    const customFields = {};
    const mappedColNames = Object.values(activeMapping).filter(Boolean);
    detectedColumns.forEach(col => {
      if (!mappedColNames.includes(col)) {
        const val = getVal(col);
        if (val) customFields[col] = val;
      }
    });

    const cleanPhone = formatPhoneNumber(rawPhone);
    let isCallable = true;
    let exclusionReason = null;

    // Check Phone Validity
    if (!cleanPhone || cleanPhone.length < 10) {
      isCallable = false;
      exclusionReason = 'Invalid or missing phone number';
      invalidPhoneCount++;
    }

    // Check Consent (if mapped)
    if (isCallable && activeMapping.consentCol) {
      const cLower = rawConsent.toLowerCase().trim();
      if (['no', 'false', '0', 'denied', 'optout', 'opt-out', 'refused'].includes(cLower)) {
        isCallable = false;
        exclusionReason = 'Opted out / Consent denied';
        optOutCount++;
      }
    }

    // Check Do Not Contact table
    if (isCallable) {
      const dnd = isNumberSuppressed(cleanPhone);
      if (dnd) {
        isCallable = false;
        exclusionReason = `DND suppressed: ${dnd.reason || 'On Do Not Contact list'}`;
        dndSuppressedCount++;
      }
    }

    // Check Duplicates in this sheet
    if (isCallable) {
      if (phoneSeenInSheet.has(cleanPhone)) {
        isCallable = false;
        exclusionReason = 'Duplicate phone number in spreadsheet';
        duplicateCount++;
      } else {
        phoneSeenInSheet.add(cleanPhone);
      }
    }

    if (isCallable) {
      validCallableCount++;
    }

    parsedRows.push({
      rowIndex: headerIndex + 1 + rowIdx + 1,
      name: rawName || 'Unnamed Contact',
      phone_number: cleanPhone || rawPhone || 'Missing',
      email: rawEmail || '',
      company: rawCompany || '',
      interest: rawInterest || 'General Inquiry',
      lead_source: rawSource || 'spreadsheet',
      notes: rawNotes || '',
      consent: rawConsent || 'Yes',
      custom_fields: customFields,
      is_callable: isCallable,
      exclusion_reason: exclusionReason
    });
  });

  return {
    sheetName,
    totalRows: parsedRows.length,
    validCallableLeads: validCallableCount,
    excludedLeadsCount: parsedRows.length - validCallableCount,
    invalidPhoneCount,
    duplicateCount,
    dndSuppressedCount,
    optOutCount,
    detectedColumns,
    headerRowIndex: headerIndex,
    suggestedMapping,
    currentMapping: activeMapping,
    sampleRows,
    parsedRows
  };
}

/**
 * Save validated leads into the database and attach to a new or existing campaign.
 */
function importLeadsToCampaign({ campaignTitle, fileName, leads, customScript, delaySeconds = 8, assistantId = null, provider = 'vapi' }) {
  // Create Campaign
  const stmt = db.prepare(`
    INSERT INTO calling_campaigns (
      title, file_name, total_leads, completed_calls, status, call_script, delay_seconds, assistant_id, provider
    ) VALUES (?, ?, ?, 0, 'idle', ?, ?, ?, ?)
  `);

  const result = stmt.run(
    campaignTitle || `Calling Campaign - ${new Date().toLocaleDateString()}`,
    fileName || 'imported_leads.xlsx',
    leads.length,
    customScript || null,
    Number(delaySeconds) || 8,
    assistantId || null,
    provider || 'vapi'
  );

  const campaignId = Number(result.lastInsertRowid);

  // Insert leads
  const insertLead = db.prepare(`
    INSERT INTO calling_leads (
      campaign_id, name, phone_number, email, company, interest, lead_source, notes, 
      custom_fields, call_status, do_not_contact, last_call_outcome, provider
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let callableCount = 0;
  let excludedCount = 0;

  for (const lead of leads) {
    const isCallable = lead.is_callable !== false && lead.phone_number && !lead.phone_number.startsWith('Invalid');
    const initialStatus = isCallable ? 'pending' : (lead.exclusion_reason?.includes('DND') ? 'dnc' : 'failed');
    const isDnd = initialStatus === 'dnc' ? 1 : 0;

    if (isCallable) callableCount++; else excludedCount++;

    insertLead.run(
      campaignId,
      lead.name || 'Unnamed Contact',
      lead.phone_number,
      lead.email || null,
      lead.company || null,
      lead.interest || null,
      lead.lead_source || 'spreadsheet',
      lead.notes || null,
      lead.custom_fields ? JSON.stringify(lead.custom_fields) : null,
      initialStatus,
      isDnd,
      !isCallable ? lead.exclusion_reason : null,
      provider || 'vapi'
    );
  }

  logActivity('calling', 'campaign_imported', 'success', `Imported ${leads.length} leads into Campaign #${campaignId} (${callableCount} callable, ${excludedCount} excluded).`);

  return {
    campaignId,
    totalLeads: leads.length,
    callableLeads: callableCount,
    excludedLeads: excludedCount
  };
}

module.exports = {
  inspectSpreadsheet,
  importLeadsToCampaign
};
