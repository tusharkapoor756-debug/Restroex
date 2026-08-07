import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve("apps/backend/.env") });
import WebSocket from "ws"; (global as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });

async function main() {
  const RID = "985f542e-d259-41c5-b51e-fe15692579c7";
  const CID = "1852f5f0-455a-489d-84ab-35be86437a65";

  const now = Date.now();
  const t5  = new Date(now - 5  * 60 * 1000);  // 5 min ago
  const t12 = new Date(now - 12 * 60 * 1000);  // 12 min ago

  console.log("\n=== PROBE: What format does Supabase return created_at? ===");
  console.log("Local Date.now() UTC string:", new Date(now).toISOString());

  // Create 5-min order
  const { data: o5 } = await sb.from("orders").insert({
    restaurant_id: RID, customer_id: CID, customer_phone: "9990003754",
    status: "paid", total_amount: 100, order_type: "takeaway",
    idempotency_key: `TZ-5-${Date.now()}`,
    human_readable_id: `TZ5${Date.now().toString().slice(-4)}`,
    created_at: t5.toISOString(),
  }).select("id, created_at").single();

  // Create 12-min order
  const { data: o12 } = await sb.from("orders").insert({
    restaurant_id: RID, customer_id: CID, customer_phone: "9990003754",
    status: "paid", total_amount: 100, order_type: "takeaway",
    idempotency_key: `TZ-12-${Date.now()}`,
    human_readable_id: `TZ12${Date.now().toString().slice(-4)}`,
    created_at: t12.toISOString(),
  }).select("id, created_at").single();

  if (!o5 || !o12) { console.log("Insert failed"); return; }

  console.log("\n=== RAW Supabase created_at strings (exact bytes from API) ===");
  console.log("5-min  order raw string:", JSON.stringify(o5.created_at));
  console.log("12-min order raw string:", JSON.stringify(o12.created_at));

  console.log("\n=== CALCULATION TEST (both methods) ===");
  const runAt = Date.now();

  // Method A: raw string (current code, NO timezone handling)
  const ageA_5  = (runAt - new Date(o5.created_at).getTime())  / 60000;
  const ageA_12 = (runAt - new Date(o12.created_at).getTime()) / 60000;

  // Method B: force UTC by appending Z if missing
  const forceUTC = (s: string) => s.endsWith("Z") || s.includes("+") ? s : s + "Z";
  const ageB_5  = (runAt - new Date(forceUTC(o5.created_at)).getTime())  / 60000;
  const ageB_12 = (runAt - new Date(forceUTC(o12.created_at)).getTime()) / 60000;

  console.log("\n  [5-min order]");
  console.log(`    Inserted created_at (we sent): ${t5.toISOString()}`);
  console.log(`    Supabase returned:             ${o5.created_at}`);
  console.log(`    Method A age (raw, current):   ${ageA_5.toFixed(2)} min`);
  console.log(`    Method B age (force UTC):       ${ageB_5.toFixed(2)} min`);
  console.log(`    EXPECTED ~5 min`);
  console.log(`    isUrgent (A, >=10):  ${ageA_5 >= 10}  ? ${ageA_5 >= 10 === false ? "CORRECT" : "WRONG — should be FALSE"}`);
  console.log(`    isUrgent (B, >=10):  ${ageB_5 >= 10}  ? ${ageB_5 >= 10 === false ? "CORRECT" : "WRONG — should be FALSE"}`);

  console.log("\n  [12-min order]");
  console.log(`    Inserted created_at (we sent): ${t12.toISOString()}`);
  console.log(`    Supabase returned:             ${o12.created_at}`);
  console.log(`    Method A age (raw, current):   ${ageA_12.toFixed(2)} min`);
  console.log(`    Method B age (force UTC):       ${ageB_12.toFixed(2)} min`);
  console.log(`    EXPECTED ~12 min`);
  console.log(`    isUrgent (A, >=10):  ${ageA_12 >= 10}  ? ${ageA_12 >= 10 === true ? "CORRECT" : "WRONG — should be TRUE"}`);
  console.log(`    isUrgent (B, >=10):  ${ageB_12 >= 10}  ? ${ageB_12 >= 10 === true ? "CORRECT" : "WRONG — should be TRUE"}`);

  console.log("\n=== TIMEZONE OFFSET CHECK ===");
  const localOffsetMin = new Date().getTimezoneOffset();
  console.log(`  Node.js timezone offset: ${localOffsetMin} min (${localOffsetMin < 0 ? "UTC+" : "UTC-"}${Math.abs(localOffsetMin/60)})`);
  console.log(`  IST is UTC+5:30 = offset -330 min`);
  const tzExplains342 = Math.abs(ageA_12 - ageB_12);
  console.log(`  Difference between Method A and B: ${tzExplains342.toFixed(1)} min (should be ~${Math.abs(localOffsetMin)} if TZ issue)`);

  // Cleanup
  await sb.from("orders").delete().eq("id", o5.id);
  await sb.from("orders").delete().eq("id", o12.id);
  console.log("\nCleaned up test orders.");
}
main().catch(console.error);
