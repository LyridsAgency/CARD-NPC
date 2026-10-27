// Carte ECRU en 3D — source. Construit vers assets/ecru-carte-3d.js par tools/build.mjs.
// Export : mount(el) — monte la scène dans un élément [data-ecru-carte].
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Shape,
  ExtrudeGeometry,
  ShapeGeometry,
  PlaneGeometry,
  Mesh,
  Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  SRGBColorSpace,
  NoColorSpace,
  PMREMGenerator,
  ACESFilmicToneMapping,
  DirectionalLight,
  Color,
  BoxGeometry,
  BackSide,
  DoubleSide,
} from 'three';

// Dimensions réelles (cm) : 85,6 × 54 mm, rayon ISO 3,18 mm. Épaisseur légèrement accentuée pour la lire.
const W = 8.56;
const H = 5.4;
const R = 0.318;
const T = 0.11;
const BEVEL = 0.014;
const FIT = 0.74; // largeur max de la carte en fraction de la scène
const FIT_H = 0.52; // hauteur max de la carte en fraction de la scène

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
}

function faceGeometry() {
  const g = new ShapeGeometry(roundedRect(W, H, R), 12);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + H / 2) / H);
  }
  return g;
}

function hexToRgb(hex) {
  const c = new Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

// Bruit reproductible (grain de la matière identique d'une visite à l'autre)
function prng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Dessine le texte lettre par lettre (letterSpacing n'est pas partout supporté)
function drawSpaced(ctx, text, cx, cy, size, tracking, align = 'center') {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * size * (chars.length - 1);
  let x = align === 'left' ? cx : align === 'right' ? cx - total : cx - total / 2;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, cy);
    x += widths[i] + tracking * size;
  });
  return total;
}

function fitFontSize(ctx, text, family, maxW, maxH, tracking) {
  ctx.font = `100px "${family}", sans-serif`;
  const chars = [...text];
  const w = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + tracking * 100 * (chars.length - 1);
  return Math.min((maxW / w) * 100, maxH);
}

