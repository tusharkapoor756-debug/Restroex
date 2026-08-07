import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve("apps/backend/.env") });
import WebSocket from "ws"; (global as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });

const RESTAURANT_ID = "d004cddc-dc64-420f-8621-cdbbffd1be8b";
const ORDER_ID = "48441a61-bd52-4347-9ea6-ec7b3da1193e";
const PAYMENT_ID = "c9fe642c-fdf4-4ae0-ac51-f959ea62aa1c";
const PLINK_ID = "plink_TLvPX3klbPPKuY";

async function main() {
  // Step 1: Get restaurant Razorpay keys from DB
  const { data: config } = await sb
    .from("restaurant_payment_configs")
    .select("provider_name, api_key, api_secret, webhook_secret, is_active")
    .eq("restaurant_id", RESTAURANT_ID)
    .eq("provider_name", "razorpay")
    .maybeSingle();

  if (!config || !config.api_key) {
    console.log("No Razorpay config found in DB for this restaurant");
    console.log("Config found:", JSON.stringify(config));
    return;
  }

  console.log(`Razorpay config: api_key=${config.api_key.slice(0,8)}... is_active=${config.is_active}`);

  // Step 2: Call Razorpay API to check payment link status
  const auth = Buffer.from(`${config.api_key}:${config.api_secret}`).toString("base64");
  const resp = await fetch(`https://api.razorpay.com/v1/payment_links/${PLINK_ID}`, {
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" }
  });

  if (!resp.ok) {
    console.log(`Razorpay API error: ${resp.status} ${resp.statusText}`);
    const body = await resp.text();
    console.log("Body:", body.slice(0, 500));
    return;
  }

  const plink: any = await resp.json();
  console.log("\n=== Razorpay Payment Link Status (LIVE from Razorpay API) ===");
  console.log(`  plink_id      = ${plink.id}`);
  console.log(`  status        = ${plink.status}`);
  console.log(`  amount        = ?${plink.amount / 100}`);
  console.log(`  amount_paid   = ?${plink.amount_paid / 100}`);
  console.log(`  payments      = ${JSON.stringify(plink.payments)}`);

  if (plink.status === "paid" || plink.amount_paid > 0) {
    console.log("\n? PAYMENT IS CONFIRMED ON RAZORPAY SIDE — marking order as PAID in DB");

    // Get Razorpay payment ID from plink.payments
    const rzpPaymentId = plink.payments?.[0]?.id || plink.payments?.[0]?.payment_id || null;
    console.log(`  Razorpay payment_id = ${rzpPaymentId}`);

    // Update payments table
    const { error: pe } = await sb
      .from("payments")
      .update({
        payment_status: "verified",
        verified_by: "manual_razorpay_api_check",
        verified_at: new Date().toISOString(),
        verified_amount: plink.amount_paid / 100,
        provider_transaction_id: rzpPaymentId,
        completed_at: new Date().toISOString(),
        verification_notes: `Auto-verified via Razorpay API: plink ${PLINK_ID} status=${plink.status}`,
      })
      .eq("id", PAYMENT_ID);
    
    if (pe) { console.log("Payment update error:", pe.message); return; }
    console.log("  payments table: updated to verified ?");

    // Update order status to paid
    const { error: oe } = await sb
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", ORDER_ID);
    
    if (oe) { console.log("Order update error:", oe.message); return; }
    console.log("  orders table: status updated to paid ?");

    console.log("\n? ORDER #ORD-1140 IS NOW MARKED AS PAID. Staff can accept it on KOT board.");
  } else {
    console.log("\n?? Payment NOT yet captured on Razorpay side.");
    console.log(`  Status = ${plink.status} — customer may not have completed payment.`);
  }
}
main().catch(console.error);
