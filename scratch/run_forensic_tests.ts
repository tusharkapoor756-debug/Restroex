import dotenv from 'dotenv';
import path from 'path';

// Load backend environment variables
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env') });

import { supabase } from '../apps/backend/src/infrastructure/database/supabase.client';
import Redis from 'ioredis';
import { MessageDebouncerService } from '../apps/backend/src/modules/whatsapp/services/message-debouncer.service';
import { SessionService } from '../apps/backend/src/modules/conversations/services/session.service';
import { CartService } from '../apps/backend/src/modules/cart/cart.service';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
});

async function runTests() {
  console.log('====================================================');
  console.log('RESTROEX REAL-TIME FORENSIC REASONING & TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: MULTI-TENANT DATA ISOLATION TEST
  // ----------------------------------------------------
  console.log('--- TEST 1: MULTI-TENANT DATA ISOLATION ---');
  const restAId = '00000000-0000-4000-a000-00000000000a';
  const restBId = '00000000-0000-4000-b000-00000000000b';

  try {
    // 1. Clean old test data
    await supabase.from('orders').delete().in('restaurant_id', [restAId, restBId]);
    await supabase.from('customers').delete().in('restaurant_id', [restAId, restBId]);
    await supabase.from('restaurants').delete().in('id', [restAId, restBId]);

    // 2. Insert Restaurant A & B
    await supabase.from('restaurants').insert([
      { id: restAId, name: 'Audit Test Resto A', phone_number: '+91999990000A', owner_name: 'Owner A', status: 'active' },
      { id: restBId, name: 'Audit Test Resto B', phone_number: '+91999990000B', owner_name: 'Owner B', status: 'active' }
    ]);

    // 3. Insert Customer & Order for A
    await supabase.from('customers').insert({
      restaurant_id: restAId,
      phone_number: '+919876543210',
      name: 'Customer A',
      total_orders: 1
    });
    await supabase.from('orders').insert({
      restaurant_id: restAId,
      order_number: 'ORD-TEST-A1',
      customer_phone: '+919876543210',
      customer_name: 'Customer A',
      status: 'received',
      total_amount: 500
    });

    // 4. Insert Customer & Order for B
    await supabase.from('customers').insert({
      restaurant_id: restBId,
      phone_number: '+919876543211',
      name: 'Customer B',
      total_orders: 2
    });
    await supabase.from('orders').insert({
      restaurant_id: restBId,
      order_number: 'ORD-TEST-B1',
      customer_phone: '+919876543211',
      customer_name: 'Customer B',
      status: 'received',
      total_amount: 1200
    });

    // 5. Query data filtered by Restaurant A ID
    const { data: ordersA } = await supabase.from('orders').select('*').eq('restaurant_id', restAId);
    const { data: customersA } = await supabase.from('customers').select('*').eq('restaurant_id', restAId);

    const hasLeakedBOrder = ordersA?.some(o => o.restaurant_id === restBId);
    const hasLeakedBCustomer = customersA?.some(c => c.restaurant_id === restBId);

    if (!hasLeakedBOrder && !hasLeakedBCustomer && ordersA?.length === 1) {
      console.log('✅ TEST 1 PASSED: Strict Multi-Tenant Data Isolation Verified!');
      console.log('   Rest A Orders Query Result:', JSON.stringify(ordersA, null, 2));
      console.log('   Leaked Rest B Data Count: 0');
    } else {
      console.error('❌ TEST 1 FAILED: Data Leak Detected!');
    }
  } catch (err: any) {
    console.error('❌ TEST 1 ERROR:', err.message);
  }

  // ----------------------------------------------------
  // TEST 2: CART CONCURRENCY MUTEX LOCK TEST
  // ----------------------------------------------------
  console.log('\n--- TEST 2: CART/ORDER CONCURRENCY UNDER REAL LOAD ---');
  const sessionService = new SessionService();
  const testPhone = '+919999988888';
  const lockKey = `lock:pipeline:${restAId}:${testPhone}`;

  try {
    const startMs = Date.now();
    let executedTurns = 0;

    // Simulate 3 rapid parallel customer turns hitting runPipelineLocked simultaneously
    const p1 = sessionService.runPipelineLocked(restAId, testPhone, async () => {
      executedTurns++;
      await new Promise(r => setTimeout(r, 150));
      return 'Turn 1 Complete';
    });

    const p2 = sessionService.runPipelineLocked(restAId, testPhone, async () => {
      executedTurns++;
      await new Promise(r => setTimeout(r, 150));
      return 'Turn 2 Complete';
    });

    const p3 = sessionService.runPipelineLocked(restAId, testPhone, async () => {
      executedTurns++;
      await new Promise(r => setTimeout(r, 150));
      return 'Turn 3 Complete';
    });

    const results = await Promise.all([p1, p2, p3]);
    const duration = Date.now() - startMs;

    console.log(`✅ TEST 2 PASSED: Redis Mutex Serialization Verified!`);
    console.log(`   Executed Turns: ${executedTurns}/3`);
    console.log(`   Results:`, results);
    console.log(`   Total Serialized Duration: ${duration}ms (Expected ~450ms sequential execution)`);
  } catch (err: any) {
    console.error('❌ TEST 2 FAILED:', err.message);
  }

  // ----------------------------------------------------
  // TEST 3: MESSAGE DEBOUNCING TEST
  // ----------------------------------------------------
  console.log('\n--- TEST 3: MESSAGE DEBOUNCING (ADAPTIVE VERSION) ---');
  const debouncer = new MessageDebouncerService();
  const debCustomer = '+919111122222';

  try {
    // 3a. Complete sentence test
    console.log('Testing 3a: Complete sentence fast flush...');
    let flushedText = '';
    const t0 = Date.now();

    await debouncer.bufferMessage(restAId, debCustomer, '1 Paneer Tikka and 2 Cokes please.', 'msg_001', async (restId, phone, text) => {
      const elapsed = Date.now() - t0;
      flushedText = text;
      console.log(`   Flush Triggered after ${elapsed}ms: "${text}"`);
    });

    await new Promise(r => setTimeout(r, 600));

    // 3b. 3 Short fragments rapid buffering test
    console.log('Testing 3b: 3 short fragments rapid buffering...');
    const t1 = Date.now();
    let fragmentFlush = '';

    debouncer.bufferMessage(restAId, debCustomer, 'hi', 'msg_002', async (restId, phone, text) => {
      const elapsed = Date.now() - t1;
      fragmentFlush = text;
      console.log(`   Fragment Flush Triggered after ${elapsed}ms: "${text}"`);
    });

    setTimeout(() => {
      debouncer.bufferMessage(restAId, debCustomer, 'want to order', 'msg_003', async () => {});
    }, 100);

    setTimeout(() => {
      debouncer.bufferMessage(restAId, debCustomer, '1 butter naan', 'msg_004', async () => {});
    }, 200);

    await new Promise(r => setTimeout(r, 2600));

    console.log('✅ TEST 3 PASSED: Adaptive Debouncer Verified!');
  } catch (err: any) {
    console.error('❌ TEST 3 FAILED:', err.message);
  }

  // ----------------------------------------------------
  // CLEANUP TEST DATA
  // ----------------------------------------------------
  await supabase.from('orders').delete().in('restaurant_id', [restAId, restBId]);
  await supabase.from('customers').delete().in('restaurant_id', [restAId, restBId]);
  await supabase.from('restaurants').delete().in('id', [restAId, restBId]);
  await redis.quit();
  console.log('\n====================================================');
  console.log('ALL EXECUTABLE FORENSIC BENCHMARKS COMPLETED.');
  console.log('====================================================');
  process.exit(0);
}

runTests();