// Construit les cartes de texture d'une face.
// drawMask(ctx, w, h) dessine en blanc ce qui est en relief (texte, symbole).
// drawEngrave(ctx, w, h), facultatif : gravure fine dans la matière (relief seul, sans couleur).
// brushed : stries de brossage (aluminium) ; sinon métal poli (acier) ou matière mate (PVC).
function buildFace({ w, h, base, ink, seed, drawMask, drawEngrave, relief, metal, brushed, polish = 0.14 }) {
  const mask = canvas(w, h);
  const mctx = mask.getContext('2d');
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, w, h);
  mctx.fillStyle = '#fff';
  mctx.strokeStyle = '#fff';
  drawMask(mctx, w, h);

  // Épaulement doux du relief : même dessin, flouté par l'ombre portée
  const soft = canvas(w, h);
  const sctx = soft.getContext('2d');
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, w, h);
  sctx.shadowColor = '#fff';
  sctx.shadowBlur = Math.round(w / 420);
  sctx.drawImage(mask, 0, 0);

  const md = mctx.getImageData(0, 0, w, h).data;
  const sd = sctx.getImageData(0, 0, w, h).data;
  let ed = null;
  if (drawEngrave) {
    const eng = canvas(w, h);
    const ectx = eng.getContext('2d');
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, w, h);
    ectx.strokeStyle = '#fff';
    ectx.fillStyle = '#fff';
    drawEngrave(ectx, w, h);
    ed = ectx.getImageData(0, 0, w, h).data;
  }

  const color = canvas(w, h);
  const orm = canvas(w, h);
  const bump = canvas(w, h);
  const cImg = color.getContext('2d').createImageData(w, h);
  const oImg = orm.getContext('2d').createImageData(w, h);
  const bImg = bump.getContext('2d').createImageData(w, h);
  const cd = cImg.data;
  const od = oImg.data;
  const bd = bImg.data;

  const rand = prng(seed);
  // Grain à deux échelles : fin (pixel) + moyen (blocs 3×3)
  const gw = Math.ceil(w / 3);
  const gh = Math.ceil(h / 3);
  const coarse = new Float32Array(gw * gh);
  for (let i = 0; i < coarse.length; i++) coarse[i] = rand() - 0.5;

  // Brossé : stries horizontales (une valeur par ligne, lissée) + légère variation le long de la ligne
  const rows = new Float32Array(h);
  let acc = 0;
  for (let y = 0; y < h; y++) {
    acc = acc * 0.35 + (rand() - 0.5) * 0.8;
    rows[y] = acc;
  }
  const [br, bg, bb] = base;
  const [ir, ig, ib] = ink;
  for (let y = 0; y < h; y++) {
    const cy = ((y / 3) | 0) * gw;
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const m = md[i] / 255;
      const s = sd[i] / 255;
      const g = brushed
        ? row * 0.9 + (rand() - 0.5) * 0.25
        : metal
        ? (rand() - 0.5) * 0.12
        : (rand() - 0.5) * 0.6 + coarse[cy + ((x / 3) | 0)];
      const gb = 1 + g * (metal ? 0.035 : 0.1);
      // Couleur : matière mate grainée, encre métallique sur le relief
      cd[i] = br * gb * (1 - m) + ir * m;
      cd[i + 1] = bg * gb * (1 - m) + ig * m;
      cd[i + 2] = bb * gb * (1 - m) + ib * m;
      cd[i + 3] = 255;
      // G = rugosité, B = métal
      od[i] = 255;
      const rough = (brushed ? 0.3 : metal ? polish : 0.82) + g * (metal ? 0.035 : 0.1) - (ed ? (ed[i] / 255) * 0.12 : 0);
      od[i + 1] = rough * 255 * (1 - m) + (metal ? 0.22 : 0.36) * 255 * m;
      od[i + 2] = (metal ? 255 * (1 - m) + 0.8 * 255 * m : 255 * m * 0.62);
      od[i + 3] = 255;
      // Relief : grain + texte surélevé (ou gravé si relief < 0)
      const e = ed ? ed[i] / 255 : 0;
      const v = 128 + g * (metal ? 9 : 26) + relief * (s * 0.55 + m * 0.45) * 110 - e * 38;
      bd[i] = bd[i + 1] = bd[i + 2] = v;
      bd[i + 3] = 255;
    }
  }
  color.getContext('2d').putImageData(cImg, 0, 0);
  orm.getContext('2d').putImageData(oImg, 0, 0);
  bump.getContext('2d').putImageData(bImg, 0, 0);

  const map = new CanvasTexture(color);
  map.colorSpace = SRGBColorSpace;
  const ormTex = new CanvasTexture(orm);
  ormTex.colorSpace = NoColorSpace;
  const bumpTex = new CanvasTexture(bump);
  bumpTex.colorSpace = NoColorSpace;
  return { map, orm: ormTex, bump: bumpTex };
}

function faceMaterial(tex, anisotropy, metal, brushed) {
  [tex.map, tex.orm, tex.bump].forEach((t) => (t.anisotropy = anisotropy));
  return new MeshPhysicalMaterial({
    anisotropy: brushed ? 0.75 : 0,
    specularIntensity: metal ? 1 : 0.6,
    color: 0xffffff,
    map: tex.map,
    roughness: 1,
    roughnessMap: tex.orm,
    metalness: 1,
    metalnessMap: tex.orm,
    bumpMap: tex.bump,
    bumpScale: 1.4,
    clearcoat: brushed ? 0.35 : metal ? 0.6 : 0.12,
    clearcoatRoughness: brushed ? 0.3 : metal ? 0.12 : 0.55,
  });
}

function radialTexture(stops) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

// Symbole sans contact : quatre arcs. (x, y) = centre du symbole, unit = échelle.
function drawNfc(ctx, x, y, unit, alpha = 0.85) {
  ctx.save();
  ctx.lineWidth = unit * 0.9;
  ctx.lineCap = 'round';
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x - unit * 3.4, y, unit * (1.6 + i * 1.55), -0.62, 0.62);
    ctx.stroke();
  }
  ctx.restore();
}

