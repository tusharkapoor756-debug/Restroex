const fs = require('fs');
const path = require('path');

function checkVersions() {
  console.log('--- DEPENDENCY VERSION CHECK ---');
  
  // 1. Check whatsapp-web.js version
  try {
    const wwebPkgPath = path.resolve('node_modules/whatsapp-web.js/package.json');
    const wwebPkg = JSON.parse(fs.readFileSync(wwebPkgPath, 'utf8'));
    console.log(`whatsapp-web.js version: ${wwebPkg.version}`);
  } catch (err) {
    console.error('Failed to read whatsapp-web.js package.json:', err.message);
  }

  // 2. Check puppeteer version
  try {
    const puppeteerPkgPath = path.resolve('node_modules/puppeteer/package.json');
    const puppeteerPkg = JSON.parse(fs.readFileSync(puppeteerPkgPath, 'utf8'));
    console.log(`puppeteer version: ${puppeteerPkg.version}`);
  } catch (err) {
    console.error('Failed to read puppeteer package.json:', err.message);
  }

  // 3. Check Chromium version via Puppeteer
  try {
    const puppeteer = require('puppeteer');
    const executablePath = puppeteer.executablePath();
    console.log(`Puppeteer default Chromium executable path: ${executablePath}`);
  } catch (err) {
    console.error('Failed to get Puppeteer executable path:', err.message);
  }
}

checkVersions();
