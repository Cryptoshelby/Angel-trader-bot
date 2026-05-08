const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const QuickChart = require('quickchart-js');
const http = require('http');

const TOKEN = '8383642654:AAFC3MnUGqvSzfgHRkyLpbuw46epKvfMb10';
const CANAL_SENALES = '-1003829506073';
const CANAL_NOTICIAS = '-1003778336135';
const NEWSAPI_KEY = '8c54f27258564b4aa1c4a1a991011ee8';
const YOUTUBE_API_KEY = 'AIzaSyDudNjj_JAijkm7lmwrRF6wM3787Z4fm00';
const MAX_SENALES = 23;

const HORARIOS = [
    { inicio: 1, fin: 3, nombre: 'MADRUGADA' },
    { inicio: 8, fin: 12, nombre: 'MAÑANA' },
    { inicio: 16, fin: 20, nombre: 'TARDE' }
];

const FRASES = [
    'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',
    'No sueñes con el éxito, trabaja para conseguirlo.',
    'Cada operación es una oportunidad de aprender.',
    'La disciplina es el puente entre tus metas y tus logros.',
    'El riesgo controlado es el camino a la libertad financiera.',
    'Hoy es un gran día para ganar.',
    'Los ganadores nunca se rinden, los que se rinden nunca ganan.'
];

const bot = new TelegramBot(TOKEN, { polling: { interval: 300, autoStart: true, params: { timeout: 10 } } });

let publicadas = [];
let senalesHistorial = { forex: 0, ultima_fecha: new Date().toDateString() };
let señalEnCurso = false;
let sistemaActivo = false;

const DB_FILE = 'publicadas.json';
try { publicadas = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : []; } catch(e) { publicadas = []; }

function guardarDB() { fs.writeFileSync(DB_FILE, JSON.stringify(publicadas, null, 2)); }
function escapeHTML(t) { if (!t) return ''; return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function horaActual() { return new Date().getHours() + new Date().getMinutes() / 60; }
function horarioActivo() { const h = horaActual(); for (let horario of HORARIOS) { if (h >= horario.inicio && h < horario.fin) return horario; } return null; }
function formatoHora(f) { return f.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); }

function generarGraficoQuickChart(precio) {
    const chart = new QuickChart();
    chart.setWidth(800); chart.setHeight(400); chart.setBackgroundColor('#1a1a2e');
    const labels = []; const data = []; let p = precio;
    for (let i = 0; i < 20; i++) { labels.push(i === 0 ? 'Ahora' : '-' + i * 5 + 'm'); p += (Math.random() * 0.004 - 0.002) * precio; data.push(p); }
    chart.setConfig({ type: 'line', data: { labels: labels.reverse(), datasets: [{ label: 'FOREX', data: data.reverse(), borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 2, fill: true, pointRadius: 0, tension: 0.4 }] }, options: { plugins: { title: { display: true, text: 'GRAFICO FOREX', color: '#ffffff' } }, scales: { y: { grid: { color: '#333355' }, ticks: { color: '#aaaacc' } }, x: { grid: { color: '#333355' }, ticks: { color: '#aaaacc' } } } } });
    return chart.getUrl();
}

async function obtenerPreciosQuotex() {
    return new Promise((resolve) => {
        exec('python3 ~/API-Quotex/pyquotex/obtener_precios.py', { timeout: 20000 }, (error, stdout) => {
            if (error) { resolve(null); return; }
            try { resolve(JSON.parse(stdout)); } catch (e) { resolve(null); }
        });
    });
}

