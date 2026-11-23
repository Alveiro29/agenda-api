// Empaqueta Cahier en un solo HTML (dist/Cahier.html) que se abre con doble clic.
// y el instalador de Mac (dist/instalar-cahier.sh).
// Uso: node scripts/build-cahier.js
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "cahier");
const out = path.join(__dirname, "..", "dist");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
for (const f of ["contenido.js", "app.js"]) {
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) throw new Error(`No encuentro ${tag} en index.html`);
  const js = fs.readFileSync(path.join(dir, f), "utf8").replace(/<\/script/gi, "<\\/script");
  html = html.replace(tag, () => `<script>\n${js}\n</script>`);
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "Cahier.html"), html);
console.log(`dist/Cahier.html (${(html.length / 1024).toFixed(0)} KB)`);

// Instalador para Mac: un solo .sh con la app, el ícono y el código Swift dentro.
const mac = path.join(__dirname, "..", "mac");
const b64 = buf => Buffer.from(buf).toString("base64").replace(/.{76}/g, "$&\n");
const sh = fs.readFileSync(path.join(mac, "instalar.plantilla.sh"), "utf8")
  .replace("@@HTML@@", () => b64(html))
  .replace("@@ICON@@", () => b64(fs.readFileSync(path.join(mac, "icon.png"))))
  .replace("@@SWIFT@@", () => b64(fs.readFileSync(path.join(mac, "Cahier.swift"))));
fs.writeFileSync(path.join(out, "instalar-cahier.sh"), sh, { mode: 0o755 });
console.log(`dist/instalar-cahier.sh (${(sh.length / 1024).toFixed(0)} KB)`);
