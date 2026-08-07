import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Pre-load env before importing database client
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

import { db } from './infrastructure/database/database.client';
import { parseCustomerPhoneIdentity } from './shared/utils/phone-normalizer';

async function runAudit() {
  const client = db.getClient();
  console.log('=== STARTING DATABASE & LEGACY DATA AUDIT ===\n');

  // 1. Check Tables Existence & Record Counts
  const tables = ['customers', 'customer_identities', 'customer_merge_logs', 'restaurant_customer_counters', 'orders', 'payments', 'whatsapp_conversations'];
  const tableCounts: Record<string, number | string> = {};

  for (const table of tables) {
    try {
      const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        tableCounts[table] = `ERROR / MISSING: ${error.message}`;
      } else {
        tableCounts[table] = count ?? 0;
      }
    } catch (e: any) {
      tableCounts[table] = `EXCEPTION: ${e.message}`;
    }
  }

  console.log('--- TABLE RECORD COUNTS ---');
  console.table(tableCounts);

  // 2. Sample customer columns check
  const { data: sampleCustomer } = await client.from('customers').select('*').limit(1).maybeSingle();
  console.log('\n--- CUSTOMER SAMPLE COLUMNS PRESENT ---');
  if (sampleCustomer) {
    const keys = Object.keys(sampleCustomer);
    console.log('Columns found in customers table:', keys.join(', '));
    console.log('  customer_code: ', keys.includes('customer_code') ? 'PRESENT ✅' : 'NOT IN DB YET (Pending migration 00027 execution)');
    console.log('  primary_phone: ', keys.includes('primary_phone') ? 'PRESENT ✅' : 'NOT IN DB YET (Pending migration 00027 execution)');
    console.log('  whatsapp_lid:  ', keys.includes('whatsapp_lid') ? 'PRESENT ✅' : 'NOT IN DB YET (Pending migration 00027 execution)');
    console.log('  created_source:', keys.includes('created_source') ? 'PRESENT ✅' : 'NOT IN DB YET (Pending migration 00027 execution)');
    console.log('  is_merged:     ', keys.includes('is_merged') ? 'PRESENT ✅' : 'NOT IN DB YET (Pending migration 00027 execution)');
  } else {
    console.log('No customers found in DB to sample columns.');
  }

  // 3. Dry-Run Migration Preview (Detect Potential Duplicates)
  console.log('\n--- DRY-RUN PREVIEW: POTENTIAL MERGE DUPLICATES ---');
  const { data: allCustomers } = await client.from('customers').select('id, restaurant_id, phone, contact_phone, created_at');
  
  if (allCustomers && allCustomers.length > 0) {
    const phoneMap = new Map<string, any[]>();
    allCustomers.forEach(c => {
      const identity = parseCustomerPhoneIdentity(c.contact_phone || c.phone);
      if (identity.primaryPhone) {
        const key = `${c.restaurant_id}:${identity.primaryPhone}`;
        const list = phoneMap.get(key) || [];
        list.push(c);
        phoneMap.set(key, list);
      }
    });

    let duplicateGroups = 0;
    let totalMergedCount = 0;

    phoneMap.forEach((custs, key) => {
      if (custs.length > 1) {
        duplicateGroups++;
        totalMergedCount += (custs.length - 1);
      }
    });

    console.log(`Potential Duplicate Phone Groups Detected: ${duplicateGroups}`);
    console.log(`Total Duplicate Customer Rows to be Soft-Merged: ${totalMergedCount}`);
  } else {
    console.log('No existing customer records to evaluate for migration dry-run.');
  }

  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
