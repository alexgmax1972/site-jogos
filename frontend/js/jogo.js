"use strict";

// =====================================================
// REINOS EM GUERRA - MOTOR 3D
// THREE.JS r128 + GLTFLoader
// Mapa do castelo + inimigos + poção de cura + som + gráficos
// =====================================================

// ---------- MODELOS DOS PERSONAGENS ----------
const MODELOS_PERSONAGENS = {
    guerreiro: "modelos/guerreiro/guerreiro.glb",
    mago: "modelos/mago/mago.glb",
    arqueiro: "modelos/arqueiro/arqueiro.glb",
    paladino: "modelos/paladino/paladino.glb",
    assassino: "modelos/assassino/assassino.glb",
    druida: "modelos/druida/druida.glb",
    necromante: "modelos/necromante/necromante.glb",
    barbaro: "modelos/barbaro/barbaro.glb",
    invocador: "modelos/invocador/invocador.glb",
    cavaleirorunico: "modelos/cavaleiro/rune-knight.glb"
};

function normalizarNome(nome) {
    return String(nome || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

function identificarModelo(classe) {
    const nome = normalizarNome(classe);
    const aliases = {
        guerreiro: "guerreiro", warrior: "guerreiro",
        mago: "mago", mage: "mago", wizard: "mago",
        arqueiro: "arqueiro", archer: "arqueiro",
        paladino: "paladino", paladin: "paladino",
        assassino: "assassino", assassin: "assassino",
        druida: "druida", druid: "druida",
        necromante: "necromante", necromancer: "necromante",
        barbaro: "barbaro", barbarian: "barbaro",
        invocador: "invocador", summoner: "invocador",
        cavaleiro: "cavaleirorunico", cavaleirorunico: "cavaleirorunico", runeknight: "cavaleirorunico"
    };
    return aliases[nome] || null;
}

// ---------- AVISO DE ERROS NA TELA (ajuda a achar problemas) ----------
const VERSAO = "v5 · cenários + horda";
const errosMostrados = new Set();
function reportarErro(erro) {
    const texto = String((erro && erro.message) || erro);
    console.error(erro);
    if (errosMostrados.has(texto) || errosMostrados.size > 4) return;
    errosMostrados.add(texto);
    try {
        let box = document.getElementById("erroJogo");
        if (!box) {
            box = document.createElement("div");
            box.id = "erroJogo";
            box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;padding:8px 12px;border-radius:8px;background:rgba(150,0,0,.92);color:#fff;font:12px monospace;white-space:pre-wrap;pointer-events:none";
            document.body.appendChild(box);
        }
        box.textContent = "⚠️ Erro no jogo (" + VERSAO + "):\n" + Array.from(errosMostrados).join("\n");
    } catch (e2) { /* ignora */ }
}
window.addEventListener("error", e => reportarErro(e.message + " @" + String(e.filename || "").split("/").pop() + ":" + e.lineno));
window.addEventListener("unhandledrejection", e => reportarErro(e.reason));

// ---------- SOM (embutido: não depende de js/som.js) ----------
if (!window.Som) {
(function () {
    let ctx = null, master, sfxG, musG, ambG;
    let mudo = false;
    const vol = { mestre: 0.85, musica: 0.6 };
    let ruidoBuf = null;

    try {
        const s = JSON.parse(localStorage.getItem("rpg_som") || "null");
        if (s) {
            vol.mestre = s.mestre ?? 0.85;
            vol.musica = s.musica ?? 0.6;
            mudo = !!s.mudo;
        }
    } catch (e) { /* ignora */ }

    function salvar() {
        try { localStorage.setItem("rpg_som", JSON.stringify({ mestre: vol.mestre, musica: vol.musica, mudo })); } catch (e) { /* ignora */ }
    }

    function aplicarVolume() {
        if (!ctx) return;
        master.gain.value = mudo ? 0 : vol.mestre;
        musG.gain.value = vol.musica * 0.5;
    }

    // ---------- blocos basicos ----------
    function tom(freq, dur, tipo, v, fim, atraso, dest) {
        if (!ctx) return;
        const t = ctx.currentTime + (atraso || 0);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = tipo || "sine";
        o.frequency.setValueAtTime(freq, t);
        if (fim) o.frequency.exponentialRampToValueAtTime(Math.max(20, fim), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v || 0.2), t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(dest || sfxG);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    function criarRuido() {
        const n = ctx.sampleRate * 2;
        const b = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }

    function sopro(dur, v, fIni, fFim, tipoFiltro, atraso) {
        if (!ctx) return;
        const t = ctx.currentTime + (atraso || 0);
        const s = ctx.createBufferSource();
        s.buffer = ruidoBuf;
        const f = ctx.createBiquadFilter();
        f.type = tipoFiltro || "bandpass";
        f.frequency.setValueAtTime(fIni, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, fFim), t + dur);
        f.Q.value = 1.2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(sfxG);
        s.start(t, Math.random());
        s.stop(t + dur + 0.05);
    }

    function arpejo(notas, tipo, v, passo) {
        notas.forEach((n, i) => tom(n, 0.35, tipo, v, 0, i * passo));
    }

    // ---------- efeitos ----------
    const EFEITOS = {
        ataque()  { sopro(0.18, 0.35, 1800, 500, "bandpass"); },
        acerto()  { tom(140, 0.12, "square", 0.25, 60); sopro(0.1, 0.3, 3000, 800, "highpass"); },
        magia()   { tom(300, 0.5, "sawtooth", 0.12, 900); tom(450, 0.5, "sine", 0.2, 1400); sopro(0.5, 0.15, 500, 3000); },
        escudo()  { tom(220, 0.6, "triangle", 0.25, 440); tom(330, 0.6, "sine", 0.2, 660, 0.05); },
        cura()    { arpejo([523, 659, 784, 1047], "sine", 0.2, 0.08); },
        pocao()   { tom(300, 0.1, "sine", 0.25, 500); tom(260, 0.1, "sine", 0.25, 450, 0.13); tom(240, 0.1, "sine", 0.25, 420, 0.26); arpejo([659, 784, 988, 1319], "sine", 0.15, 0.07); },
        pulo()    { tom(250, 0.15, "square", 0.08, 500); },
        dash()    { sopro(0.25, 0.4, 600, 3000, "bandpass"); },
        dano()    { tom(180, 0.25, "sawtooth", 0.28, 70); sopro(0.15, 0.3, 1200, 200, "lowpass"); },
        morte()   { tom(220, 0.4, "square", 0.18, 60); sopro(0.3, 0.25, 1500, 200, "lowpass"); },
        caca()    { tom(400, 0.12, "triangle", 0.2, 200); tom(300, 0.15, "triangle", 0.2, 150, 0.1); },
        nivel()   { arpejo([523, 659, 784, 1047, 1319], "triangle", 0.22, 0.1); },
        item()    { tom(880, 0.08, "sine", 0.25); tom(1320, 0.15, "sine", 0.25, 0, 0.07); },
        projetil(){ tom(600, 0.3, "sawtooth", 0.1, 200); },
        passo()   { sopro(0.07, 0.10, 350 + Math.random() * 200, 180, "lowpass"); },
        agua()    { sopro(0.12, 0.14, 1500, 600, "bandpass"); },
        erro()    { tom(150, 0.15, "square", 0.12, 100); },
        clique()  { tom(700, 0.05, "square", 0.08); },
        bioma()   { tom(392, 0.7, "sine", 0.14); tom(523, 0.9, "sine", 0.14, 0, 0.15); }
    };

    function tocar(nome) {
        if (!ctx || mudo || !EFEITOS[nome]) return;
        try { EFEITOS[nome](); } catch (e) { /* ignora */ }
    }

    // ---------- ambiente: vento, passaros, musica ----------
    function criarVento() {
        const s = ctx.createBufferSource();
        s.buffer = ruidoBuf;
        s.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 420;
        f.Q.value = 0.5;
        const g = ctx.createGain();
        g.gain.value = 0.07;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.07;
        lg.gain.value = 0.04;
        lfo.connect(lg); lg.connect(g.gain);
        s.connect(f); f.connect(g); g.connect(ambG);
        s.start(); lfo.start();
    }

    function passaro() {
        if (ctx && !mudo && ctx.state === "running") {
            const base = 2400 + Math.random() * 1200;
            const n = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) tom(base, 0.09, "sine", 0.05, base * 1.35, i * 0.12, ambG);
        }
        setTimeout(passaro, 5000 + Math.random() * 9000);
    }

    const ACORDES = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
    const PENTA = [440, 494, 587, 659, 784, 880];
    let iAcorde = 0;

    function acorde() {
        if (ctx && ctx.state === "running") {
            const notas = ACORDES[iAcorde++ % ACORDES.length];
            const t = ctx.currentTime;
            notas.forEach(fq => {
                const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
                o.type = "triangle";
                o.frequency.value = fq;
                f.type = "lowpass";
                f.frequency.value = 900;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(0.28, t + 2);
                g.gain.linearRampToValueAtTime(0.0001, t + 7.5);
                o.connect(f); f.connect(g); g.connect(musG);
                o.start(t); o.stop(t + 8);
            });
        }
        setTimeout(acorde, 7000);
    }

    function melodia() {
        if (ctx && ctx.state === "running" && Math.random() < 0.7) {
            const fq = PENTA[Math.floor(Math.random() * PENTA.length)];
            tom(fq, 1.6, "sine", 0.18, 0, 0, musG);
        }
        setTimeout(melodia, 1600 + Math.random() * 2400);
    }

    let iniciado = false;
    function iniciar() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            master = ctx.createGain(); master.connect(ctx.destination);
            sfxG = ctx.createGain(); sfxG.connect(master);
            musG = ctx.createGain(); musG.connect(master);
            ambG = ctx.createGain(); ambG.gain.value = 0.5; ambG.connect(master);
            ruidoBuf = criarRuido();
            aplicarVolume();
        }
        if (ctx.state === "suspended") ctx.resume();
        if (!iniciado) {
            iniciado = true;
            criarVento();
            acorde();
            melodia();
            setTimeout(passaro, 3000);
        }
    }

    // navegadores so liberam audio depois de um toque/tecla
    ["pointerdown", "click", "keydown", "touchstart"].forEach(ev =>
        window.addEventListener(ev, iniciar, { passive: true }));

    document.addEventListener("visibilitychange", () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    window.Som = {
        iniciar,
        tocar,
        mudo: () => mudo,
        ativo: () => !!ctx && ctx.state === "running",
        alternarMudo() { mudo = !mudo; aplicarVolume(); salvar(); return mudo; },
        definir(chave, valor) {
            if (chave in vol) { vol[chave] = Math.min(1, Math.max(0, valor)); aplicarVolume(); salvar(); }
        },
        obter: () => ({ mestre: vol.mestre, musica: vol.musica, mudo })
    };
})();
}
const Som = window.Som;

// ---------- VERIFICAR ELEMENTOS E PERSONAGEM ----------
const areaJogo = document.getElementById("rpg");
const elementoCarregamento = document.getElementById("carregando");

let personagemSalvo = null;
try {
    const dados = localStorage.getItem("rpg_personagem");
    if (dados) personagemSalvo = JSON.parse(dados);
} catch (erro) {
    console.error("Erro ao ler personagem:", erro);
}

if (!personagemSalvo) {
    if (elementoCarregamento) elementoCarregamento.textContent = "Nenhum herói encontrado. Crie seu personagem primeiro.";
} else if (typeof THREE === "undefined" || typeof THREE.GLTFLoader === "undefined") {
    if (elementoCarregamento) elementoCarregamento.textContent = "Erro ao carregar Three.js ou GLTFLoader.";
} else if (!areaJogo || !elementoCarregamento) {
    console.error("Elementos do jogo não encontrados.");
} else {
    iniciarRPG3D(personagemSalvo);
}

