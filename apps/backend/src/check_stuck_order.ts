import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve("apps/backend/.env") });
import WebSocket from "ws"; (global as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });

async function main() {
  // Last 2 hours ke saare payment_pending orders
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await sb
    .from("orders")
    .select("id, human_readable_id, status, total_amount, customer_phone, restaurant_id, created_at, updated_at, idempotency_key")
    .in("status", ["payment_pending", "checkout_pending"])
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) { console.log("ERROR:", error.message); return; }
  console.log(`Found ${orders?.length ?? 0} stuck orders (payment_pending/checkout_pending) in last 2h:`);
  orders?.forEach(o => {
    const ageMin = Math.floor((Date.now() - new Date(o.created_at + "Z").getTime()) / 60000);
    console.log(`\n  Order: #${o.human_readable_id || o.id.slice(0,8)}`);
    console.log(`    id         = ${o.id}`);
    console.log(`    status     = ${o.status}`);
    console.log(`    amount     = ?${o.total_amount}`);
    console.log(`    phone      = ${o.customer_phone}`);
    console.log(`    created    = ${o.created_at} (${ageMin}m ago)`);
    console.log(`    updated    = ${o.updated_at}`);
  });

  // Also check payments table for these orders
  if (orders && orders.length > 0) {
    const ids = orders.map(o => o.id);
    const { data: payments } = await sb
      .from("payments")
      .select("order_id, payment_status, payment_method, provider_name, amount, created_at, verified_at")
      .in("order_id", ids);
    console.log(`\n--- Payments for these orders ---`);
    payments?.forEach(p => {
      console.log(`  order_id=${p.order_id.slice(0,8)}  payment_status=${p.payment_status}  method=${p.payment_method}  provider=${p.provider_name}  amount=?${p.amount}  verified_at=${p.verified_at}`);
    });
  }

  // Also check ALL recent orders (any status) to get full picture
  const { data: allRecent } = await sb
    .from("orders")
    .select("id, human_readable_id, status, total_amount, customer_phone, created_at")
    .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())  // last 30 min
    .order("created_at", { ascending: false });
  console.log(`\n--- All orders in last 30 min ---`);
  allRecent?.forEach(o => {
    const ageMin = Math.floor((Date.now() - new Date(o.created_at + "Z").getTime()) / 60000);
    console.log(`  #${o.human_readable_id || o.id.slice(0,8)}  status=${o.status}  ?${o.total_amount}  phone=${o.customer_phone}  age=${ageMin}m`);
  });
}
main().catch(console.error);
