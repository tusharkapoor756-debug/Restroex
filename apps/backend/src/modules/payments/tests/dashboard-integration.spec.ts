import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { DashboardReceiptEngineDtoMapper, DashboardPaymentDetailDto } from '../engine/dtos/dashboard-engine-response.dto';
import { PaymentDecision, MerchantVerificationResult, FraudAnalysisResult } from '../engine/types/foundation-types';
import { StructuredPaymentReceipt } from '../engine/types/structured-receipt.schema';

async function runDashboardIntegrationTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 10: DASHBOARD INTEGRATION UNIT TESTS');
  console.log('=================================================================\n');

  const mockReceipt: StructuredPaymentReceipt = {
    amount: 500,
    currency: 'INR',
    receiverName: 'Restroex Cafe',
    receiverUpi: 'restroex@upi',
    receiverAccount: null,
    senderName: 'Rahul Verma',
    senderUpi: 'rahul@okaxis',
    senderAccount: null,
    transactionId: '987654321098',
    upiReference: '987654321098',
    status: 'SUCCESS',
    paymentApp: 'Google Pay',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    timestamp: '08:30 PM',
    date: 'Jul 24, 2026',
    confidenceScores: {
      amountConfidence: 95,
      receiverUpiConfidence: 95,
      upiReferenceConfidence: 95,
      statusConfidence: 95,
      overallConfidence: 100,
      isHighConfidence: true,
      requiresSecondaryReview: false,
    },
    rawLineCount: 7,
  };

  const mockVerification: MerchantVerificationResult = {
    upiMatch: true,
    nameMatch: true,
    amountMatch: true,
    statusMatch: true,
    overallMatchScore: 100,
    discrepancies: [],
  };

  const mockFraud: FraudAnalysisResult = {
    isDuplicateScreenshot: false,
    isDuplicateUtr: false,
    isWrongMerchant: false,
    amountMismatch: false,
    fraudScore: 0,
    riskLevel: 'LOW',
    riskFlags: [],
  };

  const mockDecision: PaymentDecision = {
    action: 'APPROVE',
    confidenceScore: 100,
    explanations: ['Payment APPROVED: Merchant UPI, order amount, and status verified cleanly with 0 fraud risk flags.'],
    evidence: {
      receipt: mockReceipt,
      verification: mockVerification,
      fraud: mockFraud,
    },
  };

  // Test 1: DTO Transformation Mapping
  console.log('Test 1 - Dashboard Engine DTO Mapping:');
  const dto: DashboardPaymentDetailDto = DashboardReceiptEngineDtoMapper.mapToDashboardDto(
    'pay-101',
    'ord-999',
    500,
    'INR',
    mockDecision,
    mockReceipt
  );

  if (dto.paymentId !== 'pay-101' || dto.orderId !== 'ord-999' || dto.status !== 'verified') {
    throw new Error('Test 1 Failed: Expected paymentId, orderId, and mapped status = verified.');
  }
  console.log('  ✔ Engine DTO mapped basic payment metadata cleanly.\n');

  // Test 2: Confidence Visualization Payload
  console.log('Test 2 - Confidence Visualization Payload:');
  const conf = dto.confidenceVisualization;
  if (conf.overallConfidence !== 100 || !conf.isHighConfidence || conf.requiresSecondaryReview) {
    throw new Error('Test 2 Failed: Confidence visualization payload mapping mismatch.');
  }
  if (conf.fieldBreakdown.amountConfidence !== 95 || conf.fieldBreakdown.upiReferenceConfidence !== 95) {
    throw new Error('Test 2 Failed: Field breakdown confidence mapping mismatch.');
  }
  console.log('  ✔ Confidence visualization payload & field breakdown formatted correctly.\n');

  // Test 3: Decision Explanation Payload
  console.log('Test 3 - Decision Explanation Payload:');
  const dec = dto.decisionPayload;
  if (dec.action !== 'APPROVE' || dec.confidenceScore !== 100 || dec.explanations.length !== 1) {
    throw new Error('Test 3 Failed: Decision payload mapping mismatch.');
  }
  console.log('  ✔ Decision payload & audit explanations formatted correctly.\n');

  // Test 4: Verification Summary Payload
  console.log('Test 4 - Verification Summary Payload:');
  const ver = dto.verificationSummaryPayload;
  if (ver.overallMatchScore !== 100 || !ver.upiMatch || !ver.amountMatch) {
    throw new Error('Test 4 Failed: Verification summary payload mapping mismatch.');
  }
  console.log('  ✔ Verification summary payload formatted correctly.\n');

  // Test 5: Fraud Risk Payload
  console.log('Test 5 - Fraud Risk Payload:');
  const frd = dto.fraudRiskPayload;
  if (frd.riskLevel !== 'LOW' || frd.fraudScore !== 0 || frd.isDuplicateScreenshot || frd.isDuplicateUtr) {
    throw new Error('Test 5 Failed: Fraud risk payload mapping mismatch.');
  }
  console.log('  ✔ Fraud risk payload formatted correctly.\n');

  // Test 6: JSON Serializability Compliance
  console.log('Test 6 - Dashboard DTO JSON Serializability Compliance:');
  const jsonStr = JSON.stringify(dto);
  if (!jsonStr || !jsonStr.includes('confidenceVisualization') || !jsonStr.includes('fraudRiskPayload')) {
    throw new Error('Test 6 Failed: DTO failed JSON serialization check.');
  }
  console.log('  ✔ Dashboard DTO passed JSON serialization compliance.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 10 DASHBOARD INTEGRATION UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runDashboardIntegrationTests().catch((err) => {
  console.error('❌ Dashboard Integration Unit Tests Failed:', err);
  process.exit(1);
});
