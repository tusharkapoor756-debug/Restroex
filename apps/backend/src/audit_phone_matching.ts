import { parseCustomerPhoneIdentity } from './shared/utils/phone-normalizer';

function runPhoneMatchingAudit() {
  console.log('=== STARTING PHONE NORMALIZATION & MATCHING AUDIT ===\n');

  const testCases = [
    { input: '+919876543210', expectedPrimary: '919876543210', expectedLid: null, isLid: false },
    { input: '919876543210', expectedPrimary: '919876543210', expectedLid: null, isLid: false },
    { input: '9876543210', expectedPrimary: '919876543210', expectedLid: null, isLid: false },
    { input: '9876543210@s.whatsapp.net', expectedPrimary: '919876543210', expectedLid: null, isLid: false },
    { input: '82073285091419@lid', expectedPrimary: null, expectedLid: '82073285091419@lid', isLid: true },
    { input: '82073285091419', expectedPrimary: null, expectedLid: '82073285091419@lid', isLid: true }, // 14-digit numeric LID without @lid suffix
  ];

  let passed = 0;
  testCases.forEach((tc, idx) => {
    const res = parseCustomerPhoneIdentity(tc.input);
    const primaryOk = res.primaryPhone === tc.expectedPrimary;
    const lidOk = res.whatsappLid === tc.expectedLid;
    const isLidOk = res.isLid === tc.isLid;

    const ok = primaryOk && lidOk && isLidOk;
    if (ok) passed++;

    console.log(`Test #${idx + 1} [${tc.input}]: ${ok ? 'PASS ✅' : 'FAIL ❌'}`);
    if (!ok) {
      console.log('  Expected:', { primaryPhone: tc.expectedPrimary, whatsappLid: tc.expectedLid, isLid: tc.isLid });
      console.log('  Actual:  ', res);
    }
  });

  console.log(`\nPhone Matching Audit Results: ${passed}/${testCases.length} Passed.`);
  process.exit(passed === testCases.length ? 0 : 1);
}

runPhoneMatchingAudit();
