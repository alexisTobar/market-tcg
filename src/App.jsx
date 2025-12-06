import React, { useState, useEffect } from 'react';
import { Search, Loader2, TrendingUp, ShieldCheck, AlertTriangle, ImageOff } from 'lucide-react';

const EDICIONES = [
  { slug: "libertadores", id: 161, name: "Libertadores" },
  { slug: "onyria", id: 160, name: "Onyria" },
  { slug: "toolkit_cenizas_de_fuego", id: 156, name: "Toolkit Cenizas" },
  { slug: "toolkit_hielo_inmortal", id: 155, name: "Toolkit Hielo" },
  { slug: "lootbox_2024", id: 150, name: "Lootbox 2024" },
  { slug: "secretos_arcanos", id: 149, name: "Secretos Arcanos" },
  { slug: "bestiarium", id: 148, name: "Bestiarium" },
  { slug: "guardianes_de_daana", id: 146, name: "Guardianes de Daana" },
  { slug: "escuadronmecha", id: 137, name: "Escuadrón Mecha" },
  { slug: "amenazakaiju", id: 136, name: "Amenaza Kaiju" },
  { slug: "zodiaco", id: 126, name: "Zodiaco" },
  { slug: "espiritu_samurai", id: 125, name: "Espíritu Samurái" },
  { slug: "vigilantes", id: 124, name: "Vigilantes" },
  { slug: "giger", id: 121, name: "Giger" },
  { slug: "raciales_imp_2024", id: 120, name: "Raciales 2024" },
  { slug: "napoleon", id: 119, name: "Napoleón" },
  { slug: "chile_oscur", id: 108, name: "Chile Oscuro" },
  { slug: "visiones_de_kemet", id: 107, name: "Visiones de Kemet" },
  { slug: "la_venganza_de_horus", id: 106, name: "La Venganza de Horus" },
  { slug: "extension_valhalla", id: 91, name: "Ext. Valhalla" },
  { slug: "valhalla", id: 85, name: "Valhalla" },
];

const PriceCard = ({ card, editionId }) => {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/prices?card=${encodeURIComponent(card.name)}`);
        
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPriceData(data);
            setLoading(false);
          }
        } else {
          // Si no hay datos, es porque semilla.js aún no llega a esta carta
          if (isMounted) setLoading(false);
        }
      } catch (e) {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [card.name]); 

  const getImageUrl = () => {
    if (imgError) return null;
    const cardImageId = card.edid;
    const finalEditionId = card.ed_edid || editionId;
    return `https://api.myl.cl/static/cards/${finalEditionId}/${cardImageId}.png`;
  };
  const imageUrl = getImageUrl();

  return (
    <div className="bg-[#161b22] rounded border border-gray-800 hover:border-gray-600 transition-all flex overflow-hidden group h-full relative min-h-[140px]">
      <div className="w-[100px] bg-[#0d1117] p-2 flex items-center justify-center border-r border-gray-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={card.name}
            className="max-h-[140px] object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-600 gap-1">
             <ImageOff size={24} />
             <span className="text-[9px]">Sin Img</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-3 flex flex-col justify-between w-full">
        <div>
          <h3 className="font-bold text-sm text-gray-100 leading-tight mb-1 truncate" title={card.name}>{card.name}</h3>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${card.rarity === 'Ultra Real' ? 'text-amber-300 border-amber-800' : 'text-gray-500 border-gray-700'}`}>
            {card.rarity || 'Común'}
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-800 text-xs">
          {loading ? (
            <div className="flex items-center gap-2 text-amber-500/70">
              <Loader2 size={12} className="animate-spin" /> <span className="text-[10px]">Cargando...</span>
            </div>
          ) : !priceData ? (
             <div className="text-gray-600 text-[10px] italic">Esperando escaneo...</div>
          ) : (
            <div className="space-y-1 animate-in fade-in duration-300">
              {priceData?.stats?.min > 0 ? (
                <div className="flex justify-between items-center mb-2 bg-emerald-900/10 p-1.5 rounded border border-emerald-900/30">
                  <span className="text-emerald-500 font-bold">Mejor: ${priceData.stats.min.toLocaleString('es-CL')}</span>
                  <ShieldCheck size={12} className="text-emerald-500" />
                </div>
              ) : (
                <div className="flex items-center gap-1 text-gray-500 mb-2 italic">
                  <AlertTriangle size={12} /> Sin stock
                </div>
              )}

              {priceData?.results?.slice(0, 3).map((store, idx) => (
                <a
                  key={idx}
                  href={store.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex justify-between items-center px-1.5 py-1 rounded hover:bg-gray-700 transition-colors ${!store.price && 'opacity-40'}`}
                >
                  <span className="text-gray-400 text-[9px] truncate max-w-[70px]">{store.store}</span>
                  <span className={`font-mono font-bold ${store.price ? 'text-gray-200' : 'text-red-400'}`}>
                    {store.price ? `$${store.price.toLocaleString('es-CL')}` : '---'}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [selectedEdition, setSelectedEdition] = useState(EDICIONES[0]);
  const [cards, setCards] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCards = async () => {
      setListLoading(true);
      try {
        const response = await fetch(`https://api.myl.cl/cards/edition/${selectedEdition.slug}`);
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.cards || []);
        setCards(list);
      } catch (err) {
        console.error(err);
      } finally {
        setListLoading(false);
      }
    };
    fetchCards();
  }, [selectedEdition]);

  const filteredCards = cards.filter(card =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f1115] text-gray-200 font-sans flex flex-col">
      <header className="bg-[#161b22] border-b border-gray-800 sticky top-0 z-40 shadow-xl backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-600/10 p-2 rounded border border-amber-600/20">
              <TrendingUp size={20} className="text-amber-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-100">MyL Market <span className="text-emerald-500">DB</span></h1>
              <p className="text-[10px] text-gray-500">Base de Datos Centralizada</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select
              value={selectedEdition.slug}
              onChange={(e) => setSelectedEdition(EDICIONES.find(ed => ed.slug === e.target.value))}
              className="bg-[#0d1117] border border-gray-700 text-gray-300 text-sm py-2 px-3 rounded"
            >
              {EDICIONES.map((ed) => (<option key={ed.id} value={ed.slug}>{ed.name}</option>))}
            </select>
            <input
              type="text"
              placeholder="Buscar carta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0d1117] border border-gray-700 text-gray-200 text-sm py-2 px-3 rounded"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {listLoading ? (
          <div className="flex justify-center text-amber-500 py-10">
            <Loader2 className="animate-spin" size={32}/>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {filteredCards.map((card) => (
              <PriceCard
                key={card.uuid || card.id}
                card={card}
                editionId={selectedEdition.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}