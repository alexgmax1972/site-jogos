"use strict";

// ============================================================
// REINOS EM GUERRA - MOTOR 3D (v2)
// Mundo infinito, biomas por personagem, inimigos, obstaculos,
// dano/cura, escudo magico, artefatos, controles mobile
// THREE.JS r128 + GLTFLoader
// ============================================================

// ---------- 1. MODELOS ----------
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
    cavaleirorunico: "modelos/cavaleiro/rune-knight.glb",
    monge: "modelos/monge/monge.glb",
    samurai: "modelos/samurai/samurai.glb"
};

// ---------- 2. CENARIOS (BIOMAS) ----------
const CENARIOS_PERSONAGENS = {
    guerreiro:       { nome: "Castelo de Eldoria",     arquivo: "modelos/cenarios/castelo-eldoria.glb",     cor: 0x7895a5, terreno: 0x527d3e, floresta: true },
    mago:            { nome: "Torre Arcana",           arquivo: "modelos/cenarios/torre-arcana.glb",        cor: 0x24204f, terreno: 0x30275d },
    arqueiro:        { nome: "Floresta dos Arqueiros", arquivo: "modelos/cenarios/floresta-arqueiro.glb",   cor: 0x527d63, terreno: 0x315b35, floresta: true },
    paladino:        { nome: "Santuário Sagrado",      arquivo: "modelos/cenarios/santuario-paladino.glb",  cor: 0xc9b98a, terreno: 0x9b895c },
    assassino:       { nome: "Ruínas Sombrias",        arquivo: "modelos/cenarios/ruinas-sombrias.glb",     cor: 0x1a2a38, terreno: 0x2b3a46, cemiterio: true },
    druida:          { nome: "Bosque Sagrado",         arquivo: "modelos/cenarios/bosque-sagrado.glb",      cor: 0x456f4c, terreno: 0x35613a, floresta: true },
    necromante:      { nome: "Necrópole",              arquivo: "modelos/cenarios/necropole.glb",           cor: 0x153440, terreno: 0x304550, cemiterio: true },
    barbaro:         { nome: "Terra de Guerra",        arquivo: "modelos/cenarios/terra-guerra.glb",        cor: 0x876b4e, terreno: 0x705238 },
    invocador:       { nome: "Círculo Arcano",         arquivo: "modelos/cenarios/circulo-arcano.glb",      cor: 0x322653, terreno: 0x42305e },
    monge:           { nome: "Templo do Monge",        arquivo: "modelos/cenarios/templo-monge.glb",        cor: 0xb69a73, terreno: 0x8c7655 },
    cavaleirorunico: { nome: "Fortaleza das Runas",    arquivo: "modelos/cenarios/fortaleza-runas.glb",     cor: 0x465a75, terreno: 0x47505d },
    samurai:         { nome: "Fortaleza Samurai",      arquivo: "modelos/cenarios/fortaleza-samurai.glb",   cor: 0x9d665b, terreno: 0x725347 }
};

// ---------- AJUSTES DO JOGO (mexa aqui) ----------
const CFG = {
    tamanhoChunk: 120,       // lado de cada bloco do mundo aberto
    chunksPorBioma: 4,       // quantos trechos antes de trocar de cenario
    tamanhoCenarioGLB: 62,   // largura (em unidades) dos cenarios GLB
    velAndar: 4,
    velCorrer: 8,
    pulos: 2,                // pulo duplo
    custoMagia: 20,
    custoEscudo: 20,
    custoCura: 25,
    escalaProps: 1.4,       // escala dos props GLB (o heroi tem 2.5 de altura)
    propsPorTrecho: 70,
    raioChunks: 1,          // blocos carregados ao redor do heroi (1 = 3x3)
    maxInimigos: 30,
    raioSpawn: 95,
    raioDespawn: 150
};

