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
// drawInlay(ctx, w, h), facultatif : fenêtre NFC (zone non métallique, mate, en léger creux).
function buildFace({ w, h, base, ink, seed, drawMask, drawEngrave, drawInlay, relief, metal, brushed, polish = 0.14, metalAmt = 1, inlayShade = 0.38 }) {
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

  let nd = null;
  let ng = null;
  if (drawInlay) {
    const inl = canvas(w, h);
    const ictx = inl.getContext('2d');
    ictx.fillStyle = '#000';
    ictx.fillRect(0, 0, w, h);
    ictx.fillStyle = '#fff';
    drawInlay(ictx, w, h);
    nd = ictx.getImageData(0, 0, w, h).data;
    // Joint : contour fin de la fenêtre, pour le relief
    const joint = canvas(w, h);
    const jctx = joint.getContext('2d');
    jctx.fillStyle = '#000';
    jctx.fillRect(0, 0, w, h);
    jctx.filter = `blur(${Math.max(1, w / 900)}px)`;
    jctx.drawImage(inl, 0, 0);
    ng = jctx.getImageData(0, 0, w, h).data;
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
      const n = nd ? nd[i] / 255 : 0;
      const gb = (1 + g * (metal ? 0.035 : 0.1)) * (1 - n * (metal ? inlayShade : 0.08));
      // Couleur : matière grainée (fenêtre NFC un peu plus sombre), encre sur le relief
      cd[i] = br * gb * (1 - m) + ir * m;
      cd[i + 1] = bg * gb * (1 - m) + ig * m;
      cd[i + 2] = bb * gb * (1 - m) + ib * m;
      cd[i + 3] = 255;
      // G = rugosité, B = métal
      od[i] = 255;
      let rough = (brushed ? 0.3 : metal ? polish : 0.82) + g * (metal ? 0.035 : 0.1) - (ed ? (ed[i] / 255) * 0.12 : 0);
      rough = rough * (1 - n) + 0.62 * n;
      od[i + 1] = rough * 255 * (1 - m) + (metal ? 0.3 : 0.4) * 255 * m;
      od[i + 2] = metal ? 255 * metalAmt * (1 - m) * (1 - n) + 0.75 * 255 * m : 255 * m * 0.55;
      od[i + 3] = 255;
      // Relief : grain + texte surélevé (ou gravé si relief < 0)
      const e = ed ? ed[i] / 255 : 0;
      const joint = ng ? Math.min(1, Math.abs(ng[i] / 255 - n) * 4) : 0;
      const v = 128 + g * (metal ? 9 : 26) + relief * (s * 0.55 + m * 0.45) * 110 - e * 38 - n * 10 - joint * 26;
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
    clearcoat: brushed ? 0.35 : metal ? 0.08 : 0.1,
    clearcoatRoughness: brushed ? 0.3 : 0.5,
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
  const room = new Mesh(new BoxGeometry(40, 24, 40), new MeshBasicMaterial({ color: 0x1e1e1c, side: BackSide }));
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

// Logo du client → masque blanc (imprimé dans la couleur du relief).
// PNG/SVG transparents : on suit la transparence ; JPG : les zones sombres forment le logo.
function logoMask(img, maxW, maxH) {
  const ratio = Math.min(maxW / img.width, maxH / img.height);
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h);
  const px = d.data;
  let transparent = false;
  for (let i = 3; i < px.length; i += 16) {
    if (px[i] < 240) {
      transparent = true;
      break;
    }
  }
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) / 255;
    const a = transparent ? px[i + 3] / 255 : Math.max(0, Math.min(1, (0.85 - lum) / 0.6));
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = a * 255;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

const logos = new Map();
function loadLogo(url) {
  if (!logos.has(url)) {
    logos.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      })
    );
  }
  return logos.get(url);
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

  const key = new DirectionalLight(0xffffff, 1.7);
  key.position.set(4, 6, 8);
  scene.add(key);
  // Lumière d'appoint à gauche : le recto reste lisible quand la carte se tourne
  const fill = new DirectionalLight(0xfffaf2, 1.2);
  fill.position.set(-7, 3, 7);
  scene.add(fill);
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

  let lookId = 0;
  async function applyLook(look) {
    const id = ++lookId;
    // Les logos se chargent avant de redessiner ; seule la dernière demande est appliquée
    const images = new Map();
    const urls = (look.elements || []).filter((e) => e.t === 'logo' && e.u).map((e) => e.u);
    for (const u of urls) {
      const img = await loadLogo(u);
      if (img) images.set(u, img);
    }
    if (id !== lookId) return;
    drawLook(look, images);
  }

  // Éléments posés sur le recto, en coordonnées 0 à 1 (centre de l'élément) :
  //   { t: 'text', v: 'Texte', x, y, s: taille (part de la hauteur), f: 'display' | 'body', a: 'left' | 'center' | 'right' }
  //   { t: 'logo', u: url, x, y, s: hauteur (part de la hauteur) }
  function drawLook({ color, ink, finish, elements, inlay }, images) {
    elements = Array.isArray(elements) ? elements : [];
    // finish : 'mat' (PVC) ou 'metal' (métal satiné). 'brosse' reste disponible pour un métal brossé.
    const metal = finish !== 'mat';
    const brushed = finish === 'brosse';
    const cardColor = new Color(color || '#0d0d0c');
    const hsl = cardColor.getHSL({});
    const dark = hsl.l < 0.35;
    const neutre = hsl.s < 0.18;
    // Métal satiné, comme les cartes réelles : ni miroir, ni brossé
    const polish = dark ? 0.4 : 0.44;
    let metalBase;
    // Métal sombre : revêtement anodisé/laqué satiné (réagit à la lumière comme une peinture)
    const revetu = neutre && dark;
    const metalAmt = revetu ? 0.18 : 1;
    if (neutre) {
      metalBase = cardColor.clone().lerp(new Color(dark ? '#3a3936' : '#d2d1cd'), dark ? 0.38 : 0.55);
    } else {
      metalBase = cardColor.clone().setHSL(hsl.h, Math.min(1, hsl.s * 0.9), Math.max(hsl.l, 0.26)).lerp(new Color('#8d8b85'), 0.12);
    }
    // PVC mat : une teinte foncée paraîtrait noire, on l'éclaircit légèrement
    const matBase = neutre
      ? dark
        ? cardColor.clone().lerp(new Color('#3a3936'), 0.45)
        : cardColor
      : cardColor.clone().setHSL(hsl.h, hsl.s, Math.max(hsl.l, 0.3));
    const base = hexToRgb(`#${(metal ? metalBase : matBase).getHexString()}`);
    const inkRgb = hexToRgb(ink || (cardColor.getHSL({}).l > 0.6 ? '#121211' : '#e9e4d8'));
    [front.material, back.material].forEach((m) => {
      if (m && m.map) {
        m.map.dispose();
        m.roughnessMap.dispose();
        m.bumpMap.dispose();
        m.dispose();
      }
    });
    const frontTex = buildFace({
      w: texW,
      h: texH,
      base,
      ink: inkRgb,
      seed: 7,
      relief: 0.7,
      metal,
      brushed,
      polish,
      metalAmt,
      inlayShade: dark ? 0.38 : 0.1,
      drawMask(ctx, w, h) {
        ctx.textBaseline = 'middle';
        elements.forEach((el) => {
          const x = (el.x ?? 0.5) * w;
          const y = (el.y ?? 0.5) * h;
          const size = Math.max(0.02, el.s || 0.08) * h;
          if (el.t === 'logo') {
            const img = images.get(el.u);
            if (!img) return;
            const lm = logoMask(img, w * 0.9, size);
            ctx.drawImage(lm, x - lm.width / 2, y - lm.height / 2);
          } else if (el.v) {
            const txt = String(el.v).slice(0, 40);
            const display = el.f !== 'body';
            ctx.font = display ? `${size}px "${family}", sans-serif` : `500 ${size}px "${bodyFamily}", sans-serif`;
            const align = el.a || 'center';
            drawSpaced(ctx, display ? txt.toUpperCase() : txt, x, y, size, display ? 0.12 : 0.04, align);
          }
        });
      },
      // Fenêtre NFC : le carré par lequel passe le signal, comme sur les cartes métal réelles
      drawInlay:
        inlay === 'aucune'
          ? null
          : (ctx, w, h) => {
              ctx.beginPath();
              ctx.roundRect(w * 0.072, h * 0.12, h * 0.4, h * 0.4, h * 0.03);
              ctx.fill();
            },
    });
    const backTex = buildFace({
      w: texW,
      h: texH,
      base,
      ink: inkRgb.map((v, i) => v * 0.7 + base[i] * 0.3),
      seed: 11,
      relief: 0.4,
      metal,
      brushed,
      polish,
      metalAmt,
      drawMask(ctx, w, h) {
        // Verso : le symbole sans contact, discret, en haut à droite
        drawNfc(ctx, w - w * 0.1, h * 0.19, h * 0.019, 0.85);
      },
    });
    front.material = faceMaterial(frontTex, anisotropy, metal, brushed);
    back.material = faceMaterial(backTex, anisotropy, metal, brushed);
    // Tranche : métal poli plus clair, qui accroche la lumière
    const edge = cardColor.clone().lerp(new Color('#8d8b85'), metal ? (dark ? 0.55 : 0.2) : 0.12);
    edgeMat.color.copy(edge);
    edgeMat.metalness = metal ? 1 : 0.35;
    edgeMat.roughness = brushed ? 0.22 : metal ? 0.3 : 0.42;
    scene.environmentIntensity = metal ? 1.9 : 1.35;
    current = { color, ink, finish, elements, inlay };
  }

  const d = el.dataset;
  let elementsDepart = [];
  try {
    elementsDepart = JSON.parse(d.elements || '[]');
  } catch (e) {
    elementsDepart = [];
  }
  applyLook({ color: d.color, ink: d.ink, finish: d.finish, elements: elementsDepart, inlay: d.inlay });

  // ---- Cadrage : la carte occupe toujours la même part de la scène (cohérent avec l'image de secours)
  // Pose fixe (images, vues) : data-pose="angle,inclinaison,zoom"
  const poseBrute = (el.dataset.pose || '').split(',').map(Number);
  const pose = {
    fixe: poseBrute.length >= 2 && poseBrute.every((n) => !Number.isNaN(n)),
    yaw: poseBrute[0] || 0,
    pitch: poseBrute[1] || 0,
    zoom: poseBrute[2] || 1,
  };
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
    const dist = visibleW / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect) / pose.zoom;
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
    presentUntil: 0,
    view: null,
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

  el.addEventListener('ecru:card-update', (e) => {
    const detail = e.detail || {};
    // Après un choix, la carte se présente de face quelques secondes pour montrer le changement
    if (detail.present) state.presentUntil = t + 4;
    applyLook({ ...current, ...detail });
  });
  el.addEventListener('ecru:avantages', (e) => (state.hover = !!e.detail));
  // Points de vue : recto, verso, profil ; 'auto' relance la rotation
  const VUES = { recto: 0, verso: Math.PI, profil: 1.25 };
  el.addEventListener('ecru:view', (e) => {
    const v = e.detail && e.detail.view;
    state.view = v in VUES ? VUES[v] : null;
  });

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

    if (state.view !== null) {
      // Vue choisie : on rejoint l'angle le plus proche équivalent
      const tour = Math.PI * 2;
      const target = state.view + Math.round((state.yaw - state.view) / tour) * tour;
      state.yaw += (target - state.yaw) * (1 - Math.exp(-dt * 2.6));
    } else if (state.hover || t < state.presentUntil) {
      // Au survol : la carte se pose de face pour lire les avantages
      const target = Math.round(state.yaw / (Math.PI * 2)) * Math.PI * 2;
      state.yaw += (target - state.yaw) * (1 - Math.exp(-dt * 2.2));
    } else if (!still) {
      state.yaw += SPIN * dt;
    }

    if (pose.fixe) {
      state.yaw = pose.yaw;
      state.px = state.py = 0;
    }
    const sway = still || pose.fixe ? 0 : Math.sin(t * 0.45) * 0.05;
    pivot.rotation.order = 'YXZ';
    pivot.rotation.y = state.yaw + state.px * 0.55;
    pivot.rotation.x = -0.05 + (pose.fixe ? pose.pitch : 0) + state.py * 0.32 + sway;
    pivot.position.y = still || pose.fixe ? 0 : Math.sin(t * 0.7) * 0.07;

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
