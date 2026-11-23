// Empaqueta Cahier en un solo HTML (dist/Cahier.html) que se abre con doble clic.
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
