import { ScratchVm } from "./engine/runtime-vm.js";
import { createOpcodeRegistry } from "./engine/opcode-registry.js";
import { createProjectModelFromState, hydrateStateFromProjectModel, ensureProjectModelShape } from "./engine/project-model.js";
import { importSb3ToProjectModel, exportProjectModelToSb3 } from "./engine/sb3-adapter.js";

const OPERATORS = ["===", "!==", ">", "<", ">=", "<="];

const STAGE_BOUNDS = {
  width: 480,
  height: 360,
  maxX: 240,
  maxY: 180,
};

const WORKSPACE_CANVAS = {
  minHeight: 620,
  compactMinHeight: 420,
  defaultX: 16,
  defaultY: 16,
  minX: 8,
  minY: 8,
  columnWidth: 360,
  columnGap: 26,
  rowHeight: 180,
  rowGap: 22,
};

const WORKSPACE_SNAP = {
  distance: 26,
  xTolerance: 74,
  gap: 6,
  xWeight: 0.45,
};

const BLOCK_CATALOG = [
  {
    type: "whenStart",
    name: "Bayrak Tiklaninca",
    description: "Icindeki bloklar proje calisinca tetiklenir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "whenKeyPressed",
    name: "Tusa Basilinca",
    description: "Secilen tusa basildiginda icindeki bloklar calisir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "whenSpriteClicked",
    name: "Kukla Tiklaninca",
    description: "Secilen kukla tiklaninca akisi baslatir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "whenBackdropSwitches",
    name: "Backdrop Degisince",
    description: "Belirli bir backdrop'a gecilince calisir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "whenBroadcastReceived",
    name: "Mesaj Alinca",
    description: "Belirli bir yayin mesaji alininca calisir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "whenCloneStart",
    name: "Klon Baslayinca",
    description: "Klon olustugunda icindeki bloklar calisir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "moveSprite",
    name: "Kuklayi Tasi",
    description: "Secilen kuklayi dx ve dy kadar hareket ettirir.",
    category: "motion",
    color: "var(--type-move-sprite)",
  },
  {
    type: "gotoSprite",
    name: "Konuma Git",
    description: "Secilen kuklayi sahnede x/y konumuna goturur.",
    category: "motion",
    color: "var(--type-goto-sprite)",
  },
  {
    type: "turnSprite",
    name: "Kuklayi Dondur",
    description: "Kuklanin yonunu derece kadar arttirir.",
    category: "motion",
    color: "var(--type-turn-sprite)",
  },
  {
    type: "setSpriteDirection",
    name: "Yonu Ayarla",
    description: "Kuklanin yonunu belirlenen dereceye getirir.",
    category: "motion",
    color: "var(--type-set-direction)",
  },
  {
    type: "saySprite",
    name: "Mesaj Goster",
    description: "Kuklanin ustunde kisa bir konusma balonu gosterir.",
    category: "looks",
    color: "var(--type-say-sprite)",
  },
  {
    type: "showSprite",
    name: "Kuklayi Goster",
    description: "Secilen kuklayi gorunur hale getirir.",
    category: "looks",
    color: "var(--type-show-sprite)",
  },
  {
    type: "hideSprite",
    name: "Kuklayi Gizle",
    description: "Secilen kuklayi gizler.",
    category: "looks",
    color: "var(--type-hide-sprite)",
  },
  {
    type: "setSpriteSize",
    name: "Boyutu Ayarla",
    description: "Kukla boyutunu yuzde olarak ayarlar.",
    category: "looks",
    color: "var(--type-size-sprite)",
  },
  {
    type: "switchBackdrop",
    name: "Backdrop Degistir",
    description: "Sahnenin backdrop'unu secilen degere ayarlar.",
    category: "looks",
    color: "var(--type-backdrop)",
  },
  {
    type: "nextBackdrop",
    name: "Sonraki Backdrop",
    description: "Sahnede bir sonraki backdrop'a gecer.",
    category: "looks",
    color: "var(--type-backdrop)",
  },
  {
    type: "print",
    name: "Yazdir",
    description: "Konsola metin yazar.",
    category: "looks",
    color: "var(--type-print)",
  },
  {
    type: "playSound",
    name: "Sesi Cal",
    description: "Yuklenen seslerden birini calar.",
    category: "sound",
    color: "var(--type-play-sound)",
  },
  {
    type: "musicSetTempo",
    name: "Tempoyu Ayarla",
    description: "Muzik extension temposunu BPM olarak ayarlar.",
    category: "sound",
    color: "var(--type-music)",
  },
  {
    type: "musicPlayNoteForBeats",
    name: "Notayi Cal",
    description: "MIDI notayi belirli beat kadar calar.",
    category: "sound",
    color: "var(--type-music)",
  },
  {
    type: "waitSeconds",
    name: "Bekle",
    description: "Belirtilen saniye kadar bekler.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "repeatTimes",
    name: "Tekrarla",
    description: "Icindeki bloklari belirli sayida tekrarlar.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "if",
    name: "Eger",
    description: "Kosul dogruysa icindeki bloklar calisir.",
    category: "control",
    color: "var(--type-if)",
  },
  {
    type: "while",
    name: "Dongu (while)",
    description: "Kosul dogru kaldigi surece bloklari tekrarlar.",
    category: "control",
    color: "var(--type-while)",
  },
  {
    type: "broadcast",
    name: "Mesaj Yayinla",
    description: "Bir yayin mesaji gonderir.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "broadcastAndWait",
    name: "Mesaj Yayinla ve Bekle",
    description: "Yayin mesajini gonderir ve alicilar bitene kadar bekler.",
    category: "events",
    color: "var(--cat-events)",
  },
  {
    type: "stopAllScripts",
    name: "Tumunu Durdur",
    description: "Calisan tum scriptleri durdurur.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "stopThisScript",
    name: "Bu Scripti Durdur",
    description: "Sadece bulundugu scripti durdurur.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "stopOtherScriptsInSprite",
    name: "Digerlerini Durdur",
    description: "Ayni kukladaki diger scriptleri durdurur.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "createCloneOf",
    name: "Klon Olustur",
    description: "Secilen kuklanin klonunu olusturur.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "deleteThisClone",
    name: "Klondan Sil",
    description: "Bulundugu klon scriptini kapatir ve klonu siler.",
    category: "control",
    color: "var(--type-control)",
  },
  {
    type: "sensingMouseLog",
    name: "Fare Konumu Yaz",
    description: "Anlik fare koordinatini konsola yazar.",
    category: "sensing",
    color: "var(--type-sensing)",
  },
  {
    type: "setRandomVar",
    name: "Rastgele Ata",
    description: "Bir degiskene rastgele tam sayi atar.",
    category: "operators",
    color: "var(--type-operators)",
  },
  {
    type: "setVar",
    name: "Degisken Ata",
    description: "Bir degiskene sayi, metin veya baska degisken degeri atar.",
    category: "variables",
    color: "var(--type-set-var)",
  },
  {
    type: "increment",
    name: "Degisken Arttir",
    description: "Bir degiskenin degerini adim kadar arttirir.",
    category: "variables",
    color: "var(--type-increment)",
  },
  {
    type: "showVariableMonitor",
    name: "Degiskeni Goster",
    description: "Degisken monitorunu sahnede gorunur yapar.",
    category: "variables",
    color: "var(--type-set-var)",
  },
  {
    type: "hideVariableMonitor",
    name: "Degiskeni Gizle",
    description: "Degisken monitorunu sahneden gizler.",
    category: "variables",
    color: "var(--type-set-var)",
  },
  {
    type: "listAdd",
    name: "Listeye Ekle",
    description: "Belirli listeye oge ekler.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "listDeleteAt",
    name: "Listeden Sil",
    description: "Listede belirli indexteki ogeyi siler.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "listInsertAt",
    name: "Listeye Araya Ekle",
    description: "Degeri listede index konumuna ekler.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "listReplaceAt",
    name: "Liste Ogesini Degistir",
    description: "Listede indexteki ogeyi yeni degerle degistirir.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "listClear",
    name: "Listeyi Temizle",
    description: "Belirli listedeki tum ogeleri siler.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "showListMonitor",
    name: "Listeyi Goster",
    description: "Liste monitorunu sahnede gorunur yapar.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "hideListMonitor",
    name: "Listeyi Gizle",
    description: "Liste monitorunu sahneden gizler.",
    category: "variables",
    color: "var(--type-lists)",
  },
  {
    type: "defineCustomBlock",
    name: "Blok Tanimla",
    description: "Benim Bloklarim icin argumanli custom blok tanimi olusturur.",
    category: "myblocks",
    color: "var(--type-myblocks)",
  },
  {
    type: "customBlockCall",
    name: "Benim Blokumu Cagir",
    description: "Custom blok adini ve argumanlarini cagirir.",
    category: "myblocks",
    color: "var(--type-myblocks)",
  },
  {
    type: "penDown",
    name: "Kalemi Indir",
    description: "Kukla hareket ederken iz cizmeye baslar.",
    category: "myblocks",
    color: "var(--type-pen)",
  },
  {
    type: "penUp",
    name: "Kalemi Kaldir",
    description: "Kukla hareket izini durdurur.",
    category: "myblocks",
    color: "var(--type-pen)",
  },
  {
    type: "setPenColor",
    name: "Kalem Rengi",
    description: "Kalem cizim rengini ayarlar.",
    category: "myblocks",
    color: "var(--type-pen)",
  },
  {
    type: "setPenSize",
    name: "Kalem Kalinligi",
    description: "Kalem cizgi kalinligini ayarlar.",
    category: "myblocks",
    color: "var(--type-pen)",
  },
  {
    type: "clearPen",
    name: "Kalemi Temizle",
    description: "Sahnedeki tum kalem izlerini temizler.",
    category: "myblocks",
    color: "var(--type-pen)",
  },
  {
    type: "unsupportedOpcode",
    name: "Desteklenmeyen Blok",
    description: "SB3 import sirasinda placeholder olarak korunur.",
    category: "internal",
    color: "var(--type-control)",
  },
];

const BLOCK_INFO = Object.fromEntries(BLOCK_CATALOG.map((item) => [item.type, item]));

const PALETTE_CATEGORIES = [
  { id: "motion", label: "Hareket", color: "var(--cat-motion)" },
  { id: "looks", label: "Gorunum", color: "var(--cat-looks)" },
  { id: "sound", label: "Ses", color: "var(--cat-sound)" },
  { id: "events", label: "Olaylar", color: "var(--cat-events)" },
  { id: "control", label: "Kontrol", color: "var(--cat-control)" },
  { id: "sensing", label: "Algilama", color: "var(--cat-sensing)" },
  { id: "operators", label: "Operatorler", color: "var(--cat-operators)" },
  { id: "variables", label: "Degiskenler", color: "var(--cat-variables)" },
  { id: "myblocks", label: "Benim Bloklarim", color: "var(--cat-myblocks)" },
];

const state = {
  root: [],
  blocks: new Map(),
  dragPayload: null,
  nextId: 1,
  activePaletteCategory: "motion",
  mousePos: { x: 0, y: 0 },
  activeAudios: [],
  runToken: 0,

  sprites: [],
  selectedSpriteId: null,
  nextSpriteId: 1,

  sounds: [],
  nextSoundId: 1,

  files: [],
  nextFileId: 1,

  backdrops: [],
  currentBackdropId: "",
  nextBackdropId: 1,

  variables: [],
  lists: [],
  monitors: {
    variables: [],
    lists: [],
  },
  penStrokes: [],
  tempo: 60,
  extensions: ["pen", "music"],
  nextCloneId: 1,
  activeVm: null,
  runtimeThreads: 0,
  selectedSoundId: "",

  spritePainter: {
    color: "#1f2621",
    size: 8,
  },
  backdropPainter: {
    color: "#1f2621",
    size: 12,
  },
  soundEditor: {
    trimStart: 0,
    trimEnd: 100,
    gain: 1,
    fadeIn: 0,
    fadeOut: 0,
    speed: 1,
    working: false,
  },
};

const opcodeRegistry = createOpcodeRegistry();

