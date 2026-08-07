import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve("apps/backend/.env") });
import WebSocket from "ws"; (global as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });

async function main() {
  const ORDER_ID = "48441a61-bd52-4347-9ea6-ec7b3da1193e";

  // Get full payment record including gateway_data (has Razorpay payment_id)
  const { data: payment } = await sb
    .from("payments")
    .select("*")
    .eq("order_id", ORDER_ID)
    .single();

  console.log("=== FULL PAYMENT RECORD ===");
  console.log(JSON.stringify(payment, null, 2));

  // Check webhook/event logs if table exists
  const { data: wh, error: whe } = await sb
    .from("webhook_logs")
    .select("*")
    .eq("order_id", ORDER_ID)
    .limit(10);
  if (!whe) {
    console.log("\n=== WEBHOOK LOGS for this order ===");
    console.log(JSON.stringify(wh, null, 2));
  } else {
    console.log("\nwebhook_logs table:", whe.message);
  }

  // Check if Razorpay keys are configured
  console.log("\n=== RAZORPAY CONFIG ===");
  console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "SET ("+process.env.RAZORPAY_KEY_ID.slice(0,8)+"...)" : "NOT SET");
  console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "SET" : "NOT SET");
}
main().catch(console.error);
