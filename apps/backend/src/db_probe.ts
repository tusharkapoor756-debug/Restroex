import * as dotenv from "dotenv"; import * as path from "path";
dotenv.config({ path: path.resolve("apps/backend/.env") });
import WebSocket from "ws"; (global as any).WebSocket = WebSocket;
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });
async function main() {
  const { data: custs, error: ce } = await sb.from("customers").select("id,phone,restaurant_id").limit(5);
  console.log("CUSTOMERS:", JSON.stringify(custs), "ERR:", JSON.stringify(ce));
  const { data: rests, error: re } = await sb.from("restaurants").select("id,name").limit(10);
  console.log("RESTAURANTS:", JSON.stringify(rests), "ERR:", JSON.stringify(re));
  const { data: orders, error: oe } = await sb.from("orders").select("id,restaurant_id,customer_id,customer_phone,status").limit(5);
  console.log("ORDERS:", JSON.stringify(orders), "ERR:", JSON.stringify(oe));
}
main().catch(console.error);