const refs = {
  paletteCategories: document.getElementById("paletteCategories"),
  paletteList: document.getElementById("paletteList"),
  workspaceLists: document.getElementById("workspaceLists"),

  stage: document.getElementById("stage"),
  greenFlagBtn: document.getElementById("greenFlagBtn"),
  stopAllBtn: document.getElementById("stopAllBtn"),
  spriteList: document.getElementById("spriteList"),
  spriteEditor: document.getElementById("spriteEditor"),
  addEmptySpriteBtn: document.getElementById("addEmptySpriteBtn"),
  addSpriteBtn: document.getElementById("addSpriteBtn"),
  spriteInput: document.getElementById("spriteInput"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  loadProjectBtn: document.getElementById("loadProjectBtn"),
  projectInput: document.getElementById("projectInput"),
  exportSb3Btn: document.getElementById("exportSb3Btn"),
  importSb3Btn: document.getElementById("importSb3Btn"),
  sb3Input: document.getElementById("sb3Input"),
  addBackdropBtn: document.getElementById("addBackdropBtn"),
  backdropInput: document.getElementById("backdropInput"),
  backdropList: document.getElementById("backdropList"),
  backdropEditor: document.getElementById("backdropEditor"),

  soundList: document.getElementById("soundList"),
  addSoundBtn: document.getElementById("addSoundBtn"),
  soundInput: document.getElementById("soundInput"),
  soundEditor: document.getElementById("soundEditor"),

  fileList: document.getElementById("fileList"),
  addFileBtn: document.getElementById("addFileBtn"),
  fileInput: document.getElementById("fileInput"),

  generatedCode: document.getElementById("generatedCode"),
  consoleOutput: document.getElementById("consoleOutput"),
  runBtn: document.getElementById("runBtn"),
  clearOutputBtn: document.getElementById("clearOutputBtn"),
  clearWorkspaceBtn: document.getElementById("clearWorkspaceBtn"),
};

init();

function init() {
  ensureDefaultBackdrop();
  ensureDefaultSprite();
  renderPaletteCategories();
  renderPalette();
  bindEvents();
  renderWorkspace();
  renderProjectPanel();
  refreshGeneratedCode();
  writeOutput("[Hazir] Bayraga basarak Scratch benzeri akisi calistirabilirsin.");
}

function bindEvents() {
  refs.paletteCategories.addEventListener("click", handlePaletteCategoryClick);
  refs.paletteList.addEventListener("dragstart", handlePaletteDragStart);
  refs.paletteList.addEventListener("dragend", handleDragEnd);
  refs.paletteList.addEventListener("click", handlePaletteClick);

  refs.workspaceLists.addEventListener("dragstart", handleWorkspaceDragStart);
  refs.workspaceLists.addEventListener("dragend", handleDragEnd);
  refs.workspaceLists.addEventListener("dragover", handleWorkspaceDragOver);
  refs.workspaceLists.addEventListener("dragleave", handleWorkspaceDragLeave);
  refs.workspaceLists.addEventListener("drop", handleWorkspaceDrop);
  refs.workspaceLists.addEventListener("input", handleParamEdit);
  refs.workspaceLists.addEventListener("change", handleParamEdit);
  refs.workspaceLists.addEventListener("click", handleWorkspaceClick);

  refs.stage.addEventListener("click", handleStageClick);
  refs.stage.addEventListener("mousemove", handleStageMouseMove);
  refs.spriteList.addEventListener("click", handleSpriteListClick);
  refs.spriteEditor.addEventListener("change", handleSpriteEditorChange);
  refs.spriteEditor.addEventListener("input", handleSpriteEditorInput);
  refs.spriteEditor.addEventListener("click", handleSpriteEditorClick);
  refs.addEmptySpriteBtn.addEventListener("click", handleAddEmptySprite);
  refs.addSpriteBtn.addEventListener("click", () => refs.spriteInput.click());
  refs.spriteInput.addEventListener("change", handleSpriteUpload);
  refs.saveProjectBtn.addEventListener("click", handleSaveProject);
  refs.loadProjectBtn.addEventListener("click", () => refs.projectInput.click());
  refs.projectInput.addEventListener("change", handleProjectUpload);
  refs.exportSb3Btn.addEventListener("click", handleExportSb3);
  refs.importSb3Btn.addEventListener("click", () => refs.sb3Input.click());
  refs.sb3Input.addEventListener("change", handleImportSb3);
  refs.addBackdropBtn.addEventListener("click", () => refs.backdropInput.click());
  refs.backdropInput.addEventListener("change", handleBackdropUpload);
  refs.backdropList.addEventListener("click", handleBackdropListClick);
  refs.backdropEditor.addEventListener("input", handleBackdropEditorInput);
  refs.backdropEditor.addEventListener("click", handleBackdropEditorClick);

  refs.addSoundBtn.addEventListener("click", () => refs.soundInput.click());
  refs.soundInput.addEventListener("change", handleSoundUpload);
  refs.soundList.addEventListener("click", handleSoundListClick);
  refs.soundEditor.addEventListener("input", handleSoundEditorInput);
  refs.soundEditor.addEventListener("change", handleSoundEditorInput);
  refs.soundEditor.addEventListener("click", handleSoundEditorClick);

  refs.addFileBtn.addEventListener("click", () => refs.fileInput.click());
  refs.fileInput.addEventListener("change", handleFileUpload);
  refs.fileList.addEventListener("click", handleFileListClick);

  refs.runBtn.addEventListener("click", runGeneratedCode);
  refs.greenFlagBtn.addEventListener("click", runFromGreenFlag);
  refs.stopAllBtn.addEventListener("click", stopAllPlayback);
  refs.clearOutputBtn.addEventListener("click", () => writeOutput(""));
  refs.clearWorkspaceBtn.addEventListener("click", clearWorkspace);
  window.addEventListener("beforeunload", releaseObjectUrls);
  window.addEventListener("resize", syncWorkspaceCanvasSize);
  window.addEventListener("keydown", handleGlobalKeyDown);
}

function renderPalette() {
  const blocks = getActivePaletteBlocks();
  refs.paletteList.innerHTML = blocks.map((item) => renderPaletteItem(item)).join("");
}

function renderPaletteItem(item) {
  return `
    <div
      class="palette-item"
      draggable="true"
      data-type="${item.type}"
      data-category="${item.category}"
      style="--block-accent:${item.color};"
    >
      <div class="palette-title-row">
        <span class="palette-name">${escapeHtml(item.name)}</span>
        <button class="add-btn" data-add-type="${item.type}" type="button">Ekle</button>
      </div>
      <p class="palette-desc">${escapeHtml(item.description)}</p>
    </div>
  `;
}

function renderPaletteCategories() {
  refs.paletteCategories.innerHTML = PALETTE_CATEGORIES.map((category) => {
    const active = category.id === state.activePaletteCategory ? " is-active" : "";
    return `
      <button
        class="palette-chip${active}"
        type="button"
        data-palette-category="${category.id}"
        style="--chip-color:${category.color};"
      >
        ${escapeHtml(category.label)}
      </button>
    `;
  }).join("");
}

function getActivePaletteBlocks() {
  return BLOCK_CATALOG.filter((item) => item.category === state.activePaletteCategory);
}

function renderWorkspace() {
  refs.workspaceLists.innerHTML = renderRootWorkspace();
  syncWorkspaceCanvasSize();
}

function renderRootWorkspace() {
  let html = `<div class="workspace-canvas" data-root-canvas="true">`;

  if (state.root.length === 0) {
    html += `<p class="empty-notice workspace-empty">Henuz blok yok. Sol panelden bir blok ekle.</p>`;
  } else {
    for (let index = 0; index < state.root.length; index += 1) {
      const nodeId = state.root[index];
      const position = ensureRootBlockPosition(nodeId, index);
      html += `
        <div
          class="workspace-node"
          data-root-node-id="${escapeAttr(nodeId)}"
          style="left:${Math.round(position.x)}px; top:${Math.round(position.y)}px;"
        >
          ${renderBlock(nodeId)}
        </div>
      `;
    }
  }

  html += "</div>";
  return html;
}

function ensureRootBlockPosition(blockId, rootIndex) {
  const node = state.blocks.get(blockId);
  if (!node) {
    return getDefaultRootPosition(rootIndex);
  }

  if (
    !node.workspacePos ||
    !Number.isFinite(node.workspacePos.x) ||
    !Number.isFinite(node.workspacePos.y)
  ) {
    node.workspacePos = getDefaultRootPosition(rootIndex);
  }

  return node.workspacePos;
}

function getDefaultRootPosition(rootIndex) {
  const workspaceWidth = refs.workspaceLists?.clientWidth || 780;
  const usableWidth = Math.max(workspaceWidth - 42, WORKSPACE_CANVAS.columnWidth);
  const columnSpan = WORKSPACE_CANVAS.columnWidth + WORKSPACE_CANVAS.columnGap;
  const columns = Math.max(1, Math.floor(usableWidth / columnSpan));
  const column = rootIndex % columns;
  const row = Math.floor(rootIndex / columns);

  return {
    x: WORKSPACE_CANVAS.defaultX + column * columnSpan,
    y: WORKSPACE_CANVAS.defaultY + row * (WORKSPACE_CANVAS.rowHeight + WORKSPACE_CANVAS.rowGap),
  };
}

function setRootBlockPosition(blockId, x, y) {
  const node = state.blocks.get(blockId);
  if (!node) {
    return false;
  }

  const maxX = getRootMaxX();
  node.workspacePos = {
    x: clampNumber(toFiniteNumber(x, WORKSPACE_CANVAS.defaultX), WORKSPACE_CANVAS.minX, maxX),
    y: Math.max(WORKSPACE_CANVAS.minY, toFiniteNumber(y, WORKSPACE_CANVAS.defaultY)),
  };

  return true;
}

function getRootMaxX() {
  const workspaceWidth = refs.workspaceLists?.clientWidth || 780;
  return Math.max(WORKSPACE_CANVAS.minX, workspaceWidth - 320);
}

function renderList(parentId, listKey, blockIds) {
  const safeParent = escapeAttr(parentId);
  const safeListKey = escapeAttr(listKey);
  let html = `<div class="block-list" data-parent-id="${safeParent}" data-list-key="${safeListKey}">`;

  for (let index = 0; index <= blockIds.length; index += 1) {
    html += renderDropSlot(parentId, listKey, index, blockIds.length === 0);
    if (index < blockIds.length) {
      const nodeId = blockIds[index];
      html += renderBlock(nodeId);
    }
  }

  if (blockIds.length === 0) {
    html += `<p class="empty-notice">Henuz blok yok. Sol panelden bir blok ekle.</p>`;
  }

  html += "</div>";
  return html;
}

function renderDropSlot(parentId, listKey, index, isEmptyList) {
  const emptyText = isEmptyList ? "Ilk blok icin birak" : "Buraya birak";
  return `
    <div
      class="drop-slot"
      data-parent-id="${escapeAttr(parentId)}"
      data-list-key="${escapeAttr(listKey)}"
      data-index="${index}"
      aria-label="${escapeAttr(emptyText)}"
    ></div>
  `;
}

function renderBlock(nodeId) {
  const node = state.blocks.get(nodeId);
  if (!node) {
    return "";
  }

  const blockInfo = BLOCK_INFO[node.type];
  if (!blockInfo) {
    return "";
  }

  let html = `
    <article class="block-card" data-id="${node.id}" data-type="${node.type}" draggable="true">
      <div class="block-header">
        <span class="block-title">${escapeHtml(blockInfo.name)}</span>
        <button class="delete-btn" type="button" data-delete-id="${node.id}">Sil</button>
      </div>
      ${renderParamFields(node)}
  `;

  if (
    node.type === "if" ||
    node.type === "while" ||
    node.type === "repeatTimes" ||
    node.type === "whenStart" ||
    node.type === "whenKeyPressed" ||
    node.type === "whenSpriteClicked" ||
    node.type === "whenBackdropSwitches" ||
    node.type === "whenBroadcastReceived" ||
    node.type === "whenCloneStart" ||
    node.type === "defineCustomBlock"
  ) {
    let nestedTitle = "Kosul dogruysa";
    if (node.type === "whenStart") nestedTitle = "Calisacak Akis";
    if (node.type === "whenKeyPressed") nestedTitle = "Tusa Basildiginda";
    if (node.type === "whenSpriteClicked") nestedTitle = "Kukla Tiklandiginda";
    if (node.type === "whenBackdropSwitches") nestedTitle = "Backdrop Degisince";
    if (node.type === "whenBroadcastReceived") nestedTitle = "Mesaj Alininca";
    if (node.type === "whenCloneStart") nestedTitle = "Klon Baslayinca";
    if (node.type === "defineCustomBlock") nestedTitle = "Custom Blok Govdesi";
    if (node.type === "repeatTimes") nestedTitle = "Tekrar Edilecek Akis";
    html += `
      <section class="nested-area" data-nested-parent-id="${escapeAttr(node.id)}" data-list-key="children">
        <p class="nested-title">${nestedTitle}</p>
        ${renderList(node.id, "children", node.children)}
      </section>
    `;
  }

  if (node.type === "if") {
    html += `
      <section class="nested-area" data-nested-parent-id="${escapeAttr(node.id)}" data-list-key="elseChildren">
        <p class="nested-title">Aksi halde</p>
        ${renderList(node.id, "elseChildren", node.elseChildren)}
      </section>
    `;
  }

  html += "</article>";
  return html;
}

function renderParamFields(node) {
  if (node.type === "whenKeyPressed") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Tus</label>
          ${renderKeySelect(node.id, "key", node.params.key)}
        </div>
      </div>
    `;
  }

  if (node.type === "whenSpriteClicked") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
      </div>
    `;
  }

  if (node.type === "whenCloneStart") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
      </div>
    `;
  }

  if (node.type === "whenBackdropSwitches") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Backdrop</label>
          ${renderBackdropSelect(node.id, "backdrop", node.params.backdrop)}
        </div>
      </div>
    `;
  }

  if (node.type === "whenBroadcastReceived") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Mesaj</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="mesaj1" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "print") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Metin</label>
          <input
            data-id="${node.id}"
            data-param="text"
            value="${escapeAttr(node.params.text)}"
            placeholder="Merhaba dunya"
            autocomplete="off"
          >
        </div>
      </div>
    `;
  }

  if (node.type === "setVar") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Degisken adi</label>
          <input
            data-id="${node.id}"
            data-param="name"
            value="${escapeAttr(node.params.name)}"
            placeholder="sayac"
            autocomplete="off"
          >
        </div>
        <div class="param-row">
          <label>Deger (sayi, "metin" veya degisken)</label>
          <input
            data-id="${node.id}"
            data-param="value"
            value="${escapeAttr(node.params.value)}"
            placeholder="0"
            autocomplete="off"
          >
        </div>
      </div>
    `;
  }

  if (node.type === "increment") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Degisken adi</label>
          <input
            data-id="${node.id}"
            data-param="name"
            value="${escapeAttr(node.params.name)}"
            placeholder="sayac"
            autocomplete="off"
          >
        </div>
        <div class="param-row">
          <label>Adim</label>
          <input
            data-id="${node.id}"
            data-param="step"
            value="${escapeAttr(node.params.step)}"
            placeholder="1"
            autocomplete="off"
          >
        </div>
      </div>
    `;
  }

  if (node.type === "if" || node.type === "while") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kosul</label>
          <div class="condition-grid">
            <input
              data-id="${node.id}"
              data-param="left"
              value="${escapeAttr(node.params.left)}"
              placeholder="sayac"
              autocomplete="off"
            >
            <select data-id="${node.id}" data-param="operator">
              ${OPERATORS.map((operator) => renderOperatorOption(operator, node.params.operator)).join("")}
            </select>
            <input
              data-id="${node.id}"
              data-param="right"
              value="${escapeAttr(node.params.right)}"
              placeholder="5"
              autocomplete="off"
            >
          </div>
        </div>
      </div>
    `;
  }

  if (node.type === "moveSprite") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>dx</label>
          <input data-id="${node.id}" data-param="dx" value="${escapeAttr(node.params.dx)}" placeholder="10" autocomplete="off">
        </div>
        <div class="param-row">
          <label>dy</label>
          <input data-id="${node.id}" data-param="dy" value="${escapeAttr(node.params.dy)}" placeholder="0" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "gotoSprite") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>x</label>
          <input data-id="${node.id}" data-param="x" value="${escapeAttr(node.params.x)}" placeholder="0" autocomplete="off">
        </div>
        <div class="param-row">
          <label>y</label>
          <input data-id="${node.id}" data-param="y" value="${escapeAttr(node.params.y)}" placeholder="0" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "turnSprite") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>Derece</label>
          <input data-id="${node.id}" data-param="degrees" value="${escapeAttr(node.params.degrees)}" placeholder="15" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "setSpriteDirection") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>Yon (derece)</label>
          <input data-id="${node.id}" data-param="direction" value="${escapeAttr(node.params.direction)}" placeholder="90" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "saySprite") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>Metin</label>
          <input data-id="${node.id}" data-param="text" value="${escapeAttr(node.params.text)}" placeholder="Merhaba" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Sure (sn, bos birak = kalici)</label>
          <input data-id="${node.id}" data-param="seconds" value="${escapeAttr(node.params.seconds)}" placeholder="">
        </div>
      </div>
    `;
  }

  if (node.type === "showSprite" || node.type === "hideSprite") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
      </div>
    `;
  }

  if (node.type === "setSpriteSize") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>Boyut (%)</label>
          <input data-id="${node.id}" data-param="size" value="${escapeAttr(node.params.size)}" placeholder="100" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "switchBackdrop") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Backdrop</label>
          ${renderBackdropSelect(node.id, "backdrop", node.params.backdrop)}
        </div>
      </div>
    `;
  }

  if (
    node.type === "nextBackdrop" ||
    node.type === "stopAllScripts" ||
    node.type === "stopThisScript" ||
    node.type === "stopOtherScriptsInSprite" ||
    node.type === "deleteThisClone" ||
    node.type === "clearPen"
  ) {
    return `
      <div class="params-grid">
        <p class="empty-notice">Parametre yok.</p>
      </div>
    `;
  }

  if (node.type === "playSound") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Ses</label>
          ${renderSoundSelect(node.id, "soundId", node.params.soundId)}
        </div>
      </div>
    `;
  }

  if (node.type === "musicSetTempo") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>BPM</label>
          <input data-id="${node.id}" data-param="bpm" value="${escapeAttr(node.params.bpm)}" placeholder="60" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "musicPlayNoteForBeats") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Nota (MIDI)</label>
          <input data-id="${node.id}" data-param="note" value="${escapeAttr(node.params.note)}" placeholder="60" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Beat</label>
          <input data-id="${node.id}" data-param="beats" value="${escapeAttr(node.params.beats)}" placeholder="1" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "waitSeconds") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Saniye</label>
          <input data-id="${node.id}" data-param="seconds" value="${escapeAttr(node.params.seconds)}" placeholder="1" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "repeatTimes") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Tekrar Sayisi</label>
          <input data-id="${node.id}" data-param="count" value="${escapeAttr(node.params.count)}" placeholder="10" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "broadcast" || node.type === "broadcastAndWait") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Mesaj</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="mesaj1" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "createCloneOf") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Klon Hedefi</label>
          ${renderCloneTargetSelect(node.id, "target", node.params.target)}
        </div>
      </div>
    `;
  }

  if (node.type === "sensingMouseLog") {
    return `
      <div class="params-grid">
        <p class="empty-notice">Fare konumu calisma aninda okunur.</p>
      </div>
    `;
  }

  if (node.type === "setRandomVar") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Degisken</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="sayi" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Min</label>
          <input data-id="${node.id}" data-param="min" value="${escapeAttr(node.params.min)}" placeholder="1" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Max</label>
          <input data-id="${node.id}" data-param="max" value="${escapeAttr(node.params.max)}" placeholder="10" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "customBlockCall") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Blok Adi</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="islem1" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Argumanlar (virgul ile)</label>
          <input data-id="${node.id}" data-param="args" value="${escapeAttr(node.params.args)}" placeholder="x, y, 10">
        </div>
      </div>
    `;
  }

  if (node.type === "defineCustomBlock") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Blok Adi</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="islem1" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Arguman Adlari (virgul ile)</label>
          <input data-id="${node.id}" data-param="args" value="${escapeAttr(node.params.args)}" placeholder="x, y">
        </div>
      </div>
    `;
  }

  if (node.type === "unsupportedOpcode") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Opcode</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="unknown_opcode" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "showVariableMonitor" || node.type === "hideVariableMonitor") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Degisken</label>
          <input data-id="${node.id}" data-param="name" value="${escapeAttr(node.params.name)}" placeholder="sayac" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "listAdd") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Liste</label>
          <input data-id="${node.id}" data-param="listName" value="${escapeAttr(node.params.listName)}" placeholder="liste1" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Deger</label>
          <input data-id="${node.id}" data-param="value" value="${escapeAttr(node.params.value)}" placeholder="oge" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "listDeleteAt" || node.type === "listClear" || node.type === "showListMonitor" || node.type === "hideListMonitor") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Liste</label>
          <input data-id="${node.id}" data-param="listName" value="${escapeAttr(node.params.listName)}" placeholder="liste1" autocomplete="off">
        </div>
        ${node.type === "listDeleteAt" ? `
        <div class="param-row">
          <label>Index</label>
          <input data-id="${node.id}" data-param="index" value="${escapeAttr(node.params.index)}" placeholder="1" autocomplete="off">
        </div>` : ""}
      </div>
    `;
  }

  if (node.type === "listInsertAt" || node.type === "listReplaceAt") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Liste</label>
          <input data-id="${node.id}" data-param="listName" value="${escapeAttr(node.params.listName)}" placeholder="liste1" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Index</label>
          <input data-id="${node.id}" data-param="index" value="${escapeAttr(node.params.index)}" placeholder="1" autocomplete="off">
        </div>
        <div class="param-row">
          <label>Deger</label>
          <input data-id="${node.id}" data-param="value" value="${escapeAttr(node.params.value)}" placeholder="oge" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "penDown" || node.type === "penUp") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
      </div>
    `;
  }

  if (node.type === "setPenColor") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>Renk</label>
          <input data-id="${node.id}" data-param="color" value="${escapeAttr(node.params.color)}" placeholder="#0f172a" autocomplete="off">
        </div>
      </div>
    `;
  }

  if (node.type === "setPenSize") {
    return `
      <div class="params-grid">
        <div class="param-row">
          <label>Kukla</label>
          ${renderSpriteSelect(node.id, "spriteId", node.params.spriteId)}
        </div>
        <div class="param-row">
          <label>Kalinlik</label>
          <input data-id="${node.id}" data-param="size" value="${escapeAttr(node.params.size)}" placeholder="2" autocomplete="off">
        </div>
      </div>
    `;
  }

  return "";
}

function renderSpriteSelect(nodeId, paramName, selectedSpriteId) {
  return `
    <select data-id="${nodeId}" data-param="${paramName}">
      ${renderSpriteOptions(selectedSpriteId)}
    </select>
  `;
}

function renderSoundSelect(nodeId, paramName, selectedSoundId) {
  return `
    <select data-id="${nodeId}" data-param="${paramName}">
      ${renderSoundOptions(selectedSoundId)}
    </select>
  `;
}

