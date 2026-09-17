(() => {
  let config = null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const wa = (text) => `https://wa.me/${config?.whatsappNumber || '254725528888'}?text=${encodeURIComponent(text)}`;

  async function loadConfig() {
    try { config = await fetch('/api/payment-config').then(r => r.ok ? r.json() : null); }
    catch (_) { config = null; }
    renderBankPanel();
  }

  function renderBankPanel(productName = '', amount = '') {
    const payButton = $('payNowButton');
    if (!payButton || document.getElementById('bankTransferButton')) return;
    const wrap = payButton.parentElement;
    const button = document.createElement('button');
    button.id = 'bankTransferButton';
    button.type = 'button';
    button.className = 'btn btn-secondary pay-now-btn';
    button.textContent = 'Pay via Bank Transfer';
    button.addEventListener('click', () => showBankPanel(productName, amount));
    payButton.insertAdjacentElement('afterend', button);

    const panel = document.createElement('div');
    panel.id = 'bankTransferPanel';
    panel.className = 'mpesa-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <h4 style="margin:0 0 8px">Bank transfer checkout</h4>
      <p style="margin:0 0 12px">Transfer the order total to the account below, then send the transfer reference to FARMTEK09 CENTRE for verification.</p>
      <div class="pay-field"><span class="pay-field-text">Bank<span class="pay-value" id="bankNameValue">${esc(config?.bankTransfer?.bankName || 'Not configured yet')}</span></span></div>
      <div class="pay-field"><span class="pay-field-text">Account name<span class="pay-value">${esc(config?.bankTransfer?.accountName || 'FARMTEK09 CENTRE')}</span></span></div>
      <div class="pay-field"><span class="pay-field-text">Account number<span class="pay-value" id="bankAccountValue">${esc(config?.bankTransfer?.accountNumber || 'Not configured yet')}</span></span><button class="btn btn-copy" id="copyBankAccount" type="button">Copy</button></div>
      <div class="pay-field"><span class="pay-field-text">Branch<span class="pay-value">${esc(config?.bankTransfer?.branch || 'Not configured yet')}</span></span></div>
      <div class="pay-field"><span class="pay-field-text">Branch code<span class="pay-value">${esc(config?.bankTransfer?.branchCode || 'Not configured yet')}</span></span></div>
      <label for="bankOrderAmount">Order amount (KES)</label><input id="bankOrderAmount" type="number" min="1" step="1" value="${esc(amount)}" placeholder="Amount">
      <label for="bankReference">Transfer reference</label><input id="bankReference" type="text" maxlength="40" placeholder="e.g. bank receipt/reference number">
      <label for="bankCustomerName">Customer name</label><input id="bankCustomerName" type="text" maxlength="80" placeholder="Your name">
      <label for="bankPhone">Phone / WhatsApp</label><input id="bankPhone" type="tel" maxlength="20" placeholder="0712 345 678">
      <label for="bankProduct">Order / product</label><input id="bankProduct" type="text" maxlength="160" value="${esc(productName)}" placeholder="Product or order details">
      <button id="bankConfirmButton" class="btn btn-primary" type="button">I’ve made the bank transfer</button>
      <p id="bankStatus" class="mpesa-status" role="status" aria-live="polite"></p>`;
    wrap.appendChild(panel);

    $('copyBankAccount')?.addEventListener('click', async () => {
      const value = config?.bankTransfer?.accountNumber || '';
      if (!value) return;
      try { await navigator.clipboard.writeText(value); $('copyBankAccount').textContent = 'Copied!'; setTimeout(() => $('copyBankAccount').textContent = 'Copy', 1600); } catch (_) {}
    });
    $('bankConfirmButton')?.addEventListener('click', submitBankTransfer);
  }

  function showBankPanel(productName = '', amount = '') {
    const panel = $('bankTransferPanel');
    if (!panel) return;
    panel.hidden = false;
    if (productName) $('bankProduct').value = productName;
    if (amount) $('bankOrderAmount').value = amount;
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('bankReference')?.focus();
  }

  function status(message, state = '') { const el = $('bankStatus'); if (el) { el.textContent = message; el.dataset.state = state; } }

  function submitBankTransfer() {
    const amount = Number($('bankOrderAmount')?.value);
    const reference = $('bankReference')?.value.trim();
    const name = $('bankCustomerName')?.value.trim();
    const phone = $('bankPhone')?.value.trim();
    const product = $('bankProduct')?.value.trim();
    if (!config?.bankTransfer?.enabled || !config?.bankTransfer?.bankName || !config?.bankTransfer?.accountNumber) return status('Bank transfer is not configured yet. The store owner must add the bank details in the hosting environment.', 'error');
    if (!Number.isInteger(amount) || amount < 1) return status('Enter the transfer amount.', 'error');
    if (!reference) return status('Enter the bank transfer/reference number.', 'error');
    if (!name || !phone) return status('Enter your name and phone/WhatsApp number.', 'error');
    const msg = `Hi FARMTEK09 CENTRE! I have made a bank transfer.\n\nOrder: ${product || 'Store order'}\nAmount: KES ${amount.toLocaleString()}\nCustomer: ${name}\nPhone: ${phone}\nBank: ${config.bankTransfer.bankName}\nAccount: ${config.bankTransfer.accountName}\nTransfer reference: ${reference}\n\nPlease verify the payment and confirm my order.`;
    window.open(wa(msg), '_blank', 'noopener');
    status('WhatsApp opened with your transfer confirmation. Keep your bank receipt until the payment is verified.', 'success');
  }

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-pay-product]');
    if (!btn) return;
    setTimeout(() => showBankPanel(btn.dataset.payProduct || '', btn.dataset.payAmount || ''), 50);
  });

  document.addEventListener('DOMContentLoaded', () => { renderBankPanel(); loadConfig(); });
})();
