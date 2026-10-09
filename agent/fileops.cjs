/**
 * File ops laptop untuk job mode "file" (tanpa Claude Code: cepat, tanpa biaya token).
 *
 * instruction adalah JSON:
 *   { "op": "read",  "path": "Dokumen/catatan.txt", "maxBytes": 4000 }
 *   { "op": "read",  "path": "Dokumen/nib.pdf", "binary": true }
 *   { "op": "write", "path": "Dokumen/hasil.txt", "content": "...", "encoding": "utf8" }
 *   { "op": "write", "path": "Dokumen/foto.png", "contentBase64": "...", "encoding": "base64" }
 *   { "op": "list",  "path": "Dokumen", "recursive": false }
 *
 * Keamanan:
 * - path HARUS relatif dan HARUS berada di dalam salah satu roots
 *   (app.fileOps.roots di apps.json, hanya dari config laptop).
 * - Tolak "..", path absolut, dan symlink yang keluar dari roots.
 * - Batas: baca teks maks 2 MB (dipotong + flag), tulis maks 50 MB.
 * - Isi file TIDAK PERNAH di-log.
 *
 * Kembalian: { status, summary, files, error, fileOp } untuk report() queue.cjs.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_WRITE_BYTES = 50 * 1024 * 1024;

/** Resolve path relatif ke dalam roots; lempar Error bila di luar. */
function resolveInRoots(roots, relPath) {
  const rel = String(relPath || "").trim().replace(/\//g, path.sep);
  if (!rel || path.isAbsolute(rel)) throw new Error("path harus relatif terhadap folder yang diizinkan");
  for (const root of roots) {
    const absRoot = path.resolve(root);
    const abs = path.resolve(absRoot, rel);
    if (abs !== absRoot && !abs.startsWith(absRoot + path.sep)) continue;
    // Cegah symlink yang keluar dari roots (untuk file yang sudah ada)
    try {
      const real = fs.realpathSync(abs);
      if (real !== absRoot && !real.startsWith(absRoot + path.sep)) continue;
    } catch {
      // Belum ada (untuk write): cek parent yang ada
      let dir = path.dirname(abs);
      while (!fs.existsSync(dir) && dir !== path.dirname(dir)) dir = path.dirname(dir);
      try {
        const realDir = fs.realpathSync(dir);
        if (realDir !== absRoot && !realDir.startsWith(absRoot + path.sep)) continue;
      } catch {
        continue;
      }
    }
    return abs;
  }
  throw new Error("path di luar folder yang diizinkan");
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

async function uploadBlob(deps, s, abs, filename) {
  const buf = fs.readFileSync(abs);
  const res = await deps.fetch(`${s.url}/api/agent-blobs?filename=${encodeURIComponent(filename)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.token}`, "Content-Type": "application/octet-stream" },
    body: buf,
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload blob gagal (${res.status}): ${j.error || ""}`);
  return { key: j.key, size: j.size || buf.length };
}

async function opRead(deps, s, abs, p, log) {
  const st = fs.statSync(abs);
  if (!st.isFile()) throw new Error("path bukan file");
  if (p.binary) {
    if (st.size > MAX_WRITE_BYTES) throw new Error(`file terlalu besar (${fmtBytes(st.size)})`);
    const { key } = await uploadBlob(deps, s, abs, path.basename(abs));
    log(`[fileops] read biner ${p.path} (${fmtBytes(st.size)}) -> blob`);
    return {
      status: "done",
      summary: `File biner: ${path.basename(abs)} (${fmtBytes(st.size)})`,
      files: [`blob:${key}`],
      fileOp: { op: "read", path: p.path, bytes: st.size },
    };
  }
  const max = Math.min(Number(p.maxBytes) > 0 ? Number(p.maxBytes) : 4000, MAX_READ_BYTES);
  const fd = fs.openSync(abs, "r");
  try {
    const len = Math.min(st.size, max);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    const text = buf.toString("utf8");
    const truncated = st.size > max;
    log(`[fileops] read ${p.path} (${fmtBytes(st.size)}${truncated ? ", dipotong" : ""})`);
    return {
      status: "done",
      summary: truncated ? `${text}\n…(dipotong, ${fmtBytes(st.size)} total)` : text,
      files: [],
      fileOp: { op: "read", path: p.path, bytes: st.size },
    };
  } finally {
    fs.closeSync(fd);
  }
}

async function opWrite(deps, s, abs, p, log) {
  let buf;
  if (typeof p.contentBase64 === "string") buf = Buffer.from(p.contentBase64, "base64");
  else if (typeof p.content === "string") buf = Buffer.from(p.content, "utf8");
  else throw new Error("write butuh content atau contentBase64");
  if (buf.length > MAX_WRITE_BYTES) throw new Error(`konten terlalu besar (${fmtBytes(buf.length)})`);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buf);
  log(`[fileops] write ${p.path} (${fmtBytes(buf.length)})`);
  return {
    status: "done",
    summary: `Tersimpan: ${p.path} (${fmtBytes(buf.length)})`,
    files: [],
    fileOp: { op: "write", path: p.path, bytes: buf.length },
  };
}

async function opList(abs, p, log) {
  const st = fs.statSync(abs);
  if (!st.isDirectory()) throw new Error("path bukan folder");
  const out = [];
  const walk = (dir, depth) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const s = fs.statSync(full);
      out.push({ name: path.relative(abs, full).replace(/\\/g, "/"), dir: s.isDirectory(), bytes: s.isDirectory() ? null : s.size });
      if (s.isDirectory() && p.recursive && depth < 3) walk(full, depth + 1);
    }
  };
  walk(abs, 0);
  log(`[fileops] list ${p.path} (${out.length} entri)`);
  return {
    status: "done",
    summary: JSON.stringify(out.slice(0, 200)),
    files: [],
    fileOp: { op: "list", path: p.path, bytes: null },
  };
}

/**
 * Jalankan satu job file. deps: { fetch, log }.
 * s: settings() -> { url, token }. app: entri apps.json (pakai app.fileOps.roots).
 */
async function runFileOp(deps, s, app, job) {
  const { log } = deps;
  try {
    const roots = (app.fileOps && app.fileOps.roots) || [];
    if (!roots.length) throw new Error(`app "${app.id}" belum dikonfigurasi fileOps.roots di apps.json`);
    let p;
    try {
      p = JSON.parse(job.instruction);
    } catch {
      throw new Error("instruction bukan JSON valid");
    }
    if (!p || !["read", "write", "list"].includes(p.op)) throw new Error("op harus read, write, atau list");
    const abs = resolveInRoots(roots, p.path);
    if (p.op === "read") {
      if (!fs.existsSync(abs)) throw new Error(`file tidak ditemukan: ${p.path}`);
      return await opRead(deps, s, abs, p, log);
    }
    if (p.op === "write") return await opWrite(deps, s, abs, p, log);
    if (!fs.existsSync(abs)) throw new Error(`folder tidak ditemukan: ${p.path}`);
    return await opList(abs, p, log);
  } catch (e) {
    log(`[fileops] gagal: ${e.message}`);
    return { status: "error", summary: null, files: [], error: e.message, fileOp: null };
  }
}

module.exports = { runFileOp, resolveInRoots };