function renderBackdropSelect(nodeId, paramName, selectedBackdropId) {
  return `
    <select data-id="${nodeId}" data-param="${paramName}">
      ${renderBackdropOptions(selectedBackdropId)}
    </select>
  `;
}

function renderKeySelect(nodeId, paramName, selectedKey) {
  const keys = ["space", "up arrow", "down arrow", "left arrow", "right arrow", "a", "b", "c", "d", "enter", "any"];
  const safeSelected = String(selectedKey || "space").toLowerCase();
  return `
    <select data-id="${nodeId}" data-param="${paramName}">
      ${keys
        .map((key) => {
          const selected = key === safeSelected ? "selected" : "";
          return `<option value="${escapeAttr(key)}" ${selected}>${escapeHtml(key)}</option>`;
        })
        .join("")}
    </select>
  `;
}

function renderCloneTargetSelect(nodeId, paramName, selectedTarget) {
  const safeSelected = String(selectedTarget || "_myself_");
  let options = `<option value="_myself_" ${safeSelected === "_myself_" ? "selected" : ""}>myself</option>`;
  options += state.sprites
    .filter((sprite) => !sprite.isClone)
    .map((sprite) => {
      const selected = safeSelected === sprite.id ? "selected" : "";
      return `<option value="${escapeAttr(sprite.id)}" ${selected}>${escapeHtml(sprite.name)}</option>`;
    })
    .join("");

  return `
    <select data-id="${nodeId}" data-param="${paramName}">
      ${options}
    </select>
  `;
}

function renderSpriteOptions(selectedSpriteId) {
  const optionSprites = state.sprites.filter((sprite) => !sprite.isClone);
  if (optionSprites.length === 0) {
    return `<option value="">Kukla yok</option>`;
  }

  return optionSprites
    .map((sprite) => {
      const selected = sprite.id === selectedSpriteId ? "selected" : "";
      return `<option value="${escapeAttr(sprite.id)}" ${selected}>${escapeHtml(sprite.name)}</option>`;
    })
    .join("");
}

function renderSoundOptions(selectedSoundId) {
  if (state.sounds.length === 0) {
    return `<option value="">Ses yok</option>`;
  }

  return state.sounds
    .map((sound) => {
      const selected = sound.id === selectedSoundId ? "selected" : "";
      return `<option value="${escapeAttr(sound.id)}" ${selected}>${escapeHtml(sound.name)}</option>`;
    })
    .join("");
}

function renderBackdropOptions(selectedBackdropId) {
  if (state.backdrops.length === 0) {
    return `<option value="">Backdrop yok</option>`;
  }

  return state.backdrops
    .map((item) => {
      const selected = item.id === selectedBackdropId || item.name === selectedBackdropId ? "selected" : "";
      return `<option value="${escapeAttr(item.name)}" ${selected}>${escapeHtml(item.name)}</option>`;
    })
    .join("");
}

function renderOperatorOption(operator, selectedOperator) {
  const isSelected = operator === selectedOperator ? "selected" : "";
  return `<option value="${operator}" ${isSelected}>${operator}</option>`;
}

function handlePaletteCategoryClick(event) {
  const button = event.target.closest("[data-palette-category]");
  if (!button) {
    return;
  }

  const category = button.dataset.paletteCategory;
  if (!PALETTE_CATEGORIES.some((item) => item.id === category)) {
    return;
  }

  state.activePaletteCategory = category;
  renderPaletteCategories();
  renderPalette();
}

function handlePaletteClick(event) {
  const button = event.target.closest("[data-add-type]");
  if (!button) {
    return;
  }

  const type = button.dataset.addType;
  if (!BLOCK_INFO[type]) {
    return;
  }

  const changed = addBlockFromType(type, "root", "root", state.root.length);
  if (changed) {
    renderWorkspace();
    refreshGeneratedCode();
  }
}

function handlePaletteDragStart(event) {
  const paletteItem = event.target.closest(".palette-item");
  if (!paletteItem) {
    return;
  }

  const type = paletteItem.dataset.type;
  if (!BLOCK_INFO[type]) {
    return;
  }

  state.dragPayload = { kind: "palette", type };
  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("text/plain", JSON.stringify(state.dragPayload));
}

function handleWorkspaceDragStart(event) {
  const blockCard = event.target.closest(".block-card");
  if (!blockCard) {
    return;
  }

  if (event.target.closest("input, select, button")) {
    event.preventDefault();
    return;
  }

  const id = blockCard.dataset.id;
  if (!state.blocks.has(id)) {
    return;
  }

  state.dragPayload = { kind: "existing", id };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(state.dragPayload));
}

function handleDragEnd() {
  state.dragPayload = null;
  clearDropHighlights();
}

function handleWorkspaceDragOver(event) {
  const payload = resolveDragPayload(event);
  if (!payload) {
    return;
  }

  const destination = resolveDropDestination(event);
  if (destination) {
    event.preventDefault();
    refs.workspaceLists.classList.remove("is-canvas-over");
    highlightDropDestination(destination);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = payload.kind === "palette" ? "copy" : "move";
    }
    return;
  }

  const canvas = event.target.closest(".workspace-canvas");
  if (!canvas) {
    return;
  }

  event.preventDefault();
  clearDropHighlights();
  refs.workspaceLists.classList.add("is-canvas-over");
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = payload.kind === "palette" ? "copy" : "move";
  }
}

function handleWorkspaceDragLeave(event) {
  const related = event.relatedTarget;
  if (!related || !refs.workspaceLists.contains(related)) {
    clearDropHighlights();
  }
}

function handleWorkspaceDrop(event) {
  const payload = resolveDragPayload(event);
  if (!payload) {
    return;
  }

  const destination = resolveDropDestination(event);
  if (destination) {
    event.preventDefault();
    clearDropHighlights();
    const changed = applyPayloadToDestination(payload, destination);
    if (changed) {
      renderWorkspace();
      refreshGeneratedCode();
    }
    return;
  }

  const canvas = event.target.closest(".workspace-canvas");
  if (!canvas) {
    return;
  }

  event.preventDefault();
  clearDropHighlights();

  const dropPos = resolveCanvasDropPosition(event);
  let changed = false;
  let targetBlockId = null;

  if (payload.kind === "palette") {
    const previousCount = state.root.length;
    changed = addBlockFromType(payload.type, "root", "root", previousCount);
    if (changed && state.root.length > previousCount) {
      targetBlockId = state.root[state.root.length - 1];
    }
  } else if (payload.kind === "existing" && state.blocks.has(payload.id)) {
    targetBlockId = payload.id;
    const source = findBlockLocation(payload.id);
    if (!source) {
      return;
    }

    if (source.parentId === "root" && source.listKey === "root") {
      changed = true;
    } else {
      changed = moveExistingBlock(payload.id, "root", "root", state.root.length);
    }
  }

  if (changed && targetBlockId) {
    setRootBlockPosition(targetBlockId, dropPos.x, dropPos.y);
    renderWorkspace();
    const snapped = snapRootBlockToNearestNeighbor(targetBlockId);
    if (snapped) {
      renderWorkspace();
    }
    refreshGeneratedCode();
  }
}

function applyPayloadToDestination(payload, destination) {
  if (!payload || !destination || !Number.isInteger(destination.index)) {
    return false;
  }

  if (payload.kind === "palette") {
    return addBlockFromType(payload.type, destination.parentId, destination.listKey, destination.index);
  }

  if (payload.kind === "existing") {
    return moveExistingBlock(payload.id, destination.parentId, destination.listKey, destination.index);
  }

  return false;
}

function resolveDropDestination(event) {
  const slot = event.target.closest(".drop-slot");
  if (slot) {
    return parseDropDestinationFromSlot(slot);
  }

  const nestedArea = event.target.closest(".nested-area[data-nested-parent-id][data-list-key]");
  if (nestedArea) {
    const parentId = String(nestedArea.dataset.nestedParentId || "");
    const listKey = String(nestedArea.dataset.listKey || "");
    const list = getListRef(parentId, listKey);
    if (!list) {
      return null;
    }
    return {
      parentId,
      listKey,
      index: list.length,
    };
  }

  const blockCard = event.target.closest(".block-card");
  if (!blockCard) {
    return null;
  }

  return resolveDropDestinationFromBlockCard(event, blockCard);
}

function parseDropDestinationFromSlot(slot) {
  const parentId = String(slot.dataset.parentId || "");
  const listKey = String(slot.dataset.listKey || "");
  const index = Number.parseInt(slot.dataset.index, 10);

  if (!parentId || !listKey || !Number.isInteger(index)) {
    return null;
  }

  return {
    parentId,
    listKey,
    index,
  };
}

function resolveDropDestinationFromBlockCard(event, blockCard) {
  const blockId = String(blockCard.dataset.id || "");
  if (!blockId) {
    return null;
  }

  const location = findBlockLocation(blockId);
  if (!location) {
    return null;
  }

  if (location.parentId === "root" && location.listKey === "root") {
    return null;
  }

  const list = getListRef(location.parentId, location.listKey);
  if (!list) {
    return null;
  }

  const rect = blockCard.getBoundingClientRect();
  const threshold = Math.min(18, Math.max(10, rect.height * 0.2));
  const topDelta = Math.abs(event.clientY - rect.top);
  const bottomDelta = Math.abs(rect.bottom - event.clientY);

  // Scratch benzeri davranis: sadece bloklarin ust/alt uc noktalarinda takilsin.
  if (topDelta > threshold && bottomDelta > threshold) {
    return null;
  }

  const y = event.clientY;
  let index = topDelta <= bottomDelta ? location.index : location.index + 1;

  if (y <= rect.top + 1) {
    index = location.index;
  } else if (y >= rect.bottom - 1) {
    index = location.index + 1;
  }

  return {
    parentId: location.parentId,
    listKey: location.listKey,
    index: clampIndex(index, list.length),
  };
}

function highlightDropDestination(destination) {
  const slot = findDropSlotElement(destination.parentId, destination.listKey, destination.index);
  if (!slot) {
    clearDropHighlights();
    return;
  }
  highlightSlot(slot);
}

function findDropSlotElement(parentId, listKey, index) {
  const slots = refs.workspaceLists.querySelectorAll(".drop-slot");
  for (const slot of slots) {
    if (
      slot.dataset.parentId === parentId
      && slot.dataset.listKey === listKey
      && Number.parseInt(slot.dataset.index, 10) === index
    ) {
      return slot;
    }
  }
  return null;
}

function handleWorkspaceClick(event) {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) {
    return;
  }

  const blockId = deleteButton.dataset.deleteId;
  removeBlock(blockId);
}

function handleParamEdit(event) {
  const input = event.target.closest("[data-id][data-param]");
  if (!input) {
    return;
  }

  const blockId = input.dataset.id;
  const param = input.dataset.param;
  const node = state.blocks.get(blockId);

  if (!node || !(param in node.params)) {
    return;
  }

  node.params[param] = input.value;
  refreshGeneratedCode();
}

function clearWorkspace() {
  const confirmDelete = window.confirm("Tum bloklar silinsin mi?");
  if (!confirmDelete) {
    return;
  }

  stopAllPlayback();
  state.root = [];
  state.blocks.clear();
  renderWorkspace();
  refreshGeneratedCode();
  writeOutput("[Bilgi] Kod bloklari temizlendi. Varliklar korunuyor.");
}

function addBlockFromType(type, parentId, listKey, index) {
  if (!BLOCK_INFO[type]) {
    return false;
  }

  const list = getListRef(parentId, listKey);
  if (!list) {
    return false;
  }

  const node = createBlock(type);
  state.blocks.set(node.id, node);
  const insertAt = clampIndex(index, list.length);
  list.splice(insertAt, 0, node.id);

  if (parentId === "root" && listKey === "root") {
    const defaultPos = getDefaultRootPosition(insertAt);
    setRootBlockPosition(node.id, defaultPos.x, defaultPos.y);
  }

  return true;
}

function moveExistingBlock(blockId, targetParentId, targetListKey, targetIndex) {
  if (!state.blocks.has(blockId)) {
    return false;
  }

  const source = findBlockLocation(blockId);
  if (!source) {
    return false;
  }

  if (targetParentId !== "root" && isNodeInSubtree(blockId, targetParentId)) {
    writeOutput("[Uyari] Bir blok kendi altina tasinamaz.");
    return false;
  }

  const sourceList = getListRef(source.parentId, source.listKey);
  const targetList = getListRef(targetParentId, targetListKey);
  if (!sourceList || !targetList) {
    return false;
  }

  sourceList.splice(source.index, 1);

  let insertAt = targetIndex;
  if (sourceList === targetList && source.index < targetIndex) {
    insertAt -= 1;
  }

  insertAt = clampIndex(insertAt, targetList.length);
  targetList.splice(insertAt, 0, blockId);

  if (targetParentId === "root" && targetListKey === "root") {
    ensureRootBlockPosition(blockId, insertAt);
  }

  return true;
}

function removeBlock(blockId) {
  const location = findBlockLocation(blockId);
  if (!location) {
    return;
  }

  const list = getListRef(location.parentId, location.listKey);
  if (!list) {
    return;
  }

  list.splice(location.index, 1);
  removeBlockRecursive(blockId);
  renderWorkspace();
  refreshGeneratedCode();
}

function removeBlockRecursive(blockId) {
  const node = state.blocks.get(blockId);
  if (!node) {
    return;
  }

  if (Array.isArray(node.children)) {
    for (const childId of node.children) {
      removeBlockRecursive(childId);
    }
  }

  if (Array.isArray(node.elseChildren)) {
    for (const childId of node.elseChildren) {
      removeBlockRecursive(childId);
    }
  }

  state.blocks.delete(blockId);
}

function findBlockLocation(targetId) {
  return findInList("root", "root", state.root, targetId);
}

function findInList(parentId, listKey, list, targetId) {
  for (let index = 0; index < list.length; index += 1) {
    const currentId = list[index];
    if (currentId === targetId) {
      return { parentId, listKey, index };
    }

    const node = state.blocks.get(currentId);
    if (!node) {
      continue;
    }

    if (Array.isArray(node.children)) {
      const inChildren = findInList(node.id, "children", node.children, targetId);
      if (inChildren) {
        return inChildren;
      }
    }

    if (Array.isArray(node.elseChildren)) {
      const inElse = findInList(node.id, "elseChildren", node.elseChildren, targetId);
      if (inElse) {
        return inElse;
      }
    }
  }

  return null;
}

function isNodeInSubtree(rootId, maybeChildId) {
  if (rootId === maybeChildId) {
    return true;
  }

  const root = state.blocks.get(rootId);
  if (!root) {
    return false;
  }

  const descendants = [];
  if (Array.isArray(root.children)) {
    descendants.push(...root.children);
  }
  if (Array.isArray(root.elseChildren)) {
    descendants.push(...root.elseChildren);
  }

  for (const descendantId of descendants) {
    if (descendantId === maybeChildId || isNodeInSubtree(descendantId, maybeChildId)) {
      return true;
    }
  }

  return false;
}

function getListRef(parentId, listKey) {
  if (parentId === "root" && listKey === "root") {
    return state.root;
  }

  const parent = state.blocks.get(parentId);
  if (!parent) {
    return null;
  }

  const list = parent[listKey];
  return Array.isArray(list) ? list : null;
}

