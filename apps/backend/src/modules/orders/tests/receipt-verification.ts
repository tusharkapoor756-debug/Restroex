// apps/backend/src/modules/orders/tests/receipt-verification.ts
import { ReceiptFormatterService } from '../services/receipt-formatter.service';
import { Order } from '../types/order.types';

function runReceiptVerification() {
  console.log('🧪 Starting Billing Identity and Receipt Formatter Tests...');

  const formatter = new ReceiptFormatterService();

  // Mock Order with full receipt snapshot metadata
  const mockOrder: Order = {
    id: 'test-order-uuid',
    restaurantId: 'test-rest-uuid',
    customerPhone: '+919876543210',
    status: 'paid',
    totalAmount: 580.00,
    idempotencyKey: 'razorpay_order_ref_id_102',
    humanReadableId: 'ORD-1024',
    receiptSnapshot: {
      restaurantId: 'test-rest-uuid',
      customerPhone: '+919876543210',
      humanReadableId: 'ORD-1024',
      totalAmount: 580.00,
      items: [
        {
          name: 'Malai Chaap',
          variantName: 'half',
          quantity: 2,
          unitPrice: 280.00,
          totalPrice: 560.00,
        },
        {
          name: 'Rumali Roti',
          variantName: undefined,
          quantity: 1,
          unitPrice: 20.00,
          totalPrice: 20.00,
        }
      ],
      generatedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const receiptOutput = formatter.formatReceipt(mockOrder, 'pay_NHD83jJ82jJd');
  console.log('\nGenerated WhatsApp Receipt Output Preview:\n');
  console.log(receiptOutput);

  // Assertion check elements
  if (!receiptOutput.includes('ORD-1024')) {
    console.error('❌ Formatting failed: missing human readable order ID');
    process.exit(1);
  }

  if (!receiptOutput.includes('Malai Chaap (half)')) {
    console.error('❌ Formatting failed: missing item or variant snaps');
    process.exit(1);
  }

  if (!receiptOutput.includes('Grand Total: ₹580.00')) {
    console.error('❌ Formatting failed: grand totals calculation mismatch');
    process.exit(1);
  }

  if (!receiptOutput.includes('*Ref ID:* pay_NHD83jJ82jJd')) {
    console.error('❌ Formatting failed: failed to attach payment reference ID');
    process.exit(1);
  }

  console.log('\n🌟 ALL BILLING RECEIPT FORMATTING SCENARIOS PASSED SUCCESSFULLY!');
}

runReceiptVerification();
