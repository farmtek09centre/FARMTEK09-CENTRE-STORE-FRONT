import fs from "node:fs";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const catalogue = readJson("data/catalogue.json");
const orders = readJson("data/orders.json");
const overrideIds = new Set(["apple-mango-source", "lemon-source", "grafted-pixie-orange"]);
const effective = catalogue.filter((product) => !overrideIds.has(product.id));
const ids = new Set();

for (const product of effective) {
  if (!product.id || !product.name || !product.category) throw new Error(`Invalid catalogue item: ${JSON.stringify(product)}`);
  if (ids.has(product.id)) throw new Error(`Duplicate effective product ID: ${product.id}`);
  ids.add(product.id);
  if (product.price != null && (!Number.isFinite(Number(product.price)) || Number(product.price) < 0)) throw new Error(`Invalid price for ${product.id}`);
  if (product.stock != null && (!Number.isInteger(Number(product.stock)) || Number(product.stock) < 0)) throw new Error(`Invalid stock for ${product.id}`);
}

for (const required of ["apple-grafted-mango", "hass-grafted-avocado", "pixie-tangerine", "lemon-tree-seedling"]) {
  if (!ids.has(required)) throw new Error(`Missing FARMTEK09 catalogue entry: ${required}`);
}

if (!Array.isArray(orders)) throw new Error("data/orders.json must be an array");
console.log(`Store checks passed: ${effective.length} effective catalogue products, ${orders.length} stored orders.`);
