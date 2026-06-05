const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const urls = [
  'https://www.globalmedia.mx/',
  'https://zacatecas.globalmedia.mx/',
  'https://queretaro.globalmedia.mx/',
  'https://vallartabahia.globalmedia.mx/',
  'https://www.globalmedia.mx/sections/San-Luis',
  'https://www.globalmedia.mx/sections/bajio',
  'https://www.globalmedia.mx/sections/M%C3%89XICO',
  'https://www.globalmedia.mx/sections/MUNDO',
  'https://www.globalmedia.mx/sections/Negocios',
  'https://www.globalmedia.mx/sections/T%C3%A1ctica-Local',
  'https://www.globalmedia.mx/tactica',
  'https://www.globalmedia.mx/sections/ENTRETENIMIENTO',
  'https://zacatecas.globalmedia.mx/sections/zacatecas',
  'https://queretaro.globalmedia.mx/sections/queretaro',
  'https://leon.globalmedia.mx/sections/leon',
  'https://vallartabahia.globalmedia.mx/sections/jalisco',
];

async function takeScreenshots() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const date = new Date().toISOString().slice(0, 16).replace(':', '-');
  const folder = `screenshots/${date}`;

  fs.mkdirSync(folder, { recursive: true });

  for (const url of urls) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const filename = url
        .replace('https://', '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 80);
      await page.screenshot({
        path: `${folder}/${filename}.png`,
        fullPage: true
      });
      console.log(`✅ ${url}`);
    } catch (e) {
      console.log(`❌ Error en ${url}: ${e.message}`);
    }

    await page.close();
  }

  await browser.close();
  console.log(`\nScreenshots guardados en: ${folder}`);
}

takeScreenshots();