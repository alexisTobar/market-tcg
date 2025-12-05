const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const PORT = 3001;
const DB_FILE = path.join(__dirname, 'base_datos_precios.json');
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 Horas en milisegundos

// === UTILIDADES DE BASE DE DATOS ===
// Cargar base de datos
const loadDB = () => {
    if (!fs.existsSync(DB_FILE)) return {};
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
};

// Guardar base de datos
const saveDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// === UTILIDAD DE LIMPIEZA DE PRECIO ===
const parsePrice = (text) => {
    if (!text) return null;

    // 1. Limpieza agresiva: Nos quedamos solo con números y el separador decimal si hubiera
    // El error "8.000.800" suele ser "8.000" y "800" pegados.
    // Vamos a intentar tomar solo los primeros digitos coherentes hasta encontrar un patrón repetido o texto basura.

    let cleanText = text.trim();

    // Si el texto contiene varios símbolos $, cortamos en el segundo
    if ((cleanText.match(/\$/g) || []).length > 1) {
        cleanText = cleanText.split('$')[1]; // Tomar el primer bloque despues del primer $
    }

    // Quitar puntos (miles) y simbolos
    let numberString = cleanText.replace(/\./g, '').replace(/[^\d]/g, '');

    // Convertir a numero
    let price = parseInt(numberString, 10);

    // FILTRO DE SEGURIDAD:
    // Si el precio es NaN o Mayor a 100.000, asumimos que es un error de lectura (pack de cartas, display, o error de parseo)
    if (isNaN(price) || price > 100000 || price < 100) {
        return null;
    }

    return price;
};

// === CONFIGURACIÓN TIENDAS ===
const STORES = [
    {
        name: 'SRX Store',
        urlBuilder: (query) => `https://srxstore.cl/?s=${encodeURIComponent(query)}&post_type=product`,
        // Buscamos especificamente dentro de la ficha de producto si es posible, o el primer precio de la lista
        selector: '.product .price'
    },
    {
        name: 'La Ira TCG',
        urlBuilder: (query) => `https://laira.cl/?s=${encodeURIComponent(query)}&post_type=product`,
        selector: '.product .price'
    },
    {
        name: 'MyL La Serena',
        urlBuilder: (query) => `https://mylserena.cl/?s=${encodeURIComponent(query)}&post_type=product`,
        // MyL Serena a veces pone el precio en un <bdi> dentro de un <span>
        selector: '.price .woocommerce-Price-amount bdi'
    }
];

app.get('/api/prices', async (req, res) => {
    const { card } = req.query;
    if (!card) return res.status(400).json({ error: 'Falta nombre carta' });

    // 1. REVISAR CACHÉ
    const db = loadDB();
    const cachedEntry = db[card];
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_DURATION)) {
        console.log(`⚡ [CACHÉ] Retornando datos guardados para: ${card}`);
        return res.json(cachedEntry.data);
    }

    console.log(`globe_with_meridians [SCRAPING] Buscando datos frescos para: ${card}`);

    // 2. SCRAPING EN TIEMPO REAL
    const promises = STORES.map(async (store) => {
        try {
            const url = store.urlBuilder(card);
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                timeout: 10000
            });

            const $ = cheerio.load(data);

            // Lógica Mejorada de Selección:
            // Obtenemos todos los elementos que coinciden con el selector
            let foundPrice = null;

            $(store.selector).each((i, el) => {
                if (foundPrice) return; // Si ya encontramos uno válido, parar.

                const text = $(el).text();
                const price = parsePrice(text);

                if (price) {
                    foundPrice = price;
                }
            });

            return {
                store: store.name,
                price: foundPrice,
                link: url,
                status: foundPrice ? 'ok' : 'no_stock'
            };

        } catch (e) {
            return { store: store.name, price: null, link: store.urlBuilder(card), status: 'error' };
        }
    });

    const results = await Promise.all(promises);

    // Calcular estadísticas
    const validPrices = results.filter(r => r.price !== null).map(r => r.price);
    const min = validPrices.length ? Math.min(...validPrices) : 0;
    const max = validPrices.length ? Math.max(...validPrices) : 0;
    const avg = validPrices.length ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 0;

    const responseData = {
        card,
        stats: { min, max, avg },
        results
    };

    // 3. GUARDAR EN CACHÉ
    db[card] = {
        timestamp: now,
        data: responseData
    };
    saveDB(db);

    res.json(responseData);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor con CACHÉ (12h) corriendo en http://localhost:${PORT}`);
});