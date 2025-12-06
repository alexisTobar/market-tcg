const axios = require('axios');
const { scrapeCardData, loadDB, saveDB } = require('./server'); 

// LISTA CORREGIDA (Sin "Imperio" falso)
const EDICIONES = [
  { slug: "libertadores", name: "Libertadores" },
  { slug: "onyria", name: "Onyria" },
  { slug: "toolkit_cenizas_de_fuego", name: "Toolkit Cenizas" },
  { slug: "toolkit_hielo_inmortal", name: "Toolkit Hielo" },
  { slug: "lootbox_2024", name: "Lootbox 2024" },
  { slug: "secretos_arcanos", name: "Secretos Arcanos" },
  { slug: "bestiarium", name: "Bestiarium" },
  { slug: "guardianes_de_daana", name: "Guardianes de Daana" },
  { slug: "escuadronmecha", name: "Escuadrón Mecha" },
  { slug: "amenazakaiju", name: "Amenaza Kaiju" },
  { slug: "zodiaco", name: "Zodiaco" },
  { slug: "espiritu_samurai", name: "Espíritu Samurái" },
  { slug: "vigilantes", name: "Vigilantes" },
  { slug: "giger", name: "Giger" },
  { slug: "raciales_imp_2024", name: "Raciales 2024" },
  { slug: "napoleon", name: "Napoleón" },
  { slug: "chile_oscur", name: "Chile Oscuro" },
  { slug: "visiones_de_kemet", name: "Visiones de Kemet" },
  { slug: "la_venganza_de_horus", name: "La Venganza de Horus" },
  { slug: "extension_valhalla", name: "Ext. Valhalla" },
  { slug: "valhalla", name: "Valhalla" }
];

const BATCH_SIZE = 6; // Lote pequeño para PC estándar

const runSeeder = async () => {
    console.log("========================================");
    console.log("🌱 INICIANDO CARGA DE PRECIOS");
    console.log("========================================");

    const db = loadDB();

    for (const edicion of EDICIONES) {
        console.log(`\n📂 ESCANEANDO EDICIÓN: ${edicion.name.toUpperCase()}...`);
        
        try {
            // 1. Descargar lista de cartas de la API oficial
            const response = await axios.get(`https://api.myl.cl/cards/edition/${edicion.slug}`);
            const cardsList = Array.isArray(response.data) ? response.data : (response.data.cards || []);
            
            console.log(`   -> Cartas encontradas: ${cardsList.length}`);

            // 2. Procesar por lotes
            for (let i = 0; i < cardsList.length; i += BATCH_SIZE) {
                const batch = cardsList.slice(i, i + BATCH_SIZE);
                console.log(`   ⚡ Lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(cardsList.length / BATCH_SIZE)} (${batch.length} cartas)...`);

                const promises = batch.map(async (card) => {
                    // Si ya existe en DB, saltar
                    if (db[card.name]) {
                        process.stdout.write('⏭️ ');
                        return null;
                    }

                    try {
                        const data = await scrapeCardData(card.name);
                        process.stdout.write('✅ ');
                        return { name: card.name, data };
                    } catch (e) {
                        process.stdout.write('❌ ');
                        return null;
                    }
                });

                const results = await Promise.all(promises);
                console.log(""); 

                let savedCount = 0;
                results.forEach(res => {
                    if (res && res.data) {
                        db[res.name] = { timestamp: Date.now(), data: res.data };
                        savedCount++;
                    }
                });

                saveDB(db);
                console.log(`      💾 Guardados: ${savedCount}`);
                
                // Pausa de 3 segundos entre lotes para cuidar tu PC
                await new Promise(r => setTimeout(r, 3000));
            }

        } catch (error) {
            console.error(`Error en edición ${edicion.name}:`, error.message);
        }
    }

    console.log("\n========================================");
    console.log("🏁 TODO LISTO. YA PUEDES USAR LA PÁGINA.");
    console.log("========================================");
};

runSeeder();