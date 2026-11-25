// Testigos diarios: una captura por cada banner activo en las secciones elegidas.
// Los banners rotan, así que para cada uno se detiene la rotación, se deja visible solo ese banner
// y se toma la captura con la fecha, la hora y el nombre del banner encima.
const puppeteer = require('puppeteer');
const fs = require('fs');

const SECCIONES = [
  'https://www.globalmedia.mx/sections/San-Luis',
  'https://www.globalmedia.mx/sections/MUNDO',
  'https://www.globalmedia.mx/sections/Negocios',
  'https://www.globalmedia.mx/sections/ENTRETENIMIENTO',
];

// Solo se capturan los banners con este nombre en el panel: "VERSION 16" a "VERSION 21".
// Para cambiar la lista, ajusta este rango.
const VERSION_DESDE = 16;
const VERSION_HASTA = 21;
const bannerElegido = (nombre) => {
  const m = String(nombre).match(/^\s*VERSI[OÓ]N\s*(\d+)\s*$/i);
  return !!m && Number(m[1]) >= VERSION_DESDE && Number(m[1]) <= VERSION_HASTA;
};

const TZ = 'America/Mexico_City';
const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // AAAA-MM-DD
const limpio = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

async function capturarSeccion(browser, url, carpeta, resumen) {
  const seccion = decodeURIComponent(url.split('/sections/')[1] || url);
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  } catch (e) {
    // Si algo externo no termina de cargar, se sigue con lo que ya está en pantalla.
    console.log(`  (aviso) ${seccion}: ${e.message}`);
  }

  // Detener la rotación automática para que no cambie el banner a media captura.
  await page.evaluate(() => {
    const ultimo = setTimeout(() => {}, 0);
    for (let i = 0; i <= ultimo; i++) { clearTimeout(i); clearInterval(i); }
    if (window.TweenMax) window.TweenMax.killAll();
  });

  // Banners de cada carrusel (sin repetir el mismo banner dos veces en la sección).
  const todos = await page.evaluate(() => {
    const vistos = new Set();
    const lista = [];
    document.querySelectorAll('.banners-container').forEach((cont, c) => {
      cont.querySelectorAll(':scope > .slider-item').forEach((a, i) => {
        const id = ((a.getAttribute('href') || '').match(/banners\/(\d+)/) || [])[1];
        if (!id || vistos.has(id)) return;
        vistos.add(id);
        const img = a.querySelector('img');
        lista.push({ c, i, id, nombre: ((img && img.alt) || `banner ${id}`).trim() });
      });
    });
    return lista;
  });

  const banners = todos.filter((b) => bannerElegido(b.nombre));
  if (!banners.length) console.log(`  ${seccion}: no hay banners de VERSION ${VERSION_DESDE} a ${VERSION_HASTA} activos`);

  for (const b of banners) {
    const hora = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, dateStyle: 'long', timeStyle: 'short' }).format(new Date());
    await page.evaluate(({ c, i, nombre, seccion, hora }) => {
      const cont = document.querySelectorAll('.banners-container')[c];
      const items = cont.querySelectorAll(':scope > .slider-item');
      items.forEach((el, j) => {
        el.style.setProperty('opacity', j === i ? '1' : '0', 'important');
        el.style.setProperty('visibility', j === i ? 'visible' : 'hidden', 'important');
      });
      // Banner a la vista, un poco abajo del menú.
      const top = cont.getBoundingClientRect().top + window.scrollY - 160;
      window.scrollTo(0, Math.max(0, top));

      let sello = document.getElementById('gm-testigo-sello');
      if (!sello) {
        sello = document.createElement('div');
        sello.id = 'gm-testigo-sello';
        sello.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:rgba(0,0,0,.78);color:#fff;'
          + 'font:600 15px/1.35 Arial,sans-serif;padding:10px 14px;border-radius:6px;max-width:520px;pointer-events:none';
        document.body.appendChild(sello);
      }
      sello.innerHTML = '';
      [`Testigo: ${hora} (hora del centro)`, `Sección: ${seccion} (${location.host})`, `Banner: ${nombre}`].forEach((t) => {
        const d = document.createElement('div');
        d.textContent = t;
        sello.appendChild(d);
      });
    }, { ...b, seccion, hora });

    // Esperar a que la imagen del banner termine de cargar.
    const cargo = await page.waitForFunction(({ c, i }) => {
      const it = document.querySelectorAll('.banners-container')[c].querySelectorAll(':scope > .slider-item')[i];
      const img = [...it.querySelectorAll('img')].find((im) => im.offsetWidth > 0);
      return img && img.complete && img.naturalWidth > 0;
    }, { timeout: 15000 }, b).then(() => true, () => false);
    await new Promise((r) => setTimeout(r, 400));

    const archivo = `${carpeta}/${limpio(seccion)}__${b.id}-${limpio(b.nombre)}.jpg`;
    await page.screenshot({ path: archivo, type: 'jpeg', quality: 80 });
    resumen.push({ seccion, banner: b.nombre, id: b.id, archivo, ok: cargo });
    console.log(`  ${cargo ? 'ok' : 'SIN IMAGEN'}  ${seccion}: ${b.nombre}`);
  }
  await page.close();
}

(async () => {
  const carpeta = `screenshots/${fecha}`;
  fs.mkdirSync(carpeta, { recursive: true });
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const resumen = [];
  for (const url of SECCIONES) {
    try {
      await capturarSeccion(browser, url, carpeta, resumen);
    } catch (e) {
      console.log(`  ERROR en ${url}: ${e.message}`);
    }
  }
  await browser.close();

  // Lista para buscar rápido qué banner salió en qué sección.
  const csv = ['seccion,banner_id,banner,archivo,imagen_cargada',
    ...resumen.map((r) => [r.seccion, r.id, `"${r.banner.replace(/"/g, '""')}"`, r.archivo.split('/').pop(), r.ok ? 'si' : 'no'].join(','))];
  fs.writeFileSync(`${carpeta}/resumen.csv`, '﻿' + csv.join('\n'));
  console.log(`\n${resumen.length} testigos guardados en ${carpeta}`);
  if (!resumen.length) process.exitCode = 1;
})();
