const { createWorker } = require("tesseract.js");
const path = require("path");

async function checkWorkerOptions() {
  const tempPath = path.resolve("apps/backend/tmp/sharp_300dpi.png");
  
  // Tesseract v5 node worker options
  const worker = await createWorker("eng");
  
  const res = await worker.recognize(tempPath);
  console.log("recognize res keys:", Object.keys(res));
  console.log("res.data keys:", Object.keys(res.data));
  console.log("res.data.text snippet:\n", res.data.text.substring(0, 300));
  
  await worker.terminate();
}

checkWorkerOptions().catch(console.error);