// Guillochage : arcs concentriques très fins, partant d'un coin, comme sur un billet ou une montre
function drawGuilloche(ctx, w, h, cx, cy, from, to) {
  ctx.lineWidth = Math.max(1, w / 1500);
  for (let r = from; r < to; r += h * 0.021) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(r / (h * 0.09));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Studio photo virtuel : pièce sombre + boîtes à lumière en bandes.
// Ce sont leurs reflets qui glissent sur le métal quand la carte tourne.
function studioScene() {
  const s = new Scene();
  const room = new Mesh(new BoxGeometry(40, 24, 40), new MeshBasicMaterial({ color: 0x141413, side: BackSide }));
  s.add(room);
  const panel = (w, h, x, y, z, ry, rx, power) => {
    const m = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(power, power, power * 0.97), side: DoubleSide })
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    s.add(m);
  };
  // Grande boîte douce derrière la caméra : la face de la carte la reflète quand elle est de face
  panel(10, 6, 0, 4, 19.5, Math.PI, 0, 1.4);
  // Bandes verticales tout autour : à chaque angle de rotation, un reflet traverse le métal
  const powers = [4.2, 1.4, 3, 1.1, 3.6, 1.3, 2.4, 1.1];
  powers.forEach((pw, k) => {
    const a = (k * Math.PI) / 4 + 0.25;
    panel(1.3, 15, Math.sin(a) * 18.5, 1, Math.cos(a) * 18.5, a + Math.PI, 0, pw);
  });
  panel(30, 1.6, 0, 11.5, 4, 0, Math.PI / 2, 3); // bande au plafond (tranche haute)
  return s;
}

