// キャリアの自動セーブ（本筋4・`TODO.md` #13）。
// ⚠️IndexedDBを使う（localStorageではない）。理由は実測：現行のロースター
// （150厩舎×5,090〜5,113頭）をそのままJSONにすると、開始時点で5.77MB・
// 52週後で6.85MBあり、localStorageの上限（ブラウザにより5〜10MB）に迫る／超えうる
// （`devlog/wave10.md`§11・測定スクリプトの実測）。IndexedDBはこの上限がずっと大きい。
//
// ⚠️**1人1件の自動セーブ**（2026-09-19にユーザーが決定）。複数キャリアの並行セーブは持たない。
// 保存のタイミングは「卒業式が終わって週の画面に入った瞬間」と「毎週`この週を進める`の直後」。
//
// 純ロジック層のすぐ上（`domain/`が返す`roster`・`player`をそのまま保存するだけ）。
// JSX無し。`domain/`には依存しない（型を知る必要が無い——丸ごと保存して丸ごと返すだけ）。

const DB_NAME = "keiba-game";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const SAVE_KEY = "current"; // 1人1件なので固定のキー1つだけを使う

// セーブの中身の形が変わったら（`domain/horse.js`等のフィールドが増減したら）ここを上げる。
// 読み込み時に一致しなければ「セーブ無し」として扱う（例外で画面を壊さない）。
export const SAVE_SCHEMA_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = fn(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

/**
 * 今のキャリアを1件だけ保存する（上書き）。
 * ⚠️**失敗しても例外を投げない**——プライベートブラウジング等でIndexedDBが使えない
 * 環境でも、プレイ自体は止めない（保存できないだけにする）。
 * @param {number|string} saveSeed
 * @param {number} startYear - キャリア開始年（`player.currentYear`とは別——1年目が
 *   終わったかどうかの判定に使う開始時点の値）
 * @param {object} roster
 * @param {object} player
 * @returns {Promise<boolean>} 保存できたか
 */
export async function writeSave(saveSeed, startYear, roster, player) {
  const payload = { schemaVersion: SAVE_SCHEMA_VERSION, savedAt: Date.now(), saveSeed, startYear, roster, player };
  try {
    await withStore("readwrite", (store) => store.put(payload, SAVE_KEY));
    return true;
  } catch {
    return false;
  }
}

/**
 * 保存済みのキャリアを読む。無い・壊れている・セーブの形が古い場合は`null`
 * （「セーブ無し」と同じ扱い）。
 * @returns {Promise<{ saveSeed: number|string, startYear: number, roster: object,
 *   player: object, savedAt: number }|null>}
 */
export async function readSave() {
  try {
    const payload = await withStore("readonly", (store) => store.get(SAVE_KEY));
    if (!payload || payload.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
    if (!payload.saveSeed || !payload.roster || !payload.player) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 保存済みのキャリアを消す。 */
export async function clearSave() {
  try {
    await withStore("readwrite", (store) => store.delete(SAVE_KEY));
    return true;
  } catch {
    return false;
  }
}