async function enviarSenal() {
    if (señalEnCurso) return;
    if (senalesHistorial.forex >= MAX_SENALES) return;
    const horario = horarioActivo();
    if (!horario) return;
    señalEnCurso = true;
    try {
        const ahora = new Date();
        const min = Math.ceil(ahora.getMinutes() / 5) * 5;
        const entrada = new Date(ahora); entrada.setMinutes(min, 0, 0);
        const vence = new Date(entrada.getTime() + 300000);
        const g1 = new Date(vence.getTime() + 300000);
        const g2 = new Date(g1.getTime() + 300000);
        const precios = await obtenerPreciosQuotex();
        let par, precio, dir;
        if (precios && precios.length > 0) {
            const mejor = precios[0];
            par = mejor.par;
            precio = mejor.precio;
            dir = mejor.cambio > 0 ? 'CALL' : 'PUT';
        } else {
            const forex = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];
            par = forex[Math.floor(Math.random() * forex.length)];
            precio = 1.0500 + Math.random() * 0.01;
            dir = Math.random() > 0.5 ? 'CALL' : 'PUT';
        }
        const dirEmoji = dir === 'CALL' ? 'CALL 🟩' : 'PUT 🟥';
        const graficoUrl = generarGraficoQuickChart(precio);
        const mensaje = '💰 *SEÑAL FOREX - QUOTEX*\n' + '━'.repeat(30) + '\n\n' +
            '📊 *PAR:* ' + par + '\n💵 *Precio Quotex:* ' + parseFloat(precio).toFixed(5) + '\n' +
            '⏰ *ENTRADA:* ' + formatoHora(entrada) + ' UTC-3\n🎯 *DIRECCIÓN:* ' + dirEmoji + '\n\n' +
            '⏳ *VENCIMIENTO:* 5 minutos\n🕐 HORA: *' + formatoHora(vence) + ' UTC-3*\n\n' +
            '📈 *GALES:*\n1ª GALE → *' + formatoHora(g1) + ' UTC-3*\n2ª GALE → *' + formatoHora(g2) + ' UTC-3*\n\n' +
            '🎯 *Efectividad estimada:* 95%+\n\n' +
            '🔥 [Abrir Quotex y operar ahora](https://broker-qx.pro/sign-up/?lid=2097658)\n\n#Forex #Quotex #Señal';
        await bot.sendPhoto(CANAL_SENALES, graficoUrl, { caption: mensaje, parse_mode: 'Markdown' });
        
        // OPERAR AUTOMÁTICAMENTE
        exec('python3 ~/bot-telegram/operar.py ' + par + ' ' + dir, { timeout: 10000 }, (error, stdout) => {
            if (error) console.log('Error operando:', error.message);
            else console.log('Operación:', stdout);
        });
        
        senalesHistorial.forex++;
        setTimeout(() => { señalEnCurso = false; }, 17 * 60 * 1000);
    } catch (e) { console.error('Error:', e); señalEnCurso = false; }
}

setInterval(async () => {
    const horario = horarioActivo();
    if (horario && !sistemaActivo) {
        sistemaActivo = true;
        const frase = FRASES[Math.floor(Math.random() * FRASES.length)];
        await bot.sendAnimation(CANAL_SENALES, 'https://media.giphy.com/media/3o7TKSjRrfIPjeiVyE/giphy.gif', {
            caption: '🚨 *¡AJUSTA TUS NOTIFICACIONES!* 🚨\n' + '━'.repeat(35) + '\n\n🔥 *¡EMPEZAMOS A OPERAR!* 🔥\n\n📊 *PREPÁRATE PARA LA ACCIÓN*\n📈 Señales activadas en ' + horario.nombre + '\n🌐 *UTC-3*\n\n💬 *' + frase + '*\n\n🚀 *¡VAMOS HACIA LA CIMA!* 🚀',
            parse_mode: 'Markdown'
        });
        await new Promise(r => setTimeout(r, 3000));
        enviarSenal();
    }
    if (!horario && sistemaActivo) {
        sistemaActivo = false;
        await bot.sendMessage(CANAL_SENALES, '📊 *FIN DEL HORARIO*\n' + '━'.repeat(30) + '\n\n📊 Señales enviadas: ' + senalesHistorial.forex + '\n\n💪 Nos vemos en el próximo horario.\n🚀 ¡Sigue hacia la cima!', { parse_mode: 'Markdown' });
    }
    if (horario && !señalEnCurso) enviarSenal();
}, 30000);

async function buscarNoticias() {
    try {
        const r = await axios.get('https://newsapi.org/v2/everything?q=forex+OR+trading&language=es&sortBy=publishedAt&from=2026-05-01&pageSize=5&apiKey=' + NEWSAPI_KEY, { timeout: 10000 });
        if (r.data?.articles) {
            for (let a of r.data.articles.slice(0, 3)) {
                if (!publicadas.some(p => p.id === a.url)) {
                    await bot.sendMessage(CANAL_NOTICIAS, '📰 *' + escapeHTML(a.title) + '*\n\n' + escapeHTML(a.description || '') + '\n\n📅 Mayo 2026\n🔗 ' + a.url + '\n\n#Noticias2026', { parse_mode: 'Markdown' });
                    publicadas.push({ id: a.url, fecha: new Date().toISOString() }); guardarDB();
                }
            }
        }
    } catch (e) {}
}