function createBlock(type) {
  const id = `b${state.nextId}`;
  state.nextId += 1;
  const hatBlock = (params = {}) => ({ id, type, params, children: [] });
  const simpleBlock = (params = {}) => ({ id, type, params });

  if (type === "whenStart") return hatBlock({});
  if (type === "whenKeyPressed") return hatBlock({ key: "space" });
  if (type === "whenSpriteClicked") return hatBlock({ spriteId: getDefaultSpriteId() });
  if (type === "whenBackdropSwitches") return hatBlock({ backdrop: getDefaultBackdropName() });
  if (type === "whenBroadcastReceived") return hatBlock({ name: "mesaj1" });
  if (type === "whenCloneStart") return hatBlock({ spriteId: getDefaultSpriteId() });
  if (type === "defineCustomBlock") return hatBlock({ name: "islem1", args: "x, y" });

  if (type === "if") {
    return {
      id,
      type,
      params: { left: "sayac", operator: "<", right: "5" },
      children: [],
      elseChildren: [],
    };
  }

  if (type === "while") {
    return {
      id,
      type,
      params: { left: "sayac", operator: "<", right: "5" },
      children: [],
    };
  }

  if (type === "repeatTimes") {
    return {
      id,
      type,
      params: { count: "10" },
      children: [],
    };
  }

  if (type === "moveSprite") return simpleBlock({ spriteId: getDefaultSpriteId(), dx: "10", dy: "0" });
  if (type === "gotoSprite") return simpleBlock({ spriteId: getDefaultSpriteId(), x: "0", y: "0" });
  if (type === "turnSprite") return simpleBlock({ spriteId: getDefaultSpriteId(), degrees: "15" });
  if (type === "setSpriteDirection") return simpleBlock({ spriteId: getDefaultSpriteId(), direction: "90" });

  if (type === "saySprite") return simpleBlock({ spriteId: getDefaultSpriteId(), text: "Merhaba!", seconds: "" });
  if (type === "showSprite" || type === "hideSprite") return simpleBlock({ spriteId: getDefaultSpriteId() });
  if (type === "setSpriteSize") return simpleBlock({ spriteId: getDefaultSpriteId(), size: "100" });
  if (type === "switchBackdrop") return simpleBlock({ backdrop: getDefaultBackdropName() });
  if (type === "nextBackdrop") return simpleBlock({});

  if (type === "print") return simpleBlock({ text: "Merhaba dunya" });
  if (type === "playSound") return simpleBlock({ soundId: getDefaultSoundId() });
  if (type === "musicSetTempo") return simpleBlock({ bpm: "60" });
  if (type === "musicPlayNoteForBeats") return simpleBlock({ note: "60", beats: "1" });

  if (type === "waitSeconds") return simpleBlock({ seconds: "1" });
  if (type === "broadcast") return simpleBlock({ name: "mesaj1" });
  if (type === "broadcastAndWait") return simpleBlock({ name: "mesaj1" });
  if (type === "stopAllScripts" || type === "stopThisScript" || type === "stopOtherScriptsInSprite") return simpleBlock({});
  if (type === "createCloneOf") return simpleBlock({ target: "_myself_" });
  if (type === "deleteThisClone") return simpleBlock({});

  if (type === "setVar") return simpleBlock({ name: "sayac", value: "0" });
  if (type === "increment") return simpleBlock({ name: "sayac", step: "1" });
  if (type === "setRandomVar") return simpleBlock({ name: "sayi", min: "1", max: "10" });
  if (type === "showVariableMonitor" || type === "hideVariableMonitor") return simpleBlock({ name: "sayac" });
  if (type === "listAdd") return simpleBlock({ listName: "liste1", value: "oge" });
  if (type === "listDeleteAt") return simpleBlock({ listName: "liste1", index: "1" });
  if (type === "listInsertAt") return simpleBlock({ listName: "liste1", index: "1", value: "oge" });
  if (type === "listReplaceAt") return simpleBlock({ listName: "liste1", index: "1", value: "oge" });
  if (type === "listClear" || type === "showListMonitor" || type === "hideListMonitor") return simpleBlock({ listName: "liste1" });

  if (type === "sensingMouseLog") return simpleBlock({});
  if (type === "customBlockCall") return simpleBlock({ name: "islem1", args: "" });

  if (type === "penDown" || type === "penUp") return simpleBlock({ spriteId: getDefaultSpriteId() });
  if (type === "setPenColor") return simpleBlock({ spriteId: getDefaultSpriteId(), color: "#0f172a" });
  if (type === "setPenSize") return simpleBlock({ spriteId: getDefaultSpriteId(), size: "2" });
  if (type === "clearPen") return simpleBlock({});
  if (type === "unsupportedOpcode") return simpleBlock({ name: "unknown_opcode", raw: "" });

  return simpleBlock({});
}

