(() => {
  const originalFetch = window.fetch.bind(window);
  const overrideIds = new Set(["apple-mango-source", "lemon-source", "grafted-pixie-orange"]);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.endsWith("/products.json") || url === "products.json") input = "data/catalogue.json";
    const response = await originalFetch(input, init);
    if (!/data\/catalogue\.json$|\/api\/catalogue$/.test(String(input)) || !response.ok) return response;
    try {
      const data = await response.clone().json();
      if (!Array.isArray(data)) return response;
      const filtered = data.filter((product) => !overrideIds.has(product.id));
      return new Response(JSON.stringify(filtered), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (_) { return response; }
  };
})();