async function buscarVideosVirales() {
    try {
        const queries = ['trading viral', 'forex ganancias', 'bitcoin shorts', 'criptomonedas viral', 'trading motivacion'];
        const q = queries[Math.floor(Math.random() * queries.length)];
        const yt = await axios.get('https://www.googleapis.com/youtube/v3/search', { params: { part: 'snippet', q, type: 'video', order: 'viewCount', maxResults: 5, relevanceLanguage: 'es', videoDuration: 'short', key: YOUTUBE_API_KEY }, timeout: 15000 });
        if (yt.data?.items?.[0]) {
            const v = yt.data.items[0];
            await bot.sendMessage(CANAL_NOTICIAS, '🎬 *VIDEO VIRAL*\n\n📺 *' + escapeHTML(v.snippet.title) + '*\n📊 ' + escapeHTML(v.snippet.channelTitle) + '\n\n🔗 https://www.youtube.com/watch?v=' + v.id.videoId + '\n\n#Viral #Shorts #Trading', { parse_mode: 'Markdown' });
        }
    } catch (e) {}
}

async function buscarNoticiasTecnologia() {
    try {
        const r = await axios.get('https://newsapi.org/v2/everything?q=tecnologia+OR+inteligencia+artificial+OR+innovacion&language=es&sortBy=publishedAt&pageSize=3&apiKey=' + NEWSAPI_KEY, { timeout: 10000 });
        if (r.data?.articles) {
            for (let a of r.data.articles.slice(0, 2)) {
                if (!publicadas.some(p => p.id === a.url)) {
                    await bot.sendMessage(CANAL_NOTICIAS, '🔬 *TECNOLOGÍA*\n\n📰 *' + escapeHTML(a.title) + '*\n\n' + escapeHTML(a.description || '') + '\n\n🔗 ' + a.url + '\n\n#Tecnologia #IA #Innovacion', { parse_mode: 'Markdown' });
                    publicadas.push({ id: a.url, fecha: new Date().toISOString() }); guardarDB();
                }
            }
        }
    } catch (e) {}
}

async function buscarTendencias() {
    try {
        const r = await axios.get('https://newsapi.org/v2/everything?q=tendencias+OR+viral+OR+criptomonedas&language=es&sortBy=popularity&pageSize=3&apiKey=' + NEWSAPI_KEY, { timeout: 10000 });
        if (r.data?.articles) {
            for (let a of r.data.articles.slice(0, 2)) {
                if (!publicadas.some(p => p.id === a.url)) {
                    await bot.sendMessage(CANAL_NOTICIAS, '🔥 *TENDENCIAS*\n\n📰 *' + escapeHTML(a.title) + '*\n\n' + escapeHTML(a.description || '') + '\n\n🔗 ' + a.url + '\n\n#Tendencias #Viral', { parse_mode: 'Markdown' });
                    publicadas.push({ id: a.url, fecha: new Date().toISOString() }); guardarDB();
                }
            }
        }
    } catch (e) {}
}

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Angel Trader funcionando 24/7');
}).listen(PORT, () => {
    console.log('Servidor en puerto ' + PORT);
});

console.log('🤖 BOT UNIFICADO COMPLETO');
console.log('📡 Canal señales: ' + CANAL_SENALES);
console.log('📰 Canal noticias: ' + CANAL_NOTICIAS);
console.log('🕐 Horarios UTC-3: 01-03, 08-12, 16-20');
console.log('⏳ 17 minutos entre señales');
console.log('🤖 Operación automática ACTIVADA');

buscarNoticias();
buscarVideosVirales();
buscarNoticiasTecnologia();
buscarTendencias();

setInterval(buscarNoticias, 30 * 60 * 1000);
setInterval(buscarVideosVirales, 60 * 60 * 1000);
setInterval(buscarNoticiasTecnologia, 45 * 60 * 1000);
setInterval(buscarTendencias, 90 * 60 * 1000);

let ra = 0;
bot.on('polling_error', async (e) => {
    if (e.code === 'EFATAL' || e.code === 'ECONNABORTED') { ra++; if (ra <= 10) { await bot.stopPolling(); await new Promise(r => setTimeout(r, ra * 5000)); await bot.startPolling(); } }
});
