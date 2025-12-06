const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'base_datos_precios.json');

// === UTILIDADES ===
const loadDB = () => {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

const saveDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const parsePrice = (text) => {
    if (!text) return null;
    const cleanText = text.replace(/[^0-9]/g, ''); 
    const price = parseInt(cleanText, 10);
    if (isNaN(price) || price < 100 || price > 2000000) return null;
    return price;
};

// Filtro de nombres mejorado: Ignora mayúsculas, tildes y paréntesis
const verifyNameMatch = (searchQuery, foundTitle) => {
    const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Limpiamos la búsqueda: "Bernardo (LTD)" -> "Bernardo"
    const cleanQuery = normalize(searchQuery.split('(')[0].trim());
    const cleanTitle = normalize(foundTitle);
    
    // Palabras clave (ignoramos palabras cortas como 'de', 'el', 'la')
    const searchWords = cleanQuery.split(' ').filter(w => w.length > 2); 

    // TODAS las palabras clave deben estar presentes en el título encontrado
    return searchWords.every(word => cleanTitle.includes(word));
};

// === NAVEGADOR ===
const launchBrowser = async () => {
    return await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1280,800'
        ]
    });
};

const STORES = [
    {
        name: 'SRX Store',
        urlBuilder: (query) => `https://srxstore.cl/?s=${encodeURIComponent(query)}&post_type=product`,
        selector: '.product', 
        priceSelector: '.price',
        titleSelector: '.woocommerce-loop-product__title',
        type: 'standard'
    },
    {
        name: 'La Ira TCG',
        urlBuilder: (query) => `https://laira.cl/?s=${encodeURIComponent(query)}&post_type=product`,
        selector: '.product',
        priceSelector: 'ins .amount bdi, .price', 
        titleSelector: '.woocommerce-loop-product__title',
        type: 'button_load_more',
        buttonSelector: '#btn_load_more_products' 
    },
    {
        name: 'MyL La Serena',
        urlBuilder: (query) => `https://mylserena.cl/search?q=${encodeURIComponent(query)}`,
        selector: '.product-block__wrapper', 
        priceSelector: '.product-block__price',
        titleSelector: '.product-block__name', 
        stockSelector: '.product-block__label--status',
        type: 'wait_for_selector' 
    }
];

// === SCRAPER ===
async function scrapeCardData(cardName) {
    let browser;
    try {
        browser = await launchBrowser();
        
        const processStore = async (store) => {
            const page = await browser.newPage();
            try {
                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.goto(store.urlBuilder(cardName), { waitUntil: 'domcontentloaded', timeout: 60000 });

                if (store.type === 'wait_for_selector') {
                    try { await page.waitForSelector(store.selector, { timeout: 3000 }); } catch (e) {}
                } else if (store.type === 'button_load_more') {
                    try {
                        const btn = await page.$(store.buttonSelector);
                        if(btn) await btn.click();
                    } catch(e) {}
                }

                const content = await page.content();
                const $ = cheerio.load(content);
                const results = [];

                $(store.selector).each((i, el) => {
                    const container = $(el);
                    const title = container.find(store.titleSelector).first().text().trim();
                    const link = container.find('a').first().attr('href');

                    if (!verifyNameMatch(cardName, title)) return;

                    let price = null;
                    if (store.name === 'La Ira TCG') {
                        const offer = container.find('ins .amount').text();
                        if (offer) price = parsePrice(offer);
                        else {
                            const normal = container.find('.price').text();
                            const matches = normal.match(/\d[\d\.]+/g);
                            if (matches) price = Math.min(...matches.map(m => parsePrice(m)).filter(p => p));
                        }
                    } else {
                        price = parsePrice(container.find(store.priceSelector).text());
                    }

                    let isOutOfStock = false;
                    if (store.stockSelector) {
                        const stockText = container.find(store.stockSelector).text().toLowerCase();
                        if (stockText.includes('agotado')) isOutOfStock = true;
                    }

                    let fullLink = link;
                    if (link && !link.startsWith('http')) {
                        const origin = new URL(store.urlBuilder(cardName)).origin;
                        fullLink = `${origin}${link}`;
                    }

                    if (title && price) {
                        results.push({
                            store: store.name,
                            title: title,
                            price: price,
                            link: fullLink,
                            status: isOutOfStock ? 'no_stock' : 'ok'
                        });
                    }
                });
                
                if (results.length === 0) return { store: store.name, price: null, status: 'no_stock' };
                results.sort((a, b) => {
                    if (a.status === 'ok' && b.status !== 'ok') return -1;
                    if (a.status !== 'ok' && b.status === 'ok') return 1;
                    return a.price - b.price;
                });
                return results[0];

            } catch (e) {
                return { store: store.name, price: null, status: 'error' };
            } finally {
                if (!page.isClosed()) await page.close();
            }
        };

        const promises = STORES.map(store => processStore(store));
        const results = await Promise.all(promises);

        const available = results.filter(r => r.price && r.status === 'ok');
        const prices = available.map(r => r.price);
        const min = prices.length ? Math.min(...prices) : 0;
        const max = prices.length ? Math.max(...prices) : 0;
        const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

        return { card: cardName, stats: { min, max, avg }, results };

    } catch (error) {
        console.error("Error browser:", error);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}

// API
app.get('/api/prices', async (req, res) => {
    const { card } = req.query;
    if (!card) return res.status(400).json({ error: 'Falta nombre' });

    const db = loadDB();
    if (db[card]) {
        return res.json(db[card].data);
    }
    
    // Si no está, devuelve error (para que uses semilla.js)
    res.status(404).json({error: "Datos no encontrados. Ejecuta el script semilla.js"});
});

module.exports = { scrapeCardData, loadDB, saveDB, PORT };

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
    });
}