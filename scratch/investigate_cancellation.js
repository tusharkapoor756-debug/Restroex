const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../apps/backend/.env') });

const { db } = require('../apps/backend/dist/infrastructure/database/database.client');

async function main() {
  console.log('=== INVESTIGATING ORDER CANCELLATIONS & TIMELINE ===');
  await db.connect();
  const client = db.getClient();

  // 1. Get recent 10 orders
  const { data: orders, error: oErr } = await client
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (oErr) {
    console.error('Error fetching orders:', oErr);
    return;
  }

  console.log(`Retrieved ${orders.length} recent orders:\n`);

  for (const order of orders) {
    console.log(`==================================================`);
    console.log(`Order ID:          ${order.id}`);
    console.log(`Human Readable ID: ${order.human_readable_id}`);
    console.log(`Customer Phone:    ${order.customer_phone}`);
    console.log(`Status:            ${order.status}`);
    console.log(`Total Amount:      ${order.total_amount}`);
    console.log(`Idempotency Key:   ${order.idempotency_key}`);
    console.log(`Created At:        ${order.created_at}`);
    console.log(`Updated At:        ${order.updated_at}`);
    console.log(`Cancelled At:      ${order.cancelled_at}`);

    // Fetch Timeline
    const { data: timeline } = await client
      .from('order_status_timeline')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    console.log(`\n--- Order Status Timeline ---`);
    if (timeline && timeline.length > 0) {
      timeline.forEach((t) => console.log(`  [${t.created_at}] Status: ${t.status}`));
    } else {
      console.log(`  No timeline entries found.`);
    }

    // Fetch Associated Payment
    const { data: payments } = await client
      .from('payments')
      .select('*')
      .eq('order_id', order.id);

    console.log(`\n--- Associated Payments ---`);
    if (payments && payments.length > 0) {
      payments.forEach((p) => {
        console.log(`  Payment ID: ${p.id} | Status: ${p.payment_status} | Method: ${p.payment_method} | Created: ${p.created_at} | StoragePath: ${p.gateway_data?.storagePath || 'none'}`);
      });
    } else {
      console.log(`  No payments found.`);
    }
  }

  // Fetch recent conversation_sessions if present
  console.log(`\n==================================================`);
  console.log(`=== CHECKING RECENT SESSIONS ===`);
  const { data: sessions } = await client
    .from('conversation_sessions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (sessions && sessions.length > 0) {
    sessions.forEach((s) => {
      console.log(`\nSession Phone: ${s.customer_phone} | State: ${s.state}`);
      console.log(`Context:`, JSON.stringify(s.context));
      console.log(`Cart:`, JSON.stringify(s.cart));
      console.log(`Updated At: ${s.updated_at}`);
    });
  } else {
    console.log('No conversation_sessions found.');
  }
}

main().catch(console.error);