// =====================================================
// MOTOR PRINCIPAL
// =====================================================
function iniciarRPG3D(personagem) {

    const area = areaJogo;
    const carregando = elementoCarregamento;
    const num = (v, padrao) => Number.isFinite(Number(v)) ? Number(v) : padrao;

    const MAX_POCOES = 5;
    const RECARGA_POCAO = 3;
    const LIMITE_MAPA = 140;

    // ---------- DADOS DO HERÓI ----------
    personagem.nome = personagem.nome || "Aventureiro";
    personagem.classe = personagem.classe || "Cavaleiro Rúnico";
    personagem.nivel = Math.max(1, num(personagem.nivel, 1));
    personagem.hpMax = Math.max(1, num(personagem.hpMax ?? personagem.vidaMaxima ?? personagem.hp ?? personagem.vida, 100));
    personagem.hp = Math.min(personagem.hpMax, Math.max(0, num(personagem.hp ?? personagem.vida, personagem.hpMax)));
    if (personagem.hp <= 0) personagem.hp = personagem.hpMax;
    personagem.mpMax = Math.max(0, num(personagem.mpMax ?? personagem.manaMaxima ?? personagem.mp ?? personagem.mana, 50));
    personagem.mp = Math.min(personagem.mpMax, Math.max(0, num(personagem.mp ?? personagem.mana, personagem.mpMax)));
    personagem.xp = Math.max(0, num(personagem.xp ?? personagem.experiencia, 0));
    personagem.xpProximoNivel = Math.max(1, num(personagem.xpProximoNivel, 100));
    personagem.ouro = Math.max(0, num(personagem.ouro, 100));
    personagem.pocoes = Math.min(MAX_POCOES, Math.max(0, num(personagem.pocoes, 2)));
    personagem.inventario = Array.isArray(personagem.inventario) ? personagem.inventario : [];

    const classeIdentificada = identificarModelo(personagem.classe);
    if (!classeIdentificada) {
        carregando.textContent = "Classe não reconhecida: " + personagem.classe;
        console.error("Classe não reconhecida:", personagem.classe);
        return;
    }
    const caminhoModelo = MODELOS_PERSONAGENS[classeIdentificada];

    // ---------- CENÁRIO DE CADA PERSONAGEM ----------
    // arq = arquivo .glb | chao = cor do campo em volta | ceu = céu e névoa
    // folha = [matiz, saturação, luz] das árvores de fora | arvores = quantidade (multiplicador)
    const CENARIOS_CLASSE = {
        guerreiro:  { nome: "Castelo de Eldoria",  arq: "castelo-eldoria.glb",     chao: 0x4f9a3a, ceu: 0xa9d6f5, folha: [0.30, 0.55, 0.28], arvores: 1.0 },
        mago:       { nome: "Torre Arcana",        arq: "torre-arcana.glb",        chao: 0x5d6fae, ceu: 0xb7b2ea, folha: [0.74, 0.35, 0.36], arvores: 0.8 },
        arqueiro:   { nome: "Floresta dos Arqueiros", arq: "floresta-arqueiro.glb", chao: 0x3f8a3a, ceu: 0xb4dcc0, folha: [0.33, 0.60, 0.26], arvores: 1.5, esc: 2 },
        paladino:   { nome: "Santuário Sagrado",   arq: "santuario-paladino.glb",  chao: 0xb8a46a, ceu: 0xf0e4c0, folha: [0.20, 0.40, 0.34], arvores: 0.5 },
        assassino:  { nome: "Ruínas Sombrias",     arq: "ruinas-sombrias.glb",     chao: 0x5c6b78, ceu: 0x9fb0c0, folha: [0.50, 0.30, 0.24], arvores: 0.7 },
        druida:     { nome: "Bosque Sagrado",      arq: "bosque-sagrado.glb",      chao: 0x3f9a45, ceu: 0xb0e0c8, folha: [0.34, 0.65, 0.30], arvores: 1.3 },
        necromante: { nome: "Necrópole",           arq: "necropole.glb",           chao: 0x5a6e70, ceu: 0x9db5bf, folha: [0.50, 0.20, 0.25], arvores: 0.5 },
        barbaro:    { nome: "Terra de Guerra",     arq: "terra-guerra.glb",        chao: 0x8a6a45, ceu: 0xe0c9a8, folha: [0.10, 0.40, 0.30], arvores: 0.6 },
        invocador:  { nome: "Círculo Arcano",      arq: "circulo-arcano.glb",      chao: 0x7a5fb0, ceu: 0xc6b4ee, folha: [0.78, 0.40, 0.35], arvores: 0.7 },
        cavaleiro:  { nome: "Fortaleza das Runas", arq: "fortaleza-runas.glb",     chao: 0x667488, ceu: 0xaec0d8, folha: [0.36, 0.35, 0.26], arvores: 0.8 },
        monge:      { nome: "Templo do Monge",     arq: "templo-monge.glb",        chao: 0x9a8a5a, ceu: 0xe8dcc0, folha: [0.30, 0.40, 0.35], arvores: 0.8 },
        samurai:    { nome: "Fortaleza Samurai",   arq: "fortaleza-samurai.glb",   chao: 0x8a6a58, ceu: 0xe6c8c0, folha: [0.02, 0.50, 0.45], arvores: 0.8 }
    };
    const chaveCenario = classeIdentificada === "cavaleirorunico" ? "cavaleiro" : classeIdentificada;
    const dadosCenario = CENARIOS_CLASSE[chaveCenario] || CENARIOS_CLASSE.guerreiro;
    const tema = dadosCenario;
    const corMapaChao = "#" + new THREE.Color(tema.chao).multiplyScalar(1.15).getHexString();

    // ---------- QUALIDADE GRÁFICA ----------
    const PRESETS = {
        baixo: { nome: "Baixo", pixel: 1,    sombras: false, sombraTam: 512,  arvores: 60,  pedras: 25, grama: 0,     maxInim: 0, horda: 400, slots: 4,  filtro: false },
        medio: { nome: "Médio", pixel: 1.25, sombras: true,  sombraTam: 1024, arvores: 100, pedras: 40, grama: 2500,  maxInim: 0, horda: 1200, slots: 8, filtro: false },
        alto:  { nome: "Alto",  pixel: 1.75, sombras: true,  sombraTam: 2048, arvores: 150, pedras: 60, grama: 6000,  maxInim: 0, horda: 2500, slots: 16, filtro: true },
        ultra: { nome: "Ultra", pixel: 2,    sombras: true,  sombraTam: 2048, arvores: 220, pedras: 90, grama: 12000, maxInim: 0, horda: 4000, slots: 28, filtro: true }
    };
    const ehToque = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    let nivelGraf = ehToque ? "medio" : "alto";
    try {
        const salvo = localStorage.getItem("rpg_graficos");
        if (salvo && PRESETS[salvo]) nivelGraf = salvo;
    } catch (erro) { /* ignora */ }
    const GR = Object.assign({}, PRESETS[nivelGraf]);

    // =================================================
    // CENA, CÂMERA, RENDERIZADOR
    // =================================================
    const COR_CEU = tema.ceu;
    const cena = new THREE.Scene();
    cena.background = new THREE.Color(COR_CEU);
    cena.fog = new THREE.Fog(COR_CEU, 60, 260);

    const camera = new THREE.PerspectiveCamera(65, area.clientWidth / Math.max(1, area.clientHeight), 0.1, 500);
    camera.position.set(0, 4, 8);

    let renderizador;
    try {
        renderizador = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (erro) {
        console.error(erro);
        carregando.textContent = "Seu navegador não conseguiu iniciar o WebGL.";
        return;
    }
    renderizador.setSize(area.clientWidth, area.clientHeight);
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, GR.pixel));
    renderizador.shadowMap.enabled = GR.sombras;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    renderizador.outputEncoding = THREE.sRGBEncoding;
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.0;

    const estiloCanvas = renderizador.domElement.style;
    estiloCanvas.position = "absolute";
    estiloCanvas.inset = "0";
    estiloCanvas.width = "100%";
    estiloCanvas.height = "100%";
    estiloCanvas.display = "block";
    estiloCanvas.touchAction = "none";
    area.insertBefore(renderizador.domElement, area.firstChild);

    // =================================================
    // ILUMINAÇÃO (clara)
    // =================================================
    const luzAmbiente = new THREE.HemisphereLight(0xffffff, 0x8a9a7a, 1.25);
    cena.add(luzAmbiente);

    const luzSol = new THREE.DirectionalLight(0xfff0d0, 2.1);
    luzSol.position.set(35, 55, 25);
    luzSol.castShadow = GR.sombras;
    luzSol.shadow.mapSize.set(GR.sombraTam, GR.sombraTam);
    luzSol.shadow.camera.left = -60;
    luzSol.shadow.camera.right = 60;
    luzSol.shadow.camera.top = 60;
    luzSol.shadow.camera.bottom = -60;
    luzSol.shadow.camera.far = 200;
    luzSol.shadow.bias = -0.0002;
    cena.add(luzSol);
    cena.add(luzSol.target);

    const luzPreenchimento = new THREE.DirectionalLight(0xbcd4ff, 0.45);
    luzPreenchimento.position.set(-25, 15, -20);
    cena.add(luzPreenchimento);

    // =================================================
    // TERRENO E CAMINHO
    // =================================================
    function criarTexturaChao() {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        g.fillStyle = "#e8e8e8";
        g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 1800; k++) {
            const x = Math.random() * 256, y = Math.random() * 256, r = 1 + Math.random() * 4;
            const tom = Math.floor(170 + Math.random() * 85);
            g.fillStyle = `rgba(${tom},${tom},${tom},0.5)`;
            g.beginPath();
            g.arc(x, y, r, 0, 6.283);
            g.fill();
        }
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(50, 50);
        t.encoding = THREE.sRGBEncoding;
        t.anisotropy = renderizador.capabilities.getMaxAnisotropy();
        return t;
    }

    const terreno = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshStandardMaterial({ color: tema.chao, map: criarTexturaChao(), roughness: 1 })
    );
    terreno.rotation.x = -Math.PI / 2;
    terreno.position.y = -0.05;
    terreno.receiveShadow = true;
    cena.add(terreno);

    // =================================================
    // CENÁRIO DA CLASSE (.glb) + MAPA DE CHÃO E PAREDES
    // =================================================
    const CS = 0.5;                                   // tamanho de cada célula do mapa de colisão
    let mapa = null;                                  // { gx0, gz0, nx, nz, topo[], muro }
    let mapaBg = null;                                // imagem do minimapa
    let zonaCenario = { x0: -55, x1: 55, z0: -60, z1: 45 };   // área ocupada pelo cenário (a decoração fica fora)
    let cenarioPronto = false, cenarioFalhou = false;
    let obstaculosFixos = [];                         // só usado se o .glb não carregar

    function celda(x, z) {
        if (!mapa) return -1;
        const ix = Math.floor((x - mapa.gx0) / CS), iz = Math.floor((z - mapa.gz0) / CS);
        if (ix < 0 || iz < 0 || ix >= mapa.nx || iz >= mapa.nz) return -1;
        return iz * mapa.nx + ix;
    }
    // altura do chão em (x,z): a superfície mais alta que fique até 1,2 acima dos pés (sobe degraus, passa por baixo de telhados)
    function alturaMundo(x, z, pesY) {
        const k = celda(x, z);
        if (k < 0) return 0;
        const hs = mapa.topo[k];
        if (!hs) return 0;
        const lim = pesY + 1.2;
        let melhor = -Infinity;
        for (let i = 0; i < hs.length; i++) if (hs[i] <= lim && hs[i] > melhor) melhor = hs[i];
        return melhor === -Infinity ? 0 : Math.max(0, melhor);
    }
    function bloqueado(x, z) {
        const k = celda(x, z);
        return k >= 0 && mapa.muro[k] === 1;
    }

    function construirMapa(raiz, caixa) {
        const gx0 = caixa.min.x - 1, gz0 = caixa.min.z - 1;
        const nx = Math.ceil((caixa.max.x - gx0) / CS) + 2, nz = Math.ceil((caixa.max.z - gz0) / CS) + 2;
        const topo = new Array(nx * nz), muro = new Uint8Array(nx * nz);
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();

        function marcar(x, z) {
            const ix = Math.floor((x - gx0) / CS), iz = Math.floor((z - gz0) / CS);
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const X = ix + dx, Z = iz + dz;
                    if (X >= 0 && Z >= 0 && X < nx && Z < nz) muro[Z * nx + X] = 1;
                }
            }
        }
        function paredeTri() {
            const pts = [a, b, c];
            for (let k = 0; k < 3; k++) {
                const p = pts[k], q = pts[(k + 1) % 3];
                const d = Math.hypot(q.x - p.x, q.z - p.z);
                const passos = Math.max(1, Math.ceil(d / (CS * 0.8)));
                for (let s2 = 0; s2 <= passos; s2++) {
                    const f = s2 / passos;
                    marcar(p.x + (q.x - p.x) * f, p.z + (q.z - p.z) * f);
                }
            }
            marcar((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3);
        }
        function chaoTri() {
            const den = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
            if (Math.abs(den) < 1e-9) return;
            const ix0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) - gx0) / CS));
            const ix1 = Math.min(nx - 1, Math.floor((Math.max(a.x, b.x, c.x) - gx0) / CS));
            const iz0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) - gz0) / CS));
            const iz1 = Math.min(nz - 1, Math.floor((Math.max(a.z, b.z, c.z) - gz0) / CS));
            for (let iz = iz0; iz <= iz1; iz++) {
                for (let ix = ix0; ix <= ix1; ix++) {
                    const px = gx0 + (ix + 0.5) * CS, pz = gz0 + (iz + 0.5) * CS;
                    const l1 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / den;
                    const l2 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / den;
                    const l3 = 1 - l1 - l2;
                    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
                    const h = l1 * a.y + l2 * b.y + l3 * c.y;
                    const k = iz * nx + ix;
                    const lista = topo[k] || (topo[k] = []);
                    let igual = false;
                    for (let q = 0; q < lista.length; q++) if (Math.abs(lista[q] - h) < 0.05) { igual = true; break; }
                    if (!igual) lista.push(h);
                }
            }
        }

        raiz.updateMatrixWorld(true);
        raiz.traverse(o => {
            if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
            const pos = o.geometry.attributes.position, idx = o.geometry.index, m = o.matrixWorld;
            const total = idx ? idx.count : pos.count;
            for (let i = 0; i + 2 < total; i += 3) {
                a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
                b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(m);
                c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(m);
                e1.subVectors(b, a);
                e2.subVectors(c, a);
                nrm.crossVectors(e1, e2);
                const len = nrm.length();
                if (len < 1e-9) continue;
                const ny = nrm.y / len;
                if (ny > 0.5) {
                    chaoTri();
                } else if (Math.abs(ny) < 0.6) {
                    const ymin = Math.min(a.y, b.y, c.y), ymax = Math.max(a.y, b.y, c.y);
                    if (ymax > 0.7 && ymin < 3.0) paredeTri();
                }
            }
        });

        mapa = { gx0, gz0, nx, nz, topo, muro };

        // imagem do minimapa (1 pixel por célula)
        const cv = document.createElement("canvas");
        cv.width = nx; cv.height = nz;
        const g = cv.getContext("2d");
        const img = g.createImageData(nx, nz);
        const cc = new THREE.Color(tema.chao).multiplyScalar(1.15);
        const rgbChao = [Math.min(255, cc.r * 255), Math.min(255, cc.g * 255), Math.min(255, cc.b * 255)];
        for (let k = 0; k < nx * nz; k++) {
            let cor = null;
            if (muro[k]) cor = [86, 92, 106];
            else if (topo[k]) {
                let max = -Infinity;
                for (const h of topo[k]) if (h > max) max = h;
                cor = max > 3 ? [150, 134, 116] : (max > 1.2 ? [176, 166, 142] : rgbChao);
            }
            if (cor) { img.data[k * 4] = cor[0]; img.data[k * 4 + 1] = cor[1]; img.data[k * 4 + 2] = cor[2]; img.data[k * 4 + 3] = 255; }
        }
        g.putImageData(img, 0, 0);
        mapaBg = cv;
    }

    // ponto aberto dentro do cenário (sem parede perto e sem teto em cima)
    function pontoLivreNoCenario(rnd, minDist, ref) {
        if (!mapa) return null;
        for (let t = 0; t < 40; t++) {
            const x = zonaCenario.x0 + rnd() * (zonaCenario.x1 - zonaCenario.x0);
            const z = zonaCenario.z0 + rnd() * (zonaCenario.z1 - zonaCenario.z0);
            const k = celda(x, z);
            if (k < 0 || mapa.muro[k] || !mapa.topo[k]) continue;
            let baixo = false, alto = false;
            for (const h of mapa.topo[k]) { if (h <= 1.2) baixo = true; if (h > 2.2) alto = true; }
            if (!baixo || alto) continue;
            if (ref && Math.hypot(x - ref.x, z - ref.z) < minDist) continue;
            let ok = true;
            for (let dz = -3; dz <= 3 && ok; dz += 3) {
                for (let dx = -3; dx <= 3; dx += 3) {
                    if (bloqueado(x + dx * CS, z + dz * CS)) { ok = false; break; }
                }
            }
            if (ok) return [x, z];
        }
        return null;
    }

    // materiais muito escuros (ou "metal" sem reflexo) ficavam pretos: clareia sem mudar as texturas
    function clarearMaterial(m) {
        if (!m || !m.isMeshStandardMaterial) return;
        m.metalness = Math.min(m.metalness || 0, 0.15);
        m.roughness = Math.max(m.roughness === undefined ? 1 : m.roughness, 0.6);
        if (!m.map && m.color) {
            const c = m.color, lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
            if (lum < 0.16) c.multiplyScalar(Math.min(6, 0.16 / Math.max(lum, 0.015)));
        }
        m.needsUpdate = true;
    }

    // castelo simples, só aparece se o .glb não for encontrado
    function criarCasteloReserva() {
        const g = new THREE.Group();
        const matP = new THREE.MeshStandardMaterial({ color: 0xa0a3aa, roughness: 0.9 });
        const matT = new THREE.MeshStandardMaterial({ color: 0x8a3a2e, roughness: 0.9 });
        const corpo = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 12), matP);
        corpo.position.set(0, 7, 0);
        g.add(corpo);
        [[-12, 0, 20], [12, 0, 20], [0, -8, 24]].forEach(([x, z, h]) => {
            const t = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, h, 8), matP);
            t.position.set(x, h / 2, z);
            const top = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 8), matT);
            top.position.set(x, h + 2, z);
            g.add(t, top);
        });
        g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        g.position.set(0, 0, -20);
        cena.add(g);
        obstaculosFixos = [{ x: -6, z: -20, r: 7.5 }, { x: 6, z: -20, r: 7.5 }, { x: -12, z: -20, r: 3.2 }, { x: 12, z: -20, r: 3.2 }, { x: 0, z: -28, r: 3.2 }];
    }

    function posicionarHeroiInicio() {
        const cx = (zonaCenario.x0 + zonaCenario.x1) / 2;
        const z = Math.min(LIMITE_MAPA - 8, zonaCenario.z1 + 8);
        heroi.position.set(cx, 0, z);
        heroi.rotation.y = Math.PI;
        anguloCamera = Math.PI;
        camera.position.set(cx, 4, z + 7);
    }

    function cenarioFalha() {
        cenarioFalhou = true;
        console.warn("Cenário GLB não encontrado, usando o castelo simples:", dadosCenario.arq);
        criarCasteloReserva();
        zonaCenario = { x0: -25, x1: 25, z0: -35, z1: -5 };
        construirCenario();
        heroi.position.set(0, 0, 20);
        colocarItensIniciais();
        msg("⚠️ Cenário 3D não encontrado em modelos/cenarios/" + dadosCenario.arq, 8);
    }

    function carregarCenarioClasse(caminhos) {
        const atual = caminhos[0], resto = caminhos.slice(1);
        new THREE.GLTFLoader().load(atual, gltf => {
            try {
                const raiz = gltf.scene;
                raiz.scale.setScalar(dadosCenario.esc || 1);
                raiz.updateMatrixWorld(true);
                raiz.traverse(o => {
                    if (!o.isMesh) return;
                    o.castShadow = true;
                    o.receiveShadow = true;
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach(clarearMaterial);
                });
                cena.add(raiz);
                const caixa = new THREE.Box3().setFromObject(raiz);
                construirMapa(raiz, caixa);
                zonaCenario = { x0: caixa.min.x, x1: caixa.max.x, z0: caixa.min.z, z1: caixa.max.z };
                cenarioPronto = true;
                construirCenario();          // refaz árvores, pedras e grama só FORA da área do cenário
                posicionarHeroiInicio();
                colocarItensIniciais();
                reiniciarHorda();
                carregarModelosHorda();
                msg("🏰 " + dadosCenario.nome, 5);
            } catch (erro) {
                console.error("Erro ao preparar cenário:", atual, erro);
                cenarioFalha();
            }
        }, undefined, () => {
            if (resto.length) carregarCenarioClasse(resto);
            else cenarioFalha();
        });
    }
    carregarCenarioClasse(["modelos/cenarios/" + dadosCenario.arq, "cenarios/" + dadosCenario.arq, "modelos/" + dadosCenario.arq]);

    // =================================================
    // CENÁRIO (árvores, pedras, grama) - muda com a qualidade gráfica
    // =================================================
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    const geoTronco = new THREE.CylinderGeometry(0.25, 0.4, 3, 8);
    geoTronco.translate(0, 1.5, 0);
    const geoFolhas = new THREE.ConeGeometry(2.2, 5, 8);
    geoFolhas.translate(0, 5, 0);
    const geoPedra = new THREE.DodecahedronGeometry(1, 0);
    const geoGrama = new THREE.ConeGeometry(0.07, 1.2, 3, 1);
    geoGrama.translate(0, 0.6, 0);

    const matTronco = new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 1 });
    const matFolhas = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const matPedra = new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 1 });
    const matGrama = new THREE.MeshStandardMaterial({ color: new THREE.Color(tema.chao).multiplyScalar(1.3), roughness: 1, side: THREE.DoubleSide });

    const cenarioGrupo = new THREE.Group();
    cena.add(cenarioGrupo);
    let obstaculosCenario = [];

    function posicaoLivre(rnd, folga) {
        for (let t = 0; t < 12; t++) {
            const x = (rnd() - 0.5) * 2 * (LIMITE_MAPA - 4);
            const z = (rnd() - 0.5) * 2 * (LIMITE_MAPA - 4);
            if (x > zonaCenario.x0 - 5 - folga && x < zonaCenario.x1 + 5 + folga && z > zonaCenario.z0 - 5 - folga && z < zonaCenario.z1 + 20 + folga) continue;   // fora do cenário e da área de início
            return [x, z];
        }
        return null;
    }

    function construirCenario() {
        while (cenarioGrupo.children.length) cenarioGrupo.remove(cenarioGrupo.children[0]);
        obstaculosCenario = [];
        const rnd = mulberry32(20240607);   // mesma disposição sempre
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), eu = new THREE.Euler();
        const cor = new THREE.Color();

        // árvores
        const nA = Math.round(GR.arvores * tema.arvores);
        const troncos = new THREE.InstancedMesh(geoTronco, matTronco, nA);
        const folhas = new THREE.InstancedMesh(geoFolhas, matFolhas, nA);
        let usadas = 0;
        for (let k = 0; k < nA; k++) {
            const pos = posicaoLivre(rnd, 2);
            if (!pos) continue;
            const esc = 0.8 + rnd() * 0.7;
            p.set(pos[0], 0, pos[1]);
            eu.set(0, rnd() * 6.28, 0);
            q.setFromEuler(eu);
            s.setScalar(esc);
            m4.compose(p, q, s);
            troncos.setMatrixAt(usadas, m4);
            folhas.setMatrixAt(usadas, m4);
            cor.setHSL(tema.folha[0] + rnd() * 0.05, tema.folha[1], tema.folha[2] + rnd() * 0.10);
            folhas.setColorAt(usadas, cor);
            obstaculosCenario.push({ x: pos[0], z: pos[1], r: 0.5 * esc });
            usadas++;
        }
        troncos.count = folhas.count = usadas;
        troncos.instanceMatrix.needsUpdate = true;
        folhas.instanceMatrix.needsUpdate = true;
        if (folhas.instanceColor) folhas.instanceColor.needsUpdate = true;
        troncos.castShadow = folhas.castShadow = true;
        troncos.receiveShadow = folhas.receiveShadow = true;
        troncos.frustumCulled = folhas.frustumCulled = false;
        cenarioGrupo.add(troncos, folhas);

        // pedras
        const nP = GR.pedras;
        const pedras = new THREE.InstancedMesh(geoPedra, matPedra, nP);
        let pu = 0;
        for (let k = 0; k < nP; k++) {
            const pos = posicaoLivre(rnd, 0);
            if (!pos) continue;
            const esc = 0.5 + rnd() * 1.2;
            p.set(pos[0], esc * 0.5, pos[1]);
            eu.set(rnd() * 3, rnd() * 3, rnd() * 3);
            q.setFromEuler(eu);
            s.setScalar(esc);
            m4.compose(p, q, s);
            pedras.setMatrixAt(pu++, m4);
            obstaculosCenario.push({ x: pos[0], z: pos[1], r: esc * 0.9 });
        }
        pedras.count = pu;
        pedras.instanceMatrix.needsUpdate = true;
        pedras.castShadow = true;
        pedras.receiveShadow = true;
        pedras.frustumCulled = false;
        cenarioGrupo.add(pedras);

        // grama
        if (GR.grama > 0) {
            const grama = new THREE.InstancedMesh(geoGrama, matGrama, GR.grama);
            for (let k = 0; k < GR.grama; k++) {
                const x = (rnd() - 0.5) * 2 * LIMITE_MAPA, z = (rnd() - 0.5) * 2 * LIMITE_MAPA;
                const noCaminho = x > zonaCenario.x0 && x < zonaCenario.x1 && z > zonaCenario.z0 && z < zonaCenario.z1;
                const sc = noCaminho ? 0 : 0.7 + rnd() * 1.0;
                p.set(x, 0, z);
                eu.set(0, rnd() * 6, 0);
                q.setFromEuler(eu);
                s.set(sc, sc * (0.8 + rnd() * 0.8), sc);
                m4.compose(p, q, s);
                grama.setMatrixAt(k, m4);
            }
            grama.instanceMatrix.needsUpdate = true;
            grama.frustumCulled = false;
            cenarioGrupo.add(grama);
        }
    }

    // =================================================
    // HERÓI 3D
    // =================================================
    const heroi = new THREE.Group();
    cena.add(heroi);

    const luzHeroi = new THREE.PointLight(0xffe8c0, 0.5, 16);
    luzHeroi.position.y = 1.6;
    heroi.add(luzHeroi);

    let modelo3D = null, mixer = null, animacaoAtual = null;
    let acoes = {};
    let modeloCarregado = false;
    let noAr = false, velocidadeVertical = 0, pulosFeitos = 0;
    let atacando = false, tempoAcao = 0;

    const loader = new THREE.GLTFLoader();

    const estado = {
        recargaAtaque: 0, recargaMagia: 0, recargaPocao: 0,
        invulneravel: 0, passo: 0, tSpawn: 0, salvar: 0
    };

    function registrarAnimacoes(animacoes) {
        acoes = {};
        animacaoAtual = null;
        if (!animacoes.length) {
            console.warn("Este GLB não possui animações:", classeIdentificada);
            return;
        }
        const mapa = {
            idle: ["idle", "stand", "breath", "rest"],
            walk: ["walk", "walking"],
            run: ["run", "running", "sprint"],
            jump: ["jump", "jumping"],
            swordswing: ["swordswing", "swordattack", "attack", "slash", "melee", "hit"],
            cheer: ["cheer", "victory", "celebrate"],
            wave: ["wave", "hello", "greet"]
        };
        Object.entries(mapa).forEach(([nome, palavras]) => {
            const clipe = animacoes.find(c => {
                const n = normalizarNome(c.name);
                return palavras.some(pa => n.includes(pa));
            });
            if (clipe) acoes[nome] = mixer.clipAction(clipe);
        });
        acoes.primeira = mixer.clipAction(animacoes[0]);
        if (!acoes.idle) acoes.idle = acoes.primeira;
    }

    function tocarAnimacao(nome, repetir = true) {
        if (!mixer || !acoes[nome] || animacaoAtual === nome) return;
        const proxima = acoes[nome];
        proxima.reset();
        proxima.enabled = true;
        proxima.setEffectiveWeight(1);
        proxima.setEffectiveTimeScale(1);
        if (repetir) {
            proxima.setLoop(THREE.LoopRepeat, Infinity);
            proxima.clampWhenFinished = false;
        } else {
            proxima.setLoop(THREE.LoopOnce, 1);
            proxima.clampWhenFinished = true;
        }
        if (animacaoAtual && acoes[animacaoAtual] && acoes[animacaoAtual] !== proxima) {
            acoes[animacaoAtual].crossFadeTo(proxima, 0.25, true);
        } else {
            proxima.fadeIn(0.25);
        }
        proxima.play();
        animacaoAtual = nome;
    }

    function prepararModelo(gltf) {
        modelo3D = gltf.scene;
        modelo3D.traverse(o => {
            if (!o.isMesh) return;
            o.castShadow = true;
            o.receiveShadow = true;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach(m => {
                if (!m) return;
                m.needsUpdate = true;
                if ("roughness" in m) m.roughness = Math.max(0.25, m.roughness);
            });
        });
        modelo3D.updateMatrixWorld(true);

        const c0 = new THREE.Box3().setFromObject(modelo3D);
        const centro = new THREE.Vector3();
        c0.getCenter(centro);
        modelo3D.position.x -= centro.x;
        modelo3D.position.z -= centro.z;
        modelo3D.updateMatrixWorld(true);

        const c1 = new THREE.Box3().setFromObject(modelo3D);
        const tam = new THREE.Vector3();
        c1.getSize(tam);
        modelo3D.scale.setScalar(2.5 / (tam.y || 1));
        modelo3D.updateMatrixWorld(true);

        const c2 = new THREE.Box3().setFromObject(modelo3D);
        modelo3D.position.y -= c2.min.y;

        heroi.add(modelo3D);
        mixer = new THREE.AnimationMixer(modelo3D);
        registrarAnimacoes(gltf.animations || []);

        mixer.addEventListener("finished", ev => {
            const unicas = [acoes.swordswing, acoes.cheer, acoes.wave, acoes.jump];
            if (!unicas.includes(ev.action)) return;
            if (ev.action === acoes.jump && noAr) return;
            finalizarAcao();
        });

        modeloCarregado = true;
        carregando.style.display = "none";
        if (acoes.idle) tocarAnimacao("idle");
    }

    carregando.style.display = "flex";
    carregando.textContent = "Carregando " + personagem.classe + "...";
    loader.load(caminhoModelo,
        gltf => {
            try { prepararModelo(gltf); }
            catch (erro) {
                console.error("Erro ao preparar personagem:", erro);
                carregando.textContent = "O modelo foi encontrado, mas não pôde ser preparado.";
            }
        },
        progresso => {
            if (progresso.total > 0) {
                carregando.textContent = "Carregando " + personagem.classe + ": " + Math.round(progresso.loaded / progresso.total * 100) + "%";
            }
        },
        erro => {
            console.error("Erro ao carregar modelo:", caminhoModelo, erro);
            carregando.style.display = "flex";
            carregando.textContent = "Não foi possível carregar " + personagem.classe + ". Confira o caminho do arquivo GLB.";
        }
    );

    // =================================================
    // MENSAGENS
    // =================================================
    const mensagemEl = document.getElementById("mensagemJogo");
    let msgTimer = 0;
    function msg(texto, tempo = 3) {
        if (mensagemEl) mensagemEl.textContent = texto;
        msgTimer = tempo;
    }

    // =================================================
    // ENTRADA (teclado, mouse, toque)
    // =================================================
    const teclas = {};
    const joy = { x: 0, y: 0, ativo: false, id: null };
    const gp = { x: 0, y: 0, cx: 0, cy: 0, ativo: false, corre: false, antes: [] };   // controle (gamepad)
    let anguloCamera = 0, alturaCamera = 3.2, distanciaCamera = 7;
    let arrastando = false, mouseX = 0, mouseY = 0;

    window.addEventListener("keydown", e => {
        const tecla = e.key.toLowerCase();
        if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
        if (e.repeat) return;
        teclas[tecla] = true;
        if (e.code === "Space") pular();
        if (tecla === "j") atacar();
        if (tecla === "k") magiaAtaque();
        if (tecla === "f" || tecla === "h") usarPocao();
        if (tecla === "g") alternarPainelConfig();
        if (tecla === "p") alternarAjuda();
        if (tecla === "m") { Som.alternarMudo(); atualizarIconeSom(); }
        if (tecla === "c") executarAcao("cheer", "🏆 " + personagem.classe + " está comemorando!");
        if (tecla === "v") executarAcao("wave", "👋 " + personagem.classe + " está acenando!");
    });
    window.addEventListener("keyup", e => { teclas[e.key.toLowerCase()] = false; });
    window.addEventListener("blur", () => {
        Object.keys(teclas).forEach(t => { teclas[t] = false; });
        arrastando = false;
    });

    renderizador.domElement.addEventListener("mousedown", e => {
        arrastando = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    window.addEventListener("mouseup", () => { arrastando = false; });
    window.addEventListener("mousemove", e => {
        if (!arrastando) return;
        anguloCamera -= (e.clientX - mouseX) * 0.005;
        alturaCamera = THREE.MathUtils.clamp(alturaCamera + (e.clientY - mouseY) * 0.02, 1.5, 8);
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    renderizador.domElement.addEventListener("wheel", e => {
        e.preventDefault();
        distanciaCamera = THREE.MathUtils.clamp(distanciaCamera + e.deltaY * 0.01, 3, 14);
    }, { passive: false });

    // câmera por toque
    let toqueCamId = null, toqueX = 0, toqueY = 0;
    renderizador.domElement.addEventListener("touchstart", e => {
        const t = e.changedTouches[0];
        if (toqueCamId === null) { toqueCamId = t.identifier; toqueX = t.clientX; toqueY = t.clientY; }
    }, { passive: true });
    renderizador.domElement.addEventListener("touchmove", e => {
        for (const t of e.changedTouches) {
            if (t.identifier !== toqueCamId) continue;
            anguloCamera -= (t.clientX - toqueX) * 0.006;
            alturaCamera = THREE.MathUtils.clamp(alturaCamera + (t.clientY - toqueY) * 0.02, 1.5, 8);
            toqueX = t.clientX;
            toqueY = t.clientY;
        }
        e.preventDefault();
    }, { passive: false });
    const fimToqueCam = e => { for (const t of e.changedTouches) if (t.identifier === toqueCamId) toqueCamId = null; };
    renderizador.domElement.addEventListener("touchend", fimToqueCam);
    renderizador.domElement.addEventListener("touchcancel", fimToqueCam);

    // controles de celular (joystick + botões)
    function criarControlesMobile() {
        if (!ehToque) return;
        const estilo = document.createElement("style");
        estilo.textContent = `
            #joystickBase{position:absolute;left:18px;bottom:22px;width:130px;height:130px;border-radius:50%;
                background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.3);z-index:20;touch-action:none}
            #joystickKnob{position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;
                background:rgba(255,220,150,.75);pointer-events:none}
            #botoesMobile{position:absolute;right:14px;bottom:20px;display:grid;grid-template-columns:repeat(3,58px);gap:8px;z-index:20}
            #botoesMobile button{height:58px;border-radius:50%;border:2px solid rgba(255,255,255,.35);
                background:rgba(40,25,10,.65);color:#fff;font-size:22px;touch-action:none}
            #botoesMobile button:active{background:rgba(200,140,40,.8)}
            .controles{display:none!important}
            .botoes-jogo{display:none!important}
        `;
        document.head.appendChild(estilo);

        const base = document.createElement("div");
        base.id = "joystickBase";
        const knob = document.createElement("div");
        knob.id = "joystickKnob";
        base.appendChild(knob);
        area.appendChild(base);

        const raio = 45;
        function moverJoy(t) {
            const r = base.getBoundingClientRect();
            let dx = t.clientX - (r.left + r.width / 2);
            let dy = t.clientY - (r.top + r.height / 2);
            const d = Math.hypot(dx, dy);
            if (d > raio) { dx = dx / d * raio; dy = dy / d * raio; }
            knob.style.transform = `translate(${dx}px,${dy}px)`;
            joy.x = dx / raio;
            joy.y = dy / raio;
            joy.ativo = true;
        }
        function soltarJoy() {
            joy.x = 0; joy.y = 0; joy.ativo = false; joy.id = null;
            knob.style.transform = "translate(0,0)";
        }
        base.addEventListener("touchstart", e => { joy.id = e.changedTouches[0].identifier; moverJoy(e.changedTouches[0]); e.preventDefault(); }, { passive: false });
        base.addEventListener("touchmove", e => { for (const t of e.changedTouches) if (t.identifier === joy.id) moverJoy(t); e.preventDefault(); }, { passive: false });
        base.addEventListener("touchend", e => { for (const t of e.changedTouches) if (t.identifier === joy.id) soltarJoy(); });
        base.addEventListener("touchcancel", soltarJoy);

        const painel = document.createElement("div");
        painel.id = "botoesMobile";
        [
            ["⚔️", atacar], ["🔥", magiaAtaque], ["⬆️", pular],
            ["🧪", usarPocao], ["💨", () => { teclas.shift = !teclas.shift; }],
            ["📜", () => { const b = document.getElementById("botaoMenu"); if (b) b.click(); }]
        ].forEach(([icone, fn]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = icone;
            b.addEventListener("touchstart", e => { e.preventDefault(); fn(); }, { passive: false });
            painel.appendChild(b);
        });
        area.appendChild(painel);
    }
    criarControlesMobile();
    if (ehToque) document.body.style.overscrollBehavior = "none";

    // ---------- CONTROLE (PlayStation / Xbox / genérico) ----------
    // Analógico esq.: mover | Analógico dir.: câmera | A(X): pular | X(Quadrado): atacar
    // Y(Triângulo) ou R1: magia | B(Bolinha) ou L1: poção | L2: correr | R2: atacar
    // Options: ficha | Share: configurações | D-pad cima/baixo: zoom
    const zona = v => Math.abs(v) < 0.2 ? 0 : (v - Math.sign(v) * 0.2) / 0.8;
    window.addEventListener("gamepadconnected", e => { msg("🎮 Controle conectado!", 4); });
    window.addEventListener("gamepaddisconnected", () => { msg("🎮 Controle desconectado.", 3); });

    function lerControle(delta) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        let pad = null;
        for (const p of pads) if (p && p.connected) { pad = p; break; }
        if (!pad) { gp.x = gp.y = gp.cx = gp.cy = 0; gp.ativo = false; gp.corre = false; return; }

        gp.x = zona(pad.axes[0] || 0);
        gp.y = zona(pad.axes[1] || 0);
        gp.cx = zona(pad.axes[2] || 0);
        gp.cy = zona(pad.axes[3] || 0);
        const forca = Math.hypot(gp.x, gp.y);
        gp.ativo = forca > 0;
        const b = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
        gp.corre = b(6) || forca > 0.95;
        const novo = i => b(i) && !gp.antes[i];

        if (novo(0)) pular();
        if (novo(2) || novo(7)) atacar();
        if (novo(3) || novo(5)) magiaAtaque();
        if (novo(1) || novo(4)) usarPocao();
        if (novo(8)) alternarPainelConfig();
        if (novo(9)) {
            const f = document.getElementById("ficha");
            const mb = document.getElementById("botaoMenu");
            if (f && !f.classList.contains("oculta")) f.classList.add("oculta");
            else if (mb) mb.click();
        }
        if (b(12)) distanciaCamera = THREE.MathUtils.clamp(distanciaCamera - 6 * delta, 3, 14);
        if (b(13)) distanciaCamera = THREE.MathUtils.clamp(distanciaCamera + 6 * delta, 3, 14);
        for (let i = 0; i < pad.buttons.length; i++) gp.antes[i] = b(i);

        anguloCamera -= gp.cx * 2.8 * delta;
        alturaCamera = THREE.MathUtils.clamp(alturaCamera + gp.cy * 6 * delta, 1.5, 8);
    }

    // =================================================
    // EFEITOS VISUAIS
    // =================================================
    const efeitos = [];
    const geoAnel = new THREE.RingGeometry(0.9, 1, 40);
    function efeitoAnel(x, z, cor, raioMax, duracao) {
        const m = new THREE.Mesh(geoAnel, new THREE.MeshBasicMaterial({
            color: cor, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false
        }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.1, z);
        cena.add(m);
        efeitos.push({ m, t: 0, dur: duracao, max: raioMax });
    }
    function atualizarEfeitos(delta) {
        for (let k = efeitos.length - 1; k >= 0; k--) {
            const f = efeitos[k];
            f.t += delta;
            const p = f.t / f.dur;
            if (p >= 1) {
                cena.remove(f.m);
                f.m.material.dispose();
                efeitos.splice(k, 1);
                continue;
            }
            f.m.scale.setScalar(Math.max(0.01, f.max * p));
            f.m.material.opacity = 0.8 * (1 - p);
        }
    }

    // =================================================
    // INIMIGOS E ITENS
    // =================================================
    const inimigos = [];
    const itens = [];

    const geoSlime = new THREE.SphereGeometry(0.9, 16, 12);
    geoSlime.translate(0, 0.8, 0);
    const geoGoblinCorpo = new THREE.CylinderGeometry(0.45, 0.6, 1.5, 10);
    geoGoblinCorpo.translate(0, 0.75, 0);
    const geoCabeca = new THREE.SphereGeometry(0.42, 12, 12);
    const geoOlho = new THREE.SphereGeometry(0.09, 6, 6);
    const matOlho = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const geoBarra = new THREE.PlaneGeometry(1.4, 0.16);
    const matBarraFundo = new THREE.MeshBasicMaterial({ color: 0x220808, depthTest: false });
    const geoPocao = new THREE.SphereGeometry(0.4, 12, 12);

    function criarInimigo(x, z) {
        const nivel = Math.floor(Math.hypot(x, z) / 55);
        const slime = Math.random() < 0.5;
        const cor = slime ? 0x3ddc84 : 0xc27a2a;
        const mat = new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, emissive: cor, emissiveIntensity: 0.15 });

        const grupo = new THREE.Group();
        const corpo = new THREE.Group();
        const tronco = new THREE.Mesh(slime ? geoSlime : geoGoblinCorpo, mat);
        tronco.castShadow = true;
        corpo.add(tronco);
        if (!slime) {
            const cab = new THREE.Mesh(geoCabeca, mat);
            cab.position.y = 1.85;
            cab.castShadow = true;
            corpo.add(cab);
        }
        const yOlho = slime ? 1.1 : 1.9;
        [-0.2, 0.2].forEach(dx => {
            const o = new THREE.Mesh(geoOlho, matOlho);
            o.position.set(dx, yOlho, slime ? 0.78 : 0.37);
            o.scale.setScalar(1.6);
            corpo.add(o);
        });
        corpo.scale.setScalar(1.2 + nivel * 0.05);

        const fundo = new THREE.Mesh(geoBarra, matBarraFundo);
        const preench = new THREE.Mesh(geoBarra, new THREE.MeshBasicMaterial({ color: 0xe03030, depthTest: false }));
        const barra = new THREE.Group();
        barra.add(fundo, preench);
        fundo.renderOrder = 10;
        preench.renderOrder = 11;
        barra.position.y = slime ? 2.6 : 3.2;

        grupo.add(corpo, barra);
        grupo.position.set(x, alturaMundo(x, z, 0.5), z);
        cena.add(grupo);

        const hpMax = 40 + nivel * 14;
        inimigos.push({
            grupo, corpo, barra, preench, mat,
            nome: slime ? "Slime" : "Goblin",
            hp: hpMax, hpMax, nivel,
            vel: (slime ? 2.4 : 3.2) + Math.random() * 0.8,
            dano: 6 + Math.floor(nivel * 2.2),
            recarga: 0, fase: Math.random() * 6, rumo: Math.random() * 6.28
        });
    }

    function removerInimigo(idx) {
        const e = inimigos[idx];
        cena.remove(e.grupo);
        e.mat.dispose();
        e.preench.material.dispose();
        inimigos.splice(idx, 1);
    }

    function atualizarSpawns(delta) {
        estado.tSpawn -= delta;
        if ((!cenarioPronto && !cenarioFalhou) || estado.tSpawn > 0 || inimigos.length >= GR.maxInim) return;
        estado.tSpawn = 1.2;
        const ref = { x: heroi.position.x, z: heroi.position.z };
        if (mapa) {
            const pos = pontoLivreNoCenario(Math.random, 22, ref);
            if (pos) criarInimigo(pos[0], pos[1]);
            return;
        }
        for (let t = 0; t < 10; t++) {
            const x = (Math.random() - 0.5) * 2 * (LIMITE_MAPA - 6);
            const z = (Math.random() - 0.5) * 2 * (LIMITE_MAPA - 6);
            if (Math.hypot(x - ref.x, z - ref.z) < 30) continue;
            if (x > zonaCenario.x0 - 3 && x < zonaCenario.x1 + 3 && z > zonaCenario.z0 - 3 && z < zonaCenario.z1 + 3) continue;
            criarInimigo(x, z);
            return;
        }
    }

    function criarItem(tipo, x, z) {
        const cor = tipo === "vida" ? 0xe03a3a : 0x3a6ae0;
        const emi = tipo === "vida" ? 0x802020 : 0x203880;
        const malha = new THREE.Mesh(geoPocao, new THREE.MeshStandardMaterial({ color: cor, emissive: emi, emissiveIntensity: 0.8 }));
        const base = alturaMundo(x, z, 0.5) + 1;
        malha.position.set(x, base, z);
        malha.castShadow = true;
        cena.add(malha);
        itens.push({ tipo, malha, base, fase: Math.random() * 6 });
    }

    function colocarItensIniciais() {
        const rnd = mulberry32(777);
        for (let k = 0; k < 12; k++) {
            const pos = mapa ? pontoLivreNoCenario(rnd, 0, null) : posicaoLivre(rnd, 0);
            if (pos) criarItem(k < 8 ? "vida" : "mana", pos[0], pos[1]);
        }
    }

    function atualizarItens(delta, tempo) {
        for (let k = itens.length - 1; k >= 0; k--) {
            const it = itens[k];
            it.malha.rotation.y += delta * 2;
            it.malha.position.y = it.base + Math.sin(tempo * 2 + it.fase) * 0.2;
            const d = Math.hypot(it.malha.position.x - heroi.position.x, it.malha.position.z - heroi.position.z);
            if (d > 1.7) continue;

            if (it.tipo === "vida") {
                if (personagem.pocoes < MAX_POCOES) {
                    personagem.pocoes++;
                    msg("🧪 Poção de cura guardada! (tecla F para usar)");
                } else {
                    personagem.hp = Math.min(personagem.hpMax, personagem.hp + 30);
                    msg("❤️ Mochila cheia: poção bebida na hora, +30");
                }
            } else {
                personagem.mp = Math.min(personagem.mpMax, personagem.mp + 25);
                msg("🔮 Poção de mana: +25");
            }
            Som.tocar("item");
            cena.remove(it.malha);
            it.malha.material.dispose();
            itens.splice(k, 1);
            atualizarInterface();
            atualizarPocoes();
        }
    }

    // =================================================
    // COMBATE
    // =================================================
    function danoNoInimigo(e, valor) {
        e.hp -= valor;
        const p = Math.max(0.001, e.hp / e.hpMax);
        e.preench.scale.x = p;
        e.preench.position.x = -(1 - p) * 0.7;
        const dx = e.grupo.position.x - heroi.position.x, dz = e.grupo.position.z - heroi.position.z;
        const d = Math.hypot(dx, dz) || 1;
        e.grupo.position.x += dx / d * 0.8;
        e.grupo.position.z += dz / d * 0.8;
        Som.tocar("acerto");
        if (e.hp <= 0) matarInimigo(e);
    }

    function matarInimigo(e) {
        const idx = inimigos.indexOf(e);
        if (idx < 0) return;
        const px = e.grupo.position.x, pz = e.grupo.position.z;
        const ouro = 5 + Math.floor(Math.random() * 10) + e.nivel * 3;
        personagem.ouro += ouro;
        personagem.xp += 15 + e.nivel * 6;
        const sorte = Math.random();
        if (sorte < 0.3) criarItem("vida", px, pz);
        else if (sorte < 0.45) criarItem("mana", px, pz);
        msg("💀 " + e.nome + " derrotado! +" + ouro + " 🪙");
        Som.tocar("morte");
        efeitoAnel(px, pz, 0xffaa44, 2.5, 0.4);
        removerInimigo(idx);
        verificarNivel();
        atualizarInterface();
    }

    function verificarNivel() {
        while (personagem.xp >= personagem.xpProximoNivel) {
            personagem.xp -= personagem.xpProximoNivel;
            personagem.nivel++;
            personagem.xpProximoNivel = Math.round(personagem.xpProximoNivel * 1.4);
            personagem.hpMax += 10;
            personagem.mpMax += 5;
            personagem.hp = personagem.hpMax;
            personagem.mp = personagem.mpMax;
            msg("⭐ Subiu para o nível " + personagem.nivel + "!", 4);
            Som.tocar("nivel");
            efeitoAnel(heroi.position.x, heroi.position.z, 0xffe066, 6, 0.8);
        }
    }

    function atacar() {
        if (estado.recargaAtaque > 0) return;
        estado.recargaAtaque = 0.55;
        Som.tocar("ataque");
        executarAnim("swordswing");
        const dano = 15 + personagem.nivel * 4 + num(personagem.ataque ?? personagem.forca, 0);
        const fx = Math.sin(heroi.rotation.y), fz = Math.cos(heroi.rotation.y);
        let acertou = 0;
        for (const e of inimigos.slice()) {
            const dx = e.grupo.position.x - heroi.position.x;
            const dz = e.grupo.position.z - heroi.position.z;
            const d = Math.hypot(dx, dz);
            if (d < 4 && (dx * fx + dz * fz) / (d || 1) > -0.2) { danoNoInimigo(e, dano); acertou++; }
        }
        acertou += hordaGolpe(dano, 4, fx, fz, 6);
        msg(acertou ? "⚔️ Golpe! Dano: " + dano : "⚔️ " + personagem.classe + " ataca!");
    }

    function magiaAtaque() {
        if (estado.recargaMagia > 0) return;
        if (personagem.mp < 20) { msg("Mana insuficiente!"); Som.tocar("erro"); return; }
        personagem.mp -= 20;
        estado.recargaMagia = 1;
        Som.tocar("magia");
        executarAnim("swordswing");
        const dano = 30 + personagem.nivel * 6;
        efeitoAnel(heroi.position.x, heroi.position.z, 0xff6a2a, 9, 0.5);
        let n = 0;
        for (const e of inimigos.slice()) {
            const d = Math.hypot(e.grupo.position.x - heroi.position.x, e.grupo.position.z - heroi.position.z);
            if (d < 9) { danoNoInimigo(e, dano); n++; }
        }
        n += hordaArea(dano, 9, 40);
        msg("🔥 Magia! " + n + " alvo(s), dano " + dano);
        atualizarInterface();
    }

    function danoNoHeroi(valor) {
        if (estado.invulneravel > 0) return;
        valor = Math.max(1, Math.round(valor - num(personagem.defesa, 0) * 0.3));
        personagem.hp = Math.max(0, personagem.hp - valor);
        estado.invulneravel = 0.7;
        estado.semDano = 0;
        Som.tocar("dano");
        msg("💥 Você sofreu " + valor + " de dano! (F = poção)", 1.5);
        atualizarInterface();
        if (personagem.hp <= 0) morrer();
    }

    function morrer() {
        msg("☠️ Você caiu! Perdeu metade do ouro e voltou ao início.", 5);
        personagem.ouro = Math.floor(personagem.ouro / 2);
        personagem.hp = personagem.hpMax;
        personagem.mp = personagem.mpMax;
        reposicionarHeroi();
        estado.invulneravel = 4;
        for (let k = inimigos.length - 1; k >= 0; k--) removerInimigo(k);
        salvarPersonagem();
        atualizarInterface();
    }

    // ---------- poção de cura ----------
    function usarPocao() {
        if (estado.recargaPocao > 0) return;
        if (personagem.pocoes <= 0) { msg("🧪 Sem poções de cura! Derrote inimigos ou ache poções vermelhas."); Som.tocar("erro"); return; }
        if (personagem.hp >= personagem.hpMax) { msg("Vida já está cheia."); Som.tocar("erro"); return; }
        personagem.pocoes--;
        estado.recargaPocao = RECARGA_POCAO;
        const cura = Math.round(personagem.hpMax * 0.5);
        personagem.hp = Math.min(personagem.hpMax, personagem.hp + cura);
        efeitoAnel(heroi.position.x, heroi.position.z, 0xff6b6b, 4, 0.6);
        Som.tocar("pocao");
        msg("🧪 Poção de cura: +" + cura + " de vida (" + personagem.pocoes + " restantes)");
        atualizarInterface();
        atualizarPocoes();
        salvarPersonagem();
    }

    // =================================================
    // AÇÕES / ANIMAÇÕES ESPECIAIS
    // =================================================
    function movimentoAtual() {
        let dx = (teclas.a || teclas.arrowleft ? 1 : 0) - (teclas.d || teclas.arrowright ? 1 : 0);
        let dz = (teclas.w || teclas.arrowup ? 1 : 0) - (teclas.s || teclas.arrowdown ? 1 : 0);
        dx -= joy.x + gp.x;
        dz -= joy.y + gp.y;
        const comp = Math.hypot(dx, dz);
        if (comp > 1) { dx /= comp; dz /= comp; }
        return { dx, dz, mag: Math.min(1, comp), andando: comp > 0.12 };
    }

    function finalizarAcao() {
        atacando = false;
        tempoAcao = 0;
        if (!modeloCarregado) return;
        const andando = movimentoAtual().andando;
        if (noAr && acoes.jump) tocarAnimacao("jump", false);
        else if (andando && teclas.shift && acoes.run) tocarAnimacao("run");
        else if (andando && acoes.walk) tocarAnimacao("walk");
        else if (acoes.idle) tocarAnimacao("idle");
    }

    function executarAnim(nome) {
        if (!modeloCarregado || !acoes[nome]) return false;
        atacando = true;
        tempoAcao = 0.8;
        animacaoAtual = null;
        tocarAnimacao(nome, false);
        return true;
    }

    function executarAcao(nome, mensagem) {
        if (atacando) return;
        if (executarAnim(nome)) msg(mensagem);
        else msg("Animação não disponível neste modelo.");
    }

    function pular() {
        if (pulosFeitos >= 2) return;
        pulosFeitos++;
        noAr = true;
        velocidadeVertical = pulosFeitos === 1 ? 7 : 6.5;
        Som.tocar("pulo");
        if (modeloCarregado && acoes.jump) { animacaoAtual = null; tocarAnimacao("jump", false); }
    }

    // =================================================
    // MOVIMENTO E COLISÃO
    // =================================================
    function resolverColisoes() {
        const lista = [obstaculosFixos, obstaculosCenario];
        for (const grupo of lista) {
            for (const o of grupo) {
                const dx = heroi.position.x - o.x, dz = heroi.position.z - o.z;
                const min = o.r + 0.6;
                if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
                const d = Math.hypot(dx, dz);
                if (d < min && d > 0.0001) {
                    heroi.position.x = o.x + dx / d * min;
                    heroi.position.z = o.z + dz / d * min;
                }
            }
        }
    }

    function podeAndar(x, z) {
        return Math.abs(x) <= LIMITE_MAPA && Math.abs(z) <= LIMITE_MAPA && (estado.livre > 0 || !bloqueado(x, z));
    }
    function tentarMover(dx, dz) {
        const x = heroi.position.x, z = heroi.position.z;
        if (estado.livre > 0 || bloqueado(x, z) || podeAndar(x + dx, z + dz)) { heroi.position.x = THREE.MathUtils.clamp(x + dx, -LIMITE_MAPA, LIMITE_MAPA); heroi.position.z = THREE.MathUtils.clamp(z + dz, -LIMITE_MAPA, LIMITE_MAPA); }
        else if (podeAndar(x + dx, z)) heroi.position.x = x + dx;
        else if (podeAndar(x, z + dz)) heroi.position.z = z + dz;
    }
    function moverInimigo(e, dx, dz) {
        const p = e.grupo.position;
        const lim = LIMITE_MAPA - 2;
        if (podeAndar(p.x + dx, p.z + dz)) { p.x = THREE.MathUtils.clamp(p.x + dx, -lim, lim); p.z = THREE.MathUtils.clamp(p.z + dz, -lim, lim); }
        else if (podeAndar(p.x + dx, p.z)) p.x += dx;
        else if (podeAndar(p.x, p.z + dz)) p.z += dz;
    }

    function atualizarMovimento(delta) {
        const mov = movimentoAtual();
        const correndo = teclas.shift || gp.corre || (joy.ativo && mov.mag > 0.92);
        const vel = correndo ? 8 : 4;

        if (mov.andando) {
            const direcaoFinal = Math.atan2(mov.dx, mov.dz) + anguloCamera;
            let dif = direcaoFinal - heroi.rotation.y;
            dif = Math.atan2(Math.sin(dif), Math.cos(dif));
            heroi.rotation.y += dif * Math.min(1, delta * 8);

            const v = vel * ((joy.ativo || gp.ativo) ? Math.max(0.4, mov.mag) : 1);
            const antesX = heroi.position.x, antesZ = heroi.position.z;
            tentarMover(Math.sin(direcaoFinal) * v * delta, Math.cos(direcaoFinal) * v * delta);
            const andou = Math.hypot(heroi.position.x - antesX, heroi.position.z - antesZ);
            if (andou < v * delta * 0.2) estado.travado = (estado.travado || 0) + delta; else estado.travado = 0;
            if (estado.travado > 0.7) {
                estado.travado = 0;
                let saida = false;
                for (let a = 0; a < 8 && !saida; a++) {
                    saida = podeAndar(heroi.position.x + Math.cos(a * 0.785) * 0.7, heroi.position.z + Math.sin(a * 0.785) * 0.7);
                }
                if (!saida) { estado.livre = 1.5; msg("💨 Você estava preso: saindo do obstáculo...", 2); }   // só se estiver cercado de verdade
            }

            if (!noAr) {
                estado.passo -= delta;
                if (estado.passo <= 0) {
                    estado.passo = correndo ? 0.28 : 0.42;
                    Som.tocar("passo");
                }
            }
        }
        resolverColisoes();

        if (modeloCarregado && !atacando && !noAr) {
            if (mov.andando && correndo && acoes.run) tocarAnimacao("run");
            else if (mov.andando && acoes.walk) tocarAnimacao("walk");
            else if (!mov.andando && acoes.idle) tocarAnimacao("idle");
        }

        const chaoY = alturaMundo(heroi.position.x, heroi.position.z, heroi.position.y);
        if (!noAr) {
            if (chaoY < heroi.position.y - 0.6) { noAr = true; velocidadeVertical = 0; pulosFeitos = 1; }
            else heroi.position.y += (chaoY - heroi.position.y) * Math.min(1, delta * 14);
        }
        if (noAr) {
            heroi.position.y += velocidadeVertical * delta;
            velocidadeVertical -= 18 * delta;
            if (heroi.position.y <= chaoY && velocidadeVertical <= 0) {
                heroi.position.y = chaoY;
                noAr = false;
                velocidadeVertical = 0;
                pulosFeitos = 0;
                if (modeloCarregado && !atacando) finalizarAcao();
            }
        }
    }

    function atualizarInimigos(delta, tempo) {
        for (let k = inimigos.length - 1; k >= 0; k--) {
            const e = inimigos[k];
            const dx = heroi.position.x - e.grupo.position.x;
            const dz = heroi.position.z - e.grupo.position.z;
            const d = Math.hypot(dx, dz);
            e.recarga -= delta;

            if (d < 22) {
                const ux = dx / (d || 1), uz = dz / (d || 1);
                e.corpo.rotation.y = Math.atan2(dx, dz);
                if (d > 2.3) {
                    moverInimigo(e, ux * e.vel * delta, uz * e.vel * delta);
                } else if (e.recarga <= 0) {
                    e.recarga = 1.1;
                    danoNoHeroi(e.dano);
                }
            } else {
                e.rumo += Math.sin(tempo * 0.5 + e.fase) * delta;
                moverInimigo(e, Math.sin(e.rumo) * e.vel * 0.25 * delta, Math.cos(e.rumo) * e.vel * 0.25 * delta);
                e.corpo.rotation.y = e.rumo;
            }
            e.grupo.position.x = THREE.MathUtils.clamp(e.grupo.position.x, -LIMITE_MAPA, LIMITE_MAPA);
            e.grupo.position.z = THREE.MathUtils.clamp(e.grupo.position.z, -LIMITE_MAPA, LIMITE_MAPA);
            e.grupo.position.y = alturaMundo(e.grupo.position.x, e.grupo.position.z, e.grupo.position.y);
            e.corpo.position.y = Math.abs(Math.sin(tempo * 6 + e.fase)) * 0.15;
            e.barra.quaternion.copy(camera.quaternion);
        }
    }

    // =================================================
    // CÂMERA
    // =================================================
    function atualizarCamera() {
        const alvo = new THREE.Vector3(
            heroi.position.x - Math.sin(anguloCamera) * distanciaCamera,
            heroi.position.y + alturaCamera,
            heroi.position.z - Math.cos(anguloCamera) * distanciaCamera
        );
        camera.position.lerp(alvo, 0.12);
        camera.lookAt(heroi.position.x, heroi.position.y + 1.35, heroi.position.z);
    }

    // =================================================
    // INTERFACE: barras, poções, ficha
    // =================================================
    const hud = {};   // HUD compacto (montado logo abaixo)
    function atualizarInterface() {
        const texto = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        const barra = (id, v, max) => {
            const el = document.getElementById(id);
            if (el) el.style.width = (max > 0 ? THREE.MathUtils.clamp(v / max * 100, 0, 100) : 0) + "%";
        };
        texto("nomeHero", personagem.nome);
        texto("classeHero", personagem.classe);
        texto("vidaTexto", `${Math.round(personagem.hp)}/${personagem.hpMax}`);
        texto("manaTexto", `${Math.round(personagem.mp)}/${personagem.mpMax}`);
        texto("xpTexto", `${personagem.xp}/${personagem.xpProximoNivel}`);
        texto("nivelHero", `⭐ Nível ${personagem.nivel}`);
        texto("ouroHero", `🪙 ${personagem.ouro}`);
        barra("barraVida", personagem.hp, personagem.hpMax);
        barra("barraMana", personagem.mp, personagem.mpMax);
        barra("barraXP", personagem.xp, personagem.xpProximoNivel);
        if (hud.vida) {
            const pct = (v, max) => (max > 0 ? THREE.MathUtils.clamp(v / max * 100, 0, 100) : 0) + "%";
            hud.nome.textContent = personagem.nome + " · Nv " + personagem.nivel + "   🪙 " + personagem.ouro + "   💀 " + (personagem.abates || 0);
            hud.vida.style.width = pct(personagem.hp, personagem.hpMax);
            hud.vidaT.textContent = "❤️ " + Math.round(personagem.hp) + "/" + personagem.hpMax;
            hud.mana.style.width = pct(personagem.mp, personagem.mpMax);
            hud.manaT.textContent = "🔮 " + Math.round(personagem.mp) + "/" + personagem.mpMax;
            hud.xp.style.width = pct(personagem.xp, personagem.xpProximoNivel);
        }
    }
    atualizarInterface();

    // barra de poções (topo, centro)
    const hudPocao = document.createElement("div");
    hudPocao.style.cssText = "position:absolute;left:50%;top:64px;transform:translateX(-50%);z-index:15;" +
        "display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;" +
        "font:700 12px sans-serif;color:#fff;text-shadow:0 1px 3px #000;user-select:none";
    const linhaSlots = document.createElement("div");
    linhaSlots.style.cssText = "display:flex;gap:4px;align-items:center";
    const slots = [];
    for (let k = 0; k < MAX_POCOES; k++) {
        const s = document.createElement("span");
        s.textContent = "🧪";
        s.style.cssText = "font-size:22px;transition:opacity .2s,filter .2s";
        linhaSlots.appendChild(s);
        slots.push(s);
    }
    const rotuloPocao = document.createElement("span");
    rotuloPocao.textContent = "F";
    rotuloPocao.style.cssText = "margin-left:6px;padding:1px 6px;border:1px solid rgba(255,255,255,.5);border-radius:5px";
    linhaSlots.appendChild(rotuloPocao);
    const fundoRecarga = document.createElement("div");
    fundoRecarga.style.cssText = "width:150px;height:7px;border-radius:4px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);overflow:hidden";
    const preencheRecarga = document.createElement("div");
    preencheRecarga.style.cssText = "height:100%;width:100%;background:linear-gradient(90deg,#c0392b,#ff6b6b)";
    fundoRecarga.appendChild(preencheRecarga);
    hudPocao.append(linhaSlots, fundoRecarga);
    hudPocao.addEventListener("click", () => usarPocao());
    hudPocao.addEventListener("touchstart", e => { e.preventDefault(); usarPocao(); }, { passive: false });
    area.appendChild(hudPocao);

    function atualizarPocoes() {
        for (let k = 0; k < MAX_POCOES; k++) {
            const tem = k < personagem.pocoes;
            slots[k].style.opacity = tem ? "1" : "0.22";
            slots[k].style.filter = tem ? "none" : "grayscale(1)";
        }
        const p = THREE.MathUtils.clamp(1 - estado.recargaPocao / RECARGA_POCAO, 0, 1);
        preencheRecarga.style.width = Math.round(p * 100) + "%";
        preencheRecarga.style.opacity = p >= 1 ? "1" : "0.55";
    }
    atualizarPocoes();

    // ---------- HUD compacto (no lugar do painel grande e da caixa de controles do HTML) ----------
    const estiloHud = document.createElement("style");
    estiloHud.textContent = "#interface .painel-personagem,#interface .controles{display:none!important}";
    document.head.appendChild(estiloHud);

    const hudBox = document.createElement("div");
    hudBox.style.cssText = "position:absolute;left:10px;top:10px;z-index:15;width:" + (ehToque ? "150px" : "210px") +
        ";pointer-events:none;font:700 12px sans-serif;color:#fff;text-shadow:0 1px 3px #000";
    function linhaBarra(cor, altura) {
        const f = document.createElement("div");
        f.style.cssText = "position:relative;height:" + altura + "px;border-radius:7px;background:rgba(0,0,0,.55);" +
            "border:1px solid rgba(255,255,255,.35);overflow:hidden;margin-top:4px";
        const p = document.createElement("div");
        p.style.cssText = "height:100%;width:100%;background:" + cor + ";transition:width .15s";
        const t = document.createElement("span");
        t.style.cssText = "position:absolute;left:0;right:0;top:0;text-align:center;font-size:11px;line-height:" + (altura - 2) + "px";
        f.append(p, t);
        hudBox.appendChild(f);
        return [p, t];
    }
    hud.nome = document.createElement("div");
    hud.nome.style.cssText = "font-size:13px;white-space:nowrap";
    hudBox.appendChild(hud.nome);
    const bv = linhaBarra("linear-gradient(90deg,#c62828,#ff5252)", 17);
    const bm = linhaBarra("linear-gradient(90deg,#1e63c4,#4fc3ff)", 14);
    const bx = linhaBarra("linear-gradient(90deg,#c79100,#ffd54f)", 7);
    hud.vida = bv[0]; hud.vidaT = bv[1];
    hud.mana = bm[0]; hud.manaT = bm[1];
    hud.xp = bx[0];
    area.appendChild(hudBox);
    atualizarInterface();

    // ficha do herói
    const botaoMenu = document.getElementById("botaoMenu");
    const ficha = document.getElementById("ficha");
    const fecharFicha = document.getElementById("fecharFicha");
    if (botaoMenu) {
        botaoMenu.onclick = () => {
            if (!ficha) return;
            ficha.classList.remove("oculta");
            const dados = document.getElementById("dadosFicha");
            if (dados) {
                dados.replaceChildren();
                [
                    ["Nome", personagem.nome], ["Classe", personagem.classe], ["Nível", personagem.nivel],
                    ["Ataque", personagem.ataque ?? personagem.forca ?? 0], ["Defesa", personagem.defesa ?? 0],
                    ["Agilidade", personagem.agilidade ?? 0],
                    ["Vida", `${Math.round(personagem.hp)}/${personagem.hpMax}`],
                    ["Mana", `${Math.round(personagem.mp)}/${personagem.mpMax}`],
                    ["Cenário", dadosCenario ? dadosCenario.nome : "Eldoria"], ["Poções de cura", `${personagem.pocoes}/${MAX_POCOES}`], ["Ouro", personagem.ouro]
                ].forEach(([t, v]) => {
                    const p = document.createElement("p");
                    p.textContent = `${t}: ${v}`;
                    dados.appendChild(p);
                });
            }
            const inv = document.getElementById("inventarioFicha");
            if (inv) {
                inv.replaceChildren();
                const lista = personagem.inventario;
                if (lista.length) {
                    lista.forEach(item => {
                        const p = document.createElement("p");
                        p.textContent = `🎒 ${item.nome || item.item || "Item"} x${item.quantidade ?? 1}`;
                        inv.appendChild(p);
                    });
                } else {
                    const p = document.createElement("p");
                    p.textContent = "Inventário vazio";
                    inv.appendChild(p);
                }
            }
        };
    }
    if (fecharFicha) fecharFicha.onclick = () => { if (ficha) ficha.classList.add("oculta"); };

    const botaoPular = document.getElementById("botaoPular");
    const botaoAtaque = document.getElementById("botaoAtaque");
    if (botaoPular) botaoPular.onclick = pular;
    if (botaoAtaque) botaoAtaque.onclick = atacar;

    // =================================================
    // PAINEL DE CONFIGURAÇÕES: gráficos + som (tecla G)
    // =================================================
    function botaoTopo(texto, direita, aoClicar) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = texto;
        b.style.cssText = "position:absolute;top:12px;right:" + direita + "px;width:40px;height:40px;z-index:15;" +
            "border-radius:50%;border:2px solid rgba(255,220,150,.75);background:rgba(20,14,8,.7);color:#fff;font-size:18px;cursor:pointer";
        b.addEventListener("click", aoClicar);
        area.appendChild(b);
        return b;
    }
    const botaoSom = botaoTopo(Som.mudo() ? "🔇" : "🔊", 60, () => { Som.alternarMudo(); atualizarIconeSom(); Som.tocar("clique"); });
    botaoTopo("⚙️", 12, () => alternarPainelConfig());
    botaoTopo("⛶", 108, () => {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            const f = el.requestFullscreen || el.webkitRequestFullscreen;
            if (f) f.call(el);
        }
    });
    function atualizarIconeSom() { botaoSom.textContent = Som.mudo() ? "🔇" : "🔊"; }

    // ---------- AJUDA (botão ❓ ou tecla P) ----------
    const painelAjuda = document.createElement("div");
    painelAjuda.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;display:none;" +
        "width:min(380px,92%);max-height:88%;overflow:auto;padding:16px;border-radius:14px;box-sizing:border-box;" +
        "background:rgba(24,16,9,.94);border:2px solid rgba(255,220,150,.7);color:#fff;font:14px sans-serif;line-height:1.6";
    [
        "❓ Controles",
        "W A S D / setas — Mover  ·  Shift — Correr",
        "Espaço — Pular (duplo)",
        "J — Atacar  ·  K — Magia (20 de mana)",
        "F — Poção de cura  ·  C / V — Comemorar / Acenar",
        "Mouse (arrastar) — Câmera  ·  Roda — Zoom",
        "G — Gráficos e som  ·  M — Mudo  ·  P — Esta ajuda",
        "🎮 Controle: analógico esq. mover · dir. câmera · A/X pular · X/□ atacar · Y/△ magia · B/○ poção · L2 correr",
        "📱 Celular: joystick e botões na tela"
    ].forEach((t, i) => {
        const d = document.createElement("div");
        d.textContent = t;
        if (i === 0) d.style.cssText = "font-size:18px;font-weight:700;margin-bottom:6px";
        painelAjuda.appendChild(d);
    });
    const fecharAjuda = document.createElement("button");
    fecharAjuda.type = "button";
    fecharAjuda.textContent = "Fechar";
    fecharAjuda.style.cssText = "display:block;width:100%;margin-top:12px;padding:10px;border-radius:8px;border:none;background:#c8892a;color:#fff;font-weight:700;cursor:pointer";
    fecharAjuda.addEventListener("click", () => alternarAjuda());
    painelAjuda.appendChild(fecharAjuda);
    area.appendChild(painelAjuda);
    function alternarAjuda() { painelAjuda.style.display = painelAjuda.style.display === "none" ? "block" : "none"; }
    botaoTopo("❓", 156, () => alternarAjuda());

    // aviso até o navegador liberar o áudio (precisa de um clique/toque)
    const avisoSom = document.createElement("div");
    avisoSom.textContent = "🔊 Clique ou toque na tela para ativar o som";
    avisoSom.style.cssText = "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:30;padding:6px 14px;" +
        "border-radius:16px;background:rgba(0,0,0,.65);color:#fff;font:700 13px sans-serif;pointer-events:none;white-space:nowrap";
    area.appendChild(avisoSom);
    const selo = document.createElement("div");
    selo.textContent = VERSAO;
    selo.style.cssText = "position:absolute;left:8px;bottom:6px;z-index:14;font:11px monospace;color:rgba(255,255,255,.75);text-shadow:0 1px 2px #000;pointer-events:none";
    area.appendChild(selo);
    console.log("REINOS EM GUERRA", VERSAO);

    const painelCfg = document.createElement("div");
    painelCfg.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;display:none;" +
        "width:min(340px,92%);max-height:88%;overflow:auto;padding:16px;border-radius:14px;box-sizing:border-box;" +
        "background:rgba(24,16,9,.94);border:2px solid rgba(255,220,150,.7);color:#fff;font:14px sans-serif";
    area.appendChild(painelCfg);

    const botoesGraf = {};
    function titulo(txt) {
        const d = document.createElement("div");
        d.textContent = txt;
        d.style.cssText = "font-weight:700;margin:12px 0 6px;color:#ffd98a";
        return d;
    }
    function atualizarBotoesConfig() {
        for (const k of Object.keys(botoesGraf)) {
            const ativo = k === nivelGraf;
            botoesGraf[k].style.background = ativo ? "#c8892a" : "rgba(255,255,255,.1)";
            botoesGraf[k].style.borderColor = ativo ? "#ffd98a" : "rgba(255,255,255,.3)";
        }
    }
    function slider(rotulo, valor, aoMudar) {
        const linha = document.createElement("label");
        linha.style.cssText = "display:flex;align-items:center;gap:10px;margin:6px 0";
        const t = document.createElement("span");
        t.textContent = rotulo;
        t.style.cssText = "width:70px";
        const r = document.createElement("input");
        r.type = "range"; r.min = "0"; r.max = "100"; r.value = String(Math.round(valor * 100));
        r.style.cssText = "flex:1";
        r.addEventListener("input", () => aoMudar(r.value / 100));
        linha.append(t, r);
        return linha;
    }

    const tituloPainel = document.createElement("div");
    tituloPainel.textContent = "⚙️ Configurações";
    tituloPainel.style.cssText = "font-size:18px;font-weight:700";
    painelCfg.appendChild(tituloPainel);

    painelCfg.appendChild(titulo("🖥️ Qualidade gráfica"));
    const gradeGraf = document.createElement("div");
    gradeGraf.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:6px";
    Object.keys(PRESETS).forEach(k => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = PRESETS[k].nome;
        b.style.cssText = "padding:8px 2px;border-radius:8px;border:2px solid;color:#fff;cursor:pointer;font-size:13px";
        b.addEventListener("click", () => { Som.tocar("clique"); aplicarGraficos(k); });
        gradeGraf.appendChild(b);
        botoesGraf[k] = b;
    });
    painelCfg.appendChild(gradeGraf);
    const dica = document.createElement("div");
    dica.textContent = "Se o jogo estiver lento, escolha Baixo ou Médio.";
    dica.style.cssText = "font-size:12px;opacity:.7;margin-top:6px";
    painelCfg.appendChild(dica);

    let mostrarFPS = false, fpsAcum = 0, fpsFrames = 0;
    const fpsEl = document.createElement("div");
    fpsEl.style.cssText = "position:absolute;right:12px;top:58px;z-index:15;padding:2px 8px;border-radius:6px;" +
        "background:rgba(0,0,0,.55);color:#9f9;font:700 12px monospace;display:none;pointer-events:none";
    area.appendChild(fpsEl);
    const linhaFps = document.createElement("label");
    linhaFps.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:10px";
    const chkFps = document.createElement("input");
    chkFps.type = "checkbox";
    chkFps.addEventListener("change", () => { mostrarFPS = chkFps.checked; fpsEl.style.display = mostrarFPS ? "block" : "none"; });
    linhaFps.append(chkFps, document.createTextNode("Mostrar FPS"));
    painelCfg.appendChild(linhaFps);

    painelCfg.appendChild(titulo("🔊 Som"));
    const sv = Som.obter();
    painelCfg.appendChild(slider("Geral", sv.mestre, v => Som.definir("mestre", v)));
    painelCfg.appendChild(slider("Música", sv.musica, v => Som.definir("musica", v)));
    const btnMudo = document.createElement("button");
    btnMudo.type = "button";
    btnMudo.style.cssText = "margin-top:8px;padding:8px 12px;border-radius:8px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;cursor:pointer";
    const textoMudo = () => { btnMudo.textContent = Som.mudo() ? "🔇 Som desligado (M)" : "🔊 Som ligado (M)"; };
    textoMudo();
    btnMudo.addEventListener("click", () => { Som.alternarMudo(); textoMudo(); atualizarIconeSom(); });
    painelCfg.appendChild(btnMudo);
    const btnTeste = document.createElement("button");
    btnTeste.type = "button";
    btnTeste.textContent = "🔔 Testar som";
    btnTeste.style.cssText = "margin:8px 0 0 8px;padding:8px 12px;border-radius:8px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;cursor:pointer";
    btnTeste.addEventListener("click", () => { Som.iniciar(); Som.tocar("nivel"); });
    painelCfg.appendChild(btnTeste);

    const btnFechar = document.createElement("button");
    btnFechar.type = "button";
    btnFechar.textContent = "Fechar (G)";
    btnFechar.style.cssText = "display:block;width:100%;margin-top:14px;padding:10px;border-radius:8px;border:none;background:#c8892a;color:#fff;font-weight:700;cursor:pointer";
    btnFechar.addEventListener("click", () => alternarPainelConfig());
    painelCfg.appendChild(btnFechar);

    function alternarPainelConfig() {
        const abrir = painelCfg.style.display === "none";
        painelCfg.style.display = abrir ? "block" : "none";
        if (abrir) { textoMudo(); atualizarIconeSom(); }
    }

    // =================================================
    // HORDA: milhares de inimigos clonados dos modelos .glb
    //  - perto do herói: clones 3D com esqueleto e animação (quantidade limitada)
    //  - longe: bonecos simples em instâncias (milhares quase de graça)
    // =================================================
    const TIPOS_HORDA = [
        { id: "armoured-dwarf",    nome: "Anão Blindado",      alt: 2.2, vel: 2.6, dano: 4,  hp: 80,  xp: 1.2, cor: 0xa9afc0, peso: 30 },
        { id: "dwarf-smith",       nome: "Anão Ferreiro",      alt: 2.1, vel: 2.9, dano: 5,  hp: 60,  xp: 1.1, cor: 0xb5651d, peso: 25 },
        { id: "fur-coat-wanderer", nome: "Andarilho",          alt: 2.5, vel: 3.5, dano: 3,  hp: 40,  xp: 0.9, cor: 0x9a7b52, peso: 25 },
        { id: "gnoll-warrior",     nome: "Gnoll",              alt: 2.6, vel: 3.3, dano: 4,  hp: 50,  xp: 1.0, cor: 0x8a9a3a, peso: 17 },
        { id: "heroic-warrior",    nome: "Guerreiro Heroico",  alt: 3.4, vel: 2.8, dano: 9,  hp: 200, xp: 5.0, cor: 0xd04040, peso: 3, elite: true }
    ];
    const FIG_ALT = 1.95;
    const AGGRO = 24, ALCANCE_H = 1.9;
    const H = { n: 0 };
    let hordaFig = null, geoFigura = null;
    const slotsH = [];
    const modelosH = {};
    let hordaFrame = 0, hordaTAtrib = 0, somAcertoFrame = -1, somMorteFrame = -1;

    function fundirGeometrias(partes) {
        const pos = [], nor = [];
        for (const g0 of partes) {
            const g = g0.index ? g0.toNonIndexed() : g0;
            const p = g.attributes.position.array, n = g.attributes.normal.array;
            for (let k = 0; k < p.length; k++) { pos.push(p[k]); nor.push(n[k]); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        return geo;
    }
    function geometriaFigura() {
        if (geoFigura) return geoFigura;
        const torso = new THREE.CylinderGeometry(0.30, 0.36, 0.85, 8); torso.translate(0, 1.0, 0);
        const cabeca = new THREE.SphereGeometry(0.26, 8, 6); cabeca.translate(0, 1.68, 0);
        const pernaE = new THREE.CylinderGeometry(0.11, 0.10, 0.62, 6); pernaE.translate(-0.15, 0.31, 0);
        const pernaD = new THREE.CylinderGeometry(0.11, 0.10, 0.62, 6); pernaD.translate(0.15, 0.31, 0);
        const bracoE = new THREE.CylinderGeometry(0.08, 0.07, 0.7, 6); bracoE.rotateZ(0.25); bracoE.translate(-0.46, 1.05, 0);
        const bracoD = new THREE.CylinderGeometry(0.08, 0.07, 0.7, 6); bracoD.rotateZ(-0.25); bracoD.translate(0.46, 1.05, 0);
        geoFigura = fundirGeometrias([torso, cabeca, pernaE, pernaD, bracoE, bracoD]);
        return geoFigura;
    }

    // clona um modelo COM esqueleto (clone() comum faria todos os clones compartilharem o mesmo esqueleto)
    function clonarComEsqueleto(fonte) {
        const clone = fonte.clone(true);
        const src = [], dst = [];
        fonte.traverse(o => src.push(o));
        clone.traverse(o => dst.push(o));
        for (let k = 0; k < src.length; k++) {
            const sm = src[k];
            if (!sm.isSkinnedMesh) continue;
            const d = dst[k];
            const ossos = sm.skeleton.bones.map(b => dst[src.indexOf(b)]);
            d.skeleton = new THREE.Skeleton(ossos, sm.skeleton.boneInverses);
            d.bind(d.skeleton, sm.bindMatrix);
        }
        return clone;
    }

    function limparHorda() {
        if (hordaFig) { cena.remove(hordaFig); hordaFig.material.dispose(); hordaFig = null; }
        for (const sl of slotsH) { cena.remove(sl.grupo); if (sl.mixer) sl.mixer.stopAllAction(); }
        slotsH.length = 0;
        H.n = 0;
    }

    function reiniciarHorda() {
        limparHorda();
        const N = GR.horda || 0;
        if (!mapa || N <= 0) return;
        H.x = new Float32Array(N); H.z = new Float32Array(N); H.y = new Float32Array(N); H.rumo = new Float32Array(N);
        H.hp = new Float32Array(N); H.hpMax = new Float32Array(N); H.rec = new Float32Array(N); H.atq = new Float32Array(N); H.resp = new Float32Array(N);
        H.tipo = new Uint8Array(N); H.vivo = new Uint8Array(N); H.est = new Uint8Array(N);
        H.slot = new Int16Array(N).fill(-1);

        const rnd = mulberry32(4242);
        const soma = TIPOS_HORDA.reduce((a, t) => a + t.peso, 0);
        const ref = { x: heroi.position.x, z: heroi.position.z };
        let criados = 0, tentativas = 0;
        while (criados < N && tentativas < N) {
            tentativas++;
            const c = pontoLivreNoCenario(rnd, 28, ref);          // centro de um bando
            if (!c) continue;
            const tam = 15 + Math.floor(rnd() * 40);
            for (let k = 0; k < tam && criados < N; k++) {
                const x = c[0] + (rnd() - 0.5) * 14, z = c[1] + (rnd() - 0.5) * 14;
                const kk = celda(x, z);
                if (kk < 0 || mapa.muro[kk] || !mapa.topo[kk]) continue;
                let r = rnd() * soma, t = 0;
                for (; t < TIPOS_HORDA.length - 1; t++) { r -= TIPOS_HORDA[t].peso; if (r <= 0) break; }
                const i = criados++;
                H.x[i] = x; H.z[i] = z; H.y[i] = alturaMundo(x, z, 0.5);
                H.tipo[i] = t; H.vivo[i] = 1; H.rumo[i] = rnd() * 6.28;
                H.hpMax[i] = H.hp[i] = TIPOS_HORDA[t].hp * (0.9 + rnd() * 0.3);
            }
        }
        H.n = criados;
        if (!H.n) return;

        hordaFig = new THREE.InstancedMesh(geometriaFigura(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), H.n);
        const cor = new THREE.Color();
        for (let i = 0; i < H.n; i++) hordaFig.setColorAt(i, cor.set(TIPOS_HORDA[H.tipo[i]].cor));
        if (hordaFig.instanceColor) hordaFig.instanceColor.needsUpdate = true;
        hordaFig.frustumCulled = false;
        cena.add(hordaFig);
        escreverFar();

        for (let k = 0; k < (GR.slots || 0); k++) {
            const grupo = new THREE.Group();
            const barra = new THREE.Group();
            const fundoB = new THREE.Mesh(geoBarra, matBarraFundo);
            const preB = new THREE.Mesh(geoBarra, new THREE.MeshBasicMaterial({ color: 0xe03030, depthTest: false }));
            fundoB.renderOrder = 10; preB.renderOrder = 11;
            barra.add(fundoB, preB);
            barra.visible = false;
            grupo.add(barra);
            grupo.visible = false;
            cena.add(grupo);
            slotsH.push({ grupo, barra, pre: preB, ent: -1, tipoId: null, clone: null, mixer: null, acoes: {}, anim: null, alt: 2 });
        }
    }

    function carregarModelosHorda() {
        const pastas = ["modelos/inimigos/", "modelos/", "modelos/personagens/", "modelos/npcs/", ""];
        let pendentes = TIPOS_HORDA.length, achados = 0;
        TIPOS_HORDA.forEach(t => {
            const tentar = lista => {
                new THREE.GLTFLoader().load(lista[0] + t.id + ".glb", gltf => {
                    try {
                        const raiz = gltf.scene;
                        raiz.updateMatrixWorld(true);
                        const caixa = new THREE.Box3().setFromObject(raiz);
                        const tam = new THREE.Vector3();
                        caixa.getSize(tam);
                        raiz.traverse(o => {
                            if (!o.isMesh) return;
                            (Array.isArray(o.material) ? o.material : [o.material]).forEach(clarearMaterial);
                        });
                        modelosH[t.id] = { base: raiz, anims: gltf.animations || [], esc: t.alt / (tam.y || 1), minY: caixa.min.y };
                        achados++;
                    } catch (erro) { reportarErro(erro); }
                    if (--pendentes === 0) fimModelos();
                }, undefined, () => {
                    if (lista.length > 1) tentar(lista.slice(1));
                    else if (--pendentes === 0) fimModelos();
                });
            };
            tentar(pastas);
        });
        function fimModelos() {
            if (achados) msg("👹 " + achados + " modelo(s) de inimigo carregado(s). Horda: " + H.n + " inimigos!", 6);
            else msg("⚠️ Modelos dos inimigos não achados (modelos/inimigos/*.glb). Usando bonecos simples. Horda: " + H.n, 8);
        }
    }

    function prepararSlot(sl, idxTipo) {
        const t = TIPOS_HORDA[idxTipo];
        if (sl.clone && sl.tipoId === t.id) return true;
        const mod = modelosH[t.id];
        if (!mod) return false;
        if (sl.clone) { sl.grupo.remove(sl.clone); if (sl.mixer) sl.mixer.stopAllAction(); }
        const clone = clonarComEsqueleto(mod.base);
        clone.scale.setScalar(mod.esc);
        clone.position.y = -mod.minY * mod.esc;
        const pesada = GR.sombras && slotsH.indexOf(sl) < 6;
        clone.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = pesada; o.receiveShadow = true; } });
        sl.grupo.add(clone);
        sl.clone = clone;
        sl.tipoId = t.id;
        sl.mixer = new THREE.AnimationMixer(clone);
        sl.acoes = {};
        sl.anim = null;
        const clipe = (...palavras) => {
            for (const pal of palavras) {
                const c = mod.anims.find(cl => normalizarNome(cl.name).includes(pal));
                if (c) return c;
            }
            return null;
        };
        const reg = (chave, c, uma) => {
            if (!c) return;
            const a = sl.mixer.clipAction(c);
            if (uma) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
            sl.acoes[chave] = a;
        };
        reg("parado", clipe("idle", "wave"), false);                          // o gnoll só tem "wave"
        reg("andar", t.vel > 3.2 ? clipe("run", "walk") : clipe("walk", "run"), false);
        reg("atq", clipe("punch", "swordswing", "kick", "attack"), true);
        sl.alt = t.alt;
        return true;
    }

    function liberarSlot(sl) {
        if (sl.ent >= 0) H.slot[sl.ent] = -1;
        sl.ent = -1;
        sl.grupo.visible = false;
    }

    function atribuirSlots() {
        if (!slotsH.length || !H.n) return;
        const hx = heroi.position.x, hz = heroi.position.z;
        for (const sl of slotsH) {
            if (sl.ent < 0) continue;
            const i = sl.ent, dx = H.x[i] - hx, dz = H.z[i] - hz;
            if (!H.vivo[i] || dx * dx + dz * dz > 3600) liberarSlot(sl);
        }
        const livres = slotsH.filter(sl => sl.ent < 0);
        if (!livres.length && !slotsH.length) return;
        // candidatos: os vivos mais próximos (até 45 m) que ainda não têm clone
        const cand = [];
        for (let i = 0; i < H.n; i++) {
            if (!H.vivo[i] || H.slot[i] >= 0) continue;
            const dx = H.x[i] - hx, dz = H.z[i] - hz, d2 = dx * dx + dz * dz;
            if (d2 > 2025 || !modelosH[TIPOS_HORDA[H.tipo[i]].id]) continue;
            // mantém só os melhores (lista pequena ordenada)
            let pos = cand.length;
            while (pos > 0 && cand[pos - 1][1] > d2) pos--;
            if (pos < slotsH.length) { cand.splice(pos, 0, [i, d2]); if (cand.length > slotsH.length) cand.pop(); }
        }
        for (const [i, d2] of cand) {
            let sl = slotsH.find(x => x.ent < 0);
            if (!sl) {
                // troca com o clone mais distante, se for bem mais longe que este candidato
                let pior = null, pd = 0;
                for (const x of slotsH) {
                    const dx = H.x[x.ent] - hx, dz = H.z[x.ent] - hz, dd = dx * dx + dz * dz;
                    if (dd > pd) { pd = dd; pior = x; }
                }
                if (!pior || pd < d2 + 150) break;
                liberarSlot(pior);
                sl = pior;
            }
            if (!prepararSlot(sl, H.tipo[i])) continue;
            sl.ent = i;
            H.slot[i] = slotsH.indexOf(sl);
            sl.grupo.visible = true;
        }
    }

    function escreverFar() {
        if (!hordaFig) return;
        const arr = hordaFig.instanceMatrix.array;
        for (let i = 0; i < H.n; i++) {
            const o = i * 16;
            if (!H.vivo[i] || H.slot[i] >= 0) {
                arr[o] = 0; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
                arr[o + 4] = 0; arr[o + 5] = 0; arr[o + 6] = 0; arr[o + 7] = 0;
                arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = 0; arr[o + 11] = 0;
                arr[o + 12] = H.x[i]; arr[o + 13] = H.y[i]; arr[o + 14] = H.z[i]; arr[o + 15] = 1;
                continue;
            }
            const sc = TIPOS_HORDA[H.tipo[i]].alt / FIG_ALT;
            const c = Math.cos(H.rumo[i]) * sc, sn = Math.sin(H.rumo[i]) * sc;
            arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -sn; arr[o + 3] = 0;
            arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
            arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c; arr[o + 11] = 0;
            arr[o + 12] = H.x[i]; arr[o + 13] = H.y[i]; arr[o + 14] = H.z[i]; arr[o + 15] = 1;
        }
        hordaFig.instanceMatrix.needsUpdate = true;
    }

    function atualizarHorda(delta, tempo) {
        if (!H.n) return;
        hordaFrame++;
        const hx = heroi.position.x, hz = heroi.position.z;
        const dano0 = Math.floor(personagem.nivel * 0.5);
        let respawns = 0;
        for (let i = 0; i < H.n; i++) {
            if (!H.vivo[i]) {
                if (tempo > H.resp[i] && respawns < 4 && ((hordaFrame + i) % 20 === 0)) {
                    const p = pontoLivreNoCenario(Math.random, 40, { x: hx, z: hz });
                    if (p) {
                        H.x[i] = p[0]; H.z[i] = p[1]; H.y[i] = alturaMundo(p[0], p[1], 0.5);
                        H.hp[i] = H.hpMax[i]; H.vivo[i] = 1; H.est[i] = 0; H.rec[i] = 1;
                        respawns++;
                    }
                }
                continue;
            }
            const dx = hx - H.x[i], dz = hz - H.z[i], d2 = dx * dx + dz * dz;
            if (H.atq[i] > 0) H.atq[i] -= delta;
            if (d2 > AGGRO * AGGRO) { H.est[i] = 0; continue; }
            const d = Math.sqrt(d2) || 0.001;
            const t = TIPOS_HORDA[H.tipo[i]];
            H.rumo[i] = Math.atan2(dx, dz);
            H.rec[i] -= delta;
            const alcance = ALCANCE_H + (i % 5) * 0.35;      // formam um anel em volta do herói
            if (d > alcance) {
                H.est[i] = 1;
                const v = t.vel * delta;
                let nx = H.x[i] + dx / d * v, nz = H.z[i] + dz / d * v;
                if (!podeAndar(nx, nz)) {
                    if (podeAndar(nx, H.z[i])) nz = H.z[i];
                    else if (podeAndar(H.x[i], nz)) nx = H.x[i];
                    else { nx = H.x[i]; nz = H.z[i]; }
                }
                H.x[i] = nx; H.z[i] = nz;
                H.y[i] = alturaMundo(nx, nz, H.y[i]);
            } else {
                H.est[i] = 2;
                if (H.rec[i] <= 0) {
                    H.rec[i] = 1.2;
                    H.atq[i] = 0.6;
                    danoNoHeroi(t.dano + dano0);
                }
            }
        }

        hordaTAtrib -= delta;
        if (hordaTAtrib <= 0) { hordaTAtrib = 0.25; atribuirSlots(); }
        if (hordaFrame % 3 === 0) escreverFar();

        for (const sl of slotsH) {
            if (sl.ent < 0) continue;
            const i = sl.ent;
            sl.grupo.position.set(H.x[i], H.y[i], H.z[i]);
            sl.grupo.rotation.y = H.rumo[i];
            const alvo = (H.atq[i] > 0 && sl.acoes.atq) ? "atq" : (H.est[i] === 1 && sl.acoes.andar ? "andar" : "parado");
            if (sl.anim !== alvo && sl.acoes[alvo]) {
                const a = sl.acoes[alvo];
                a.reset();
                a.fadeIn(0.15);
                a.play();
                const ant = sl.acoes[sl.anim];
                if (ant && ant !== a) ant.fadeOut(0.15);
                sl.anim = alvo;
            }
            if (sl.mixer) sl.mixer.update(delta);
            const ferido = H.hp[i] < H.hpMax[i];
            sl.barra.visible = ferido;
            if (ferido) {
                const pr = Math.max(0.001, H.hp[i] / H.hpMax[i]);
                sl.pre.scale.x = pr;
                sl.pre.position.x = -(1 - pr) * 0.7;
                sl.barra.position.y = sl.alt + 0.6;
                sl.barra.quaternion.copy(camera.quaternion);
            }
        }
    }

    function hordaDano(i, dano) {
        H.hp[i] -= dano;
        const dx = H.x[i] - heroi.position.x, dz = H.z[i] - heroi.position.z, d = Math.hypot(dx, dz) || 1;
        const nx = H.x[i] + dx / d * 0.7, nz = H.z[i] + dz / d * 0.7;
        if (podeAndar(nx, nz)) { H.x[i] = nx; H.z[i] = nz; }
        if (somAcertoFrame !== hordaFrame) { somAcertoFrame = hordaFrame; Som.tocar("acerto"); }
        if (H.hp[i] <= 0) hordaMatar(i);
    }

    function hordaMatar(i) {
        const t = TIPOS_HORDA[H.tipo[i]];
        H.vivo[i] = 0;
        H.resp[i] = relogio.elapsedTime + (t.elite ? 120 : 45) + Math.random() * 45;
        if (H.slot[i] >= 0) liberarSlot(slotsH[H.slot[i]]);
        const ouro = (1 + Math.floor(Math.random() * 4)) + (t.elite ? 30 : 0);
        personagem.ouro += ouro;
        personagem.xp += Math.round(8 * t.xp);
        personagem.abates = (personagem.abates || 0) + 1;
        const sorte = Math.random();
        if (itens.length < 60) {
            if (sorte < (t.elite ? 0.6 : 0.04)) criarItem("vida", H.x[i], H.z[i]);
            else if (sorte < (t.elite ? 0.8 : 0.07)) criarItem("mana", H.x[i], H.z[i]);
        }
        efeitoAnel(H.x[i], H.z[i], 0xffaa44, 1.8, 0.3);
        if (somMorteFrame !== hordaFrame) { somMorteFrame = hordaFrame; Som.tocar("morte"); }
        msg((t.elite ? "👑 " : "💀 ") + t.nome + " derrotado! Abates: " + personagem.abates + " (+" + ouro + " 🪙)", 2);
        verificarNivel();
        atualizarInterface();
    }

    // escolhe os "max" mais próximos que passam no teste (lista ordenada pequena) e aplica o dano
    function hordaAtingir(dano, alcance, max, filtro) {
        const hx = heroi.position.x, hz = heroi.position.z, r2 = alcance * alcance;
        const alvos = [];
        for (let i = 0; i < H.n; i++) {
            if (!H.vivo[i]) continue;
            const dx = H.x[i] - hx, dz = H.z[i] - hz, d2 = dx * dx + dz * dz;
            if (d2 > r2 || (filtro && !filtro(dx, dz, Math.sqrt(d2)))) continue;
            let pos = alvos.length;
            while (pos > 0 && alvos[pos - 1][1] > d2) pos--;
            if (pos < max) { alvos.splice(pos, 0, [i, d2]); if (alvos.length > max) alvos.pop(); }
        }
        alvos.forEach(([i]) => hordaDano(i, dano));
        return alvos.length;
    }
    function hordaGolpe(dano, alcance, fx, fz, max) {
        return hordaAtingir(dano, alcance, max, (dx, dz, d) => (dx * fx + dz * fz) / (d || 1) > -0.2);
    }
    function hordaArea(dano, raio, max) { return hordaAtingir(dano, raio, max, null); }

    // tira os inimigos de perto de um ponto (ao renascer)
    function hordaAfastar(x, z, raio) {
        for (let i = 0; i < H.n; i++) {
            if (!H.vivo[i]) continue;
            if (Math.hypot(H.x[i] - x, H.z[i] - z) < raio) {
                H.vivo[i] = 0;
                H.resp[i] = relogio.elapsedTime + 3;
                if (H.slot[i] >= 0) liberarSlot(slotsH[H.slot[i]]);
            }
        }
    }

    function desenharHordaMapa(c, P) {
        const hx = heroi.position.x, hz = heroi.position.z;
        for (let i = 0; i < H.n; i++) {
            if (!H.vivo[i]) continue;
            const dx = H.x[i] - hx, dz = H.z[i] - hz;
            if (dx * dx + dz * dz > 4900) continue;
            const q = P(H.x[i], H.z[i]);
            c.fillStyle = TIPOS_HORDA[H.tipo[i]].elite ? "#ff00ff" : "#ff2a2a";
            c.fillRect(q[0] - 1, q[1] - 1, 2, 2);
        }
    }

    function reposicionarHeroi() {
        if (cenarioPronto) posicionarHeroiInicio(); else heroi.position.set(0, 0, 20);
        hordaAfastar(heroi.position.x, heroi.position.z, 28);
    }

    // =================================================
    // MINIMAPA (gira junto com a câmera)
    // =================================================
    const mapaTam = ehToque ? 100 : 130;
    const mapaDiv = document.createElement("div");
    mapaDiv.style.cssText = "position:absolute;left:auto;bottom:auto;right:12px;top:" + (ehToque ? 58 : 62) + "px;width:" + mapaTam + "px;height:" + mapaTam + "px;" +
        "border-radius:50%;overflow:hidden;border:2px solid rgba(255,220,150,.8);background:#3f7a35;z-index:14;pointer-events:none";
    const mapaCv = document.createElement("canvas");
    mapaCv.width = mapaCv.height = mapaTam;
    mapaCv.style.cssText = "position:static;display:block;width:100%;height:100%";
    mapaDiv.appendChild(mapaCv);
    area.appendChild(mapaDiv);
    const mapaCtx = mapaCv.getContext("2d");

    function desenharMinimapa() {
        const c = mapaCtx, m = mapaTam / 2, esc = mapaTam / 120;
        const hx = heroi.position.x, hz = heroi.position.z;
        const ca = Math.cos(anguloCamera), sa = Math.sin(anguloCamera);
        const P = (wx, wz) => {
            const dx = wx - hx, dz = wz - hz;
            return [m + (-dx * ca + dz * sa) * esc, m - (dx * sa + dz * ca) * esc];
        };
        const poligono = (pts, cor) => {
            c.beginPath();
            pts.forEach(([x, z], i) => { const q = P(x, z); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
            c.closePath();
            c.fillStyle = cor;
            c.fill();
        };
        c.clearRect(0, 0, mapaTam, mapaTam);
        poligono([[-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000]], "#1d2a3a");                    // fora do mapa
        poligono([[-LIMITE_MAPA, -LIMITE_MAPA], [LIMITE_MAPA, -LIMITE_MAPA], [LIMITE_MAPA, LIMITE_MAPA], [-LIMITE_MAPA, LIMITE_MAPA]], corMapaChao); // chão
        if (mapaBg) {
            c.save();
            c.imageSmoothingEnabled = false;
            c.setTransform(-CS * ca * esc, -CS * sa * esc, CS * sa * esc, -CS * ca * esc,
                m + (-(mapa.gx0 - hx) * ca + (mapa.gz0 - hz) * sa) * esc,
                m - ((mapa.gx0 - hx) * sa + (mapa.gz0 - hz) * ca) * esc);
            c.drawImage(mapaBg, 0, 0);
            c.restore();
        }
        for (const it of itens) {
            const q = P(it.malha.position.x, it.malha.position.z);
            c.fillStyle = it.tipo === "vida" ? "#ff4d4d" : "#4d8dff";
            c.beginPath(); c.arc(q[0], q[1], 2.5, 0, 6.283); c.fill();
        }
        desenharHordaMapa(c, P);
        for (const e of inimigos) {
            const q = P(e.grupo.position.x, e.grupo.position.z);
            c.fillStyle = "#ff2a2a";
            c.fillRect(q[0] - 2, q[1] - 2, 4, 4);
        }
        c.save();
        c.translate(m, m);
        c.rotate(anguloCamera - heroi.rotation.y);
        c.fillStyle = "#fff";
        c.strokeStyle = "#000";
        c.beginPath();
        c.moveTo(0, -7); c.lineTo(-5, 5); c.lineTo(5, 5); c.closePath();
        c.fill(); c.stroke();
        c.restore();
    }

    // =================================================
    // APLICAR GRÁFICOS
    // =================================================
    function aplicarGraficos(nome) {
        const p = PRESETS[nome] || PRESETS.alto;
        nivelGraf = nome;
        Object.assign(GR, p);

        const mudouSombra = renderizador.shadowMap.enabled !== p.sombras;
        renderizador.shadowMap.enabled = p.sombras;
        luzSol.castShadow = p.sombras;
        luzSol.shadow.mapSize.set(p.sombraTam, p.sombraTam);
        if (luzSol.shadow.map) { luzSol.shadow.map.dispose(); luzSol.shadow.map = null; }
        if (mudouSombra) {
            cena.traverse(o => {
                if (!o.material) return;
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; });
            });
        }
        estiloCanvas.filter = (p.filtro && !ehToque) ? "contrast(1.08) saturate(1.15)" : "none";
        redimensionar();
        construirCenario();
        while (inimigos.length > p.maxInim) removerInimigo(inimigos.length - 1);
        if (cenarioPronto) reiniciarHorda();
        try { localStorage.setItem("rpg_graficos", nome); } catch (erro) { /* ignora */ }
        atualizarBotoesConfig();
    }

    // =================================================
    // SALVAR
    // =================================================
    function salvarPersonagem() {
        try { localStorage.setItem("rpg_personagem", JSON.stringify(personagem)); }
        catch (erro) { console.error("Erro ao salvar personagem:", erro); }
    }

    // =================================================
    // REDIMENSIONAR
    // =================================================
    function ajustarArea() {
        if (getComputedStyle(area).position === "static") area.style.position = "relative";
        const h = Math.max(320, window.innerHeight - area.getBoundingClientRect().top);
        area.style.height = h + "px";
        area.style.minHeight = h + "px";
        area.style.overflow = "hidden";
    }
    function redimensionar() {
        ajustarArea();
        const w = Math.max(1, area.clientWidth);
        const h = Math.max(1, area.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderizador.setSize(w, h, false);
        renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, GR.pixel));
    }
    window.addEventListener("resize", redimensionar);
    window.addEventListener("orientationchange", () => setTimeout(redimensionar, 250));
    setTimeout(redimensionar, 300);

    // =================================================
    // LOOP DO JOGO
    // =================================================
    const relogio = new THREE.Clock();

    const seguro = (f, ...a) => { try { f(...a); } catch (erro) { reportarErro(erro); } };
    function quadro() {
        const delta = Math.min(relogio.getDelta(), 0.05);
        const tempo = relogio.elapsedTime;

        seguro(lerControle, delta);
        if (mixer) mixer.update(delta);

        estado.recargaAtaque = Math.max(0, estado.recargaAtaque - delta);
        estado.recargaMagia = Math.max(0, estado.recargaMagia - delta);
        estado.recargaPocao = Math.max(0, estado.recargaPocao - delta);
        estado.invulneravel = Math.max(0, estado.invulneravel - delta);
        estado.livre = Math.max(0, (estado.livre || 0) - delta);

        if (msgTimer > 0) {
            msgTimer -= delta;
            if (msgTimer <= 0 && mensagemEl) mensagemEl.textContent = "Explore as terras de Eldoria!";
        }
        if (atacando) {
            tempoAcao -= delta;
            if (tempoAcao <= 0) finalizarAcao();
        }

        // vida volta devagar depois de alguns segundos sem apanhar
        estado.semDano = (estado.semDano || 0) + delta;
        if (estado.semDano > 5 && personagem.hp < personagem.hpMax) personagem.hp = Math.min(personagem.hpMax, personagem.hp + 2.5 * delta);

        // regeneração leve de mana
        if (personagem.mp < personagem.mpMax) {
            personagem.mp = Math.min(personagem.mpMax, personagem.mp + 1.5 * delta);
        }

        seguro(atualizarMovimento, delta);
        seguro(atualizarSpawns, delta);
        seguro(atualizarInimigos, delta, tempo);
        seguro(atualizarHorda, delta, tempo);
        seguro(atualizarItens, delta, tempo);
        seguro(atualizarEfeitos, delta);
        atualizarPocoes();
        estado.tMapa = (estado.tMapa || 0) - delta;
        if (estado.tMapa <= 0) {
            estado.tMapa = 0.1;
            desenharMinimapa();
            if (avisoSom.style.display !== "none" && (!Som.ativo || Som.ativo() || Som.mudo())) avisoSom.style.display = "none";
        }

        // a luz do sol acompanha o herói (sombras nítidas perto dele)
        luzSol.position.set(heroi.position.x + 35, 55, heroi.position.z + 25);
        luzSol.target.position.copy(heroi.position);

        // FPS
        fpsAcum += delta; fpsFrames++;
        if (fpsAcum >= 0.5) {
            if (mostrarFPS) fpsEl.textContent = Math.round(fpsFrames / fpsAcum) + " FPS";
            fpsAcum = 0; fpsFrames = 0;
        }

        estado.salvar += delta;
        if (estado.salvar > 3) {
            estado.salvar = 0;
            atualizarInterface();
            salvarPersonagem();
        }

        atualizarCamera();
        renderizador.render(cena, camera);
    }
    function animar() {
        requestAnimationFrame(animar);
        try { quadro(); }
        catch (erro) { reportarErro(erro); try { renderizador.render(cena, camera); } catch (e2) { /* ignora */ } }
    }

    // início
    heroi.position.set(0, 0, 60);
    heroi.rotation.y = Math.PI;
    anguloCamera = Math.PI;
    camera.position.set(0, 4, 67);
    aplicarGraficos(nivelGraf);
    msg("⚔️ J ataca · K magia · F poção · ❓ ajuda", 8);
    animar();
    console.log("REINOS EM GUERRA iniciado — herói:", personagem.nome, "| classe:", classeIdentificada);
}