// ---------- 3. NOMES / ALIASES ----------
function normalizarNome(nome) {
    return String(nome || "").trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

const ALIASES_CLASSES = {
    guerreiro: "guerreiro", warrior: "guerreiro",
    mago: "mago", mage: "mago", wizard: "mago",
    arqueiro: "arqueiro", archer: "arqueiro",
    paladino: "paladino", paladin: "paladino",
    assassino: "assassino", assassin: "assassino",
    druida: "druida", druid: "druida",
    necromante: "necromante", necromancer: "necromante",
    barbaro: "barbaro", barbarian: "barbaro",
    invocador: "invocador", summoner: "invocador",
    monge: "monge", monk: "monge",
    samurai: "samurai",
    cavaleiro: "cavaleirorunico", cavaleirorunico: "cavaleirorunico",
    cavaleirodasrunas: "cavaleirorunico", runeknight: "cavaleirorunico",
    runicknight: "cavaleirorunico"
};

function identificarClasse(dados) {
    const candidatos = [];
    if (typeof dados === "string") candidatos.push(dados);
    if (dados && typeof dados === "object") {
        candidatos.push(dados.classeId, dados.classe, dados.modelo,
            dados.tipo, dados.class, dados.nome);
    }
    for (const candidato of candidatos) {
        if (!candidato) continue;
        const nome = normalizarNome(candidato);
        if (MODELOS_PERSONAGENS[nome]) return nome;
        if (ALIASES_CLASSES[nome]) return ALIASES_CLASSES[nome];
        for (const chave of Object.keys(MODELOS_PERSONAGENS)) {
            if (nome.includes(chave)) return chave;
        }
    }
    return null;
}

// ---------- 4. LER PERSONAGEM ----------
const areaJogo = document.getElementById("rpg");
const carregando = document.getElementById("carregando");
let personagemSalvo = null;

try {
    personagemSalvo = JSON.parse(localStorage.getItem("rpg_personagem") || "null");
} catch (erro) {
    console.error("Erro ao ler personagem:", erro);
}

function mostrarCarregamento(mensagem) {
    if (carregando) {
        carregando.style.display = "block";
        carregando.textContent = mensagem;
    }
    console.log(mensagem);
}

if (!personagemSalvo || typeof personagemSalvo !== "object") {
    mostrarCarregamento("Nenhum personagem encontrado. Volte e escolha um herói.");
} else if (typeof THREE === "undefined") {
    mostrarCarregamento("Three.js não foi carregado.");
} else if (typeof THREE.GLTFLoader !== "function") {
    mostrarCarregamento("GLTFLoader não foi carregado.");
} else if (!areaJogo) {
    mostrarCarregamento("Área do jogo não encontrada.");
} else {
    iniciarRPG3D(personagemSalvo);
}

// ============================================================
// 5. MOTOR
// ============================================================

function iniciarRPG3D(personagem) {

    // ---------- 5.1 DADOS ----------
    const num = (v, padrao) => Number.isFinite(Number(v)) ? Number(v) : padrao;

    personagem.nome = personagem.nome || "Aventureiro";
    personagem.classe = personagem.classe || "Aventureiro";
    personagem.nivel = Math.max(1, num(personagem.nivel, 1));
    personagem.hpMax = Math.max(1, num(personagem.hpMax ?? personagem.vidaMaxima ?? personagem.hp ?? personagem.vida, 100));
    personagem.mpMax = Math.max(0, num(personagem.mpMax ?? personagem.manaMaxima ?? personagem.mp ?? personagem.mana, 50));
    personagem.hp = THREE.MathUtils.clamp(num(personagem.hp ?? personagem.vida, personagem.hpMax), 0, personagem.hpMax);
    personagem.mp = THREE.MathUtils.clamp(num(personagem.mp ?? personagem.mana, personagem.mpMax), 0, personagem.mpMax);
    if (personagem.hp <= 0) personagem.hp = personagem.hpMax;
    personagem.xp = Math.max(0, num(personagem.xp ?? personagem.experiencia, 0));
    personagem.xpProximoNivel = Math.max(1, num(personagem.xpProximoNivel, 100));
    personagem.ouro = Math.max(0, num(personagem.ouro, 100));
    personagem.recorde = Math.max(0, num(personagem.recorde, 0));
    personagem.inventario = Array.isArray(personagem.inventario) ? personagem.inventario : [];

    const classeId = identificarClasse(personagem);
    if (!classeId) {
        mostrarCarregamento("Classe não reconhecida. Volte à seleção de personagens.");
        return;
    }
    personagem.classeId = classeId;

    const caminhoModelo = MODELOS_PERSONAGENS[classeId];
    const dadosCenario = CENARIOS_PERSONAGENS[classeId];

    // Mapa proprio de cada personagem: comeca no cenario dele e
    // depois passa pelos outros cenarios, em ordem circular.
    const chaves = Object.keys(CENARIOS_PERSONAGENS);
    const inicio = chaves.indexOf(classeId);
    const ordemBiomas = chaves.map((_, i) => chaves[(inicio + i) % chaves.length]);

    // ---------- 5.2 CENA / CAMERA / RENDER ----------
    const cena = new THREE.Scene();
    cena.background = new THREE.Color(dadosCenario.cor);
    cena.fog = new THREE.FogExp2(dadosCenario.cor, 0.012);

    const camera = new THREE.PerspectiveCamera(65, areaJogo.clientWidth / areaJogo.clientHeight, 0.1, 500);
    camera.position.set(0, 4, 8);

    let renderizador;
    try {
        renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch (erro) {
        console.error(erro);
        mostrarCarregamento("Seu navegador não conseguiu iniciar o WebGL.");
        return;
    }

    renderizador.setSize(areaJogo.clientWidth, areaJogo.clientHeight);
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderizador.shadowMap.enabled = true;
    renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding !== undefined) renderizador.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping !== undefined) renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 1.15;

    const estiloCanvas = renderizador.domElement.style;
    estiloCanvas.position = "absolute";
    estiloCanvas.inset = "0";
    estiloCanvas.width = "100%";
    estiloCanvas.height = "100%";
    estiloCanvas.display = "block";
    estiloCanvas.touchAction = "none";
    areaJogo.insertBefore(renderizador.domElement, areaJogo.firstChild);

    // acabamento cinematografico: contraste + vinheta nas bordas
    if (!("ontouchstart" in window)) estiloCanvas.filter = "contrast(1.1) saturate(1.18)";
    const vinheta = document.createElement("div");
    vinheta.style.cssText = "position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,5,15,0.62) 100%)";
    areaJogo.insertBefore(vinheta, renderizador.domElement.nextSibling);

    // ---------- 5.3 LUZES (seguem o heroi) ----------
    const luzAmbiente = new THREE.HemisphereLight(0xe5f1ff, 0x465238, 1.8);
    cena.add(luzAmbiente);

    const luzSol = new THREE.DirectionalLight(0xffe7c2, 3);
    luzSol.castShadow = true;
    luzSol.shadow.mapSize.set(2048, 2048);
    luzSol.shadow.camera.left = -60;
    luzSol.shadow.camera.right = 60;
    luzSol.shadow.camera.top = 60;
    luzSol.shadow.camera.bottom = -60;
    luzSol.shadow.camera.far = 200;
    luzSol.shadow.bias = -0.0002;
    cena.add(luzSol);
    cena.add(luzSol.target);

    const luzPreenchimento = new THREE.DirectionalLight(0x9bbcff, 0.7);
    luzPreenchimento.position.set(-25, 15, -20);
    cena.add(luzPreenchimento);

    // ---------- 5.4 UTILITARIOS ----------
    const loader = new THREE.GLTFLoader();
    const matCache = {};
    function mat(cor, extra) {
        const chave = cor + JSON.stringify(extra || {});
        if (!matCache[chave]) {
            matCache[chave] = new THREE.MeshStandardMaterial(Object.assign({ color: cor, roughness: 1 }, extra || {}));
        }
        return matCache[chave];
    }

    const geo = {
        tronco: new THREE.CylinderGeometry(0.25, 0.4, 3, 8),
        folhas: new THREE.ConeGeometry(2.2, 5, 8),
        rocha: new THREE.DodecahedronGeometry(1.2, 0),
        cristal: new THREE.OctahedronGeometry(1.4, 0),
        caixa: new THREE.BoxGeometry(1.8, 1.8, 1.8),
        poção: new THREE.SphereGeometry(0.4, 12, 12),
        artefato: new THREE.OctahedronGeometry(0.6, 0),
        anel: new THREE.RingGeometry(0.9, 1, 40),
        corpoInimigo: new THREE.CylinderGeometry(0.5, 0.7, 1.4, 10),
        cabeca: new THREE.SphereGeometry(0.45, 12, 12),
        olho: new THREE.SphereGeometry(0.09, 6, 6),
        barra: new THREE.PlaneGeometry(1.2, 0.12)
    };

    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    const mensagemEl = document.getElementById("mensagemJogo");
    let msgTimer = 0;
    function msg(texto, tempo = 3) {
        if (mensagemEl) mensagemEl.textContent = texto;
        msgTimer = tempo;
    }

    // ---------- 5.5 BIOMAS E CHUNKS (MUNDO INFINITO) ----------
    const L = CFG.tamanhoChunk;

    const RC = 3; // lado de cada regiao, em blocos
    function hash2(a, b) {
        let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0);
    }
    function regiaoDoChunk(cx, cz) { return [Math.floor((cx + 1) / RC), Math.floor((cz + 1) / RC)]; }
    function indiceBiomaReg(rx, rz) {
        if (rx === 0 && rz === 0) return 0;
        return 1 + hash2(rx, rz) % (ordemBiomas.length - 1);
    }
    function biomaDoChunk(cx, cz) {
        const r = regiaoDoChunk(cx, cz);
        return CENARIOS_PERSONAGENS[ordemBiomas[indiceBiomaReg(r[0], r[1])]];
    }
    function centroRegiao(rx, rz) { return { x: (RC * rx + 0.5) * L, z: (RC * rz + 0.5) * L }; }
    function biomaNoPonto(x, z) { return biomaDoChunk(Math.floor(x / L), Math.floor(z / L)); }

    // cache de cenarios GLB (carrega 1x, clona nos trechos)
    const cacheGLB = {};
    function obterCenario(arquivo, aoPronto) {
        let e = cacheGLB[arquivo];
        if (!e) {
            e = cacheGLB[arquivo] = { estado: "carregando", modelo: null, fila: [] };
            loader.load(arquivo, gltf => {
                try {
                    const cenaGLB = gltf.scene;
                    cenaGLB.updateMatrixWorld(true);
                    let caixa = new THREE.Box3().setFromObject(cenaGLB);
                    const tam = new THREE.Vector3();
                    caixa.getSize(tam);
                    const horizontal = Math.max(tam.x, tam.z) || 1;
                    const esc = Math.min(CFG.tamanhoCenarioGLB / horizontal, 60 / (tam.y || 1));
                    cenaGLB.scale.setScalar(esc);
                    cenaGLB.updateMatrixWorld(true);
                    caixa = new THREE.Box3().setFromObject(cenaGLB);
                    const centro = new THREE.Vector3();
                    caixa.getCenter(centro);
                    cenaGLB.position.x -= centro.x;
                    cenaGLB.position.z -= centro.z;
                    cenaGLB.position.y -= caixa.min.y;
                    const biomaArq = Object.values(CENARIOS_PERSONAGENS).find(b => b.arquivo === arquivo) || dadosCenario;
                    cenaGLB.traverse(o => {
                        if (o.isMesh) {
                            o.castShadow = true;
                            o.receiveShadow = true;
                            o.material = Array.isArray(o.material)
                                ? o.material.map(mm => matCenario(mm, biomaArq))
                                : matCenario(o.material, biomaArq);
                        }
                    });
                    const base = new THREE.Group();
                    base.add(cenaGLB);
                    e.modelo = base;
                    e.estado = "pronto";
                    e.fila.forEach(f => f(base.clone(true)));
                } catch (erro) {
                    console.error("Erro ao preparar cenário:", arquivo, erro);
                    e.estado = "erro";
                }
                e.fila = [];
            }, undefined, erro => {
                console.warn("Cenário GLB não encontrado:", arquivo, erro);
                e.estado = "erro";
                e.fila = [];
            });
        }
        if (e.estado === "pronto") aoPronto(e.modelo.clone(true));
        else if (e.estado === "carregando") e.fila.push(aoPronto);
    }

    // ---------- TERRENO, TEXTURAS E CEU (visual mais realista) ----------
    const suave = (a, b, x) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };

    // mundo aberto: colinas, montanhas raras, lagos e plataformas planas sob cada marco
    const NIVEL_AGUA = -0.9;
    function alturaBase(x, z) {
        const plano = suave(25, 95, Math.hypot(x, z));
        const colinas = Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.013 + 0.4) * 5.5
            + Math.sin(z * 0.027 + x * 0.019) * 2.8
            + Math.sin(x * 0.061) * Math.sin(z * 0.053) * 1.3
            + Math.sin(x * 0.15 + z * 0.12) * 0.35;
        const mm = Math.max(0, Math.sin(x * 0.0045 + 2.1) * Math.sin(z * 0.0051 + 0.7));
        const montanha = mm * mm * 42;
        const lago = suave(0.72, 0.93, Math.sin(x * 0.0072 + 0.9) * Math.sin(z * 0.0081 + 2.3)) * 9;
        return (colinas + 3 + montanha - lago) * plano;
    }
    function alturaTerreno(x, z) {
        const h = alturaBase(x, z);
        const rx = Math.round((x / L - 0.5) / RC), rz = Math.round((z / L - 0.5) / RC);
        const cx = (RC * rx + 0.5) * L, cz = (RC * rz + 0.5) * L;
        const w = 1 - suave(30, 72, Math.hypot(x - cx, z - cz));
        if (w <= 0) return h;
        const hc = Math.max(alturaBase(cx, cz), NIVEL_AGUA + 1.2);
        return h + (hc - h) * w;
    }

    function criarTextura(claro, pontos) {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        g.fillStyle = claro;
        g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < pontos; k++) {
            const x = Math.random() * 256, y = Math.random() * 256;
            const r = 1 + Math.random() * 5;
            const tom = Math.floor(150 + Math.random() * 105);
            g.fillStyle = `rgba(${tom},${tom},${tom},0.55)`;
            for (const dx of [-256, 0, 256]) {
                for (const dy of [-256, 0, 256]) {
                    g.beginPath();
                    g.arc(x + dx, y + dy, r, 0, 6.283);
                    g.fill();
                }
            }
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(40, 15);
        if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = renderizador.capabilities.getMaxAnisotropy();
        return tex;
    }

    const matTerreno = new THREE.MeshStandardMaterial({
        map: criarTextura("#e6e6e6", 2200), vertexColors: true, roughness: 1, metalness: 0
    });

    geo.pilar = new THREE.CylinderGeometry(0.6, 0.75, 4, 8);
    geo.copa1 = new THREE.ConeGeometry(2.6, 3.4, 9);
    geo.copa2 = new THREE.ConeGeometry(2.0, 3.0, 9);
    geo.copa3 = new THREE.ConeGeometry(1.3, 2.6, 9);
    geo.grama = new THREE.ConeGeometry(0.07, 1.5, 3, 3);
    geo.grama.translate(0, 0.75, 0);
    {
        const pg = geo.grama.attributes.position;
        const cg = new Float32Array(pg.count * 3);
        for (let v = 0; v < pg.count; v++) {
            const g = 0.4 + 0.8 * (pg.getY(v) / 1.5);
            cg[v * 3] = cg[v * 3 + 1] = cg[v * 3 + 2] = g;
        }
        geo.grama.setAttribute("color", new THREE.BufferAttribute(cg, 3));
    }
    geo.fantasmaCorpo = new THREE.CylinderGeometry(0.42, 0.1, 1.8, 10);
    geo.fantasmaBraco = new THREE.CylinderGeometry(0.07, 0.04, 1.2, 6);
    geo.fantasmaBraco.translate(0, 0.6, 0);
    geo.lapideBase = new THREE.BoxGeometry(1.3, 1.8, 0.35);
    geo.lapideTopo = new THREE.CylinderGeometry(0.65, 0.65, 0.35, 14);
    geo.lapideTopo.rotateX(Math.PI / 2);
    geo.troncoMorto = new THREE.CylinderGeometry(0.3, 0.75, 7, 7);
    geo.galho = new THREE.CylinderGeometry(0.08, 0.2, 3.2, 5);
    geo.galho.translate(0, 1.6, 0);
    const matLapide = mat(0x6f8896);
    const matMorto = mat(0x262a33);
    geo.chifre = new THREE.ConeGeometry(0.12, 0.5, 6);
    geo.marcador = new THREE.RingGeometry(1.0, 1.25, 24);
    const matMarcador = new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    const matOlho = new THREE.MeshBasicMaterial({ color: 0x02060c });

    // ceu em degradê + sol/lua
    const ceuBase0 = new THREE.Color(dadosCenario.cor).lerp(new THREE.Color(0xffffff), 0.18);
    const ceuTopo0 = new THREE.Color(dadosCenario.cor).multiplyScalar(0.55).lerp(new THREE.Color(0x1e3c78), 0.35);
    const ceuMat = new THREE.ShaderMaterial({
        uniforms: { topo: { value: ceuTopo0 }, base: { value: ceuBase0 } },
        vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 topo; uniform vec3 base; varying float h; void main(){ float t = smoothstep(-0.05, 0.65, h); gl_FragColor = vec4(mix(base, topo, t), 1.0); }",
        side: THREE.BackSide, depthWrite: false, fog: false
    });
    const ceu = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), ceuMat);
    ceu.frustumCulled = false;
    ceu.renderOrder = -2;
    const sol = new THREE.Mesh(new THREE.SphereGeometry(16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
    sol.position.set(0.5, 0.3, -0.8).normalize().multiplyScalar(360);
    sol.frustumCulled = false;
    sol.renderOrder = -1;
    ceu.add(sol);
    cena.add(ceu);

    const clima = { noite: 0.25 };
    const uTempo = { value: 0 };
    const cacheGrama = {};
    function matGrama(bioma) {
        const cor = new THREE.Color(bioma.terreno).multiplyScalar(1.5).getHex();
        if (!cacheGrama[cor]) {
            const m = new THREE.MeshStandardMaterial({ color: cor, roughness: 1, vertexColors: true, side: THREE.DoubleSide });
            m.onBeforeCompile = sh => {
                sh.uniforms.tempo = uTempo;
                sh.vertexShader = "uniform float tempo;\n" + sh.vertexShader.replace("#include <begin_vertex>",
                    "vec3 transformed = vec3(position); float vento = sin(tempo * 1.6 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27) * position.y * 0.16; transformed.x += vento; transformed.z += vento * 0.6;");
            };
            cacheGrama[cor] = m;
        }
        return cacheGrama[cor];
    }

    // textura de brilho (halos e vaga-lumes)
    const texBrilho = (function () {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d");
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "rgba(255,255,255,1)");
        gr.addColorStop(0.35, "rgba(255,255,255,0.35)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
    })();

    // vaga-lumes / almas flutuantes
    const NP = 140;
    const posP = new Float32Array(NP * 3);
    const faseP = new Float32Array(NP);
    for (let k = 0; k < NP; k++) {
        const x = (Math.random() - 0.5) * 60, z = -Math.random() * 50;
        posP[k * 3] = x;
        posP[k * 3 + 1] = alturaTerreno(x, z) + 0.8 + Math.random() * 3.5;
        posP[k * 3 + 2] = z;
        faseP[k] = Math.random() * 6.28;
    }
    const geoP = new THREE.BufferGeometry();
    geoP.setAttribute("position", new THREE.BufferAttribute(posP, 3));
    const matP = new THREE.PointsMaterial({
        size: 0.7, map: texBrilho, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: 0x80d4ff, opacity: 0.9
    });
    const particulas = new THREE.Points(geoP, matP);
    particulas.frustumCulled = false;
    cena.add(particulas);

    function atualizarParticulas(delta, tempo) {
        const hx = heroi.position.x, hz = heroi.position.z;
        for (let k = 0; k < NP; k++) {
            let x = posP[k * 3], y = posP[k * 3 + 1], z = posP[k * 3 + 2];
            x += Math.sin(tempo * 0.5 + faseP[k]) * 0.5 * delta;
            z += Math.cos(tempo * 0.4 + faseP[k]) * 0.5 * delta;
            y += Math.sin(tempo * 1.2 + faseP[k]) * 0.4 * delta;
            if (Math.abs(x - hx) > 32 || Math.abs(z - hz) > 32 || y > 8) {
                x = hx + (Math.random() - 0.5) * 60;
                z = hz + (Math.random() - 0.5) * 60 - 10;
                y = alturaTerreno(x, z) + 0.8 + Math.random() * 3.5;
            }
            posP[k * 3] = x; posP[k * 3 + 1] = y; posP[k * 3 + 2] = z;
        }
        geoP.attributes.position.needsUpdate = true;
    }

    const ceuBaseAlvo = new THREE.Color(), ceuTopoAlvo = new THREE.Color();
    function atualizarCeu(bioma, delta) {
        const k = Math.min(1, delta * 1.5);
        ceuBaseAlvo.set(bioma.cor).lerp(new THREE.Color(0xffffff), 0.18);
        ceuTopoAlvo.set(bioma.cor).multiplyScalar(0.55).lerp(new THREE.Color(0x1e3c78), 0.35);
        ceuMat.uniforms.base.value.lerp(ceuBaseAlvo, k);
        ceuMat.uniforms.topo.value.lerp(ceuTopoAlvo, k);
        cena.background.copy(ceuMat.uniforms.base.value);
        cena.fog.color.copy(ceuMat.uniforms.base.value);

        const c = new THREE.Color(bioma.cor);
        const lum = c.r * 0.3 + c.g * 0.6 + c.b * 0.1;
        sol.material.color.set(lum < 0.3 ? 0xcfd8ff : 0xfff2c0);

        // clima: quanto mais escuro o bioma, mais nevoa, luz fria e brilho magico
        clima.noite += (Math.max(0.2, 1 - suave(0.18, 0.5, lum)) - clima.noite) * k;
        const n = clima.noite;
        const mix = (a, b) => new THREE.Color(a).lerp(new THREE.Color(b), n);
        cena.fog.density += (0.0105 + 0.010 * n - cena.fog.density) * k;
        luzAmbiente.color.copy(mix(0xe5f1ff, 0x6f9fd0));
        luzAmbiente.groundColor.copy(mix(0x465238, 0x1b2a3a));
        luzAmbiente.intensity = (1.8 - 0.7 * n) * 0.85;
        luzSol.color.copy(mix(0xffe7c2, 0x8fb0ff));
        luzSol.intensity = 3 - 1.4 * n;
        luzPreenchimento.color.copy(mix(0x9bbcff, 0xa070ff));
        luzPreenchimento.intensity = 0.7 + 0.8 * n;
        luzHeroi.color.copy(mix(0xffe0b0, 0xa07cff));
        luzHeroi.intensity = 0.3 + 1.1 * n;
        matP.color.copy(mix(0xffe9a0, 0x80d4ff));
        renderizador.toneMappingExposure = 1.15 - 0.1 * n;
    }

    // ---------- REALISMO: detalhe procedural, musgo e luz de ambiente ----------
    const texDet = (function () {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const g = c.getContext("2d");
        g.fillStyle = "#808080";
        g.fillRect(0, 0, 256, 256);
        for (let k = 0; k < 1100; k++) {
            const x = Math.random() * 256, y = Math.random() * 256;
            const r = 2 + Math.pow(Math.random(), 2) * 40;
            const tom = Math.floor(50 + Math.random() * 160);
            g.fillStyle = `rgba(${tom},${tom},${tom},0.22)`;
            for (const dx of [-256, 0, 256]) {
                for (const dy of [-256, 0, 256]) {
                    g.beginPath();
                    g.arc(x + dx, y + dy, r, 0, 6.283);
                    g.fill();
                }
            }
        }
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = renderizador.capabilities.getMaxAnisotropy();
        return t;
    })();
    matTerreno.envMapIntensity = 0.5;

    // material de cenario: textura triplanar (sem UV), musgo nas faces de cima, rugosidade variavel
    const cacheMatCen = new Map();
    function matCenario(orig, bioma) {
        if (!orig || !orig.isMeshStandardMaterial) return orig;
        const chave = orig.uuid + "|" + bioma.nome;
        if (cacheMatCen.has(chave)) return cacheMatCen.get(chave);
        let m = orig;
        if (!orig.transparent && orig.emissive.getHex() === 0) {
            m = orig.clone();
            const uMusgo = { value: bioma.floresta ? 0.9 : (bioma.cemiterio ? 0.5 : 0.25) };
            const uCor = { value: new THREE.Color(bioma.cemiterio ? 0x2f4a3a : 0x4a6a34) };
            const uDet = { value: texDet };
            m.onBeforeCompile = sh => {
                sh.uniforms.detalhe = uDet;
                sh.uniforms.musgo = uMusgo;
                sh.uniforms.musgoCor = uCor;
                sh.vertexShader = sh.vertexShader
                    .replace("#include <common>", "#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;")
                    .replace("#include <begin_vertex>",
                        "#include <begin_vertex>\n" +
                        "vec4 wpos = vec4(transformed, 1.0);\n" +
                        "vec3 wnor = objectNormal;\n" +
                        "#ifdef USE_INSTANCING\nwpos = instanceMatrix * wpos;\nwnor = mat3(instanceMatrix) * wnor;\n#endif\n" +
                        "vWP = (modelMatrix * wpos).xyz;\nvWN = normalize(mat3(modelMatrix) * wnor);");
                sh.fragmentShader = sh.fragmentShader
                    .replace("#include <common>",
                        "#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\nuniform sampler2D detalhe;\nuniform float musgo;\nuniform vec3 musgoCor;\n" +
                        "float triDet(vec3 p, vec3 n, float s){ vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z + 1e-5); " +
                        "return texture2D(detalhe, p.zy * s).r * b.x + texture2D(detalhe, p.xz * s).r * b.y + texture2D(detalhe, p.xy * s).r * b.z; }")
                    .replace("#include <color_fragment>",
                        "#include <color_fragment>\n" +
                        "vec3 wn = normalize(vWN);\n" +
                        "float d1 = triDet(vWP, wn, 0.22);\nfloat d2 = triDet(vWP, wn, 0.9);\nfloat det = mix(d1, d2, 0.5);\n" +
                        "diffuseColor.rgb *= 0.62 + 0.76 * det;\n" +
                        "float topo = smoothstep(0.45, 0.85, wn.y);\n" +
                        "float mk = smoothstep(0.35, 0.65, d1 + (d2 - 0.5) * 0.4) * topo * musgo;\n" +
                        "diffuseColor.rgb = mix(diffuseColor.rgb, musgoCor * (0.6 + 0.6 * d2), clamp(mk, 0.0, 1.0));")
                    .replace("#include <roughnessmap_fragment>",
                        "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.8 + 0.4 * det), 0.3, 1.0);");
            };
        }
        m.envMapIntensity = 0.9;
        cacheMatCen.set(chave, m);
        return m;
    }

    // luz de ambiente (IBL) gerada a partir das cores do ceu de cada bioma
    let pmrem = null, envRT = null;
    const envScene = new THREE.Scene();
    const envMat = new THREE.ShaderMaterial({
        uniforms: { topo: { value: new THREE.Color() }, base: { value: new THREE.Color() } },
        vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "uniform vec3 topo; uniform vec3 base; varying float h; void main(){ " +
            "vec3 c = mix(base * 0.18, mix(base, topo, smoothstep(0.0, 0.7, h)), smoothstep(-0.35, 0.05, h)); gl_FragColor = vec4(c * 1.6, 1.0); }",
        side: THREE.BackSide, depthWrite: false
    });
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), envMat));
    function atualizarAmbiente(bioma) {
        try {
            if (!pmrem) pmrem = new THREE.PMREMGenerator(renderizador);
            envMat.uniforms.base.value.set(bioma.cor).lerp(new THREE.Color(0xffffff), 0.18);
            envMat.uniforms.topo.value.set(bioma.cor).multiplyScalar(0.55).lerp(new THREE.Color(0x1e3c78), 0.35);
            const rt = pmrem.fromScene(envScene, 0.04);
            if (envRT) envRT.dispose();
            envRT = rt;
            cena.environment = rt.texture;
        } catch (erro) {
            console.warn("Luz de ambiente indisponível:", erro);
        }
    }

    // ---------- PROPS GLB (instanciados por trecho) ----------
    // [nome, peso, perto-do-caminho(1)]
    const PROPS_BIOMA = {
        guerreiro: [["arvore_carvalho_a", 3, 0], ["arvore_carvalho_b", 3, 0], ["pinheiro_a", 1, 0], ["arbusto", 3, 0], ["rocha_a", 1.5, 0], ["rocha_musgo", 1, 0], ["cerca_madeira", 2, 1], ["casa_a", 1, 0], ["casa_b", 0.6, 0], ["barril", 1, 1], ["caixote", 1, 1], ["estandarte", 1.2, 1], ["poste_lanterna", 1.5, 1], ["feno", 1, 0], ["carroca", 0.6, 0], ["toco", 1, 0]],
        mago: [["cristal_a", 3, 0], ["cristal_b", 3, 0], ["pedra_runica", 2, 0], ["rocha_c", 2, 0], ["arvore_morta", 2, 0], ["pilar_ruina", 1.5, 0], ["cogumelo_gigante", 1, 0], ["poste_lanterna", 1, 1]],
        arqueiro: [["arvore_carvalho_a", 4, 0], ["arvore_carvalho_b", 3, 0], ["pinheiro_a", 3, 0], ["pinheiro_b", 2, 0], ["arbusto", 3, 0], ["tronco_caido", 1.5, 0], ["toco", 1.5, 0], ["rocha_musgo", 1.5, 0], ["tenda", 1, 0], ["fogueira", 1, 1], ["estandarte", 1, 1]],
        paladino: [["coluna_santuario", 3, 0], ["estatua_anjo", 1, 0], ["arvore_carvalho_a", 1.5, 0], ["arbusto", 2, 0], ["rocha_b", 1, 0], ["estandarte", 2, 1], ["poste_lanterna", 2, 1], ["lanterna_pedra", 1, 1]],
        assassino: [["arvore_morta", 3, 0], ["pilar_ruina", 2, 0], ["muro_ruina", 2, 0], ["arco_ruina", 0.8, 0], ["escombros", 2, 0], ["lapide_b", 1, 0], ["tocha_brazeiro", 2, 1], ["cerca_ferro", 1, 1]],
        druida: [["arvore_carvalho_a", 3, 0], ["arvore_carvalho_b", 3, 0], ["cogumelo_gigante", 2, 0], ["arbusto", 3, 0], ["rocha_musgo", 2, 0], ["tronco_caido", 1.5, 0], ["toco", 1, 0], ["pedra_runica", 1, 0]],
        necromante: [["lapide_a", 4, 0], ["lapide_b", 3, 0], ["lapide_c", 2, 0], ["cruz_celta", 2, 0], ["tumulo", 2, 0], ["mausoleu", 0.7, 0], ["estatua_anjo", 1, 0], ["arvore_morta", 3, 0], ["cerca_ferro", 1.5, 1], ["tocha_brazeiro", 1.5, 1]],
        barbaro: [["rocha_a", 2, 0], ["rocha_b", 2, 0], ["rocha_c", 2, 0], ["pinheiro_a", 2, 0], ["pinheiro_b", 1.5, 0], ["tenda", 1.2, 0], ["fogueira", 1, 1], ["estandarte", 1.5, 1], ["caixote", 1, 1], ["barril", 1, 1], ["tronco_caido", 1, 0], ["arvore_morta", 1, 0]],
        invocador: [["cristal_a", 2, 0], ["cristal_b", 2, 0], ["pedra_runica", 3, 0], ["pilar_ruina", 2, 0], ["arco_ruina", 0.8, 0], ["rocha_c", 1.5, 0], ["arvore_morta", 1, 0], ["tocha_brazeiro", 1, 1]],
        monge: [["torii", 0.8, 0], ["lanterna_pedra", 3, 1], ["pinheiro_a", 2, 0], ["pinheiro_b", 1.5, 0], ["arbusto", 2, 0], ["rocha_musgo", 2, 0], ["casa_b", 0.6, 0], ["estandarte", 1, 1], ["cerca_madeira", 1.5, 1], ["poco", 0.5, 0]],
        cavaleirorunico: [["pedra_runica", 2, 0], ["pilar_ruina", 2, 0], ["muro_ruina", 2, 0], ["rocha_a", 2, 0], ["pinheiro_a", 2, 0], ["estandarte", 2, 1], ["poste_lanterna", 1, 1], ["tocha_brazeiro", 1.5, 1]],
        samurai: [["torii", 0.8, 0], ["lanterna_pedra", 2.5, 1], ["pinheiro_a", 2, 0], ["casa_b", 1.2, 0], ["cerca_madeira", 2, 1], ["estandarte", 2, 1], ["arbusto", 2, 0], ["poco", 0.6, 0], ["rocha_musgo", 1.5, 0]]
    };
    // raio de colisao (antes da escala)
    const RAIO_PROPS = {
        arvore_carvalho_a: 0.8, arvore_carvalho_b: 0.9, pinheiro_a: 0.5, pinheiro_b: 0.5, arvore_morta: 0.5,
        rocha_a: 1.5, rocha_b: 1.8, rocha_c: 0.9, rocha_musgo: 1.5, mausoleu: 2.4, casa_a: 3.0, casa_b: 3.5,
        pilar_ruina: 0.6, carroca: 1.4, poco: 1.2, tenda: 1.6, cogumelo_gigante: 0.5, pedra_runica: 1.0,
        cristal_a: 0.8, cristal_b: 0.8, estatua_anjo: 0.8, cruz_celta: 0.5, feno: 1.3, barril: 0.5, caixote: 0.6,
        coluna_santuario: 0.7, lanterna_pedra: 0.4, fogueira: 0.7, tocha_brazeiro: 0.3, poste_lanterna: 0.2
    };

    const cacheProps = {};
    function obterProp(nome, ok, falha) {
        let e = cacheProps[nome];
        if (!e) {
            e = cacheProps[nome] = { estado: "carregando", partes: null, fila: [] };
            loader.load("modelos/props/" + nome + ".glb", gltf => {
                try {
                    gltf.scene.updateMatrixWorld(true);
                    const partes = [];
                    gltf.scene.traverse(o => {
                        if (o.isMesh) partes.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() });
                    });
                    e.partes = partes;
                    e.estado = "pronto";
                    e.fila.forEach(f => f.ok(partes));
                } catch (erro) {
                    console.error("Erro ao preparar prop:", nome, erro);
                    e.estado = "erro";
                    e.fila.forEach(f => f.falha());
                }
                e.fila = [];
            }, undefined, erro => {
                console.warn("Prop não encontrado:", nome, erro);
                e.estado = "erro";
                e.fila.forEach(f => f.falha());
                e.fila = [];
            });
        }
        if (e.estado === "pronto") ok(e.partes);
        else if (e.estado === "erro") falha();
        else e.fila.push({ ok, falha });
    }

    const PERTO = new Set(["casa_a", "casa_b", "torii", "arco_ruina", "poco", "carroca", "tenda", "fogueira", "feno", "barril", "caixote", "estandarte", "poste_lanterna", "tocha_brazeiro", "cerca_madeira", "cerca_ferro", "lanterna_pedra", "mausoleu", "estatua_anjo", "coluna_santuario"]);
    function chv(cx, cz) { return cx + "," + cz; }

    function colocarProps(chave, grupo, bioma, nome, lista, cxm, czm) {
        const pisoY = (x, z) => alturaTerreno(cxm + x, czm + z);
        const m4 = new THREE.Matrix4(), mf = new THREE.Matrix4(), q = new THREE.Quaternion();
        const pp = new THREE.Vector3(), ss = new THREE.Vector3(), eu = new THREE.Euler();
        obterProp(nome, partes => {
            if (!chunks.has(chave)) return;
            partes.forEach(parte => {
                const im = new THREE.InstancedMesh(parte.geometry, matCenario(parte.material, bioma), lista.length);
                lista.forEach((it, k) => {
                    pp.set(it.x, pisoY(it.x, it.z) - 0.05, it.z);
                    eu.set(0, it.rot, 0);
                    q.setFromEuler(eu);
                    ss.setScalar(it.esc);
                    m4.compose(pp, q, ss);
                    mf.multiplyMatrices(m4, parte.matrix);
                    im.setMatrixAt(k, mf);
                });
                im.instanceMatrix.needsUpdate = true;
                im.castShadow = true;
                im.receiveShadow = true;
                im.frustumCulled = false;
                grupo.add(im);
            });
        }, () => {
            if (!chunks.has(chave)) return;
            const im = new THREE.InstancedMesh(geo.rocha, mat(0x6f6f6c), lista.length);
            lista.forEach((it, k) => {
                pp.set(it.x, pisoY(it.x, it.z) + 0.8 * it.esc, it.z);
                eu.set(0, it.rot, 0);
                q.setFromEuler(eu);
                ss.setScalar(it.esc);
                m4.compose(pp, q, ss);
                im.setMatrixAt(k, m4);
            });
            im.instanceMatrix.needsUpdate = true;
            im.castShadow = true;
            im.frustumCulled = false;
            grupo.add(im);
        });
    }

    // ---------- AGUA (lagos) ----------
    const aguaMat = new THREE.ShaderMaterial({
        uniforms: {
            t: { value: 0 }, fogC: { value: new THREE.Color() }, fogD: { value: 0.01 },
            fundo: { value: new THREE.Color(0x0a2a3a) }, raso: { value: new THREE.Color(0x2a7a8a) }, ceuC: { value: new THREE.Color() }
        },
        vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader:
            "uniform float t; uniform vec3 fogC; uniform float fogD; uniform vec3 fundo; uniform vec3 raso; uniform vec3 ceuC; varying vec3 vW;\n" +
            "void main(){\n" +
            "  vec3 v = normalize(cameraPosition - vW);\n" +
            "  vec3 n = normalize(vec3(sin(vW.x*0.35+t*1.3)*0.12 + sin(vW.z*0.8+t*2.1)*0.06, 1.0, cos(vW.z*0.3+t*1.1)*0.12 + cos(vW.x*0.9+t*1.7)*0.06));\n" +
            "  float f = pow(1.0 - max(dot(v, n), 0.0), 3.0);\n" +
            "  vec3 c = mix(fundo, raso, 0.35 + 0.25*sin(vW.x*0.1+vW.z*0.13+t*0.5));\n" +
            "  c = mix(c, ceuC, f*0.85);\n" +
            "  float sp = pow(max(dot(reflect(-normalize(vec3(-0.5,0.6,-0.7)), n), v), 0.0), 60.0);\n" +
            "  c += vec3(1.0,0.95,0.8)*sp*0.8;\n" +
            "  float d = length(cameraPosition - vW);\n" +
            "  float fog = 1.0 - exp(-pow(fogD*d, 2.0));\n" +
            "  c = mix(c, fogC, clamp(fog, 0.0, 1.0));\n" +
            "  gl_FragColor = vec4(c, 0.84);\n" +
            "}",
        transparent: true, depthWrite: false
    });
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), aguaMat);
    agua.rotation.x = -Math.PI / 2;
    agua.frustumCulled = false;
    agua.renderOrder = 1;
    cena.add(agua);
    function atualizarAgua(tempo) {
        agua.position.set(heroi.position.x, NIVEL_AGUA, heroi.position.z);
        const u = aguaMat.uniforms;
        u.t.value = tempo;
        u.fogC.value.copy(cena.fog.color);
        u.fogD.value = cena.fog.density;
        u.ceuC.value.copy(ceuMat.uniforms.base.value).lerp(ceuMat.uniforms.topo.value, 0.35);
    }

    // ---------- NUVENS ----------
    const texNuvem = (function () {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 128;
        const g = c.getContext("2d");
        for (let k = 0; k < 26; k++) {
            const x = 40 + Math.random() * 176, y = 40 + Math.random() * 50, r = 22 + Math.random() * 34;
            const gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, "rgba(255,255,255,0.55)");
            gr.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = gr;
            g.fillRect(0, 0, 256, 128);
        }
        return new THREE.CanvasTexture(c);
    })();
    const matNuvem = new THREE.SpriteMaterial({ map: texNuvem, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
    const nuvens = [];
    for (let k = 0; k < 16; k++) {
        const sp = new THREE.Sprite(matNuvem);
        sp.scale.set(180 + Math.random() * 180, 70 + Math.random() * 50, 1);
        sp.position.set((Math.random() - 0.5) * 600, 140 + Math.random() * 70, (Math.random() - 0.5) * 600);
        sp.renderOrder = -1;
        cena.add(sp);
        nuvens.push(sp);
    }
    function atualizarNuvens(delta) {
        const hx = heroi.position.x, hz = heroi.position.z;
        for (const sp of nuvens) {
            sp.position.x += delta * 3;
            if (sp.position.x - hx > 300) sp.position.x -= 600;
            if (sp.position.x - hx < -300) sp.position.x += 600;
            if (sp.position.z - hz > 300) sp.position.z -= 600;
            if (sp.position.z - hz < -300) sp.position.z += 600;
        }
        matNuvem.color.copy(ceuMat.uniforms.base.value).lerp(new THREE.Color(0xffffff), 0.65);
    }

    const chunks = new Map();      // indice -> { grupo, obstaculos }
    const inimigos = [];
    const itens = [];
    const efeitos = [];

    const haloMats = {};
    function matHalo(cor) {
        if (!haloMats[cor]) {
            haloMats[cor] = new THREE.SpriteMaterial({
                map: texBrilho, color: cor, transparent: true, opacity: 0.55,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
        }
        return haloMats[cor];
    }

    function criarInimigoProc(x, z, i, rnd, bioma) {
        const grupo = new THREE.Group();
        const corpoPivo = new THREE.Group();
        const paleta = [[0xcfeaff, 0x4fb8ff], [0xe3d0ff, 0x9b6bff], [0xd0ffe8, 0x4fffa8]];
        const [corCorpo, corBrilho] = paleta[Math.floor(rnd() * paleta.length)];
        const material = new THREE.MeshStandardMaterial({
            color: corCorpo, emissive: corBrilho, emissiveIntensity: 0.9,
            transparent: true, opacity: 0.88, roughness: 0.4
        });

        const tronco = new THREE.Mesh(geo.fantasmaCorpo, material);
        tronco.position.y = 0.9;
        const cabeca = new THREE.Mesh(geo.cabeca, material);
        cabeca.scale.set(0.9, 1.1, 0.9);
        cabeca.position.y = 2.0;
        const olhoE = new THREE.Mesh(geo.olho, matOlho);
        const olhoD = new THREE.Mesh(geo.olho, matOlho);
        olhoE.position.set(-0.14, 2.05, 0.32);
        olhoD.position.set(0.14, 2.05, 0.32);
        olhoE.scale.setScalar(1.8);
        olhoD.scale.setScalar(1.8);
        const bracoE = new THREE.Mesh(geo.fantasmaBraco, material);
        const bracoD = new THREE.Mesh(geo.fantasmaBraco, material);
        bracoE.position.set(-0.38, 1.5, 0);
        bracoD.position.set(0.38, 1.5, 0);
        bracoE.rotation.z = 0.9;
        bracoD.rotation.z = -0.9;
        const halo = new THREE.Sprite(matHalo(corBrilho));
        halo.position.y = 1.4;
        halo.scale.setScalar(3.6);
        corpoPivo.add(tronco, cabeca, olhoE, olhoD, bracoE, bracoD, halo);
        corpoPivo.scale.setScalar(1.35);

        const marcador = new THREE.Mesh(geo.marcador, matMarcador);
        marcador.rotation.x = -Math.PI / 2;
        marcador.position.y = 0.12;
        marcador.scale.setScalar(1.4);

        const barra = new THREE.Mesh(geo.barra, new THREE.MeshBasicMaterial({ color: 0xe03030, depthTest: false }));
        barra.position.y = 3.7;
        barra.scale.setScalar(1.3);
        barra.renderOrder = 10;

        grupo.add(corpoPivo, marcador, barra);
        grupo.position.set(x, alturaTerreno(x, z), z);
        cena.add(grupo);

        const nvl = Math.floor(Math.hypot(x, z) / 160);
        const hpMax = 40 + nvl * 14;
        inimigos.push({
            grupo, corpoPivo, barra, material,
            hp: hpMax, hpMax, chunk: i,
            vel: 2 + rnd() * 1.5,
            dano: 6 + Math.floor(nvl * 2.2),
            recarga: 0, fase: rnd() * 6, dif: nvl
        });
    }

    // ---------- MODELOS ANIMADOS (inimigos e bichos) ----------
    const cacheModelos = {};
    function obterModelo(arq, ok, falha) {
        let e = cacheModelos[arq];
        if (!e) {
            e = cacheModelos[arq] = { estado: "carregando", fila: [] };
            loader.load(arq, gltf => {
                try {
                    const raiz = gltf.scene;
                    raiz.updateMatrixWorld(true);
                    const caixa = new THREE.Box3().setFromObject(raiz);
                    const tam = new THREE.Vector3();
                    caixa.getSize(tam);
                    e.base = raiz;
                    e.altura = tam.y || 1;
                    e.minY = caixa.min.y;
                    e.anims = gltf.animations || [];
                    e.estado = "pronto";
                    e.fila.forEach(f => f.ok(e));
                } catch (erro) {
                    console.error("Erro ao preparar modelo:", arq, erro);
                    e.estado = "erro";
                    e.fila.forEach(f => f.falha());
                }
                e.fila = [];
            }, undefined, erro => {
                console.warn("Modelo não encontrado:", arq, erro);
                e.estado = "erro";
                e.fila.forEach(f => f.falha());
                e.fila = [];
            });
        }
        if (e.estado === "pronto") ok(e);
        else if (e.estado === "erro") falha();
        else e.fila.push({ ok, falha });
    }

    function instanciarAnimado(mod, alturaAlvo, escDireta) {
        const clone = mod.base.clone(true);
        const esc = escDireta || (alturaAlvo / mod.altura);
        clone.scale.setScalar(esc);
        clone.position.y = -mod.minY * esc;
        clone.traverse(o => { if (o.isMesh) { o.castShadow = !(o.material && o.material.transparent); o.receiveShadow = true; } });
        const mixer = new THREE.AnimationMixer(clone);
        const acoes = {};
        mod.anims.forEach(c => { acoes[c.name] = mixer.clipAction(c); });
        return { clone, mixer, acoes };
    }

    function tocarAnim(obj, nome, uma) {
        if (!obj.acoes || obj.anim === nome) return;
        const a = obj.acoes[nome];
        if (!a) return;
        a.reset();
        a.enabled = true;
        a.setLoop(uma ? THREE.LoopOnce : THREE.LoopRepeat, uma ? 1 : Infinity);
        a.clampWhenFinished = !!uma;
        a.fadeIn(0.15).play();
        const ant = obj.acoes[obj.anim];
        if (ant && ant !== a) ant.fadeOut(0.15);
        obj.anim = nome;
    }

    // ---------- CRIATURAS: inimigos (hostis) e bichos (passivos) ----------
    const TIPOS = {
        // hostis (tier = dificuldade minima; dificuldade sobe a cada 160 m de distancia)
        slime:     { arq: "modelos/inimigos/slime.glb",     nome: "Slime",       alt: 1.3, vel: 2.2, dano: 0.7, xp: 0.7, hp: 0.8, alcance: 1.8, tier: 0, grupo: 3 },
        goblin:    { arq: "modelos/inimigos/goblin.glb",    nome: "Goblin",      alt: 1.8, vel: 3.2, dano: 0.8, xp: 0.8, hp: 0.7, alcance: 1.8, tier: 0, grupo: 3 },
        lobo:      { arq: "modelos/inimigos/lobo.glb",      nome: "Lobo",        alt: 1.6, vel: 4.2, dano: 0.9, xp: 1.0, hp: 0.8, alcance: 2.0, tier: 0, grupo: 3 },
        javali:    { arq: "modelos/inimigos/javali.glb",    nome: "Javali",      alt: 1.4, vel: 3.8, dano: 1.0, xp: 1.0, hp: 1.0, alcance: 2.0, tier: 0 },
        morcego:   { arq: "modelos/inimigos/morcego.glb",   nome: "Morcego",     esc: 1.0, h: 1.0, voa: 3.2, vel: 5.0, dano: 0.7, xp: 0.9, hp: 0.5, alcance: 1.9, tier: 1, grupo: 3 },
        aranha:    { arq: "modelos/inimigos/aranha.glb",    nome: "Aranha",      alt: 1.3, vel: 3.6, dano: 0.9, xp: 0.9, hp: 0.8, alcance: 1.9, tier: 1 },
        esqueleto: { arq: "modelos/inimigos/esqueleto.glb", nome: "Esqueleto",   alt: 2.6, vel: 2.6, dano: 1.0, xp: 1.0, hp: 1.0, alcance: 2.2, tier: 1 },
        bandido:   { arq: "modelos/inimigos/bandido.glb",   nome: "Bandido",     alt: 2.5, vel: 3.0, dano: 1.1, xp: 1.1, hp: 1.0, alcance: 2.1, tier: 1 },
        cobra:     { arq: "modelos/inimigos/cobra.glb",     nome: "Cobra",       esc: 1.0, h: 0.6, vel: 3.4, dano: 1.0, xp: 1.0, hp: 0.6, alcance: 2.0, tier: 1 },
        fantasma:  { arq: "modelos/inimigos/fantasma.glb",  nome: "Fantasma",    alt: 3.0, vel: 2.2, dano: 1.1, xp: 1.2, hp: 0.8, alcance: 2.2, tier: 2, flutua: 0.3 },
        escorpiao: { arq: "modelos/inimigos/escorpiao.glb", nome: "Escorpião",   alt: 1.0, vel: 3.4, dano: 1.2, xp: 1.2, hp: 1.0, alcance: 2.1, tier: 2 },
        orc:       { arq: "modelos/inimigos/orc.glb",       nome: "Orc",         alt: 3.1, vel: 2.8, dano: 1.5, xp: 1.6, hp: 1.8, alcance: 2.6, tier: 2 },
        cultista:  { arq: "modelos/inimigos/cultista.glb",  nome: "Cultista",    alt: 2.6, vel: 2.6, dano: 1.1, xp: 1.6, hp: 0.9, alcance: 13, tier: 2, ranged: true },
        urso:      { arq: "modelos/inimigos/urso.glb",      nome: "Urso",        alt: 2.2, vel: 3.2, dano: 1.8, xp: 2.0, hp: 2.4, alcance: 2.6, tier: 3 },
        golem:     { arq: "modelos/inimigos/golem.glb",     nome: "Golem",       alt: 4.2, vel: 1.6, dano: 2.2, xp: 2.2, hp: 2.5, alcance: 3.4, tier: 3 },
        ent:       { arq: "modelos/inimigos/ent.glb",       nome: "Ent",         alt: 5.0, vel: 1.8, dano: 2.0, xp: 2.4, hp: 3.0, alcance: 3.6, tier: 3 },
        ogro:      { arq: "modelos/inimigos/ogro.glb",      nome: "Ogro (chefe)", alt: 4.8, vel: 2.4, dano: 2.8, xp: 6.0, hp: 7.0, alcance: 3.8, tier: 4, boss: true },
        // bichos (passivos, fogem do heroi; dao vida ao serem cacados)
        coelho:    { arq: "modelos/bichos/coelho.glb",  nome: "Coelho",  alt: 0.7, vel: 4.5, hp: 0.3, passivo: true, cura: 8,  medo: 12 },
        veado:     { arq: "modelos/bichos/veado.glb",   nome: "Veado",   alt: 2.4, vel: 5.0, hp: 0.8, passivo: true, cura: 25, medo: 16 },
        raposa:    { arq: "modelos/bichos/raposa.glb",  nome: "Raposa",  alt: 1.0, vel: 4.8, hp: 0.4, passivo: true, cura: 12, medo: 13 },
        ovelha:    { arq: "modelos/bichos/ovelha.glb",  nome: "Ovelha",  alt: 1.2, vel: 2.6, hp: 0.6, passivo: true, cura: 20, medo: 8 },
        galinha:   { arq: "modelos/bichos/galinha.glb", nome: "Galinha", alt: 0.8, vel: 3.0, hp: 0.2, passivo: true, cura: 8,  medo: 8 },
        passaro:   { arq: "modelos/bichos/passaro.glb", nome: "Pássaro", esc: 1.2, h: 1.0, voa: 9, vel: 5.0, hp: 1.0, passivo: true, passaro: true, cura: 0, medo: 0 }
    };
    const INIMIGOS_BIOMA = {
        guerreiro: ["goblin", "lobo", "javali", "bandido", "orc", "esqueleto"],
        mago: ["fantasma", "golem", "cultista", "morcego", "slime"],
        arqueiro: ["lobo", "goblin", "aranha", "javali", "urso", "ent", "cobra"],
        paladino: ["esqueleto", "fantasma", "cultista", "bandido"],
        assassino: ["esqueleto", "fantasma", "aranha", "bandido", "morcego", "cobra"],
        druida: ["lobo", "aranha", "ent", "slime", "cobra", "urso", "javali"],
        necromante: ["esqueleto", "fantasma", "cultista", "morcego", "ogro"],
        barbaro: ["goblin", "orc", "golem", "lobo", "javali", "urso", "ogro"],
        invocador: ["fantasma", "golem", "cultista", "slime", "morcego"],
        monge: ["goblin", "lobo", "bandido", "cobra", "slime"],
        cavaleirorunico: ["golem", "esqueleto", "orc", "ent", "cultista"],
        samurai: ["esqueleto", "bandido", "goblin", "cultista", "lobo"]
    };
    const BICHOS_BIOMA = {
        guerreiro: ["ovelha", "galinha", "coelho", "veado", "passaro"], mago: ["passaro", "raposa"],
        arqueiro: ["veado", "coelho", "raposa", "passaro"], paladino: ["ovelha", "passaro", "coelho"],
        assassino: ["passaro", "raposa"], druida: ["veado", "coelho", "raposa", "passaro"],
        necromante: ["passaro"], barbaro: ["raposa", "coelho", "passaro"], invocador: ["passaro", "coelho"],
        monge: ["galinha", "coelho", "passaro", "veado"], cavaleirorunico: ["raposa", "passaro", "ovelha"],
        samurai: ["galinha", "veado", "coelho", "passaro"]
    };
    const difEm = (x, z) => Math.floor(Math.hypot(x, z) / 160);

    function escolherInimigo(chaveBio, dif) {
        const pool = (INIMIGOS_BIOMA[chaveBio] || []).filter(t => TIPOS[t].tier <= dif);
        const todos = Object.keys(TIPOS).filter(t => !TIPOS[t].passivo && TIPOS[t].tier <= dif);
        const lista = pool.length && Math.random() < 0.8 ? pool : todos;
        return lista[Math.floor(Math.random() * lista.length)];
    }

    function criarCriatura(tipo, x, z, chave, ponto, dif) {
        const def = TIPOS[tipo];
        obterModelo(def.arq, mod => {
            if (!chunks.has(chave)) { if (ponto) ponto.vivo = false; return; }
            const grupo = new THREE.Group();
            const corpoPivo = new THREE.Group();
            const inst = instanciarAnimado(mod, def.alt, def.esc);
            corpoPivo.add(inst.clone);
            const altVis = def.h || def.alt || 1;
            if (!def.passivo) {
                const marcador = new THREE.Mesh(geo.marcador, matMarcador);
                marcador.rotation.x = -Math.PI / 2;
                marcador.position.y = 0.12;
                marcador.scale.setScalar(Math.max(1.2, altVis * 0.45));
                grupo.add(marcador);
            }
            const barra = new THREE.Mesh(geo.barra, new THREE.MeshBasicMaterial({ color: def.passivo ? 0x40c060 : 0xe03030, depthTest: false }));
            barra.position.y = altVis + 0.8 + (def.voa || 0);
            barra.scale.setScalar(def.boss ? 2.2 : 1.3);
            barra.renderOrder = 10;
            grupo.add(corpoPivo, barra);
            grupo.position.set(x, alturaTerreno(x, z), z);
            cena.add(grupo);

            const hpMax = Math.round(45 * (def.hp || 1) * (1 + dif * 0.35));
            const e = {
                grupo, corpoPivo, barra, material: null,
                mixer: inst.mixer, acoes: inst.acoes, anim: null, tAtq: 0,
                hp: hpMax, hpMax, chunk: chave, tipo, nome: def.nome, dif,
                boss: !!def.boss, passivo: !!def.passivo, passaro: !!def.passaro, cura: def.cura || 0, ranged: !!def.ranged,
                voa: def.voa || 0, flutua: def.flutua || 0,
                vel: (def.vel || 3) * (0.85 + Math.random() * 0.3),
                dano: Math.max(1, Math.round((6 + dif * 2.2) * (def.dano || 1))),
                xp: def.xp || 1, alcance: def.alcance || 2, medo: def.medo || 10,
                raioExtra: Math.max(0, (def.alt || 1) * 0.35 - 0.8),
                recarga: Math.random(), fase: Math.random() * 6,
                homeX: x, homeZ: z, alvoX: x, alvoZ: z, espera: Math.random() * 3, rumo: Math.random() * 6.28,
                assustado: 0, ponto
            };
            inimigos.push(e);
            if (ponto) ponto.entidade = e;
            tocarAnim(e, def.passaro ? "walk" : "idle");
        }, () => {
            if (ponto) { ponto.vivo = false; ponto.falhou = true; }
            if (!def.passivo && chunks.has(chave)) criarInimigoProc(x, z, chave, Math.random, biomaNoPonto(x, z));
        });
    }

    // instancia um ponto de spawn (grupos de lobos, slimes etc. nascem juntos)
    function spawnarPonto(p, reg) {
        p.vivo = true;
        const dif = difEm(p.x, p.z);
        if (p.tipo === "bicho") {
            const lista = BICHOS_BIOMA[reg.chaveBio] || ["passaro"];
            criarCriatura(lista[Math.floor(Math.random() * lista.length)], p.x, p.z, reg.chave, p, dif);
            return;
        }
        const tipo = escolherInimigo(reg.chaveBio, dif);
        const def = TIPOS[tipo];
        criarCriatura(tipo, p.x, p.z, reg.chave, p, dif);
        const extras = def.grupo ? Math.floor(Math.random() * def.grupo) : 0;
        for (let k = 0; k < extras; k++) {
            const a = Math.random() * 6.28, r = 2 + Math.random() * 3;
            criarCriatura(tipo, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, reg.chave, null, dif);
        }
    }

    function atualizarSpawns(delta) {
        estado.tSpawn = (estado.tSpawn || 0) - delta;
        if (estado.tSpawn > 0 || inimigos.length >= CFG.maxInimigos) return;
        estado.tSpawn = 0.12;
        const hx = heroi.position.x, hz = heroi.position.z, agora = relogio.elapsedTime;
        let melhor = null, regMelhor = null, md = CFG.raioSpawn;
        for (const reg of chunks.values()) {
            for (const p of reg.pontos) {
                if (p.vivo || p.falhou || agora < p.proxRespawn) continue;
                const d = Math.hypot(p.x - hx, p.z - hz);
                if (d < md && d > 22) { md = d; melhor = p; regMelhor = reg; }
            }
        }
        if (melhor) spawnarPonto(melhor, regMelhor);
    }

    // projeteis (ataques a distancia do cultista)
    const projeteis = [];
    const matProj = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
    const geoProj = new THREE.SphereGeometry(0.3, 10, 8);
    function lancarProjetil(e) {
        const ox = e.grupo.position.x, oz = e.grupo.position.z, oy = e.grupo.position.y + 1.8;
        const dx = heroi.position.x - ox, dz = heroi.position.z - oz, dy = (heroi.position.y + 1.3) - oy;
        const d = Math.hypot(dx, dz, dy) || 1;
        const m = new THREE.Mesh(geoProj, matProj);
        m.position.set(ox, oy, oz);
        cena.add(m);
        projeteis.push({ m, vx: dx / d * 15, vy: dy / d * 15, vz: dz / d * 15, vida: 3, dano: e.dano * 1.2 });
        if (e.acoes && e.acoes.attack) { e.tAtq = 0.7; e.anim = null; tocarAnim(e, "attack", true); }
    }
    function atualizarProjeteis(delta) {
        for (let k = projeteis.length - 1; k >= 0; k--) {
            const p = projeteis[k];
            p.vida -= delta;
            p.m.position.x += p.vx * delta;
            p.m.position.y += p.vy * delta;
            p.m.position.z += p.vz * delta;
            const dx = p.m.position.x - heroi.position.x, dz = p.m.position.z - heroi.position.z;
            const dy = p.m.position.y - (heroi.position.y + 1.3);
            let fim = p.vida <= 0 || p.m.position.y < alturaTerreno(p.m.position.x, p.m.position.z);
            if (!fim && Math.hypot(dx, dz) < 1.0 && Math.abs(dy) < 1.6) { danoNoHeroi(p.dano); fim = true; }
            if (fim) { cena.remove(p.m); projeteis.splice(k, 1); }
        }
    }

    function criarItem(tipo, x, z, i) {
        let malha;
        if (tipo === "vida") malha = new THREE.Mesh(geo.poção, new THREE.MeshStandardMaterial({ color: 0xe03a3a, emissive: 0x802020 }));
        else if (tipo === "mana") malha = new THREE.Mesh(geo.poção, new THREE.MeshStandardMaterial({ color: 0x3a6ae0, emissive: 0x203880 }));
        else malha = new THREE.Mesh(geo.artefato, new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xaa8820, metalness: 0.6, roughness: 0.3 }));
        malha.position.set(x, alturaTerreno(x, z) + 1, z);
        malha.castShadow = true;
        cena.add(malha);
        itens.push({ tipo, malha, chunk: i, fase: Math.random() * 6 });
    }

    function criarChunk(cx, cz) {
        const chave = chv(cx, cz);
        const bioma = biomaDoChunk(cx, cz);
        const reg2 = regiaoDoChunk(cx, cz), rx = reg2[0], rz = reg2[1];
        const chaveBio = ordemBiomas[indiceBiomaReg(rx, rz)];
        const rnd = mulberry32(((cx * 73856093) ^ (cz * 19349663)) + 12345);
        const cxm = (cx + 0.5) * L, czm = (cz + 0.5) * L;
        const grupo = new THREE.Group();
        grupo.position.set(cxm, 0, czm);
        const descartar = [];
        const registro = { grupo, obstaculos: [], descartar, pontos: [], cx, cz, chave, chaveBio };
        // registra ANTES de carregar os GLBs (os callbacks conferem se o bloco existe)
        chunks.set(chave, registro);
        cena.add(grupo);

        const pisoY = (x, z) => alturaTerreno(cxm + x, czm + z);
        const centro = centroRegiao(rx, rz);

        // ---- terreno: relevo, textura e cor por vertice (biomas vizinhos, rocha, areia, neve) ----
        const SEG = 60;
        const gt = new THREE.PlaneGeometry(L + 0.2, L + 0.2, SEG, SEG);
        gt.rotateX(-Math.PI / 2);
        const pos = gt.attributes.position;
        const alturas = new Float32Array(pos.count);
        for (let v = 0; v < pos.count; v++) {
            const h = alturaTerreno(cxm + pos.getX(v), czm + pos.getZ(v));
            alturas[v] = h;
            pos.setY(v, h - 0.05);
        }
        gt.computeVertexNormals();
        const nrm = gt.attributes.normal;
        const corBio = b => new THREE.Color(b.terreno).lerp(new THREE.Color(0xffffff), 0.12);
        const cBase = corBio(bioma), cL = corBio(biomaDoChunk(cx - 1, cz)), cR = corBio(biomaDoChunk(cx + 1, cz));
        const cN = corBio(biomaDoChunk(cx, cz - 1)), cS = corBio(biomaDoChunk(cx, cz + 1));
        const cTerra = new THREE.Color(0x8a7150), cAreia = new THREE.Color(0xc2b280), cRocha = new THREE.Color(0x77736c), cNeve = new THREE.Color(0xf2f4f8);
        const cores = new Float32Array(pos.count * 3);
        const cv = new THREE.Color();
        for (let v = 0; v < pos.count; v++) {
            const x = pos.getX(v), z = pos.getZ(v), wx = cxm + x, wz = czm + z, h = alturas[v];
            cv.copy(cBase);
            const u = (x + L / 2) / L, w = (z + L / 2) / L;
            const fl = 1 - suave(0, 0.18, u), fr = suave(0.82, 1, u), fn = 1 - suave(0, 0.18, w), fs = suave(0.82, 1, w);
            if (fl > 0) cv.lerp(cL, fl * 0.5);
            if (fr > 0) cv.lerp(cR, fr * 0.5);
            if (fn > 0) cv.lerp(cN, fn * 0.5);
            if (fs > 0) cv.lerp(cS, fs * 0.5);
            const ru = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453;
            const r = ru - Math.floor(ru);
            const mancha = Math.sin(wx * 0.045 + 1.3) * Math.sin(wz * 0.05 + 0.2) + Math.sin(wx * 0.13 + wz * 0.11) * 0.4;
            cv.lerp(cTerra, suave(0.55, 1.1, mancha) * 0.8);
            const ny = nrm.getY(v);
            cv.lerp(cRocha, suave(0.22, 0.45, 1 - ny));
            if (h < NIVEL_AGUA + 0.9) cv.lerp(cAreia, suave(NIVEL_AGUA + 0.9, NIVEL_AGUA - 0.3, h));
            if (h > 24) cv.lerp(cNeve, suave(24, 32, h) * suave(0.4, 0.8, ny));
            const vari = 0.88 + r * 0.24;
            cores[v * 3] = cv.r * vari;
            cores[v * 3 + 1] = cv.g * vari;
            cores[v * 3 + 2] = cv.b * vari;
        }
        gt.setAttribute("color", new THREE.BufferAttribute(cores, 3));
        const terreno = new THREE.Mesh(gt, matTerreno);
        terreno.receiveShadow = true;
        grupo.add(terreno);
        descartar.push(gt);

        // ---- posicoes validas (fora d'agua, longe do marco ou perto dele) ----
        // perto: 0 = longe do marco, 1 = vilarejo ao redor do marco, 2 = qualquer lugar
        const tentarPos = (perto, minOrigem) => {
            for (let t = 0; t < 8; t++) {
                const lx = (rnd() - 0.5) * L, lz = (rnd() - 0.5) * L;
                const wx = cxm + lx, wz = czm + lz;
                if (alturaTerreno(wx, wz) < NIVEL_AGUA + 0.6) continue;
                if (Math.hypot(wx, wz) < minOrigem) continue;
                const dc = Math.hypot(wx - centro.x, wz - centro.z);
                if (perto === 1) { if (dc > 64 || dc < 24) continue; }
                else if (perto === 0 && dc < 32) continue;
                return [lx, lz];
            }
            return null;
        };

        // ---- props GLB do bioma ----
        const corRocha = new THREE.Color(bioma.terreno).lerp(new THREE.Color(0x888888), 0.6).multiplyScalar(0.8).getHex();
        const tabela = PROPS_BIOMA[chaveBio] || PROPS_BIOMA.guerreiro;
        const somaPesos = tabela.reduce((acc, t) => acc + t[1], 0);
        const plano = {};
        for (let k = 0; k < CFG.propsPorTrecho; k++) {
            let r = rnd() * somaPesos, esc = tabela[0];
            for (const t of tabela) { r -= t[1]; if (r <= 0) { esc = t; break; } }
            const nome = esc[0];
            const lp = tentarPos(PERTO.has(nome) ? 1 : 0, 14);
            if (!lp) continue;
            const escala = (0.85 + rnd() * 0.45) * CFG.escalaProps;
            const rot = rnd() * 6.28;
            const raio = (RAIO_PROPS[nome] || 0) * escala;
            if (raio > 0) registro.obstaculos.push({ x: cxm + lp[0], z: czm + lp[1], r: raio });
            (plano[nome] = plano[nome] || []).push({ x: lp[0], z: lp[1], rot, esc: escala });
        }
        for (const nome of Object.keys(plano)) colocarProps(chave, grupo, bioma, nome, plano[nome], cxm, czm);

        // ---- grama alta (instanciada) ----
        const qtdGrama = 1500;
        const grama = new THREE.InstancedMesh(geo.grama, matGrama(bioma), qtdGrama);
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), eu = new THREE.Euler();
        for (let k = 0; k < qtdGrama; k++) {
            const x = (rnd() - 0.5) * L, z = (rnd() - 0.5) * L;
            const h = pisoY(x, z);
            const ok = h > NIVEL_AGUA + 0.35 && h < 24;
            pp.set(x, h, z);
            eu.set(0, rnd() * 6, 0);
            q.setFromEuler(eu);
            const sc = ok ? 0.7 + rnd() * 1.1 : 0;
            ss.set(sc, sc * (0.8 + rnd() * 0.8), sc);
            mtx.compose(pp, q, ss);
            grama.setMatrixAt(k, mtx);
        }
        grama.instanceMatrix.needsUpdate = true;
        grama.frustumCulled = false;
        grupo.add(grama);

        // ---- marco do bioma (GLB de cenario) no centro de cada regiao + ruinas isoladas ----
        const rotL = rnd() * 6.28;
        if (cx === RC * rx && cz === RC * rz) {
            registro.obstaculos.push({ x: cxm, z: czm, r: CFG.tamanhoCenarioGLB * 0.34 });
            obterCenario(bioma.arquivo, clone => {
                if (!chunks.has(chave)) return;
                clone.position.set(0, pisoY(0, 0) - 0.3, 0);
                clone.rotation.y = rotL;
                grupo.add(clone);
            });
        } else if (rnd() < 0.14) {
            const lx = (rnd() - 0.5) * L * 0.7, lz = (rnd() - 0.5) * L * 0.7;
            if (pisoY(lx, lz) > NIVEL_AGUA + 0.8 && Math.hypot(cxm + lx, czm + lz) > 40) {
                registro.obstaculos.push({ x: cxm + lx, z: czm + lz, r: CFG.tamanhoCenarioGLB * 0.24 });
                obterCenario(bioma.arquivo, clone => {
                    if (!chunks.has(chave)) return;
                    clone.position.set(lx, pisoY(lx, lz) - 0.3, lz);
                    clone.rotation.y = rotL;
                    clone.scale.setScalar(0.7);
                    grupo.add(clone);
                });
            }
        }

        // ---- pontos de spawn (inimigos e bichos nascem quando o heroi chega perto) ----
        const nInim = 3 + Math.floor(rnd() * 4), nBicho = 3 + Math.floor(rnd() * 4);
        for (let k = 0; k < nInim + nBicho; k++) {
            const lp = tentarPos(2, 30);
            if (!lp) continue;
            registro.pontos.push({ tipo: k < nInim ? "inimigo" : "bicho", x: cxm + lp[0], z: czm + lp[1], vivo: false, proxRespawn: 0, falhou: false, entidade: null });
        }

        // ---- itens ----
        const nIt = 2 + Math.floor(rnd() * 2);
        for (let k = 0; k < nIt; k++) {
            const lp = tentarPos(2, 12);
            if (lp) criarItem(rnd() < 0.6 ? "vida" : "mana", cxm + lp[0], czm + lp[1], chave);
        }
        if (rnd() < 0.12 && Math.hypot(cxm, czm) > 150) {
            const lp = tentarPos(2, 12);
            if (lp) criarItem("artefato", cxm + lp[0], czm + lp[1], chave);
        }
    }

    function removerChunk(chave) {
        const c = chunks.get(chave);
        if (!c) return;
        cena.remove(c.grupo);
        c.descartar.forEach(g => g.dispose());
        chunks.delete(chave);
        for (let k = inimigos.length - 1; k >= 0; k--) {
            if (inimigos[k].chunk === chave) removerInimigo(k);
        }
        for (let k = itens.length - 1; k >= 0; k--) {
            if (itens[k].chunk === chave) { cena.remove(itens[k].malha); itens.splice(k, 1); }
        }
    }

    function removerInimigo(idx) {
        const e = inimigos[idx];
        cena.remove(e.grupo);
        if (e.material) e.material.dispose();
        if (e.mixer) e.mixer.stopAllAction();
        e.barra.material.dispose();
        inimigos.splice(idx, 1);
    }

    function atualizarChunks() {
        const cx0 = Math.floor(heroi.position.x / L), cz0 = Math.floor(heroi.position.z / L);
        const R = CFG.raioChunks;
        const faltando = [];
        for (let dx = -R; dx <= R; dx++) {
            for (let dz = -R; dz <= R; dz++) {
                if (!chunks.has(chv(cx0 + dx, cz0 + dz))) faltando.push([dx, dz]);
            }
        }
        faltando.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
        // no inicio cria tudo de uma vez; depois, 1 bloco por quadro para nao travar
        const limite = estado.mundoPronto ? 1 : 99;
        for (let k = 0; k < faltando.length && k < limite; k++) criarChunk(cx0 + faltando[k][0], cz0 + faltando[k][1]);
        estado.mundoPronto = true;
        for (const par of Array.from(chunks.entries())) {
            if (Math.abs(par[1].cx - cx0) > R + 1 || Math.abs(par[1].cz - cz0) > R + 1) removerChunk(par[0]);
        }
        return [cx0, cz0];
    }

    function limparMundo() {
        for (const k of Array.from(chunks.keys())) removerChunk(k);
        for (const p of projeteis) cena.remove(p.m);
        projeteis.length = 0;
        estado.mundoPronto = false;
    }

    // ---------- 5.6 HEROI ----------
    const heroi = new THREE.Group();
    cena.add(heroi);

    const luzHeroi = new THREE.PointLight(0xa07cff, 1.1, 16);
    luzHeroi.position.y = 1.6;
    heroi.add(luzHeroi);

    const escudoMalha = new THREE.Mesh(
        new THREE.SphereGeometry(1.9, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.28, depthWrite: false })
    );
    escudoMalha.position.y = 1.25;
    escudoMalha.visible = false;
    heroi.add(escudoMalha);

    let modelo3D = null, mixer = null, animacaoAtual = null;
    let acoes = {};
    let modeloCarregado = false;
    let noAr = false, velocidadeVertical = 0, pulosFeitos = 0;
    let atacando = false, tempoAcao = 0;

    // estado de combate
    const estado = {
        recargaAtaque: 0, recargaMagia: 0, escudo: 0,
        recargaDash: 0, dash: 0, dashX: 0, dashZ: 0,
        invulneravel: 0, distanciaMax: 0, biomaAtual: -1, salvar: 0
    };

    function registrarAnimacoes(animacoes) {
        acoes = {};
        animacaoAtual = null;
        if (!animacoes || animacoes.length === 0) return;

        const mapa = {
            idle: ["idle", "stand", "breath", "rest"],
            walk: ["walk", "walking"],
            run: ["run", "running", "sprint"],
            jump: ["jump", "jumping"],
            swordswing: ["swordswing", "swordattack", "attack", "slash", "melee"],
            cheer: ["cheer", "victory", "celebrate"],
            wave: ["wave", "hello", "greet"]
        };

        Object.entries(mapa).forEach(([nome, palavras]) => {
            const clipe = animacoes.find(c => {
                const n = normalizarNome(c.name);
                return palavras.some(p => n.includes(normalizarNome(p)));
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
        if (!modelo3D) throw new Error("Modelo GLB sem cena.");
        modelo3D.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
        modelo3D.updateMatrixWorld(true);

        heroi.add(modelo3D);
        mixer = new THREE.AnimationMixer(modelo3D);
        registrarAnimacoes(gltf.animations || []);

        mixer.addEventListener("finished", evento => {
            const unica = [acoes.swordswing, acoes.cheer, acoes.wave, acoes.jump];
            if (!unica.includes(evento.action)) return;
            if (evento.action === acoes.jump && noAr) return;
            finalizarAcao();
        });

        modeloCarregado = true;
    }

    function carregarPersonagem() {
        mostrarCarregamento("Carregando herói: " + personagem.nome);
        loader.load(caminhoModelo, gltf => {
            try {
                prepararModelo(gltf);
                if (carregando) carregando.style.display = "none";
                if (acoes.idle) tocarAnimacao("idle");
                atualizarInterface();
            } catch (erro) {
                console.error("Erro ao preparar personagem:", erro);
                mostrarCarregamento("O modelo foi encontrado, mas não pôde ser preparado.");
            }
        }, progresso => {
            if (progresso.total > 0 && carregando) {
                carregando.textContent = "Carregando herói: " + Math.round(progresso.loaded / progresso.total * 100) + "%";
            }
        }, erro => {
            console.error("Erro ao carregar personagem:", caminhoModelo, erro);
            mostrarCarregamento("Não foi possível carregar o personagem. Verifique: " + caminhoModelo);
        });
    }
    carregarPersonagem();

    // ---------- 5.7 ENTRADA (teclado, mouse, toque) ----------
    const teclas = {};
    const joy = { x: 0, y: 0, ativo: false, id: null };
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
        if (tecla === "e") magiaEscudo();
        if (tecla === "r") magiaCura();
        if (tecla === "q") dash();
        if (tecla === "c") emote("cheer", "🏆 " + personagem.classe + " está comemorando!");
        if (tecla === "v") emote("wave", "👋 " + personagem.classe + " está acenando!");
    });
    window.addEventListener("keyup", e => { teclas[e.key.toLowerCase()] = false; });
    window.addEventListener("blur", () => {
        Object.keys(teclas).forEach(t => { teclas[t] = false; });
        arrastando = false;
    });

    renderizador.domElement.addEventListener("mousedown", e => {
        if (e.button !== 0) return;
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

    // camera por toque (arrastar na tela)
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
    const fimToqueCam = e => {
        for (const t of e.changedTouches) if (t.identifier === toqueCamId) toqueCamId = null;
    };
    renderizador.domElement.addEventListener("touchend", fimToqueCam);
    renderizador.domElement.addEventListener("touchcancel", fimToqueCam);

    // ---------- 5.8 CONTROLES MOBILE (criados por JS) ----------
    function criarControlesMobile() {
        const toque = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
        if (!toque) return;

        const estilo = document.createElement("style");
        estilo.textContent = `
            #joystickBase{position:absolute;left:18px;bottom:22px;width:130px;height:130px;border-radius:50%;
                background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.3);z-index:20;touch-action:none}
            #joystickKnob{position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;
                background:rgba(255,220,150,.75);pointer-events:none}
            #botoesMobile{position:absolute;right:14px;bottom:20px;display:grid;grid-template-columns:repeat(3,58px);
                gap:8px;z-index:20}
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
        areaJogo.appendChild(base);

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
        base.addEventListener("touchstart", e => {
            const t = e.changedTouches[0];
            joy.id = t.identifier;
            moverJoy(t);
            e.preventDefault();
        }, { passive: false });
        base.addEventListener("touchmove", e => {
            for (const t of e.changedTouches) if (t.identifier === joy.id) moverJoy(t);
            e.preventDefault();
        }, { passive: false });
        base.addEventListener("touchend", e => {
            for (const t of e.changedTouches) if (t.identifier === joy.id) soltarJoy();
        });
        base.addEventListener("touchcancel", soltarJoy);

        const painel = document.createElement("div");
        painel.id = "botoesMobile";
        const lista = [
            ["⚔️", atacar], ["🔥", magiaAtaque], ["⬆️", pular],
            ["🛡️", magiaEscudo], ["💚", magiaCura], ["💨", dash],
            ["📜", () => { const b = document.getElementById("botaoMenu"); if (b) b.click(); }]
        ];
        lista.forEach(([icone, fn]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.textContent = icone;
            b.addEventListener("touchstart", e => { e.preventDefault(); fn(); }, { passive: false });
            painel.appendChild(b);
        });
        areaJogo.appendChild(painel);
    }
    criarControlesMobile();

    // texto de controles do PC
    (function atualizarTextoControles() {
        const el = document.querySelector(".controles");
        if (!el) return;
        const linhas = [
            "MOVIMENTAÇÃO", "WASD / setas — Mover", "Shift — Correr", "Espaço — Pular (duplo)",
            "Q — Investida", "J — Atacar", "K — Magia de dano", "E — Escudo mágico",
            "R — Magia de cura", "Mouse — Câmera", "C / V — Comemorar / Acenar"
        ];
        el.replaceChildren();
        linhas.forEach((t, i) => {
            const d = document.createElement("div");
            if (i === 0) d.className = "controle-titulo";
            d.textContent = t;
            el.appendChild(d);
        });
    })();

    // linha extra de HUD (distancia)
    const painelHud = document.querySelector(".painel-personagem");
    let distEl = null;
    if (painelHud) {
        distEl = document.createElement("div");
        distEl.id = "distanciaHero";
        painelHud.appendChild(distEl);
    }

    // ---------- 5.9 EFEITOS VISUAIS ----------
    function efeitoAnel(x, z, cor, raioMax, duracao) {
        const m = new THREE.Mesh(geo.anel, new THREE.MeshBasicMaterial({
            color: cor, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false
        }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.1, z);
        cena.add(m);
        efeitos.push({ m, t: 0, dur: duracao, max: raioMax });
    }

    // ---------- 5.10 ACOES / COMBATE ----------
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
        tocarAnimacao(nome, false);
        return true;
    }

    function emote(nome, texto) {
        if (atacando) return;
        if (executarAnim(nome)) msg(texto);
        else msg("Animação não disponível neste modelo.");
    }

    function pular() {
        if (!modeloCarregado || atacando && !noAr) return;
        if (pulosFeitos >= CFG.pulos) return;
        pulosFeitos++;
        noAr = true;
        velocidadeVertical = pulosFeitos === 1 ? 7 : 6.5;
        if (acoes.jump) { animacaoAtual = null; tocarAnimacao("jump", false); }
    }

    function dash() {
        if (estado.recargaDash > 0 || !modeloCarregado) return;
        estado.recargaDash = 1.2;
        estado.dash = 0.22;
        estado.invulneravel = 0.3;
        estado.dashX = Math.sin(heroi.rotation.y);
        estado.dashZ = Math.cos(heroi.rotation.y);
        efeitoAnel(heroi.position.x, heroi.position.z, 0xffffff, 2, 0.35);
    }

    function alvoAlcance(e) {
        const y = e.grupo.position.y + e.corpoPivo.position.y;
        return Math.abs(y - heroi.position.y) < 4;
    }

    function danoNoInimigo(e, valor) {
        e.hp -= valor;
        e.barra.scale.x = Math.max(0.001, e.hp / e.hpMax);
        e.barra.position.x = -(1 - e.barra.scale.x) * 0.6;
        e.corpoPivo.position.y = 0.25;
        if (e.passivo) e.assustado = 4;
        if (e.hp <= 0) matarInimigo(e);
    }

    function matarInimigo(e) {
        const idx = inimigos.indexOf(e);
        if (idx < 0) return;
        const dif = e.dif || 0;
        const px = e.grupo.position.x, pz = e.grupo.position.z;
        if (e.passivo) {
            personagem.hp = Math.min(personagem.hpMax, personagem.hp + e.cura);
            personagem.xp += 6 + dif;
            personagem.ouro += 1 + Math.floor(Math.random() * 3);
            msg("🍖 " + e.nome + " caçado! +" + e.cura + " de vida");
        } else {
            const ouro = 5 + Math.floor(Math.random() * 10) + dif * 3 + (e.boss ? 100 : 0);
            personagem.ouro += ouro;
            personagem.xp += Math.round((15 + dif * 6) * (e.xp || 1));
            msg((e.boss ? "👑 " : "💀 ") + (e.nome || "Inimigo") + " derrotado! +" + ouro + " 🪙", e.boss ? 5 : 3);
            if (e.boss) criarItem("artefato", px, pz, e.chunk);
            else if (Math.random() < 0.25) criarItem(Math.random() < 0.7 ? "vida" : "mana", px, pz, e.chunk);
        }
        if (e.ponto) { e.ponto.vivo = false; e.ponto.proxRespawn = relogio.elapsedTime + 180; }
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
            efeitoAnel(heroi.position.x, heroi.position.z, 0xffe066, 6, 0.8);
        }
    }

    function atacar() {
        if (estado.recargaAtaque > 0 || !modeloCarregado) return;
        estado.recargaAtaque = 0.55;
        executarAnim("swordswing");
        const dano = 15 + personagem.nivel * 4 + num(personagem.ataque ?? personagem.forca, 0);
        const fx = Math.sin(heroi.rotation.y), fz = Math.cos(heroi.rotation.y);
        let acertou = 0;
        for (const e of inimigos.slice()) {
            const dx = e.grupo.position.x - heroi.position.x;
            const dz = e.grupo.position.z - heroi.position.z;
            const d = Math.hypot(dx, dz);
            if (d < 3.8 + (e.raioExtra || 0) && alvoAlcance(e) && (dx * fx + dz * fz) / (d || 1) > -0.2) {
                danoNoInimigo(e, dano);
                acertou++;
            }
        }
        if (acertou) msg("⚔️ Golpe! Dano: " + dano);
        else msg("⚔️ " + personagem.classe + " ataca!");
    }

    function magiaAtaque() {
        if (estado.recargaMagia > 0 || !modeloCarregado) return;
        if (personagem.mp < CFG.custoMagia) { msg("Mana insuficiente!"); return; }
        personagem.mp -= CFG.custoMagia;
        estado.recargaMagia = 1;
        executarAnim("swordswing");
        const dano = 30 + personagem.nivel * 6;
        efeitoAnel(heroi.position.x, heroi.position.z, 0xff6a2a, 9, 0.5);
        let n = 0;
        for (const e of inimigos.slice()) {
            const d = Math.hypot(e.grupo.position.x - heroi.position.x, e.grupo.position.z - heroi.position.z);
            if (d < 9 + (e.raioExtra || 0) && alvoAlcance(e)) { danoNoInimigo(e, dano); n++; }
        }
        msg("🔥 Magia! " + n + " alvo(s), dano " + dano);
        atualizarInterface();
    }

    function magiaEscudo() {
        if (estado.escudo > 0) return;
        if (personagem.mp < CFG.custoEscudo) { msg("Mana insuficiente!"); return; }
        personagem.mp -= CFG.custoEscudo;
        estado.escudo = 6;
        msg("🛡️ Escudo mágico ativo por 6s (-80% de dano)");
        atualizarInterface();
    }

    function magiaCura() {
        if (personagem.mp < CFG.custoCura) { msg("Mana insuficiente!"); return; }
        if (personagem.hp >= personagem.hpMax) { msg("Vida já está cheia."); return; }
        personagem.mp -= CFG.custoCura;
        const cura = 35 + personagem.nivel * 5;
        personagem.hp = Math.min(personagem.hpMax, personagem.hp + cura);
        efeitoAnel(heroi.position.x, heroi.position.z, 0x55ff88, 4, 0.6);
        msg("💚 Restauração: +" + cura + " de vida");
        atualizarInterface();
    }

    function danoNoHeroi(valor) {
        if (estado.invulneravel > 0) return;
        if (estado.escudo > 0) valor *= 0.2;
        valor = Math.max(1, Math.round(valor - num(personagem.defesa, 0) * 0.3));
        personagem.hp = Math.max(0, personagem.hp - valor);
        estado.invulneravel = 0.35;
        msg("💥 Você sofreu " + valor + " de dano!", 1.5);
        atualizarInterface();
        if (personagem.hp <= 0) morrer();
    }

    function morrer() {
        msg("☠️ Você caiu! Perdeu metade do ouro e voltou ao início.", 5);
        personagem.ouro = Math.floor(personagem.ouro / 2);
        personagem.hp = personagem.hpMax;
        personagem.mp = personagem.mpMax;
        heroi.position.set(0, 0, 0);
        estado.escudo = 0;
        estado.biomaAtual = -1;
        limparMundo();
        salvarPersonagem();
        atualizarInterface();
    }

    // ---------- 5.11 MOVIMENTO ----------
    function movimentoAtual() {
        let dx = 0, dz = 0;
        if (teclas.w || teclas.arrowup) dz -= 1;
        if (teclas.s || teclas.arrowdown) dz += 1;
        if (teclas.a || teclas.arrowleft) dx -= 1;
        if (teclas.d || teclas.arrowright) dx += 1;
        dx += joy.x;
        dz += joy.y;
        const comp = Math.hypot(dx, dz);
        if (comp > 1) { dx /= comp; dz /= comp; }
        return { dx, dz, mag: Math.min(1, comp), andando: comp > 0.12 };
    }

    function resolverColisoes() {
        for (const c of chunks.values()) {
            for (const o of c.obstaculos) {
                const dx = heroi.position.x - o.x;
                const dz = heroi.position.z - o.z;
                const d = Math.hypot(dx, dz);
                const min = o.r + 0.6;
                if (d < min && d > 0.0001) {
                    heroi.position.x = o.x + dx / d * min;
                    heroi.position.z = o.z + dz / d * min;
                }
            }
        }
    }

    function atualizarMovimento(delta) {
        const mov = movimentoAtual();
        const px0 = heroi.position.x, pz0 = heroi.position.z;
        const correndo = teclas.shift || (joy.ativo && mov.mag > 0.92);
        const vel = (correndo ? CFG.velCorrer : CFG.velAndar) * (estado.emAgua ? 0.6 : 1);

        if (mov.andando) {
            const direcaoFinal = Math.atan2(mov.dx, mov.dz) + anguloCamera;
            let dif = direcaoFinal - heroi.rotation.y;
            dif = Math.atan2(Math.sin(dif), Math.cos(dif));
            heroi.rotation.y += dif * Math.min(1, delta * 10);

            const controle = noAr ? 0.85 : 1;
            const v = vel * controle * (joy.ativo ? Math.max(0.4, mov.mag) : 1);
            heroi.position.x += Math.sin(direcaoFinal) * v * delta;
            heroi.position.z += Math.cos(direcaoFinal) * v * delta;
        }

        if (estado.dash > 0) {
            estado.dash -= delta;
            heroi.position.x += estado.dashX * 20 * delta;
            heroi.position.z += estado.dashZ * 20 * delta;
        }

        resolverColisoes();
        const hTerr = alturaTerreno(heroi.position.x, heroi.position.z);
        if (hTerr < NIVEL_AGUA - 2.4) { heroi.position.x = px0; heroi.position.z = pz0; }   // agua funda: nao entra
        estado.emAgua = hTerr < NIVEL_AGUA + 0.35;

        if (modeloCarregado && !atacando && !noAr) {
            if (mov.andando && correndo && acoes.run) tocarAnimacao("run");
            else if (mov.andando && acoes.walk) tocarAnimacao("walk");
            else if (!mov.andando && acoes.idle) tocarAnimacao("idle");
        }

        const chaoY = alturaTerreno(heroi.position.x, heroi.position.z);
        if (!noAr) heroi.position.y += (chaoY - heroi.position.y) * Math.min(1, delta * 14);
        if (noAr) {
            heroi.position.y += velocidadeVertical * delta;
            velocidadeVertical -= 18 * delta;
            if (heroi.position.y <= chaoY) {
                heroi.position.y = chaoY;
                noAr = false;
                velocidadeVertical = 0;
                pulosFeitos = 0;
                if (modeloCarregado && !atacando) finalizarAcao();
            }
        }
    }

    // ---------- 5.12 INIMIGOS, ITENS, EFEITOS ----------
    function mover(e, ux, uz, vel, delta) {
        const nx = e.grupo.position.x + ux * vel * delta, nz = e.grupo.position.z + uz * vel * delta;
        if (e.voa || alturaTerreno(nx, nz) > NIVEL_AGUA - 1.0) { e.grupo.position.x = nx; e.grupo.position.z = nz; }
    }

    function iaHostil(e, dx, dz, d, delta, tempo) {
        if (d > (e.boss ? 40 : 28)) {
            e.corpoPivo.rotation.y += Math.sin(tempo + e.fase) * delta;
            if (e.tAtq <= 0) tocarAnim(e, "idle");
            return;
        }
        e.corpoPivo.rotation.y = Math.atan2(dx, dz);
        const ux = dx / d, uz = dz / d;
        if (e.ranged) {
            if (d > 13) { mover(e, ux, uz, e.vel, delta); if (e.tAtq <= 0) tocarAnim(e, "walk"); }
            else if (d < 7) { mover(e, -ux, -uz, e.vel * 0.8, delta); if (e.tAtq <= 0) tocarAnim(e, "walk"); }
            else if (e.recarga <= 0) { e.recarga = 2.2; lancarProjetil(e); }
            else if (e.tAtq <= 0) tocarAnim(e, "idle");
            return;
        }
        if (d > e.alcance) {
            mover(e, ux, uz, e.vel, delta);
            if (e.tAtq <= 0) tocarAnim(e, "walk");
        } else if (e.recarga <= 0) {
            e.recarga = 1.1;
            danoNoHeroi(e.dano);
            if (e.acoes && e.acoes.attack) { e.tAtq = 0.7; e.anim = null; tocarAnim(e, "attack", true); }
        } else if (e.tAtq <= 0) {
            tocarAnim(e, "idle");
        }
    }

    function iaBicho(e, dx, dz, d, delta, tempo) {
        if (e.passaro) {
            const gx = e.homeX - e.grupo.position.x, gz = e.homeZ - e.grupo.position.z;
            if (Math.hypot(gx, gz) > 45) {
                let dif = Math.atan2(gx, gz) - e.rumo;
                dif = Math.atan2(Math.sin(dif), Math.cos(dif));
                e.rumo += dif * Math.min(1, delta * 1.5);
            } else {
                e.rumo += Math.sin(tempo * 0.4 + e.fase) * delta * 0.8;
            }
            e.grupo.position.x += Math.sin(e.rumo) * e.vel * delta;
            e.grupo.position.z += Math.cos(e.rumo) * e.vel * delta;
            e.corpoPivo.rotation.y = e.rumo;
            tocarAnim(e, "walk");
            return;
        }
        if (d < e.medo || e.assustado > 0) {
            e.assustado -= delta;
            const ux = -dx / (d || 1), uz = -dz / (d || 1);
            mover(e, ux, uz, e.vel * 1.6, delta);
            e.corpoPivo.rotation.y = Math.atan2(ux, uz);
            tocarAnim(e, "walk");
            return;
        }
        e.espera -= delta;
        if (e.espera <= 0) {
            e.alvoX = e.homeX + (Math.random() - 0.5) * 28;
            e.alvoZ = e.homeZ + (Math.random() - 0.5) * 28;
            e.espera = 3 + Math.random() * 6;
        }
        const ax = e.alvoX - e.grupo.position.x, az = e.alvoZ - e.grupo.position.z, ad = Math.hypot(ax, az);
        if (ad > 0.5) {
            mover(e, ax / ad, az / ad, e.vel * 0.45, delta);
            e.corpoPivo.rotation.y = Math.atan2(ax, az);
            tocarAnim(e, "walk");
        } else {
            tocarAnim(e, "idle");
        }
    }

    function atualizarInimigos(delta, tempo) {
        for (let k = inimigos.length - 1; k >= 0; k--) {
            const e = inimigos[k];
            if (e.mixer) e.mixer.update(delta);
            const dx = heroi.position.x - e.grupo.position.x;
            const dz = heroi.position.z - e.grupo.position.z;
            const d = Math.hypot(dx, dz);
            if (d > CFG.raioDespawn) {
                if (e.ponto) e.ponto.vivo = false;
                removerInimigo(k);
                continue;
            }
            e.recarga -= delta;
            if (e.tAtq > 0) e.tAtq -= delta;
            const alvoY = (e.voa ? e.voa + Math.sin(tempo * 1.5 + e.fase) * 0.6 : 0) + (e.flutua ? e.flutua + Math.sin(tempo * 2 + e.fase) * 0.15 : 0);
            e.corpoPivo.position.y += (alvoY - e.corpoPivo.position.y) * Math.min(1, delta * 4);
            if (e.passivo) iaBicho(e, dx, dz, d, delta, tempo);
            else iaHostil(e, dx, dz, d, delta, tempo);
            e.barra.quaternion.copy(camera.quaternion);
            e.grupo.position.y = alturaTerreno(e.grupo.position.x, e.grupo.position.z);
        }
    }

    // ---------- MINIMAPA ----------
    const mapaCv = document.createElement("canvas");
    mapaCv.width = mapaCv.height = 150;
    mapaCv.style.cssText = "position:absolute;right:12px;top:12px;width:150px;height:150px;border-radius:50%;" +
        "border:2px solid rgba(255,220,150,.75);background:rgba(10,14,30,.55);z-index:14;pointer-events:none";
    areaJogo.appendChild(mapaCv);
    const mapaCtx = mapaCv.getContext("2d");
    function desenharMinimapa() {
        const esc = 0.34, cel = 40, hx = heroi.position.x, hz = heroi.position.z;
        mapaCtx.clearRect(0, 0, 150, 150);
        mapaCtx.save();
        mapaCtx.beginPath();
        mapaCtx.arc(75, 75, 73, 0, 6.283);
        mapaCtx.clip();
        const gx0 = Math.floor(hx / cel) * cel, gz0 = Math.floor(hz / cel) * cel;
        for (let gx = -6; gx <= 6; gx++) {
            for (let gz = -6; gz <= 6; gz++) {
                const wx = gx0 + gx * cel, wz = gz0 + gz * cel;
                const b = biomaNoPonto(wx + cel / 2, wz + cel / 2);
                const h = alturaTerreno(wx + cel / 2, wz + cel / 2);
                mapaCtx.fillStyle = h < NIVEL_AGUA ? "#2a6a9a" : "#" + b.terreno.toString(16).padStart(6, "0");
                mapaCtx.fillRect(75 + (wx - hx) * esc, 75 + (wz - hz) * esc, cel * esc + 1, cel * esc + 1);
            }
        }
        // marcos (centro das regioes)
        const rx0 = Math.round((hx / L - 0.5) / RC), rz0 = Math.round((hz / L - 0.5) / RC);
        mapaCtx.fillStyle = "#ffd34d";
        for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
                const c = centroRegiao(rx0 + a, rz0 + b);
                mapaCtx.fillRect(75 + (c.x - hx) * esc - 3, 75 + (c.z - hz) * esc - 3, 6, 6);
            }
        }
        for (const e of inimigos) {
            mapaCtx.fillStyle = e.passivo ? "#7CFC9A" : (e.boss ? "#ff00ff" : "#ff3a3a");
            mapaCtx.fillRect(75 + (e.grupo.position.x - hx) * esc - 1.5, 75 + (e.grupo.position.z - hz) * esc - 1.5, 3, 3);
        }
        mapaCtx.translate(75, 75);
        mapaCtx.rotate(Math.atan2(Math.cos(heroi.rotation.y), Math.sin(heroi.rotation.y)));
        mapaCtx.fillStyle = "#ffffff";
        mapaCtx.strokeStyle = "#000";
        mapaCtx.beginPath();
        mapaCtx.moveTo(8, 0); mapaCtx.lineTo(-5, -5); mapaCtx.lineTo(-5, 5); mapaCtx.closePath();
        mapaCtx.fill(); mapaCtx.stroke();
        mapaCtx.restore();
    }

    function atualizarItens(delta, tempo) {
        for (let k = itens.length - 1; k >= 0; k--) {
            const it = itens[k];
            it.malha.rotation.y += delta * 2;
            it.malha.position.y = alturaTerreno(it.malha.position.x, it.malha.position.z) + 1 + Math.sin(tempo * 2 + it.fase) * 0.2;
            const d = Math.hypot(it.malha.position.x - heroi.position.x, it.malha.position.z - heroi.position.z);
            if (d > 1.6) continue;

            if (it.tipo === "vida") {
                personagem.hp = Math.min(personagem.hpMax, personagem.hp + 30);
                msg("❤️ Poção de vida: +30");
            } else if (it.tipo === "mana") {
                personagem.mp = Math.min(personagem.mpMax, personagem.mp + 25);
                msg("🔮 Poção de mana: +25");
            } else {
                personagem.hpMax += 20;
                personagem.hp = personagem.hpMax;
                msg("✨ Artefato ancestral! Vida máxima +20", 4);
                efeitoAnel(heroi.position.x, heroi.position.z, 0xffd34d, 6, 0.8);
                personagem.inventario.push({ nome: "Artefato da Vida", quantidade: 1 });
            }
            cena.remove(it.malha);
            itens.splice(k, 1);
            atualizarInterface();
            salvarPersonagem();
        }
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

    // ---------- 5.13 CAMERA ----------
    function atualizarCamera() {
        const alvo = new THREE.Vector3(
            heroi.position.x - Math.sin(anguloCamera) * distanciaCamera,
            heroi.position.y + alturaCamera,
            heroi.position.z - Math.cos(anguloCamera) * distanciaCamera
        );
        camera.position.lerp(alvo, 0.12);
        camera.lookAt(heroi.position.x, heroi.position.y + 1.35, heroi.position.z);
    }

    // ---------- 5.14 INTERFACE ----------
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
    }
    atualizarInterface();

    // ---------- 5.15 FICHA ----------
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
                const info = [
                    ["Nome", personagem.nome],
                    ["Classe", personagem.classe],
                    ["Cenário atual", biomaDoChunk(Math.floor(-heroi.position.z / L)).nome],
                    ["Nível", personagem.nivel],
                    ["Ataque", personagem.ataque ?? personagem.forca ?? 0],
                    ["Defesa", personagem.defesa ?? 0],
                    ["Agilidade", personagem.agilidade ?? 0],
                    ["Vida", `${Math.round(personagem.hp)}/${personagem.hpMax}`],
                    ["Mana", `${Math.round(personagem.mp)}/${personagem.mpMax}`],
                    ["Experiência", personagem.xp],
                    ["Ouro", personagem.ouro],
                    ["Recorde de distância", Math.round(personagem.recorde) + " m"]
                ];
                info.forEach(([t, v]) => {
                    const p = document.createElement("p");
                    p.textContent = `${t}: ${v}`;
                    dados.appendChild(p);
                });
            }

            const inv = document.getElementById("inventarioFicha");
            if (inv) {
                inv.replaceChildren();
                if (personagem.inventario.length > 0) {
                    personagem.inventario.forEach(item => {
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

    // ---------- 5.16 SALVAR ----------
    function salvarPersonagem() {
        try {
            localStorage.setItem("rpg_personagem", JSON.stringify(personagem));
        } catch (erro) {
            console.error("Erro ao salvar personagem:", erro);
        }
    }
    salvarPersonagem();

    // ---------- 5.17 REDIMENSIONAR (a area do jogo ocupa toda a tela abaixo do cabecalho) ----------
    function ajustarArea() {
        if (getComputedStyle(areaJogo).position === "static") areaJogo.style.position = "relative";
        const h = Math.max(420, window.innerHeight - areaJogo.getBoundingClientRect().top);
        areaJogo.style.height = h + "px";
        areaJogo.style.minHeight = h + "px";
        areaJogo.style.overflow = "hidden";
    }
    function redimensionar() {
        ajustarArea();
        const w = Math.max(1, areaJogo.clientWidth);
        const h = Math.max(1, areaJogo.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderizador.setSize(w, h, false);
        renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    }
    window.addEventListener("resize", redimensionar);
    window.addEventListener("load", redimensionar);
    redimensionar();
    setTimeout(redimensionar, 300);
    setTimeout(redimensionar, 1200);

    // ---------- 5.18 LOOP PRINCIPAL ----------
    const relogio = new THREE.Clock();
    const corAlvo = new THREE.Color();

    function animar() {
        requestAnimationFrame(animar);

        const delta = Math.min(relogio.getDelta(), 0.05);
        const tempo = relogio.elapsedTime;

        if (mixer) mixer.update(delta);

        // temporizadores
        estado.recargaAtaque = Math.max(0, estado.recargaAtaque - delta);
        estado.recargaMagia = Math.max(0, estado.recargaMagia - delta);
        estado.recargaDash = Math.max(0, estado.recargaDash - delta);
        estado.invulneravel = Math.max(0, estado.invulneravel - delta);
        estado.escudo = Math.max(0, estado.escudo - delta);
        escudoMalha.visible = estado.escudo > 0;
        if (msgTimer > 0) {
            msgTimer -= delta;
            if (msgTimer <= 0 && mensagemEl) mensagemEl.textContent = "Explore o mundo aberto!";
        }
        if (atacando && !acoes.swordswing) tempoAcao = 0;
        if (atacando) {
            tempoAcao -= delta;
            if (tempoAcao <= 0) finalizarAcao();
        }

        // regeneracao leve de mana
        if (personagem.mp < personagem.mpMax) {
            personagem.mp = Math.min(personagem.mpMax, personagem.mp + 1.5 * delta);
        }

        atualizarMovimento(delta);
        atualizarChunks();
        atualizarSpawns(delta);
        atualizarInimigos(delta, tempo);
        atualizarProjeteis(delta);
        atualizarItens(delta, tempo);
        atualizarEfeitos(delta);
        uTempo.value = tempo;
        atualizarParticulas(delta, tempo);
        atualizarAgua(tempo);
        atualizarNuvens(delta);

        // luz acompanha o heroi
        luzSol.position.set(heroi.position.x + 30, 55, heroi.position.z - 20);
        luzSol.target.position.copy(heroi.position);

        // transicao suave entre cenarios
        const bioma = biomaNoPonto(heroi.position.x, heroi.position.z);
        atualizarCeu(bioma, delta);
        if (bioma.nome !== estado.biomaAtual) {
            const primeira = estado.biomaAtual === -1;
            estado.biomaAtual = bioma.nome;
            atualizarAmbiente(bioma);
            if (!primeira) msg("🗺️ Entrando em: " + bioma.nome, 4);
        }

        // distancia e perigo
        const distancia = Math.hypot(heroi.position.x, heroi.position.z);
        if (distancia > estado.distanciaMax) estado.distanciaMax = distancia;
        if (distancia > personagem.recorde) personagem.recorde = distancia;
        if (distEl) distEl.textContent = "📍 " + Math.round(distancia) + " m — " + bioma.nome + " — perigo " + difEm(heroi.position.x, heroi.position.z);

        estado.tMapa = (estado.tMapa || 0) - delta;
        if (estado.tMapa <= 0) { estado.tMapa = 0.2; desenharMinimapa(); }

        // interface e salvamento periodicos
        estado.salvar += delta;
        if (estado.salvar > 3) {
            estado.salvar = 0;
            atualizarInterface();
            salvarPersonagem();
        }

        atualizarCamera();
        ceu.position.copy(camera.position);
        renderizador.render(cena, camera);
    }

    msg("🌍 Mundo aberto! Explore em qualquer direção. Ataque com J, magia com K.", 8);
    animar();
    console.log("REINOS EM GUERRA v2 iniciado — herói:", personagem.nome, "| classe:", classeId);
}
