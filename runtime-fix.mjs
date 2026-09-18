import fs from "node:fs/promises";

const file = new URL("./server.js", import.meta.url);
let source = await fs.readFile(file, "utf8");
source = source.replace('app.use(express.json({ limit: "250kb" }));', 'app.use(express.json({ limit: "600kb" }));');
source = source.replaceAll('image: normalizeText(p.image, 500)', 'image: normalizeText(p.image, 450000)');
source = source.replaceAll('image: normalizeText(p.image ?? products[i].image ?? "", 500)', 'image: normalizeText(p.image ?? products[i].image ?? "", 450000)');
await fs.writeFile(file, source, "utf8");
