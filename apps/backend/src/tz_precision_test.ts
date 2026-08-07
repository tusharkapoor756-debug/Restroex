import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve("apps/backend/.env") });
import WebSocket from "ws"; (global as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });

// === THE FIXED toUtcMs function (exact copy from orders/page.tsx after fix) ===
const toUtcMs = (ts: string, now: number): number => {
  if (!ts) return now;
  const normalized = ts.endsWith("Z") || ts.includes("+") || (ts.includes("-") && ts.lastIndexOf("-") > 7)
    ? ts
    : ts + "Z";
  return new Date(normalized).getTime();
};

async function main() {
  const RID = "985f542e-d259-41c5-b51e-fe15692579c7";
  const CID = "1852f5f0-455a-489d-84ab-35be86437a65";
  const now  = Date.now();
  const t5   = new Date(now - 5  * 60 * 1000);
  const t12  = new Date(now - 12 * 60 * 1000);

  console.log("=".repeat(60));
  console.log("  PRECISION TEST: isUrgent calculation after timezone fix");
  console.log("=".repeat(60));
  console.log(`  Test run at (UTC): ${new Date(now).toISOString()}`);
  console.log(`  Node timezone:     UTC+${Math.abs(new Date().getTimezoneOffset()/60)} (IST)`);

  const { data: o5 } = await sb.from("orders").insert({
    restaurant_id: RID, customer_id: CID, customer_phone: "9990003754",
    status: "paid", total_amount: 100, order_type: "takeaway",
    idempotency_key: `PT5-${Date.now()}`,
    human_readable_id: `PT5-${Date.now().toString().slice(-4)}`,
    created_at: t5.toISOString(),
  }).select("id, created_at").single();

  const { data: o12 } = await sb.from("orders").insert({
    restaurant_id: RID, customer_id: CID, customer_phone: "9990003754",
    status: "paid", total_amount: 100, order_type: "takeaway",
    idempotency_key: `PT12-${Date.now()}`,
    human_readable_id: `PT12-${Date.now().toString().slice(-4)}`,
    created_at: t12.toISOString(),
  }).select("id, created_at").single();

  if (!o5 || !o12) { console.log("Insert failed"); return; }

  const runNow = Date.now();

  const rawAge5  = (runNow - new Date(o5.created_at).getTime())  / 60000;
  const rawAge12 = (runNow - new Date(o12.created_at).getTime()) / 60000;
  const fixAge5  = (runNow - toUtcMs(o5.created_at, runNow))  / 60000;
  const fixAge12 = (runNow - toUtcMs(o12.created_at, runNow)) / 60000;

  console.log("\n  [Order 1 — EXPECTED: 5 min, isUrgent = FALSE]");
  console.log(`    Supabase raw string:   "${o5.created_at}"`);
  console.log(`    --------------------------------------------`);
  console.log(`    BEFORE fix (raw):      ${rawAge5.toFixed(1)} min  ?  isUrgent = ${rawAge5 >= 10}  ${rawAge5 >= 10 ? "? WRONG" : "? correct"}`);
  console.log(`    AFTER  fix (toUtcMs):  ${fixAge5.toFixed(1)} min  ?  isUrgent = ${fixAge5 >= 10}  ${fixAge5 >= 10 ? "? WRONG" : "? CORRECT"}`);

  console.log("\n  [Order 2 — EXPECTED: 12 min, isUrgent = TRUE]");
  console.log(`    Supabase raw string:   "${o12.created_at}"`);
  console.log(`    --------------------------------------------`);
  console.log(`    BEFORE fix (raw):      ${rawAge12.toFixed(1)} min  ?  isUrgent = ${rawAge12 >= 10}  ${rawAge12 >= 10 ? "(was correct by accident)" : "? WRONG"}`);
  console.log(`    AFTER  fix (toUtcMs):  ${fixAge12.toFixed(1)} min  ?  isUrgent = ${fixAge12 >= 10}  ${fixAge12 >= 10 ? "? CORRECT" : "? WRONG"}`);

  const pass = fixAge5 < 10 && fixAge12 >= 10;
  console.log("\n" + "=".repeat(60));
  console.log(`  VERDICT: ${pass ? "? ALL CORRECT — Fix works" : "? STILL BROKEN"}`);
  console.log(`  5-min  order: ${fixAge5.toFixed(1)}m  isUrgent=${fixAge5 >= 10} (expected FALSE)`);
  console.log(`  12-min order: ${fixAge12.toFixed(1)}m  isUrgent=${fixAge12 >= 10} (expected TRUE)`);
  console.log("=".repeat(60));

  await sb.from("orders").delete().eq("id", o5.id);
  await sb.from("orders").delete().eq("id", o12.id);
  console.log("  Test orders cleaned up.");
}
main().catch(console.error);
