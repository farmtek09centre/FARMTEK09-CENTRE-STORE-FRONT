(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.endsWith('/products.json') || url === 'products.json') return originalFetch('data/catalogue.json', init);
    return originalFetch(input, init);
  };

  const decorate = () => {
    document.querySelectorAll('.card[data-product-id]').forEach(card => {
      if (card.querySelector('.inventory-badge')) return;
      const id = card.dataset.productId;
      const product = window.__CATALOGUE_PRODUCTS__?.find(p => p.id === id);
      if (!product) return;
      const badge = document.createElement('span');
      badge.className = 'inventory-badge';
      badge.style.cssText = 'display:inline-block;margin:8px 0 0;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700;background:#eef5e9;color:#24532d';
      badge.textContent = product.stock === 0 ? 'Out of stock' : product.stock == null ? 'Availability to confirm' : `${product.stock} in stock`;
      if (product.stock === 0) { badge.style.background='#fdecec'; badge.style.color='#9b2020'; }
      card.querySelector('.card-body')?.appendChild(badge);
    });
  };

  const originalJson = Response.prototype.json;
  Response.prototype.json = async function() {
    const data = await originalJson.call(this);
    if (Array.isArray(data) && data.some(p => p && p.id)) window.__CATALOGUE_PRODUCTS__ = data;
    return data;
  };

  const addAdminLink = () => {
    if (document.getElementById('adminLink')) return;
    const a = document.createElement('a'); a.id='adminLink'; a.href='admin.html'; a.textContent='Admin'; a.target='_blank'; a.rel='noopener';
    a.style.cssText='margin-left:12px;color:inherit;text-decoration:none;font-weight:700';
    document.querySelector('.topbar-inner')?.appendChild(a);
  };

  new MutationObserver(() => { decorate(); addAdminLink(); }).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>{decorate();addAdminLink();});
})();