function resolveDragPayload(event) {
  if (state.dragPayload) {
    return state.dragPayload;
  }

  const textPayload = event.dataTransfer?.getData("text/plain");
  if (!textPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(textPayload);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function resolveCanvasDropPosition(event) {
  const canvas = refs.workspaceLists.querySelector(".workspace-canvas");
  if (!canvas) {
    return {
      x: WORKSPACE_CANVAS.defaultX,
      y: WORKSPACE_CANVAS.defaultY,
    };
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left + refs.workspaceLists.scrollLeft - 14;
  const y = event.clientY - rect.top + refs.workspaceLists.scrollTop - 14;

  return {
    x: Math.max(WORKSPACE_CANVAS.minX, x),
    y: Math.max(WORKSPACE_CANVAS.minY, y),
  };
}

function snapRootBlockToNearestNeighbor(blockId) {
  if (!state.root.includes(blockId)) {
    return false;
  }

  const movingMetrics = getWorkspaceNodeMetrics(blockId);
  if (!movingMetrics) {
    return false;
  }

  let bestTarget = null;

  for (const candidateId of state.root) {
    if (candidateId === blockId) {
      continue;
    }

    const candidateMetrics = getWorkspaceNodeMetrics(candidateId);
    if (!candidateMetrics) {
      continue;
    }

    const xDelta = Math.abs(movingMetrics.x - candidateMetrics.x);
    if (xDelta > WORKSPACE_SNAP.xTolerance) {
      continue;
    }

    const belowTargetY = candidateMetrics.y + candidateMetrics.height + WORKSPACE_SNAP.gap;
    const belowDelta = Math.abs(movingMetrics.y - belowTargetY);
    if (belowDelta <= WORKSPACE_SNAP.distance) {
      const score = belowDelta + xDelta * WORKSPACE_SNAP.xWeight;
      if (!bestTarget || score < bestTarget.score) {
        bestTarget = {
          score,
          x: candidateMetrics.x,
          y: belowTargetY,
        };
      }
    }

    const aboveTargetY = candidateMetrics.y - movingMetrics.height - WORKSPACE_SNAP.gap;
    const aboveDelta = Math.abs(movingMetrics.y - aboveTargetY);
    if (aboveDelta <= WORKSPACE_SNAP.distance) {
      const score = aboveDelta + xDelta * WORKSPACE_SNAP.xWeight;
      if (!bestTarget || score < bestTarget.score) {
        bestTarget = {
          score,
          x: candidateMetrics.x,
          y: aboveTargetY,
        };
      }
    }
  }

  if (!bestTarget) {
    return false;
  }

  return setRootBlockPosition(blockId, bestTarget.x, bestTarget.y);
}

function getWorkspaceNodeMetrics(blockId) {
  const canvas = refs.workspaceLists.querySelector(".workspace-canvas");
  if (!canvas) {
    return null;
  }

  const node = canvas.querySelector(`[data-root-node-id="${blockId}"]`);
  if (!node) {
    return null;
  }

  return {
    x: node.offsetLeft,
    y: node.offsetTop,
    width: node.offsetWidth,
    height: node.offsetHeight,
  };
}

function highlightSlot(activeSlot) {
  const slots = refs.workspaceLists.querySelectorAll(".drop-slot.is-over");
  for (const slot of slots) {
    if (slot !== activeSlot) {
      slot.classList.remove("is-over");
    }
  }
  activeSlot.classList.add("is-over");
}

function clearDropHighlights() {
  const activeSlots = refs.workspaceLists.querySelectorAll(".drop-slot.is-over");
  for (const slot of activeSlots) {
    slot.classList.remove("is-over");
  }
  refs.workspaceLists.classList.remove("is-canvas-over");
}

function syncWorkspaceCanvasSize() {
  const canvas = refs.workspaceLists.querySelector(".workspace-canvas");
  if (!canvas) {
    return;
  }

  let maxBottom = getWorkspaceMinHeight();
  const nodes = canvas.querySelectorAll(".workspace-node");

  for (const node of nodes) {
    const bottom = node.offsetTop + node.offsetHeight + 28;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  canvas.style.height = `${Math.ceil(maxBottom)}px`;
}

function getWorkspaceMinHeight() {
  const isCompact = window.matchMedia("(max-width: 1200px)").matches;
  return isCompact ? WORKSPACE_CANVAS.compactMinHeight : WORKSPACE_CANVAS.minHeight;
}

function renderProjectPanel() {
  renderStage();
  renderBackdropList();
  renderBackdropEditor();
  renderSpriteList();
  renderSpriteEditor();
  renderSoundList();
  renderSoundEditor();
  renderFileList();
}

function renderStage() {
  const backdrop = getCurrentBackdrop();
  const backdropHtml = backdrop?.url
    ? `<div class="stage-backdrop-image" style="background-image:url('${escapeAttr(backdrop.url)}')"></div>`
    : "";

  const penHtml = renderPenOverlaySvg();
  const monitorHtml = renderMonitorsOverlay();
  let html = `${backdropHtml}${penHtml}<div class="stage-center-mark" aria-hidden="true"></div>${monitorHtml}`;

  if (state.sprites.length === 0) {
    html += `<p class="empty-notice">Sahne bos. Kukla ekle.</p>`;
    refs.stage.innerHTML = html;
    return;
  }

  for (const sprite of state.sprites) {
    const left = stageXToPercent(sprite.x);
    const top = stageYToPercent(sprite.y);
    const scale = clampNumber(sprite.size, 10, 400) / 100;
    const rotation = toFiniteNumber(sprite.direction, 90);
    const selectedClass = sprite.id === state.selectedSpriteId ? " is-selected" : "";
    const hiddenClass = sprite.visible ? "" : " is-hidden";

    const costume = sprite.costumeUrl
      ? `<img src="${escapeAttr(sprite.costumeUrl)}" alt="${escapeAttr(sprite.name)}">`
      : `<div class="stage-fallback">${escapeHtml(getSpriteInitial(sprite.name))}</div>`;

    const bubble = sprite.sayText
      ? `<div class="stage-speech">${escapeHtml(sprite.sayText)}</div>`
      : "";

    html += `
      <div
        class="stage-sprite${selectedClass}${hiddenClass}"
        data-stage-sprite-id="${escapeAttr(sprite.id)}"
        style="left:${left}%; top:${top}%; transform: translate(-50%, -50%) rotate(${rotation}deg) scale(${scale});"
        title="${escapeAttr(sprite.name)}"
      >
        ${costume}
        ${bubble}
      </div>
    `;
  }

  refs.stage.innerHTML = html;
}

function renderPenOverlaySvg() {
  if (!Array.isArray(state.penStrokes) || state.penStrokes.length === 0) {
    return "";
  }

  const lines = state.penStrokes
    .map((stroke) => {
      const x1 = clampNumber(toFiniteNumber(stroke.x1, 0), -STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxX) + STAGE_BOUNDS.maxX;
      const y1 = STAGE_BOUNDS.maxY - clampNumber(toFiniteNumber(stroke.y1, 0), -STAGE_BOUNDS.maxY, STAGE_BOUNDS.maxY);
      const x2 = clampNumber(toFiniteNumber(stroke.x2, 0), -STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxX) + STAGE_BOUNDS.maxX;
      const y2 = STAGE_BOUNDS.maxY - clampNumber(toFiniteNumber(stroke.y2, 0), -STAGE_BOUNDS.maxY, STAGE_BOUNDS.maxY);
      const color = /^#[0-9a-fA-F]{6}$/.test(String(stroke.color || "")) ? stroke.color : "#0f172a";
      const width = clampNumber(toFiniteNumber(stroke.size, 2), 1, 80);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeAttr(color)}" stroke-width="${width}" stroke-linecap="round" />`;
    })
    .join("");

  return `
    <svg class="stage-pen-overlay" viewBox="0 0 ${STAGE_BOUNDS.width} ${STAGE_BOUNDS.height}" preserveAspectRatio="none" aria-hidden="true">
      ${lines}
    </svg>
  `;
}

function renderMonitorsOverlay() {
  const variableNames = state.monitors?.variables || [];
  const listNames = state.monitors?.lists || [];

  if (variableNames.length === 0 && listNames.length === 0) {
    return "";
  }

  let html = `<div class="stage-monitors">`;

  for (const variableName of variableNames) {
    const variable = state.variables.find((item) => item.name === variableName);
    if (!variable) {
      continue;
    }
    html += `
      <div class="monitor-chip">
        <span class="monitor-name">${escapeHtml(variable.name)}</span>
        <span class="monitor-value">${escapeHtml(formatOutputValue(variable.value))}</span>
      </div>
    `;
  }

  for (const listName of listNames) {
    const list = state.lists.find((item) => item.name === listName);
    if (!list) {
      continue;
    }
    html += `
      <div class="monitor-list">
        <div class="monitor-name">${escapeHtml(list.name)}</div>
        <div class="monitor-list-items">${escapeHtml((list.items || []).join(", "))}</div>
      </div>
    `;
  }

  html += "</div>";
  return html;
}

function renderSpriteList() {
  const panelSprites = state.sprites.filter((sprite) => !sprite.isClone);
  if (panelSprites.length === 0) {
    refs.spriteList.innerHTML = `<p class="empty-notice">Kukla yok.</p>`;
    return;
  }

  refs.spriteList.innerHTML = panelSprites.map((sprite) => renderSpriteListItem(sprite)).join("");
}

function renderSpriteListItem(sprite) {
  const selectedClass = sprite.id === state.selectedSpriteId ? " is-selected" : "";
  const thumb = sprite.costumeUrl
    ? `<img src="${escapeAttr(sprite.costumeUrl)}" alt="${escapeAttr(sprite.name)}">`
    : `<span class="sprite-thumb-fallback">${escapeHtml(getSpriteInitial(sprite.name))}</span>`;

  return `
    <div class="sprite-item${selectedClass}">
      <button class="sprite-select-btn" type="button" data-sprite-select-id="${escapeAttr(sprite.id)}">
        <span class="sprite-thumb">${thumb}</span>
        <span class="sprite-meta">
          <span class="sprite-name">${escapeHtml(sprite.name)}</span>
          <span class="sprite-sub">x:${Math.round(sprite.x)} y:${Math.round(sprite.y)}</span>
        </span>
      </button>
      <button class="mini-delete-btn" type="button" data-sprite-delete-id="${escapeAttr(sprite.id)}">Sil</button>
    </div>
  `;
}

function renderSpriteEditor() {
  const selected = getSelectedSprite();
  if (!selected) {
    refs.spriteEditor.innerHTML = `<p class="empty-notice">Secili kukla yok.</p>`;
    return;
  }

  refs.spriteEditor.innerHTML = `
    <div class="sprite-editor-grid">
      <div class="sprite-editor-row">
        <label>Kukla Adi</label>
        <input data-sprite-field="name" value="${escapeAttr(selected.name)}" autocomplete="off">
      </div>
      <div class="sprite-editor-row">
        <label>X</label>
        <input data-sprite-field="x" type="number" step="1" min="-240" max="240" value="${escapeAttr(String(Math.round(selected.x)))}">
      </div>
      <div class="sprite-editor-row">
        <label>Y</label>
        <input data-sprite-field="y" type="number" step="1" min="-180" max="180" value="${escapeAttr(String(Math.round(selected.y)))}">
      </div>
      <div class="sprite-editor-row">
        <label>Boyut (%)</label>
        <input data-sprite-field="size" type="number" step="1" min="10" max="400" value="${escapeAttr(String(Math.round(selected.size)))}">
      </div>
      <div class="sprite-editor-row">
        <label>Yon (derece)</label>
        <input data-sprite-field="direction" type="number" step="1" min="-360" max="360" value="${escapeAttr(String(Math.round(selected.direction)))}">
      </div>
      <div class="sprite-editor-row">
        <label>Gorunur</label>
        <input data-sprite-field="visible" type="checkbox" ${selected.visible ? "checked" : ""}>
      </div>
    </div>
    <section class="sprite-paint-editor">
      <p class="sprite-paint-title">Cizim Editoru</p>
      <div class="sprite-paint-toolbar">
        <label class="sprite-paint-control">
          <span>Renk</span>
          <input data-sprite-draw-field="color" type="color" value="${escapeAttr(state.spritePainter.color)}">
        </label>
        <label class="sprite-paint-control">
          <span>Firca</span>
          <input data-sprite-draw-field="size" type="range" min="1" max="36" step="1" value="${escapeAttr(String(state.spritePainter.size))}">
        </label>
        <span class="sprite-paint-size" data-sprite-draw-size>${escapeHtml(String(state.spritePainter.size))} px</span>
      </div>
      <div class="sprite-paint-canvas-shell">
        <canvas class="sprite-paint-canvas" data-sprite-paint-canvas width="320" height="320"></canvas>
      </div>
      <div class="sprite-paint-actions">
        <button type="button" class="ghost-btn" data-sprite-paint-action="clear">Temizle</button>
        <button type="button" class="primary-btn" data-sprite-paint-action="apply">Kuklaya Uygula</button>
      </div>
    </section>
  `;

  setupSpritePaintEditor(selected);
}

function renderSoundList() {
  if (state.sounds.length === 0) {
    refs.soundList.innerHTML = `<p class="empty-notice">Ses yok.</p>`;
    return;
  }

  if (!state.selectedSoundId || !state.sounds.some((item) => item.id === state.selectedSoundId)) {
    state.selectedSoundId = state.sounds[0].id;
  }

  refs.soundList.innerHTML = state.sounds
    .map((sound) => {
      const selectedClass = sound.id === state.selectedSoundId ? " is-selected" : "";
      return `
        <div class="asset-card${selectedClass}">
          <div class="asset-card-head">
            <div>
              <div class="asset-card-title">${escapeHtml(sound.name)}</div>
              <div class="asset-card-sub">${escapeHtml(sound.fileName)}</div>
            </div>
            <div class="asset-actions">
              <button class="ghost-btn" type="button" data-sound-select-id="${escapeAttr(sound.id)}">Sec</button>
              <button class="asset-remove-btn" type="button" data-sound-delete-id="${escapeAttr(sound.id)}">Sil</button>
            </div>
          </div>
          <audio class="sound-preview" controls preload="none" src="${escapeAttr(sound.url)}"></audio>
        </div>
      `;
    })
    .join("");
}

function renderSoundEditor() {
  if (state.sounds.length === 0) {
    refs.soundEditor.innerHTML = `<p class="empty-notice">Duzenlemek icin ses yukle.</p>`;
    return;
  }

  const selectedSound = state.sounds.find((item) => item.id === state.selectedSoundId) || state.sounds[0];
  state.selectedSoundId = selectedSound.id;

  const soundOptions = state.sounds
    .map((sound) => {
      const selected = sound.id === state.selectedSoundId ? "selected" : "";
      return `<option value="${escapeAttr(sound.id)}" ${selected}>${escapeHtml(sound.name)}</option>`;
    })
    .join("");

  refs.soundEditor.innerHTML = `
    <section class="sound-editor">
      <p class="sprite-paint-title">Sound Editor</p>
      <div class="sprite-editor-grid">
        <div class="sprite-editor-row">
          <label>Secili Ses</label>
          <select data-sound-editor-field="selectedSoundId">${soundOptions}</select>
        </div>
        <div class="sprite-editor-row">
          <label>Trim Baslangic (%)</label>
          <input data-sound-editor-field="trimStart" type="range" min="0" max="99" step="1" value="${escapeAttr(String(state.soundEditor.trimStart))}">
        </div>
        <div class="sprite-editor-row">
          <label>Trim Bitis (%)</label>
          <input data-sound-editor-field="trimEnd" type="range" min="1" max="100" step="1" value="${escapeAttr(String(state.soundEditor.trimEnd))}">
        </div>
        <div class="sprite-editor-row">
          <label>Gain (${escapeHtml(state.soundEditor.gain.toFixed(2))})</label>
          <input data-sound-editor-field="gain" type="range" min="0.1" max="3" step="0.05" value="${escapeAttr(String(state.soundEditor.gain))}">
        </div>
        <div class="sprite-editor-row">
          <label>Fade In (sn)</label>
          <input data-sound-editor-field="fadeIn" type="number" min="0" max="10" step="0.05" value="${escapeAttr(String(state.soundEditor.fadeIn))}">
        </div>
        <div class="sprite-editor-row">
          <label>Fade Out (sn)</label>
          <input data-sound-editor-field="fadeOut" type="number" min="0" max="10" step="0.05" value="${escapeAttr(String(state.soundEditor.fadeOut))}">
        </div>
        <div class="sprite-editor-row">
          <label>Hiz (${escapeHtml(state.soundEditor.speed.toFixed(2))}x)</label>
          <input data-sound-editor-field="speed" type="range" min="0.5" max="2" step="0.05" value="${escapeAttr(String(state.soundEditor.speed))}">
        </div>
      </div>
      <div class="sprite-paint-actions">
        <button type="button" class="ghost-btn" data-sound-editor-action="reset">Sifirla</button>
        <button type="button" class="ghost-btn" data-sound-editor-action="preview">On Dinle</button>
        <button type="button" class="primary-btn" data-sound-editor-action="apply" ${state.soundEditor.working ? "disabled" : ""}>
          ${state.soundEditor.working ? "Isleniyor..." : "Sese Uygula"}
        </button>
      </div>
      <audio class="sound-preview" controls preload="none" src="${escapeAttr(selectedSound.url)}"></audio>
    </section>
  `;
}

function renderFileList() {
  if (state.files.length === 0) {
    refs.fileList.innerHTML = `<p class="empty-notice">Dosya yok.</p>`;
    return;
  }

  refs.fileList.innerHTML = state.files
    .map((file) => {
      return `
        <div class="asset-card">
          <div class="asset-card-head">
            <div>
              <div class="asset-card-title">${escapeHtml(file.name)}</div>
              <div class="asset-card-sub">${escapeHtml(file.type)} - ${escapeHtml(formatBytes(file.size))}</div>
            </div>
            <button class="asset-remove-btn" type="button" data-file-delete-id="${escapeAttr(file.id)}">Sil</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBackdropList() {
  if (state.backdrops.length === 0) {
    refs.backdropList.innerHTML = `<p class="empty-notice">Backdrop yok.</p>`;
    return;
  }

  refs.backdropList.innerHTML = state.backdrops
    .map((backdrop) => {
      const selectedClass = backdrop.id === state.currentBackdropId ? " is-selected" : "";
      const preview = backdrop.url
        ? `<img src="${escapeAttr(backdrop.url)}" alt="${escapeAttr(backdrop.name)}">`
        : `<span class="sprite-thumb-fallback">${escapeHtml(getSpriteInitial(backdrop.name))}</span>`;
      return `
        <div class="sprite-item${selectedClass}">
          <button class="sprite-select-btn" type="button" data-backdrop-select-id="${escapeAttr(backdrop.id)}">
            <span class="sprite-thumb">${preview}</span>
            <span class="sprite-meta">
              <span class="sprite-name">${escapeHtml(backdrop.name)}</span>
            </span>
          </button>
          <button class="mini-delete-btn" type="button" data-backdrop-delete-id="${escapeAttr(backdrop.id)}">Sil</button>
        </div>
      `;
    })
    .join("");
}

function renderBackdropEditor() {
  const backdrop = getCurrentBackdrop();
  if (!backdrop) {
    refs.backdropEditor.innerHTML = `<p class="empty-notice">Backdrop secili degil.</p>`;
    return;
  }

  refs.backdropEditor.innerHTML = `
    <div class="sprite-editor-grid">
      <div class="sprite-editor-row">
        <label>Backdrop Adi</label>
        <input data-backdrop-field="name" value="${escapeAttr(backdrop.name)}" autocomplete="off">
      </div>
    </div>
    <section class="sprite-paint-editor">
      <p class="sprite-paint-title">Backdrop Cizim Editoru</p>
      <div class="sprite-paint-toolbar">
        <label class="sprite-paint-control">
          <span>Renk</span>
          <input data-backdrop-draw-field="color" type="color" value="${escapeAttr(state.backdropPainter.color)}">
        </label>
        <label class="sprite-paint-control">
          <span>Firca</span>
          <input data-backdrop-draw-field="size" type="range" min="1" max="48" step="1" value="${escapeAttr(String(state.backdropPainter.size))}">
        </label>
        <span class="sprite-paint-size" data-backdrop-draw-size>${escapeHtml(String(state.backdropPainter.size))} px</span>
      </div>
      <div class="sprite-paint-canvas-shell">
        <canvas class="sprite-paint-canvas backdrop-paint-canvas" data-backdrop-paint-canvas width="480" height="360"></canvas>
      </div>
      <div class="sprite-paint-actions">
        <button type="button" class="ghost-btn" data-backdrop-paint-action="clear">Temizle</button>
        <button type="button" class="ghost-btn" data-backdrop-paint-action="rotateLeft">Sola 90</button>
        <button type="button" class="ghost-btn" data-backdrop-paint-action="rotateRight">Saga 90</button>
        <button type="button" class="ghost-btn" data-backdrop-paint-action="flipX">Yatay Cevir</button>
        <button type="button" class="primary-btn" data-backdrop-paint-action="apply">Backdrop'a Uygula</button>
      </div>
    </section>
  `;

  setupBackdropPaintEditor(backdrop);
}

function handleBackdropEditorInput(event) {
  const nameField = event.target.dataset.backdropField;
  if (nameField === "name") {
    const backdrop = getCurrentBackdrop();
    if (!backdrop) {
      return;
    }
    const previousName = backdrop.name;
    const nextName = String(event.target.value || "").trim();
    backdrop.name = nextName || backdrop.name;
    if (backdrop.name !== previousName) {
      for (const block of state.blocks.values()) {
        if (block.params?.backdrop === previousName) {
          block.params.backdrop = backdrop.name;
        }
      }
    }
    renderBackdropList();
    renderWorkspace();
    refreshGeneratedCode();
    return;
  }

  const drawField = event.target.dataset.backdropDrawField;
  if (!drawField) {
    return;
  }

  if (drawField === "color") {
    const rawColor = String(event.target.value || "").trim();
    state.backdropPainter.color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : "#1f2621";
  } else if (drawField === "size") {
    state.backdropPainter.size = clampNumber(
      Math.round(toFiniteNumber(event.target.value, state.backdropPainter.size)),
      1,
      48
    );
  }

  const sizeLabel = refs.backdropEditor.querySelector("[data-backdrop-draw-size]");
  if (sizeLabel) {
    sizeLabel.textContent = `${state.backdropPainter.size} px`;
  }
}

function handleBackdropEditorClick(event) {
  const button = event.target.closest("[data-backdrop-paint-action]");
  if (!button) {
    return;
  }

  const backdrop = getCurrentBackdrop();
  if (!backdrop) {
    return;
  }

  const canvas = refs.backdropEditor.querySelector("[data-backdrop-paint-canvas]");
  if (!canvas || canvas.dataset.backdropId !== backdrop.id) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const action = button.dataset.backdropPaintAction;
  if (action === "clear") {
    clearSpritePaintCanvas(context, canvas.width, canvas.height);
    return;
  }

  if (action === "rotateLeft") {
    transformCanvasPixels(canvas, "rotateLeft");
    return;
  }

  if (action === "rotateRight") {
    transformCanvasPixels(canvas, "rotateRight");
    return;
  }

  if (action === "flipX") {
    transformCanvasPixels(canvas, "flipX");
    return;
  }

  if (action === "apply") {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      if (backdrop.isObjectUrl && backdrop.url) {
        URL.revokeObjectURL(backdrop.url);
      }
      backdrop.url = dataUrl;
      backdrop.fileName = `${sanitizeIdentifier(backdrop.name || "backdrop", "backdrop")}.png`;
      backdrop.isObjectUrl = false;
      renderProjectPanel();
      renderWorkspace();
      refreshGeneratedCode();
      writeOutput("[Bilgi] Backdrop cizimi uygulandi.");
    } catch {
      writeOutput("[Hata] Backdrop cizimi kaydedilemedi.");
    }
  }
}

function setupBackdropPaintEditor(backdrop) {
  const canvas = refs.backdropEditor.querySelector("[data-backdrop-paint-canvas]");
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  canvas.dataset.backdropId = backdrop.id;
  clearSpritePaintCanvas(context, canvas.width, canvas.height);

  if (backdrop.url) {
    const image = new Image();
    image.addEventListener("load", () => {
      if (canvas.dataset.backdropId !== backdrop.id) {
        return;
      }
      clearSpritePaintCanvas(context, canvas.width, canvas.height);
      drawImageContain(context, image, canvas.width, canvas.height);
    });
    image.src = backdrop.url;
  }

  let drawing = false;
  let lastPoint = null;

  const toCanvasPoint = pointerEvent => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((pointerEvent.clientX - rect.left) / rect.width) * canvas.width,
      y: ((pointerEvent.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawStroke = (fromPoint, toPoint) => {
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = state.backdropPainter.color;
    context.lineWidth = state.backdropPainter.size;
    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
  };

  const finishDrawing = () => {
    drawing = false;
    lastPoint = null;
  };

  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    drawing = true;
    lastPoint = toCanvasPoint(event);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignored
    }
    drawStroke(lastPoint, lastPoint);
  });

  canvas.addEventListener("pointermove", event => {
    if (!drawing || !lastPoint) {
      return;
    }
    const currentPoint = toCanvasPoint(event);
    drawStroke(lastPoint, currentPoint);
    lastPoint = currentPoint;
  });

  canvas.addEventListener("pointerup", finishDrawing);
  canvas.addEventListener("pointercancel", finishDrawing);
  canvas.addEventListener("pointerleave", finishDrawing);
}

function ensureDefaultBackdrop() {
  if (state.backdrops.length > 0) {
    if (!state.currentBackdropId || !state.backdrops.some((item) => item.id === state.currentBackdropId)) {
      state.currentBackdropId = state.backdrops[0].id;
    }
    return;
  }

  const backdrop = {
    id: `bg${state.nextBackdropId}`,
    name: "Backdrop1",
    url: "",
    fileName: "",
    isObjectUrl: false,
  };
  state.nextBackdropId += 1;
  state.backdrops.push(backdrop);
  state.currentBackdropId = backdrop.id;
}

function getCurrentBackdrop() {
  return state.backdrops.find((item) => item.id === state.currentBackdropId) || state.backdrops[0] || null;
}

function getDefaultBackdropName() {
  const current = getCurrentBackdrop();
  return current?.name || "";
}

function ensureDefaultSprite() {
  const baseSprites = state.sprites.filter((sprite) => !sprite.isClone);
  if (baseSprites.length > 0) {
    if (!state.selectedSpriteId || !baseSprites.some((sprite) => sprite.id === state.selectedSpriteId)) {
      state.selectedSpriteId = baseSprites[0].id;
    }
    return;
  }

  state.sprites = [];

  const sprite = createSprite({
    name: "Kukla1",
    costumeUrl: "",
    costumeFileName: "",
    costumeIsObjectUrl: false,
  });
  state.sprites.push(sprite);
  state.selectedSpriteId = sprite.id;
}

function createSprite({ name, costumeUrl, costumeFileName, costumeIsObjectUrl }) {
  const id = `s${state.nextSpriteId}`;
  state.nextSpriteId += 1;
  return {
    id,
    name,
    x: 0,
    y: 0,
    size: 100,
    direction: 90,
    visible: true,
    costumeUrl,
    costumeFileName,
    costumeIsObjectUrl,
    sayText: "",
    sayToken: 0,
    isClone: false,
    baseSpriteId: id,
    cloneId: "",
    pen: {
      down: false,
      color: "#0f172a",
      size: 2,
    },
  };
}

function handleAddEmptySprite() {
  const defaultName = getUniqueSpriteName(`Kukla${state.nextSpriteId}`);
  const sprite = createSprite({
    name: defaultName,
    costumeUrl: "",
    costumeFileName: "",
    costumeIsObjectUrl: false,
  });

  state.sprites.push(sprite);
  state.selectedSpriteId = sprite.id;
  renderProjectPanel();
  renderWorkspace();
  refreshGeneratedCode();
}

function handleSpriteUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (files.length === 0) {
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      skipped += 1;
      continue;
    }

    const url = URL.createObjectURL(file);
    const sprite = createSprite({
      name: getUniqueSpriteName(toBaseName(file.name) || `Kukla${state.nextSpriteId}`),
      costumeUrl: url,
      costumeFileName: file.name,
      costumeIsObjectUrl: true,
    });

    state.sprites.push(sprite);
    state.selectedSpriteId = sprite.id;
    added += 1;
  }

  if (added > 0) {
    renderProjectPanel();
    renderWorkspace();
    refreshGeneratedCode();
  }

  if (skipped > 0) {
    writeOutput(`[Uyari] ${skipped} dosya gorsel olmadigi icin kukla olarak eklenmedi.`);
  }
}

function handleBackdropUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (files.length === 0) {
    return;
  }

  let added = 0;

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const backdrop = {
      id: `bg${state.nextBackdropId}`,
      name: getUniqueBackdropName(toBaseName(file.name) || `Backdrop${state.nextBackdropId}`),
      url: URL.createObjectURL(file),
      fileName: file.name,
      isObjectUrl: true,
    };
    state.nextBackdropId += 1;
    state.backdrops.push(backdrop);
    state.currentBackdropId = backdrop.id;
    added += 1;
  }

  if (added > 0) {
    renderProjectPanel();
    refreshGeneratedCode();
  }
}

function handleBackdropListClick(event) {
  const deleteButton = event.target.closest("[data-backdrop-delete-id]");
  if (deleteButton) {
    const backdropId = deleteButton.dataset.backdropDeleteId;
    deleteBackdrop(backdropId);
    return;
  }

  const selectButton = event.target.closest("[data-backdrop-select-id]");
  if (!selectButton) {
    return;
  }

  const backdropId = selectButton.dataset.backdropSelectId;
  const selected = state.backdrops.find((item) => item.id === backdropId);
  if (!selected) {
    return;
  }

  state.currentBackdropId = selected.id;
  renderStage();
  renderBackdropList();
  renderBackdropEditor();
  renderWorkspace();
  refreshGeneratedCode();

  if (state.activeVm?.isRunning()) {
    state.activeVm.triggerBackdropSwitch(selected.name);
  }
}

function deleteBackdrop(backdropId) {
  const index = state.backdrops.findIndex((item) => item.id === backdropId);
  if (index === -1) {
    return;
  }

  const [removed] = state.backdrops.splice(index, 1);
  if (removed.isObjectUrl && removed.url) {
    URL.revokeObjectURL(removed.url);
  }

  ensureDefaultBackdrop();

  if (!state.backdrops.some((item) => item.id === state.currentBackdropId)) {
    state.currentBackdropId = state.backdrops[0]?.id || "";
  }

  const fallbackName = getDefaultBackdropName();
  for (const block of state.blocks.values()) {
    if (block.params?.backdrop === removed.name) {
      block.params.backdrop = fallbackName;
    }
  }

  renderProjectPanel();
  refreshGeneratedCode();
}

function handleSpriteListClick(event) {
  const deleteButton = event.target.closest("[data-sprite-delete-id]");
  if (deleteButton) {
    const spriteId = deleteButton.dataset.spriteDeleteId;
    deleteSprite(spriteId);
    return;
  }

  const selectButton = event.target.closest("[data-sprite-select-id]");
  if (selectButton) {
    const spriteId = selectButton.dataset.spriteSelectId;
    if (state.sprites.some((sprite) => sprite.id === spriteId)) {
      state.selectedSpriteId = spriteId;
      renderStage();
      renderSpriteList();
      renderSpriteEditor();
    }
  }
}

function handleStageClick(event) {
  const spriteEl = event.target.closest("[data-stage-sprite-id]");
  if (!spriteEl) {
    return;
  }

  const spriteId = spriteEl.dataset.stageSpriteId;
  const clickedSprite = state.sprites.find((sprite) => sprite.id === spriteId);
  if (!clickedSprite) {
    return;
  }

  const selectedId = clickedSprite.baseSpriteId || clickedSprite.id;
  state.selectedSpriteId = selectedId;
  renderStage();
  renderSpriteList();
  renderSpriteEditor();

  if (state.activeVm?.isRunning()) {
    state.activeVm.triggerSpriteClick(selectedId);
  }
}

function handleStageMouseMove(event) {
  const rect = refs.stage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const relativeX = (event.clientX - rect.left) / rect.width;
  const relativeY = (event.clientY - rect.top) / rect.height;
  const scratchX = Math.round(relativeX * STAGE_BOUNDS.width - STAGE_BOUNDS.maxX);
  const scratchY = Math.round(STAGE_BOUNDS.maxY - relativeY * STAGE_BOUNDS.height);

  state.mousePos.x = clampNumber(scratchX, -STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxX);
  state.mousePos.y = clampNumber(scratchY, -STAGE_BOUNDS.maxY, STAGE_BOUNDS.maxY);
}

function handleGlobalKeyDown(event) {
  if (!state.activeVm?.isRunning()) {
    return;
  }

  const targetTag = event.target?.tagName?.toLowerCase();
  if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") {
    return;
  }

  let key = String(event.key || "").toLowerCase();
  if (key === " ") key = "space";
  if (key === "arrowup") key = "up arrow";
  if (key === "arrowdown") key = "down arrow";
  if (key === "arrowleft") key = "left arrow";
  if (key === "arrowright") key = "right arrow";

  state.activeVm.triggerKey(key);
}

function handleSpriteEditorChange(event) {
  const field = event.target.dataset.spriteField;
  if (!field) {
    return;
  }

  const sprite = getSelectedSprite();
  if (!sprite) {
    return;
  }

  if (field === "name") {
    const cleanName = String(event.target.value || "").trim();
    sprite.name = cleanName || sprite.name;
  } else if (field === "x") {
    sprite.x = clampNumber(toFiniteNumber(event.target.value, sprite.x), -STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxX);
  } else if (field === "y") {
    sprite.y = clampNumber(toFiniteNumber(event.target.value, sprite.y), -STAGE_BOUNDS.maxY, STAGE_BOUNDS.maxY);
  } else if (field === "size") {
    sprite.size = clampNumber(toFiniteNumber(event.target.value, sprite.size), 10, 400);
  } else if (field === "direction") {
    sprite.direction = clampNumber(toFiniteNumber(event.target.value, sprite.direction), -360, 360);
  } else if (field === "visible") {
    sprite.visible = Boolean(event.target.checked);
  }

  renderProjectPanel();
  renderWorkspace();
  refreshGeneratedCode();
}

function handleSpriteEditorInput(event) {
  const drawField = event.target.dataset.spriteDrawField;
  if (!drawField) {
    return;
  }

  if (drawField === "color") {
    const rawColor = String(event.target.value || "").trim();
    state.spritePainter.color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : "#1f2621";
  } else if (drawField === "size") {
    state.spritePainter.size = clampNumber(Math.round(toFiniteNumber(event.target.value, state.spritePainter.size)), 1, 36);
  }

  const sizeLabel = refs.spriteEditor.querySelector("[data-sprite-draw-size]");
  if (sizeLabel) {
    sizeLabel.textContent = `${state.spritePainter.size} px`;
  }
}

function handleSpriteEditorClick(event) {
  const button = event.target.closest("[data-sprite-paint-action]");
  if (!button) {
    return;
  }

  const selected = getSelectedSprite();
  if (!selected) {
    return;
  }

  const canvas = refs.spriteEditor.querySelector("[data-sprite-paint-canvas]");
  if (!canvas || canvas.dataset.spriteId !== selected.id) {
    return;
  }

  const action = button.dataset.spritePaintAction;
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  if (action === "clear") {
    clearSpritePaintCanvas(context, canvas.width, canvas.height);
    return;
  }

  if (action === "apply") {
    try {
      const dataUrl = canvas.toDataURL("image/png");
      releaseSpriteCostume(selected);
      selected.costumeUrl = dataUrl;
      selected.costumeFileName = `${sanitizeIdentifier(selected.name || "kukla", "kukla")}.png`;
      selected.costumeIsObjectUrl = false;
      renderProjectPanel();
      renderWorkspace();
      refreshGeneratedCode();
      writeOutput("[Bilgi] Cizim secili kuklaya uygulandi.");
    } catch {
      writeOutput("[Hata] Bu gorsel guvenlik kisiti nedeniyle cizim olarak kaydedilemedi.");
    }
  }
}

function setupSpritePaintEditor(sprite) {
  const canvas = refs.spriteEditor.querySelector("[data-sprite-paint-canvas]");
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  canvas.dataset.spriteId = sprite.id;
  clearSpritePaintCanvas(context, canvas.width, canvas.height);

  if (sprite.costumeUrl) {
    const image = new Image();
    image.addEventListener("load", () => {
      if (canvas.dataset.spriteId !== sprite.id) {
        return;
      }
      clearSpritePaintCanvas(context, canvas.width, canvas.height);
      drawImageContain(context, image, canvas.width, canvas.height);
    });
    image.src = sprite.costumeUrl;
  }

  let drawing = false;
  let lastPoint = null;

  const toCanvasPoint = pointerEvent => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((pointerEvent.clientX - rect.left) / rect.width) * canvas.width,
      y: ((pointerEvent.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const drawStroke = (fromPoint, toPoint) => {
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = state.spritePainter.color;
    context.lineWidth = state.spritePainter.size;
    context.beginPath();
    context.moveTo(fromPoint.x, fromPoint.y);
    context.lineTo(toPoint.x, toPoint.y);
    context.stroke();
  };

  const finishDrawing = () => {
    drawing = false;
    lastPoint = null;
  };

  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();
    drawing = true;
    lastPoint = toCanvasPoint(event);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignored
    }
    drawStroke(lastPoint, lastPoint);
  });

  canvas.addEventListener("pointermove", event => {
    if (!drawing || !lastPoint) {
      return;
    }
    const currentPoint = toCanvasPoint(event);
    drawStroke(lastPoint, currentPoint);
    lastPoint = currentPoint;
  });

  canvas.addEventListener("pointerup", finishDrawing);
  canvas.addEventListener("pointercancel", finishDrawing);
  canvas.addEventListener("pointerleave", finishDrawing);
}

function clearSpritePaintCanvas(context, width, height) {
  context.clearRect(0, 0, width, height);
}

function drawImageContain(context, image, width, height) {
  if (image.width <= 0 || image.height <= 0) {
    return;
  }

  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function transformCanvasPixels(canvas, action) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const temp = document.createElement("canvas");
  temp.width = width;
  temp.height = height;
  const tempContext = temp.getContext("2d");
  if (!tempContext) {
    return;
  }

  tempContext.drawImage(canvas, 0, 0, width, height);
  context.clearRect(0, 0, width, height);
  context.save();

  if (action === "rotateLeft") {
    context.translate(width / 2, height / 2);
    context.rotate(-Math.PI / 2);
    context.drawImage(temp, -height / 2, -width / 2, height, width);
  } else if (action === "rotateRight") {
    context.translate(width / 2, height / 2);
    context.rotate(Math.PI / 2);
    context.drawImage(temp, -height / 2, -width / 2, height, width);
  } else if (action === "flipX") {
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(temp, 0, 0, width, height);
  } else {
    context.drawImage(temp, 0, 0, width, height);
  }

  context.restore();
}

function deleteSprite(spriteId) {
  const index = state.sprites.findIndex((sprite) => sprite.id === spriteId);
  if (index === -1) {
    return;
  }

  const [removed] = state.sprites.splice(index, 1);
  releaseSpriteCostume(removed);
  state.sprites = state.sprites.filter((sprite) => !(sprite.isClone && sprite.baseSpriteId === spriteId));

  if (state.sprites.filter((sprite) => !sprite.isClone).length === 0) {
    ensureDefaultSprite();
  }

  if (!state.sprites.some((sprite) => sprite.id === state.selectedSpriteId && !sprite.isClone)) {
    state.selectedSpriteId = state.sprites.find((sprite) => !sprite.isClone)?.id ?? null;
  }

  const fallbackId = getDefaultSpriteId();
  for (const block of state.blocks.values()) {
    if ("spriteId" in block.params && block.params.spriteId === spriteId) {
      block.params.spriteId = fallbackId;
    }
  }

  renderProjectPanel();
  renderWorkspace();
  refreshGeneratedCode();
}

function releaseSpriteCostume(sprite) {
  if (sprite?.costumeIsObjectUrl && sprite.costumeUrl) {
    URL.revokeObjectURL(sprite.costumeUrl);
  }
}

function releaseObjectUrls() {
  stopAllPlayback();

  for (const sprite of state.sprites) {
    if (sprite.costumeIsObjectUrl && sprite.costumeUrl) {
      URL.revokeObjectURL(sprite.costumeUrl);
    }
  }

  for (const sound of state.sounds) {
    if (sound.isObjectUrl && sound.url) {
      URL.revokeObjectURL(sound.url);
    }
  }

  for (const backdrop of state.backdrops) {
    if (backdrop.isObjectUrl && backdrop.url) {
      URL.revokeObjectURL(backdrop.url);
    }
  }
}

function handleSoundUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (files.length === 0) {
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const file of files) {
    if (!file.type.startsWith("audio/")) {
      skipped += 1;
      continue;
    }

    const sound = {
      id: `snd${state.nextSoundId}`,
      name: getUniqueSoundName(toBaseName(file.name) || `Ses${state.nextSoundId}`),
      fileName: file.name,
      url: URL.createObjectURL(file),
      isObjectUrl: true,
    };
    state.nextSoundId += 1;
    state.sounds.push(sound);
    state.selectedSoundId = sound.id;
    added += 1;
  }

  if (added > 0) {
    if (state.sounds.length > 0) {
      const fallbackId = getDefaultSoundId();
      for (const block of state.blocks.values()) {
        if (block.type === "playSound" && !block.params.soundId) {
          block.params.soundId = fallbackId;
        }
      }
    }
    renderSoundList();
    renderSoundEditor();
    renderWorkspace();
    refreshGeneratedCode();
  }

  if (skipped > 0) {
    writeOutput(`[Uyari] ${skipped} dosya ses olmadigi icin ses listesine eklenmedi.`);
  }
}

function handleSoundListClick(event) {
  const selectButton = event.target.closest("[data-sound-select-id]");
  if (selectButton) {
    const soundId = selectButton.dataset.soundSelectId;
    if (state.sounds.some((item) => item.id === soundId)) {
      state.selectedSoundId = soundId;
      resetSoundEditorSettings();
      renderSoundList();
      renderSoundEditor();
    }
    return;
  }

  const deleteButton = event.target.closest("[data-sound-delete-id]");
  if (!deleteButton) {
    return;
  }

  const soundId = deleteButton.dataset.soundDeleteId;
  deleteSound(soundId);
}

function deleteSound(soundId) {
  const index = state.sounds.findIndex((sound) => sound.id === soundId);
  if (index === -1) {
    return;
  }

  const [removed] = state.sounds.splice(index, 1);
  if (removed.isObjectUrl && removed.url) {
    URL.revokeObjectURL(removed.url);
  }

  if (state.selectedSoundId === soundId) {
    state.selectedSoundId = state.sounds[0]?.id || "";
    resetSoundEditorSettings();
  }

  const fallbackId = getDefaultSoundId();
  for (const block of state.blocks.values()) {
    if (block.type === "playSound" && block.params.soundId === soundId) {
      block.params.soundId = fallbackId;
    }
  }

  renderSoundList();
  renderSoundEditor();
  renderWorkspace();
  refreshGeneratedCode();
}

function resetSoundEditorSettings() {
  state.soundEditor.trimStart = 0;
  state.soundEditor.trimEnd = 100;
  state.soundEditor.gain = 1;
  state.soundEditor.fadeIn = 0;
  state.soundEditor.fadeOut = 0;
  state.soundEditor.speed = 1;
}

function handleSoundEditorInput(event) {
  const field = event.target.dataset.soundEditorField;
  if (!field) {
    return;
  }

  if (field === "selectedSoundId") {
    const soundId = String(event.target.value || "");
    if (state.sounds.some((item) => item.id === soundId)) {
      state.selectedSoundId = soundId;
      resetSoundEditorSettings();
      renderSoundList();
      renderSoundEditor();
    }
    return;
  }

  if (field === "trimStart") {
    state.soundEditor.trimStart = clampNumber(Math.round(toFiniteNumber(event.target.value, state.soundEditor.trimStart)), 0, 99);
    if (state.soundEditor.trimStart >= state.soundEditor.trimEnd) {
      state.soundEditor.trimEnd = clampNumber(state.soundEditor.trimStart + 1, 1, 100);
    }
  } else if (field === "trimEnd") {
    state.soundEditor.trimEnd = clampNumber(Math.round(toFiniteNumber(event.target.value, state.soundEditor.trimEnd)), 1, 100);
    if (state.soundEditor.trimEnd <= state.soundEditor.trimStart) {
      state.soundEditor.trimStart = clampNumber(state.soundEditor.trimEnd - 1, 0, 99);
    }
  } else if (field === "gain") {
    state.soundEditor.gain = clampNumber(toFiniteNumber(event.target.value, state.soundEditor.gain), 0.1, 3);
  } else if (field === "fadeIn") {
    state.soundEditor.fadeIn = clampNumber(toFiniteNumber(event.target.value, state.soundEditor.fadeIn), 0, 10);
  } else if (field === "fadeOut") {
    state.soundEditor.fadeOut = clampNumber(toFiniteNumber(event.target.value, state.soundEditor.fadeOut), 0, 10);
  } else if (field === "speed") {
    state.soundEditor.speed = clampNumber(toFiniteNumber(event.target.value, state.soundEditor.speed), 0.5, 2);
  }

  const liveRefreshFields = new Set(["trimStart", "trimEnd", "gain", "speed"]);
  if (event.type === "change" || liveRefreshFields.has(field)) {
    renderSoundEditor();
  }
}

function handleSoundEditorClick(event) {
  const button = event.target.closest("[data-sound-editor-action]");
  if (!button || state.soundEditor.working) {
    return;
  }

  const action = button.dataset.soundEditorAction;
  if (action === "reset") {
    resetSoundEditorSettings();
    renderSoundEditor();
    return;
  }

  const selectedSound = state.sounds.find((item) => item.id === state.selectedSoundId);
  if (!selectedSound) {
    return;
  }

  if (action === "preview") {
    previewSoundWithSettings(selectedSound);
    return;
  }

  if (action === "apply") {
    applySoundEditorToSelectedSound();
  }
}

async function applySoundEditorToSelectedSound() {
  const sound = state.sounds.find((item) => item.id === state.selectedSoundId);
  if (!sound) {
    return;
  }

  state.soundEditor.working = true;
  renderSoundEditor();

  try {
    const editedDataUrl = await processSoundWithSettings(sound.url, state.soundEditor);
    if (sound.isObjectUrl && sound.url) {
      URL.revokeObjectURL(sound.url);
    }
    sound.url = editedDataUrl;
    sound.fileName = `${sanitizeIdentifier(sound.name || "sound", "sound")}_edited.wav`;
    sound.isObjectUrl = false;
    resetSoundEditorSettings();
    renderSoundList();
    renderSoundEditor();
    renderWorkspace();
    refreshGeneratedCode();
    writeOutput("[Bilgi] Sound editor islemi uygulandi.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOutput(`[Hata] Sound editor islemi basarisiz: ${message}`);
  } finally {
    state.soundEditor.working = false;
    renderSoundEditor();
  }
}

function previewSoundWithSettings(sound) {
  processSoundWithSettings(sound.url, state.soundEditor)
    .then((dataUrl) => {
      const audio = new Audio(dataUrl);
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {});
      }
    })
    .catch(() => {
      writeOutput("[Uyari] On dinleme su an kullanilamiyor.");
    });
}

function handleFileUpload(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (files.length === 0) {
    return;
  }

  for (const file of files) {
    state.files.push({
      id: `file${state.nextFileId}`,
      name: file.name,
      size: file.size,
      type: file.type || "bilinmiyor",
    });
    state.nextFileId += 1;
  }

  renderFileList();
}

function handleFileListClick(event) {
  const deleteButton = event.target.closest("[data-file-delete-id]");
  if (!deleteButton) {
    return;
  }

  const fileId = deleteButton.dataset.fileDeleteId;
  const index = state.files.findIndex((file) => file.id === fileId);
  if (index === -1) {
    return;
  }

  state.files.splice(index, 1);
  renderFileList();
}

async function handleSaveProject() {
  try {
    const snapshot = await buildProjectSnapshot();
    const fileName = `biroor-project-${getTimestampLabel()}.json`;
    downloadTextFile(JSON.stringify(snapshot, null, 2), fileName, "application/json");
    writeOutput(`[Bilgi] Proje kaydedildi: ${fileName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOutput(`[Hata] Proje kaydedilemedi: ${message}`);
  }
}

async function handleProjectUpload(event) {
  const [file] = Array.from(event.target.files || []);
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const model = parsed?.workspace ? legacySnapshotToProjectModel(parsed) : ensureProjectModelShape(parsed);
    model.activePaletteCategory = String(parsed?.activePaletteCategory || "");
    loadProjectSnapshot(model);
    writeOutput(`[Bilgi] Proje yuklendi: ${file.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOutput(`[Hata] Proje yuklenemedi: ${message}`);
  }
}

async function handleExportSb3() {
  try {
    const model = await buildProjectSnapshot();
    const exportResult = await exportProjectModelToSb3(model);
    const blob = exportResult?.blob || exportResult;
    const report = exportResult?.report || null;
    const fileName = `biroor-project-${getTimestampLabel()}.sb3`;
    downloadBlobFile(blob, fileName);

    if (report && Number.isFinite(report.skippedCount) && report.skippedCount > 0) {
      const skippedTypes = Array.isArray(report.skippedTypes) ? report.skippedTypes.slice(0, 10) : [];
      const listSuffix = skippedTypes.length > 0 ? ` | Ilk tipler: ${skippedTypes.join(", ")}${report.skippedCount > 10 ? " ..." : ""}` : "";
      writeOutput(`[Uyari] SB3 export tamamlandi: ${fileName}. Atlanan blok sayisi: ${report.skippedCount}${listSuffix}`);
    } else {
      writeOutput(`[Bilgi] SB3 export tamamlandi: ${fileName}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOutput(`[Hata] SB3 export basarisiz: ${message}`);
  }
}

async function handleImportSb3(event) {
  const [file] = Array.from(event.target.files || []);
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const result = await importSb3ToProjectModel(file);
    loadProjectSnapshot(result.project);
    if (result.warnings.length > 0) {
      const preview = result.warnings.slice(0, 10);
      const previewText = preview.length > 0 ? ` | Ilk tipler: ${preview.join(", ")}${result.warnings.length > 10 ? " ..." : ""}` : "";
      writeOutput(`[Uyari] SB3 import tamamlandi: ${file.name}. Placeholder opcode sayisi: ${result.warnings.length}${previewText}`);
    } else {
      writeOutput(`[Bilgi] SB3 import tamamlandi: ${file.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeOutput(`[Hata] SB3 import basarisiz: ${message}`);
  }
}

async function buildProjectSnapshot() {
  const snapshot = createProjectModelFromState(state);
  snapshot.meta.savedAt = new Date().toISOString();
  snapshot.activePaletteCategory = state.activePaletteCategory;
  snapshot.selectedSoundId = state.selectedSoundId;

  snapshot.sprites = await Promise.all(
    snapshot.sprites.map(async (sprite) => {
      return {
        ...sprite,
        costumeUrl: await toPersistedDataUrl(sprite.costumeUrl),
        costumeIsObjectUrl: false,
      };
    })
  );

  snapshot.backdrops = await Promise.all(
    snapshot.backdrops.map(async (backdrop) => {
      return {
        ...backdrop,
        url: await toPersistedDataUrl(backdrop.url),
        isObjectUrl: false,
      };
    })
  );

  snapshot.sounds = await Promise.all(
    snapshot.sounds.map(async (sound) => {
      return {
        ...sound,
        url: await toPersistedDataUrl(sound.url),
        isObjectUrl: false,
      };
    })
  );

  return snapshot;
}

function loadProjectSnapshot(snapshot) {
  stopAllPlayback();
  releaseObjectUrls();
  hydrateStateFromProjectModel(state, snapshot);
  const loadedSoundId = String(snapshot.selectedSoundId || "");
  state.selectedSoundId = state.sounds.some((item) => item.id === loadedSoundId)
    ? loadedSoundId
    : state.sounds[0]?.id || "";
  resetSoundEditorSettings();

  const paletteId = String(snapshot.activePaletteCategory || "");
  if (PALETTE_CATEGORIES.some((category) => category.id === paletteId)) {
    state.activePaletteCategory = paletteId;
  }

  ensureDefaultBackdrop();
  ensureDefaultSprite();

  renderPaletteCategories();
  renderPalette();
  renderProjectPanel();
  renderWorkspace();
  refreshGeneratedCode();
}

function legacySnapshotToProjectModel(snapshot) {
  const loadedBlocks = new Map();
  const rawBlocks = Array.isArray(snapshot.workspace?.blocks) ? snapshot.workspace.blocks : [];
  for (const rawNode of rawBlocks) {
    const node = deserializeBlockNode(rawNode);
    if (node) {
      loadedBlocks.set(node.id, node);
    }
  }

  for (const node of loadedBlocks.values()) {
    if (Array.isArray(node.children)) {
      node.children = node.children.filter((childId) => loadedBlocks.has(childId));
    }
    if (Array.isArray(node.elseChildren)) {
      node.elseChildren = node.elseChildren.filter((childId) => loadedBlocks.has(childId));
    }
  }

  const root = Array.isArray(snapshot.workspace?.root)
    ? snapshot.workspace.root.filter((id) => typeof id === "string" && loadedBlocks.has(id))
    : [];

  const sprites = parseSnapshotSprites(snapshot.sprites);
  const sounds = parseSnapshotSounds(snapshot.sounds);
  const files = parseSnapshotFiles(snapshot.files);

  const model = ensureProjectModelShape({
    meta: {
      app: "biroor-block-studio",
      version: 2,
      createdAt: String(snapshot.savedAt || ""),
    },
    root,
    blocks: Array.from(loadedBlocks.values()).map((node) => serializeBlockNode(node)),
    sprites,
    selectedSpriteId: String(snapshot.selectedSpriteId || ""),
    backdrops: [],
    currentBackdropId: "",
    sounds,
    files,
    variables: [],
    lists: [],
    monitors: {
      variables: [],
      lists: [],
    },
    tempo: 60,
    extensions: ["pen", "music"],
    counters: {
      nextBlockId: toSafeInteger(snapshot.nextIds?.block, 1),
      nextSpriteId: toSafeInteger(snapshot.nextIds?.sprite, 1),
      nextSoundId: toSafeInteger(snapshot.nextIds?.sound, 1),
      nextFileId: toSafeInteger(snapshot.nextIds?.file, 1),
      nextBackdropId: 1,
      nextCloneId: 1,
    },
  });
  model.activePaletteCategory = String(snapshot.activePaletteCategory || "");
  return model;
}

function serializeBlockNode(node) {
  const serialized = {
    id: node.id,
    type: node.type,
    params: { ...(node.params || {}) },
  };

  if (Array.isArray(node.children)) {
    serialized.children = [...node.children];
  }
  if (Array.isArray(node.elseChildren)) {
    serialized.elseChildren = [...node.elseChildren];
  }
  if (node.workspacePos && Number.isFinite(node.workspacePos.x) && Number.isFinite(node.workspacePos.y)) {
    serialized.workspacePos = {
      x: node.workspacePos.x,
      y: node.workspacePos.y,
    };
  }

  return serialized;
}

function deserializeBlockNode(rawNode) {
  if (!rawNode || typeof rawNode !== "object") {
    return null;
  }

  const type = String(rawNode.type || "");
  if (!BLOCK_INFO[type]) {
    return null;
  }

  const id = String(rawNode.id || "").trim();
  if (!id) {
    return null;
  }

  const node = {
    id,
    type,
    params: rawNode.params && typeof rawNode.params === "object" ? { ...rawNode.params } : {},
  };

  if (Array.isArray(rawNode.children)) {
    node.children = rawNode.children.filter(item => typeof item === "string");
  }

  if (Array.isArray(rawNode.elseChildren)) {
    node.elseChildren = rawNode.elseChildren.filter(item => typeof item === "string");
  }

  if (
    type === "whenStart" ||
    type === "whenKeyPressed" ||
    type === "whenSpriteClicked" ||
    type === "whenBackdropSwitches" ||
    type === "whenBroadcastReceived" ||
    type === "whenCloneStart" ||
    type === "defineCustomBlock" ||
    type === "while" ||
    type === "repeatTimes"
  ) {
    if (!Array.isArray(node.children)) {
      node.children = [];
    }
  }
  if (type === "if") {
    if (!Array.isArray(node.children)) {
      node.children = [];
    }
    if (!Array.isArray(node.elseChildren)) {
      node.elseChildren = [];
    }
  }

  if (
    rawNode.workspacePos &&
    Number.isFinite(rawNode.workspacePos.x) &&
    Number.isFinite(rawNode.workspacePos.y)
  ) {
    node.workspacePos = {
      x: rawNode.workspacePos.x,
      y: rawNode.workspacePos.y,
    };
  }

  return node;
}

function parseSnapshotSprites(rawSprites) {
  if (!Array.isArray(rawSprites)) {
    return [];
  }

  return rawSprites
    .map((rawSprite, index) => {
      if (!rawSprite || typeof rawSprite !== "object") {
        return null;
      }

      const id = String(rawSprite.id || `s${index + 1}`);
      const name = String(rawSprite.name || `Kukla${index + 1}`).trim() || `Kukla${index + 1}`;
      const costumeDataUrl =
        typeof rawSprite.costumeDataUrl === "string"
          ? rawSprite.costumeDataUrl
          : typeof rawSprite.costumeUrl === "string"
            ? rawSprite.costumeUrl
            : "";

      return {
        id,
        name,
        x: clampNumber(toFiniteNumber(rawSprite.x, 0), -STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxX),
        y: clampNumber(toFiniteNumber(rawSprite.y, 0), -STAGE_BOUNDS.maxY, STAGE_BOUNDS.maxY),
        size: clampNumber(toFiniteNumber(rawSprite.size, 100), 10, 400),
        direction: clampNumber(toFiniteNumber(rawSprite.direction, 90), -360, 360),
        visible: rawSprite.visible !== false,
        costumeUrl: costumeDataUrl,
        costumeFileName: String(rawSprite.costumeFileName || ""),
        costumeIsObjectUrl: false,
        sayText: "",
        sayToken: 0,
      };
    })
    .filter(Boolean);
}

function parseSnapshotSounds(rawSounds) {
  if (!Array.isArray(rawSounds)) {
    return [];
  }

  return rawSounds
    .map((rawSound, index) => {
      if (!rawSound || typeof rawSound !== "object") {
        return null;
      }

      const id = String(rawSound.id || `snd${index + 1}`);
      const dataUrl =
        typeof rawSound.dataUrl === "string"
          ? rawSound.dataUrl
          : typeof rawSound.url === "string"
            ? rawSound.url
            : "";

      return {
        id,
        name: String(rawSound.name || `Ses${index + 1}`).trim() || `Ses${index + 1}`,
        fileName: String(rawSound.fileName || `Ses${index + 1}`),
        url: dataUrl,
        isObjectUrl: false,
      };
    })
    .filter(Boolean);
}

function parseSnapshotFiles(rawFiles) {
  if (!Array.isArray(rawFiles)) {
    return [];
  }

  return rawFiles
    .map((rawFile, index) => {
      if (!rawFile || typeof rawFile !== "object") {
        return null;
      }

      return {
        id: String(rawFile.id || `file${index + 1}`),
        name: String(rawFile.name || `Dosya${index + 1}`),
        size: Math.max(0, toFiniteNumber(rawFile.size, 0)),
        type: String(rawFile.type || "bilinmiyor"),
      };
    })
    .filter(Boolean);
}

async function processSoundWithSettings(soundUrl, settings) {
  const sourceUrl = String(soundUrl || "");
  if (!sourceUrl) {
    throw new Error("Ses kaynagi bulunamadi.");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Ses dosyasi okunamadi (${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AudioCtx || !OfflineCtx) {
    throw new Error("Tarayici ses isleme API'sini desteklemiyor.");
  }

  const decodeContext = new AudioCtx();
  let decoded = null;
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    if (typeof decodeContext.close === "function") {
      decodeContext.close().catch(() => {});
    }
  }

  const trimStartPct = clampNumber(Math.round(toFiniteNumber(settings.trimStart, 0)), 0, 99);
  const trimEndPct = clampNumber(Math.round(toFiniteNumber(settings.trimEnd, 100)), trimStartPct + 1, 100);
  const speed = clampNumber(toFiniteNumber(settings.speed, 1), 0.5, 2);
  const gainValue = clampNumber(toFiniteNumber(settings.gain, 1), 0.1, 3);

  const startSec = decoded.duration * (trimStartPct / 100);
  const endSec = decoded.duration * (trimEndPct / 100);
  const trimmedDuration = Math.max(0.01, endSec - startSec);
  const outputDuration = Math.max(0.01, trimmedDuration / speed);

  const sampleRate = decoded.sampleRate;
  const channels = Math.max(1, Math.min(2, decoded.numberOfChannels || 1));
  const totalFrames = Math.max(1, Math.ceil(outputDuration * sampleRate));
  const offline = new OfflineCtx(channels, totalFrames, sampleRate);

  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.playbackRate.value = speed;

  const gainNode = offline.createGain();
  const fadeIn = clampNumber(toFiniteNumber(settings.fadeIn, 0), 0, outputDuration);
  const fadeOut = clampNumber(toFiniteNumber(settings.fadeOut, 0), 0, outputDuration);
  const fadeOutStart = Math.max(0, outputDuration - fadeOut);

  gainNode.gain.setValueAtTime(gainValue, 0);
  if (fadeIn > 0) {
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(gainValue, fadeIn);
  }
  if (fadeOut > 0) {
    gainNode.gain.setValueAtTime(gainValue, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, outputDuration);
  }

  source.connect(gainNode);
  gainNode.connect(offline.destination);
  source.start(0, startSec, trimmedDuration);

  const rendered = await offline.startRendering();
  return audioBufferToWavDataUrl(rendered);
}

function audioBufferToWavDataUrl(audioBuffer) {
  const bytes = encodeAudioBufferAsWav(audioBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/wav;base64,${base64}`;
}

function encodeAudioBufferAsWav(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const sampleCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = sampleCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeWavString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeWavString(view, 8, "WAVE");
  writeWavString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeWavString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = [];
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(audioBuffer.getChannelData(channel));
  }

  let offset = 44;
  for (let i = 0; i < sampleCount; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = clampNumber(channelData[channel][i], -1, 1);
      const value = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, Math.round(value), true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

function writeWavString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

async function toPersistedDataUrl(url) {
  if (!url) {
    return "";
  }

  const source = String(url);
  if (source.startsWith("data:")) {
    return source;
  }

  if (!source.startsWith("blob:")) {
    return source;
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Varlik okunamadi: ${response.status}`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Blob okunamadi.")));
    reader.readAsDataURL(blob);
  });
}

function downloadTextFile(text, fileName, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  downloadBlobFile(blob, fileName);
}

function downloadBlobFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function getTimestampLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function getNextEntityIdFromCollection(ids, prefix) {
  let maxId = 0;
  const pattern = new RegExp(`^${prefix}(\\d+)$`);

  for (const rawId of ids) {
    const value = String(rawId || "");
    const match = value.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (Number.isInteger(parsed) && parsed > maxId) {
      maxId = parsed;
    }
  }

  return maxId + 1;
}

function toSafeInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function getSelectedSprite() {
  if (!state.selectedSpriteId) {
    return null;
  }
  return state.sprites.find((sprite) => sprite.id === state.selectedSpriteId) ?? null;
}

function getDefaultSpriteId() {
  const selected = state.sprites.find((sprite) => sprite.id === state.selectedSpriteId && !sprite.isClone);
  if (selected) {
    return selected.id;
  }
  return state.sprites.find((sprite) => !sprite.isClone)?.id || "";
}

function getDefaultSoundId() {
  return state.sounds[0]?.id || "";
}

function getUniqueSpriteName(baseName) {
  let name = String(baseName || "Kukla").trim();
  if (!name) {
    name = "Kukla";
  }

  const used = new Set(state.sprites.map((sprite) => sprite.name));
  if (!used.has(name)) {
    return name;
  }

  let suffix = 2;
  while (used.has(`${name}_${suffix}`)) {
    suffix += 1;
  }
  return `${name}_${suffix}`;
}

function getUniqueSoundName(baseName) {
  let name = String(baseName || "Ses").trim();
  if (!name) {
    name = "Ses";
  }

  const used = new Set(state.sounds.map((sound) => sound.name));
  if (!used.has(name)) {
    return name;
  }

  let suffix = 2;
  while (used.has(`${name}_${suffix}`)) {
    suffix += 1;
  }
  return `${name}_${suffix}`;
}

function getUniqueBackdropName(baseName) {
  let name = String(baseName || "Backdrop").trim();
  if (!name) {
    name = "Backdrop";
  }

  const used = new Set(state.backdrops.map((item) => item.name));
  if (!used.has(name)) {
    return name;
  }

  let suffix = 2;
  while (used.has(`${name}_${suffix}`)) {
    suffix += 1;
  }
  return `${name}_${suffix}`;
}

function stageXToPercent(x) {
  const bounded = clampNumber(toFiniteNumber(x, 0), -STAGE_BOUNDS.maxX, STAGE_BOUNDS.maxX);
  return ((bounded + STAGE_BOUNDS.maxX) / STAGE_BOUNDS.width) * 100;
}

function stageYToPercent(y) {
  const bounded = clampNumber(toFiniteNumber(y, 0), -STAGE_BOUNDS.maxY, STAGE_BOUNDS.maxY);
  return ((STAGE_BOUNDS.maxY - bounded) / STAGE_BOUNDS.height) * 100;
}

function refreshGeneratedCode() {
  refs.generatedCode.textContent = generateCode();
}

function generateCode() {
  const lines = ["// Auto-generated by Biroor Block Studio"];
  lines.push(`// Sprites: ${state.sprites.map((sprite) => `${sprite.name}(${sprite.id})`).join(", ") || "yok"}`);
  lines.push(`// Sounds: ${state.sounds.map((sound) => `${sound.name}(${sound.id})`).join(", ") || "yok"}`);
  lines.push("");

  const context = {
    declaredVariables: new Set(),
    loopGuardCount: 0,
  };

  const orderedRootIds = getOrderedRootBlockIds();
  emitList(orderedRootIds, 0, context, lines);

  if (orderedRootIds.length === 0) {
    lines.push("// Program bos. Sol panelden blok ekle.");
  }

  return lines.join("\n");
}

function generateGreenFlagCode() {
  const lines = ["// Green flag execution (Scratch-like)"];
  const context = {
    declaredVariables: new Set(),
    loopGuardCount: 0,
  };

  const greenFlagRoots = getOrderedRootBlockIds()
    .map((id) => state.blocks.get(id))
    .filter((node) => node && node.type === "whenStart");

  if (greenFlagRoots.length === 0) {
    lines.push("// Bayrak blogu bulunamadi. Tum kod debug moduyla calistirilabilir.");
    return lines.join("\n");
  }

  for (const rootNode of greenFlagRoots) {
    emitList(rootNode.children || [], 0, context, lines);
  }

  if (lines.length === 1) {
    lines.push("// Bayrak akislarinda calisacak komut yok.");
  }

  return lines.join("\n");
}

function getOrderedRootBlockIds() {
  const orderMap = new Map(state.root.map((id, index) => [id, index]));
  return [...state.root].sort((leftId, rightId) => {
    const leftIndex = orderMap.get(leftId) ?? 0;
    const rightIndex = orderMap.get(rightId) ?? 0;

    const leftNode = state.blocks.get(leftId);
    const rightNode = state.blocks.get(rightId);
    const leftPos = leftNode?.workspacePos || getDefaultRootPosition(leftIndex);
    const rightPos = rightNode?.workspacePos || getDefaultRootPosition(rightIndex);

    const verticalDiff = Math.round(leftPos.y) - Math.round(rightPos.y);
    if (verticalDiff !== 0) {
      return verticalDiff;
    }

    const horizontalDiff = Math.round(leftPos.x) - Math.round(rightPos.x);
    if (horizontalDiff !== 0) {
      return horizontalDiff;
    }

    return leftIndex - rightIndex;
  });
}

function emitList(blockIds, depth, context, lines) {
  for (const blockId of blockIds) {
    const node = state.blocks.get(blockId);
    if (!node) {
      continue;
    }
    emitBlock(node, depth, context, lines);
  }
}

function emitBlock(node, depth, context, lines) {
  if (node.type === "whenStart") {
    line(lines, depth, "// Bayrak tiklaninca");
    emitList(node.children || [], depth, context, lines);
    return;
  }

  if (node.type === "whenKeyPressed") {
    line(lines, depth, `// ${node.params.key || "space"} tusuna basilinca`);
    emitList(node.children || [], depth, context, lines);
    return;
  }

  if (node.type === "whenSpriteClicked") {
    line(lines, depth, `// Kukla tiklaninca (${node.params.spriteId || "secili"})`);
    emitList(node.children || [], depth, context, lines);
    return;
  }

  if (node.type === "whenBackdropSwitches") {
    line(lines, depth, `// Backdrop degisince (${node.params.backdrop || ""})`);
    emitList(node.children || [], depth, context, lines);
    return;
  }

  if (node.type === "whenBroadcastReceived") {
    line(lines, depth, `// Mesaj alininca (${node.params.name || ""})`);
    emitList(node.children || [], depth, context, lines);
    return;
  }

  if (node.type === "whenCloneStart") {
    line(lines, depth, "// Klon baslayinca");
    emitList(node.children || [], depth, context, lines);
    return;
  }

  if (node.type === "defineCustomBlock") {
    line(lines, depth, `// Benim Bloklarim: ${node.params.name || "islem"}(${node.params.args || ""})`);
    emitList(node.children || [], depth + 1, context, lines);
    return;
  }

  if (node.type === "print") {
    line(lines, depth, `console.log(${JSON.stringify(node.params.text || "")});`);
    return;
  }

  if (node.type === "setVar") {
    const name = sanitizeIdentifier(node.params.name, "degisken");
    const value = toValueExpression(node.params.value);

    if (context.declaredVariables.has(name)) {
      line(lines, depth, `${name} = ${value};`);
    } else {
      context.declaredVariables.add(name);
      line(lines, depth, `let ${name} = ${value};`);
    }
    return;
  }

  if (node.type === "increment") {
    const name = sanitizeIdentifier(node.params.name, "degisken");
    const step = toNumberOrDefault(node.params.step, 1);

    if (!context.declaredVariables.has(name)) {
      context.declaredVariables.add(name);
      line(lines, depth, `let ${name} = 0;`);
    }

    line(lines, depth, `${name} += ${step};`);
    return;
  }

  if (node.type === "setRandomVar") {
    const name = sanitizeIdentifier(node.params.name, "sayi");
    const min = Number.parseInt(toNumberOrDefault(node.params.min, 1), 10);
    const max = Number.parseInt(toNumberOrDefault(node.params.max, 10), 10);
    const lower = Math.min(min, max);
    const upper = Math.max(min, max);
    const randomExpr = `Math.floor(Math.random() * (${upper} - ${lower} + 1)) + ${lower}`;

    if (context.declaredVariables.has(name)) {
      line(lines, depth, `${name} = ${randomExpr};`);
    } else {
      context.declaredVariables.add(name);
      line(lines, depth, `let ${name} = ${randomExpr};`);
    }
    return;
  }

  if (node.type === "if") {
    const condition = toConditionExpression(node.params);
    line(lines, depth, `if (${condition}) {`);
    emitList(node.children || [], depth + 1, context, lines);
    line(lines, depth, "}");

    if ((node.elseChildren || []).length > 0) {
      line(lines, depth, "else {");
      emitList(node.elseChildren, depth + 1, context, lines);
      line(lines, depth, "}");
    }
    return;
  }

  if (node.type === "while") {
    const condition = toConditionExpression(node.params);
    const guardName = `__loopGuard${context.loopGuardCount}`;
    context.loopGuardCount += 1;

    line(lines, depth, "{");
    line(lines, depth + 1, `let ${guardName} = 0;`);
    line(lines, depth + 1, `while (${condition}) {`);
    line(lines, depth + 2, `if (${guardName}++ > 1000) {`);
    line(lines, depth + 3, "throw new Error(\"Dongu limiti asildi (1000)\");");
    line(lines, depth + 2, "}");
    emitList(node.children || [], depth + 2, context, lines);
    line(lines, depth + 1, "}");
    line(lines, depth, "}");
    return;
  }

  if (node.type === "repeatTimes") {
    const count = Math.max(0, Number.parseInt(toNumberOrDefault(node.params.count, 10), 10));
    const loopVar = `__i${context.loopGuardCount}`;
    context.loopGuardCount += 1;
    line(lines, depth, `for (let ${loopVar} = 0; ${loopVar} < ${count}; ${loopVar} += 1) {`);
    emitList(node.children || [], depth + 1, context, lines);
    line(lines, depth, "}");
    return;
  }

  if (node.type === "waitSeconds") {
    line(lines, depth, `await __runtime.wait(${toNumberOrDefault(node.params.seconds, 1)});`);
    return;
  }

  if (node.type === "broadcast") {
    line(lines, depth, `await __runtime.broadcast(${JSON.stringify(node.params.name || "")});`);
    return;
  }

  if (node.type === "broadcastAndWait") {
    line(lines, depth, `await __runtime.broadcastAndWait(${JSON.stringify(node.params.name || "")});`);
    return;
  }

  if (node.type === "stopAllScripts") {
    line(lines, depth, "__runtime.stopAllScripts();");
    return;
  }

  if (node.type === "stopThisScript") {
    line(lines, depth, "__runtime.stopThisScript();");
    return;
  }

  if (node.type === "stopOtherScriptsInSprite") {
    line(lines, depth, "__runtime.stopOtherScriptsInSprite();");
    return;
  }

  if (node.type === "createCloneOf") {
    line(lines, depth, `__runtime.createCloneOf(${JSON.stringify(node.params.target || "_myself_")});`);
    return;
  }

  if (node.type === "deleteThisClone") {
    line(lines, depth, "__runtime.deleteThisClone();");
    return;
  }

  if (node.type === "moveSprite") {
    line(
      lines,
      depth,
      `__runtime.moveSprite(${JSON.stringify(node.params.spriteId || "")}, ${toNumberOrDefault(node.params.dx, 0)}, ${toNumberOrDefault(node.params.dy, 0)});`
    );
    return;
  }

  if (node.type === "gotoSprite") {
    line(
      lines,
      depth,
      `__runtime.gotoSprite(${JSON.stringify(node.params.spriteId || "")}, ${toNumberOrDefault(node.params.x, 0)}, ${toNumberOrDefault(node.params.y, 0)});`
    );
    return;
  }

  if (node.type === "turnSprite") {
    line(
      lines,
      depth,
      `__runtime.turnSprite(${JSON.stringify(node.params.spriteId || "")}, ${toNumberOrDefault(node.params.degrees, 15)});`
    );
    return;
  }

  if (node.type === "setSpriteDirection") {
    line(
      lines,
      depth,
      `__runtime.setSpriteDirection(${JSON.stringify(node.params.spriteId || "")}, ${toNumberOrDefault(node.params.direction, 90)});`
    );
    return;
  }

  if (node.type === "saySprite") {
    line(
      lines,
      depth,
      `__runtime.saySprite(${JSON.stringify(node.params.spriteId || "")}, ${JSON.stringify(node.params.text || "")}, ${toNumberOrDefault(node.params.seconds, 0)});`
    );
    return;
  }

  if (node.type === "showSprite") {
    line(lines, depth, `__runtime.showSprite(${JSON.stringify(node.params.spriteId || "")});`);
    return;
  }

  if (node.type === "hideSprite") {
    line(lines, depth, `__runtime.hideSprite(${JSON.stringify(node.params.spriteId || "")});`);
    return;
  }

  if (node.type === "setSpriteSize") {
    line(
      lines,
      depth,
      `__runtime.setSpriteSize(${JSON.stringify(node.params.spriteId || "")}, ${toNumberOrDefault(node.params.size, 100)});`
    );
    return;
  }

  if (node.type === "switchBackdrop") {
    line(lines, depth, `__runtime.switchBackdrop(${JSON.stringify(node.params.backdrop || "")});`);
    return;
  }

  if (node.type === "nextBackdrop") {
    line(lines, depth, "__runtime.nextBackdrop();");
    return;
  }

  if (node.type === "playSound") {
    line(lines, depth, `__runtime.playSound(${JSON.stringify(node.params.soundId || "")});`);
    return;
  }

  if (node.type === "musicSetTempo") {
    line(lines, depth, `__runtime.setTempo(${toNumberOrDefault(node.params.bpm, 60)});`);
    return;
  }

  if (node.type === "musicPlayNoteForBeats") {
    line(lines, depth, `await __runtime.playNoteForBeats(${toNumberOrDefault(node.params.note, 60)}, ${toNumberOrDefault(node.params.beats, 1)});`);
    return;
  }

  if (node.type === "showVariableMonitor") {
    line(lines, depth, `__runtime.showVariableMonitor(${JSON.stringify(node.params.name || "")});`);
    return;
  }

  if (node.type === "hideVariableMonitor") {
    line(lines, depth, `__runtime.hideVariableMonitor(${JSON.stringify(node.params.name || "")});`);
    return;
  }

  if (node.type === "listAdd") {
    line(lines, depth, `__runtime.listAdd(${JSON.stringify(node.params.listName || "")}, ${toValueExpression(node.params.value)});`);
    return;
  }

  if (node.type === "listDeleteAt") {
    line(lines, depth, `__runtime.listDeleteAt(${JSON.stringify(node.params.listName || "")}, ${toNumberOrDefault(node.params.index, 1)});`);
    return;
  }

  if (node.type === "listInsertAt") {
    line(lines, depth, `__runtime.listInsertAt(${JSON.stringify(node.params.listName || "")}, ${toValueExpression(node.params.value)}, ${toNumberOrDefault(node.params.index, 1)});`);
    return;
  }

  if (node.type === "listReplaceAt") {
    line(lines, depth, `__runtime.listReplaceAt(${JSON.stringify(node.params.listName || "")}, ${toValueExpression(node.params.value)}, ${toNumberOrDefault(node.params.index, 1)});`);
    return;
  }

  if (node.type === "listClear") {
    line(lines, depth, `__runtime.listClear(${JSON.stringify(node.params.listName || "")});`);
    return;
  }

  if (node.type === "showListMonitor") {
    line(lines, depth, `__runtime.showListMonitor(${JSON.stringify(node.params.listName || "")});`);
    return;
  }

  if (node.type === "hideListMonitor") {
    line(lines, depth, `__runtime.hideListMonitor(${JSON.stringify(node.params.listName || "")});`);
    return;
  }

  if (node.type === "penDown") {
    line(lines, depth, `__runtime.penDown(${JSON.stringify(node.params.spriteId || "")});`);
    return;
  }

  if (node.type === "penUp") {
    line(lines, depth, `__runtime.penUp(${JSON.stringify(node.params.spriteId || "")});`);
    return;
  }

  if (node.type === "setPenColor") {
    line(lines, depth, `__runtime.setPenColor(${JSON.stringify(node.params.spriteId || "")}, ${JSON.stringify(node.params.color || "#0f172a")});`);
    return;
  }

  if (node.type === "setPenSize") {
    line(lines, depth, `__runtime.setPenSize(${JSON.stringify(node.params.spriteId || "")}, ${toNumberOrDefault(node.params.size, 2)});`);
    return;
  }

  if (node.type === "clearPen") {
    line(lines, depth, "__runtime.clearPen();");
    return;
  }

  if (node.type === "sensingMouseLog") {
    line(lines, depth, "__runtime.logMouse();");
    return;
  }

  if (node.type === "customBlockCall") {
    line(lines, depth, `await __runtime.callCustom(${JSON.stringify(node.params.name || "")}, ${JSON.stringify(node.params.args || "")});`);
    return;
  }

  if (node.type === "unsupportedOpcode") {
    line(lines, depth, `// [unsupported] ${node.params.name || node.type}`);
    return;
  }

  line(lines, depth, `// [unknown] ${node.type}`);
}

function toConditionExpression(params) {
  const left = toOperand(params.left);
  const right = toOperand(params.right);
  const operator = OPERATORS.includes(params.operator) ? params.operator : "===";
  return `${left} ${operator} ${right}`;
}

function toValueExpression(rawValue) {
  const value = String(rawValue || "").trim();
  if (value === "") {
    return "0";
  }

  if (isNumberLiteral(value)) {
    return value;
  }

  if (value === "true" || value === "false" || value === "null") {
    return value;
  }

  if (isQuotedLiteral(value)) {
    return value;
  }

  if (isIdentifier(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function toOperand(rawValue) {
  const value = String(rawValue || "").trim();
  if (value === "") {
    return "0";
  }

  if (isNumberLiteral(value) || isQuotedLiteral(value) || isIdentifier(value)) {
    return value;
  }

  if (value === "true" || value === "false" || value === "null") {
    return value;
  }

  return JSON.stringify(value);
}

function toNumberOrDefault(rawValue, defaultValue) {
  const num = Number.parseFloat(String(rawValue || "").trim());
  if (Number.isFinite(num)) {
    return String(num);
  }
  return String(defaultValue);
}

function sanitizeIdentifier(rawName, fallback) {
  const normalized = String(rawName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let safe = normalized.replace(/[^A-Za-z0-9_$]/g, "_");
  if (!safe) {
    safe = fallback;
  }

  if (/^[0-9]/.test(safe)) {
    safe = `_${safe}`;
  }

  return safe;
}

function isIdentifier(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

function isNumberLiteral(value) {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function isQuotedLiteral(value) {
  return (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function runFromGreenFlag() {
  runProgram(true);
}

function runGeneratedCode() {
  runProgram(false);
}

function runProgram(onlyGreenFlag) {
  const code = onlyGreenFlag ? generateGreenFlagCode() : generateCode();
  refs.generatedCode.textContent = code;

  const logLines = [];
  stopAllPlayback();
  const vm = createVmSession(logLines);
  state.activeVm = vm;

  if (onlyGreenFlag) {
    vm.startGreenFlag();
    pushRuntimeLog(logLines, "[Bilgi] Green flag runtime baslatildi.");
  } else {
    vm.runAllScripts();
    pushRuntimeLog(logLines, "[Bilgi] VM debug calisma baslatildi.");
  }
}

function stopAllPlayback() {
  if (state.activeVm) {
    state.activeVm.stopAll("user-stop");
    state.activeVm = null;
  }

  state.runToken += 1;

  for (const audio of state.activeAudios) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignored
    }
  }
  state.activeAudios = [];

  for (const sprite of state.sprites) {
    sprite.sayText = "";
    if (sprite.pen) {
      sprite.pen.down = false;
    }
  }
  state.runtimeThreads = 0;
  renderProjectPanel();
}

function createVmSession(logLines) {
  let completionLogged = false;
  let everHadThreads = false;
  return new ScratchVm({
    projectRef: () => state,
    registry: opcodeRegistry,
    hooks: {
      onLog: (message) => {
        pushRuntimeLog(logLines, String(message));
      },
      onWarning: (message) => {
        pushRuntimeLog(logLines, `[Uyari] ${message}`);
      },
      onStateChange: () => {
        renderProjectPanel();
      },
      onThreadCountChange: (count) => {
        state.runtimeThreads = count;
        if (count > 0) {
          everHadThreads = true;
          completionLogged = false;
        }
        if (count === 0 && everHadThreads && !completionLogged) {
          completionLogged = true;
          pushRuntimeLog(logLines, "[Bilgi] Runtime tamamlandi.");
        }
      },
    },
    options: {
      cloneLimit: 300,
    },
  });
}

function pushRuntimeLog(logLines, line) {
  logLines.push(line);
  writeOutput(logLines.join("\n"));
}

function formatOutputValue(value) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function line(lines, depth, content) {
  lines.push(`${"  ".repeat(depth)}${content}`);
}

function clampIndex(index, maxLength) {
  if (!Number.isInteger(index)) {
    return maxLength;
  }
  if (index < 0) {
    return 0;
  }
  if (index > maxLength) {
    return maxLength;
  }
  return index;
}

function clampNumber(value, min, max) {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function toFiniteNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value));
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

function toBaseName(fileName) {
  return String(fileName || "").replace(/\.[^/.]+$/, "");
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size < 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const display = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}

function getSpriteInitial(name) {
  const safe = String(name || "").trim();
  if (!safe) {
    return "K";
  }
  return safe[0].toUpperCase();
}

function writeOutput(text) {
  refs.consoleOutput.textContent = text;
}

function escapeHtml(value) {
  const safeValue = value === null || value === undefined ? "" : String(value);
  return safeValue
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}
