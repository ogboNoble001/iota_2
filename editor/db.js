// ═══════════════════════════════════════════════════════════════
//  CanvasDB — IndexedDB Manager
// ═══════════════════════════════════════════════════════════════

const DB_NAME    = 'CanvasDB';
const DB_VERSION = 1;

let db = null;

// ── Open / Init ────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const database = e.target.result;

      // Projects store
      if (!database.objectStoreNames.contains('projects')) {
        const ps = database.createObjectStore('projects', { keyPath: 'id' });
        ps.createIndex('updatedAt', 'updatedAt', { unique: false });
        ps.createIndex('name',      'name',      { unique: false });
      }

      // Assets store (images + fonts as blobs)
      if (!database.objectStoreNames.contains('assets')) {
        const as = database.createObjectStore('assets', { keyPath: 'id' });
        as.createIndex('projectId', 'projectId', { unique: false });
        as.createIndex('type',      'type',      { unique: false });
      }

      // Thumbnails store
      if (!database.objectStoreNames.contains('thumbnails')) {
        database.createObjectStore('thumbnails', { keyPath: 'projectId' });
      }
    };

    req.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    req.onerror = e => {
      console.error('IndexedDB open error:', e.target.error);
      reject(e.target.error);
    };
  });
}

// ── Generic Helpers ────────────────────────────────────────────
function dbGet(storeName, key) {
  return openDB().then(database => new Promise((resolve, reject) => {
    const tx  = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function dbPut(storeName, value) {
  return openDB().then(database => new Promise((resolve, reject) => {
    const tx  = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function dbDelete(storeName, key) {
  return openDB().then(database => new Promise((resolve, reject) => {
    const tx  = database.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  }));
}

function dbGetAll(storeName) {
  return openDB().then(database => new Promise((resolve, reject) => {
    const tx  = database.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function dbGetAllByIndex(storeName, indexName, value) {
  return openDB().then(database => new Promise((resolve, reject) => {
    const tx    = database.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index(indexName);
    const req   = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  }));
}

function dbDeleteByIndex(storeName, indexName, value) {
  return openDB().then(database => new Promise((resolve, reject) => {
    const tx    = database.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req   = index.getAllKeys(value);
    req.onsuccess = () => {
      req.result.forEach(key => store.delete(key));
      resolve();
    };
    req.onerror = () => reject(req.error);
  }));
}

// ── Projects ───────────────────────────────────────────────────
async function dbSaveProject(project) {
  await dbPut('projects', project);
}

async function dbLoadProject(id) {
  return await dbGet('projects', id);
}

async function dbGetAllProjects() {
  const projects = await dbGetAll('projects');
  return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function dbDeleteProject(id) {
  await dbDelete('projects', id);
  await dbDeleteByIndex('assets', 'projectId', id);
  await dbDelete('thumbnails', id);
}

// ── Assets (images + fonts) ────────────────────────────────────
async function dbSaveAsset(asset) {
  // asset = { id, projectId, type, blob, name, mimeType }
  await dbPut('assets', asset);
}

async function dbGetAsset(id) {
  return await dbGet('assets', id);
}

async function dbGetProjectAssets(projectId) {
  return await dbGetAllByIndex('assets', 'projectId', projectId);
}

async function dbDeleteAsset(id) {
  await dbDelete('assets', id);
}

// ── Thumbnails ─────────────────────────────────────────────────
async function dbSaveThumbnail(projectId, blob) {
  await dbPut('thumbnails', { projectId, blob });
}

async function dbGetThumbnail(projectId) {
  return await dbGet('thumbnails', projectId);
}

// ── localStorage Migration ─────────────────────────────────────
async function migrateFromLocalStorage() {
  const OLD_KEY = 'canvas_projects';
  const raw     = localStorage.getItem(OLD_KEY);
  if (!raw) return;

  try {
    const oldProjects = JSON.parse(raw);
    if (!oldProjects || !oldProjects.length) return;

    console.log(`Migrating ${oldProjects.length} project(s) from localStorage…`);

    for (const old of oldProjects) {
      const assetIds = [];

      // Migrate element image srcs to assets
      const elements = (old.elements || []).map(el => {
        if (el.type === 'image' && el._imgSrc) {
          const assetId = 'asset_' + el.id + '_' + Date.now();
          // Convert base64 to blob
          const blob = base64ToBlob(el._imgSrc);
          dbSaveAsset({
            id:        assetId,
            projectId: old.id,
            type:      'image',
            blob,
            name:      'image_' + el.id,
            mimeType:  'image/png'
          });
          assetIds.push(assetId);
          return { ...el, _assetId: assetId, _imgSrc: undefined };
        }
        return el;
      });

      // Migrate fonts
      const fontAssetIds = [];
      if (old.importedFonts && old.importedFonts.length) {
        for (const f of old.importedFonts) {
          const assetId = 'font_' + Date.now() + '_' + Math.random().toString(36).slice(2);
          const blob    = base64ToBlob(f.url);
          await dbSaveAsset({
            id:        assetId,
            projectId: old.id,
            type:      'font',
            blob,
            name:      f.name,
            mimeType:  'font/ttf'
          });
          fontAssetIds.push({ name: f.name, assetId });
        }
      }

      // Save thumbnail
      if (old.thumb) {
        const thumbBlob = base64ToBlob(old.thumb);
        await dbSaveThumbnail(old.id, thumbBlob);
      }

      // Save project without raw base64
      await dbSaveProject({
        id:           old.id,
        name:         old.name,
        elements,
        fontAssets:   fontAssetIds,
        createdAt:    old.createdAt,
        updatedAt:    old.updatedAt
      });
    }

    // Clear old localStorage data after successful migration
    localStorage.removeItem(OLD_KEY);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

// ── Utility ────────────────────────────────────────────────────
function base64ToBlob(dataUrl) {
  const parts    = dataUrl.split(',');
  const mime     = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary   = atob(parts[1] || parts[0]);
  const bytes    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader  = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function blobToObjectURL(blob) {
  return URL.createObjectURL(blob);
}

async function blobToImage(blob) {
  const url = blobToObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img   = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = url;
  });
}