export async function mount(el) {
  if (el.__ecru) return el.__ecru;
  const stage = el.querySelector('[data-ecru-stage]');
  const fontUrl = el.dataset.font;
  const bodyUrl = el.dataset.fontBody;
  const family = 'Archivo Black';
  const bodyFamily = 'Inter';

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    el.classList.add('is-fallback');
    return null;
  }

  if (document.fonts) {
    await Promise.all(
      [
        [family, fontUrl, '400'],
        [bodyFamily, bodyUrl, '500'],
      ].map(async ([name, url, weight]) => {
        if (!url) return;
        try {
          document.fonts.add(await new FontFace(name, `url(${url})`, { weight }).load());
        } catch (e) {
          /* police système en secours */
        }
      })
    );
  }

  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 2 : 1.75));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  const cvs = renderer.domElement;
  cvs.className = 'ecru-carte__canvas';
  cvs.setAttribute('aria-hidden', 'true');
  stage.prepend(cvs);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studioScene(), 0.03).texture;
  scene.environmentIntensity = 0.62;
  pmrem.dispose();

  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, 2, -5);
  scene.add(rim);

  const camera = new PerspectiveCamera(26, 1, 0.1, 200);
  const ELEV = (8 * Math.PI) / 180;

  // ---- Carte
  const card = new Group();
  const pivot = new Group();
  pivot.add(card);
  scene.add(pivot);

  const depth = T - BEVEL * 2;
  const bodyGeo = new ExtrudeGeometry(roundedRect(W, H, R), {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 14,
  });
  bodyGeo.translate(0, 0, -depth / 2);
  const edgeMat = new MeshStandardMaterial({ roughness: 0.42, metalness: 0.35 });
  const body = new Mesh(bodyGeo, edgeMat);
  card.add(body);

  const faceGeo = faceGeometry();
  const zFace = depth / 2 + BEVEL + 0.0008;
  const front = new Mesh(faceGeo);
  front.position.z = zFace;
  const back = new Mesh(faceGeo);
  back.position.z = -zFace;
  back.rotation.y = Math.PI;
  card.add(front, back);

  // ---- Sol : halo crème très léger + ombre portée qui suit la rotation
  const FLOOR_Y = -H / 2 - 1.05;
  const glow = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({
      map: radialTexture([[0, 'rgba(233,228,216,0.10)'], [0.55, 'rgba(233,228,216,0.035)'], [1, 'rgba(233,228,216,0)']]),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = FLOOR_Y - 0.002;
  glow.scale.set(12, 5, 1);
  scene.add(glow);

  const shadowMat = new MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(0,0,0,0.85)'], [0.45, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const shadow = new Mesh(new PlaneGeometry(1, 1), shadowMat);
  shadow.rotation.order = 'YXZ';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = FLOOR_Y;
  scene.add(shadow);

  // ---- Textures (réglables : texte, couleur de carte, couleur du relief)
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const texW = small ? 1280 : 2048;
  const texH = Math.round((texW * H) / W);
  let current = {};

  function applyLook({ text, holder, tier, color, ink, finish }) {
    text = (text || 'ECRU').toUpperCase().slice(0, 18);
    holder = (holder || '').toUpperCase().slice(0, 26);
    tier = (tier || '').toUpperCase().slice(0, 18);
    // finish : 'mat' (PVC) ou 'metal' (métal lisse). 'brosse' reste disponible pour un métal brossé.
    const metal = finish !== 'mat';
    const brushed = finish === 'brosse';
    const cardColor = new Color(color || '#0d0d0c');
    const dark = cardColor.getHSL({}).l < 0.35;
    // Un métal noir pur ne refléterait rien : on remonte l'albédo vers un gris acier très sombre
    // Métal clair : satiné argenté plutôt que miroir
    const polish = dark ? 0.14 : 0.3;
    const base = metal
      ? hexToRgb(`#${cardColor.clone().lerp(new Color(dark ? '#6b6a66' : '#d2d1cd'), dark ? 0.5 : 0.55).getHexString()}`)
      : hexToRgb(color || '#0d0d0c');
    const inkRgb = hexToRgb(ink || '#e9e4d8');
    [front.material, back.material].forEach((m) => {
      if (m && m.map) {
        m.map.dispose();
        m.roughnessMap.dispose();
        m.bumpMap.dispose();
        m.dispose();
      }
    });
    const small = (ctx, txt, size, x, y, tracking, align, weight = 500) => {
      ctx.font = `${weight} ${size}px "${bodyFamily}", sans-serif`;
      drawSpaced(ctx, txt, x, y, size, tracking, align);
    };
    const frontTex = buildFace({
      w: texW,
      h: texH,
      base,
      ink: inkRgb,
      seed: 7,
      relief: 1,
      metal,
      brushed,
      polish,
      drawMask(ctx, w, h) {
        const m = w * 0.068;
        ctx.textBaseline = 'middle';
        // Marque en haut à gauche, petite et très espacée
        const size = Math.min(h * 0.082, fitFontSize(ctx, text, family, w * 0.5, h * 0.082, 0.16));
        ctx.font = `${size}px "${family}", sans-serif`;
        drawSpaced(ctx, text, m, m + size * 0.5, size, 0.16, 'left');
        // Sans contact, en haut à droite
        drawNfc(ctx, w - m - h * 0.018, m + size * 0.5, h * 0.016, 0.9);
        // Titulaire et niveau, en bas
        if (holder) {
          small(ctx, 'MEMBRE', h * 0.03, m, h - m - h * 0.105, 0.32, 'left');
          small(ctx, holder, h * 0.05, m, h - m - h * 0.035, 0.14, 'left');
        }
        if (tier) small(ctx, tier, h * 0.034, w - m, h - m - h * 0.035, 0.32, 'right');
      },
      drawEngrave(ctx, w, h) {
        drawGuilloche(ctx, w, h, w * 1.02, h * 1.12, h * 0.34, h * 1.05);
      },
    });
    const backTex = buildFace({
      w: texW,
      h: texH,
      base,
      ink: inkRgb.map((v, i) => v * 0.55 + base[i] * 0.45),
      seed: 11,
      relief: -0.8,
      metal,
      brushed,
      polish,
      drawMask(ctx, w, h) {
        ctx.textBaseline = 'middle';
        drawNfc(ctx, w / 2 + h * 0.03, h * 0.43, h * 0.032, 0.8);
        small(ctx, 'APPROCHEZ VOTRE TÉLÉPHONE', h * 0.03, w / 2, h * 0.64, 0.3, 'center');
        const m = w * 0.068;
        ctx.font = `${h * 0.04}px "${family}", sans-serif`;
        drawSpaced(ctx, text, m, h - m - h * 0.02, h * 0.04, 0.16, 'left');
      },
      drawEngrave(ctx, w, h) {
        // Filet gravé à l'intérieur du bord
        const i = w * 0.03;
        ctx.lineWidth = Math.max(1, w / 1400);
        ctx.beginPath();
        ctx.roundRect(i, i, w - i * 2, h - i * 2, h * 0.04);
        ctx.stroke();
      },
    });
    front.material = faceMaterial(frontTex, anisotropy, metal, brushed);
    back.material = faceMaterial(backTex, anisotropy, metal, brushed);
    // Tranche : métal poli plus clair, qui accroche la lumière
    const edge = cardColor.clone().lerp(new Color('#8d8b85'), metal ? (dark ? 0.55 : 0.2) : 0.12);
    edgeMat.color.copy(edge);
    edgeMat.metalness = metal ? 1 : 0.35;
    edgeMat.roughness = brushed ? 0.22 : metal ? 0.1 : 0.42;
    scene.environmentIntensity = metal ? 1.15 : 1;
    current = { text, holder, tier, color, ink, finish };
  }

  const d = el.dataset;
  applyLook({ text: d.text, holder: d.holder, tier: d.tier, color: d.color, ink: d.ink, finish: d.finish });

  // ---- Cadrage : la carte occupe toujours la même part de la scène (cohérent avec l'image de secours)
  let sw = 1;
  let sh = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    sw = Math.max(1, r.width);
    sh = Math.max(1, r.height);
    renderer.setSize(sw, sh, false);
    camera.aspect = sw / sh;
    const fracW = Math.min(FIT, ((FIT_H * sh) / sw) * (W / H));
    const visibleW = W / fracW;
    const dist = visibleW / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    el.style.setProperty('--ecru-card-w', `${fracW * 100}%`);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  // ---- Mouvement
  const state = {
    yaw: reduceMotion() ? -0.32 : 0.35,
    pitch: 0,
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
    hover: false,
    gyro: false,
  };
  const SPIN = 0.2; // rad/s : un tour en ~31 s

  const onMove = (e) => {
    if (e.pointerType === 'touch' && state.gyro) return;
    const r = stage.getBoundingClientRect();
    state.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    state.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const onEnter = (e) => {
    if (e.pointerType === 'mouse') state.hover = true;
  };
  const onLeave = () => {
    state.hover = false;
    state.tx = 0;
    state.ty = 0;
  };
  stage.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerenter', onEnter);
  stage.addEventListener('pointerleave', onLeave);

  // Inclinaison du téléphone. iOS exige une autorisation après un geste.
  const onOrient = (e) => {
    if (e.gamma == null) return;
    state.gyro = true;
    state.tx = Math.max(-1, Math.min(1, e.gamma / 30));
    state.ty = Math.max(-1, Math.min(1, ((e.beta || 45) - 45) / 30));
  };
  const enableGyro = () => {
    const D = window.DeviceOrientationEvent;
    if (!D) return;
    if (typeof D.requestPermission === 'function') {
      D.requestPermission()
        .then((p) => p === 'granted' && window.addEventListener('deviceorientation', onOrient, { passive: true }))
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientation', onOrient, { passive: true });
    }
  };
  if (window.matchMedia('(pointer: coarse)').matches) {
    if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
      el.addEventListener('click', enableGyro, { once: true });
    } else {
      enableGyro();
    }
  }

  el.addEventListener('ecru:card-update', (e) => applyLook({ ...current, ...(e.detail || {}) }));
  el.addEventListener('ecru:avantages', (e) => (state.hover = !!e.detail));

  let visible = true;
  let last = performance.now();
  let raf = 0;
  let t = 0;

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    const still = reduceMotion();
    const k = 1 - Math.exp(-dt * (still ? 8 : 2.6));

    state.px += (state.tx - state.px) * k;
    state.py += (state.ty - state.py) * k;

    if (state.hover) {
      // Au survol : la carte se pose de face pour lire les avantages
      const target = Math.round(state.yaw / (Math.PI * 2)) * Math.PI * 2;
      state.yaw += (target - state.yaw) * (1 - Math.exp(-dt * 2.2));
    } else if (!still) {
      state.yaw += SPIN * dt;
    }

    const sway = still ? 0 : Math.sin(t * 0.45) * 0.05;
    pivot.rotation.order = 'YXZ';
    pivot.rotation.y = state.yaw + state.px * 0.55;
    pivot.rotation.x = -0.05 + state.py * 0.32 + sway;
    pivot.position.y = still ? 0 : Math.sin(t * 0.7) * 0.07;

    // L'ombre est la projection de la tranche au sol : elle tourne avec la carte
    const lift = pivot.position.y;
    shadow.rotation.y = pivot.rotation.y;
    shadow.scale.set(W * 1.12, 1.25 + Math.abs(Math.sin(pivot.rotation.x)) * 2.5, 1);
    shadowMat.opacity = 0.75 - lift * 1.2;

    renderer.render(scene, camera);
    if (!el.classList.contains('is-ready')) el.classList.add('is-ready');
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  const start = () => {
    if (!raf && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    start();
  });
  io.observe(el);
  document.addEventListener('visibilitychange', start);

  cvs.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    el.classList.remove('is-ready');
    el.classList.add('is-fallback');
  });

  start();
  el.__ecru = {
    update: (look) => applyLook({ ...current, ...look }),
    renderer,
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      renderer.dispose();
      cvs.remove();
      el.__ecru = null;
    },
  };
  return el.__ecru;
}
