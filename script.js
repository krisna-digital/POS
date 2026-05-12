// ============================================
// DATA STORE
// ============================================
const STORAGE_KEYS = {
  customers: 'kd_customers',
  items: 'kd_items',
  transactions: 'kd_transactions',
  settings: 'kd_settings',
  theme: 'kd_theme',
  lastInvoice: 'kd_last_invoice'
};

function getData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch { return []; }
}

function setData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function getSetting(key, def = '') {
  const s = getData(STORAGE_KEYS.settings);
  return s[key] || def;
}

function setSetting(key, val) {
  const s = getData(STORAGE_KEYS.settings);
  s[key] = val;
  setData(STORAGE_KEYS.settings, s);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatRupiah(num) {
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${days[d.getDay()]}, ${d.getDate().toString().padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'});
}

function generateId(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return prefix + ts + rand;
}

function generateInvoiceNumber() {
  let lastInv = parseInt(localStorage.getItem(STORAGE_KEYS.lastInvoice) || '0');
  lastInv++;
  localStorage.setItem(STORAGE_KEYS.lastInvoice, lastInv.toString());
  return 'INV' + lastInv.toString().padStart(4, '0');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = { success: 'check-circle-fill', danger: 'x-circle-fill', warning: 'exclamation-triangle-fill', info: 'info-circle-fill' };
  const colors = { success: '#4facfe', danger: '#f5576c', warning: '#f6d365', info: '#667eea' };
  const toast = document.createElement('div');
  toast.className = 'toast-glass p-2 d-flex align-items-center gap-2';
  toast.style.animation = 'fadeInUp 0.3s ease';
  toast.innerHTML = `
    <i class="bi bi-${icons[type]}" style="color:${colors[type]};font-size:1rem"></i>
    <span style="flex:1;font-size:0.8rem">${message}</span>
    <button type="button" class="btn-close btn-sm" style="font-size:0.6rem" onclick="this.parentElement.remove()"></button>
  `;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ============================================
// NAVIGATION
// ============================================
function showPage(page, event) {
  if (event) event.preventDefault();
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.main-nav .nav-link').forEach(l => l.classList.remove('active'));
  if (event && event.target) {
    event.target.closest('.nav-link').classList.add('active');
  } else {
    const links = document.querySelectorAll('.main-nav .nav-link');
    const pageMap = { dashboard:0, customers:1, items:2, transaction:3, history:4, settings:5 };
    if (links[pageMap[page]]) links[pageMap[page]].classList.add('active');
  }

  if (page === 'dashboard') refreshDashboard();
  if (page === 'customers') renderCustomers();
  if (page === 'items') renderItems();
  if (page === 'transaction') { 
    renderTxCustomer(); 
    renderTxItems(); 
    initTransactionSwitch();
  }
  if (page === 'history') renderHistory();
  if (page === 'settings') loadSettings();
}

// ============================================
// THEME
// ============================================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-bs-theme') === 'dark';
  html.setAttribute('data-bs-theme', isDark ? 'light' : 'dark');
  document.querySelectorAll('.theme-toggle').forEach(t => t.classList.toggle('dark', !isDark));
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'light' : 'dark');
}

function loadTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  document.documentElement.setAttribute('data-bs-theme', theme);
  document.querySelectorAll('.theme-toggle').forEach(t => t.classList.toggle('dark', theme === 'dark'));
}

// ============================================
// CUSTOMERS CRUD (ringkas)
// ============================================
let pendingCustomerCallback = null;

function openCustomerModal(id = null, fromTransaction = false) {
  document.getElementById('customerId').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  document.getElementById('customerAddress').value = '';
  document.getElementById('customerWA').value = '';
  document.getElementById('customerModalTitle').innerHTML = '<i class="bi bi-person-plus me-1"></i>Tambah Pelanggan';
  pendingCustomerCallback = fromTransaction ? () => { renderTxCustomer(); } : null;
  if (id) {
    const customers = getData(STORAGE_KEYS.customers);
    const c = customers.find(x => x.id === id);
    if (c) {
      document.getElementById('customerId').value = c.id;
      document.getElementById('customerName').value = c.name;
      document.getElementById('customerPhone').value = c.phone || '';
      document.getElementById('customerAddress').value = c.address || '';
      document.getElementById('customerWA').value = c.whatsapp || '';
      document.getElementById('customerModalTitle').innerHTML = '<i class="bi bi-pencil me-1"></i>Edit Pelanggan';
      pendingCustomerCallback = null;
    }
  }
  new bootstrap.Modal(document.getElementById('customerModal')).show();
}

function saveCustomer() {
  const id = document.getElementById('customerId').value;
  const name = document.getElementById('customerName').value.trim();
  if (!name) { showToast('Nama pelanggan harus diisi!', 'warning'); return; }
  const customers = getData(STORAGE_KEYS.customers);
  const data = {
    id: id || generateId('CUST'),
    name: name,
    phone: document.getElementById('customerPhone').value.trim(),
    address: document.getElementById('customerAddress').value.trim(),
    whatsapp: document.getElementById('customerWA').value.trim(),
    updatedAt: new Date().toISOString()
  };
  if (id) {
    const idx = customers.findIndex(x => x.id === id);
    if (idx >= 0) { data.createdAt = customers[idx].createdAt; customers[idx] = data; }
  } else {
    data.createdAt = new Date().toISOString();
    customers.push(data);
  }
  setData(STORAGE_KEYS.customers, customers);
  bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
  renderCustomers();
  if (pendingCustomerCallback) { pendingCustomerCallback(); pendingCustomerCallback = null; renderTxCustomer(); }
  showToast(id ? 'Pelanggan diupdate' : 'Pelanggan ditambahkan');
}

function deleteCustomer(id) {
  if (!confirm('Yakin ingin menghapus pelanggan ini?')) return;
  let customers = getData(STORAGE_KEYS.customers);
  customers = customers.filter(x => x.id !== id);
  setData(STORAGE_KEYS.customers, customers);
  renderCustomers();
  if (document.getElementById('page-transaction').classList.contains('active')) renderTxCustomer();
  showToast('Pelanggan dihapus', 'danger');
}

function renderCustomers() {
  const customers = getData(STORAGE_KEYS.customers);
  const search = (document.getElementById('customerSearch').value || '').toLowerCase();
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search) || (c.phone || '').includes(search));
  const tbody = document.getElementById('customerTableBody');
  if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state py-2">Tidak ada data</div></td></tr>`; return; }
  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td><span class="badge-glass px-1 py-0 fs-7">${c.id}</span></td>
      <td><div class="d-flex align-items-center gap-1"><div class="customer-avatar" style="width:28px;height:28px;font-size:0.7rem">${c.name.charAt(0)}</div><strong>${escapeHtml(c.name)}</strong></div></td>
      <td>${c.phone || '-'}</td>
      <td class="text-truncate" style="max-width:120px">${escapeHtml(c.address || '-')}</td>
      <td>${c.whatsapp || '-'}</td>
      <td><button class="btn btn-sm btn-glass-primary me-1" onclick="openCustomerModal('${c.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-glass-danger" onclick="deleteCustomer('${c.id}')"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('');
}

// ============================================
// ITEMS CRUD (ringkas)
// ============================================
function openItemModal(id = null) {
  document.getElementById('itemId').value = '';
  document.getElementById('itemCode').value = '';
  document.getElementById('itemName').value = '';
  document.getElementById('itemCategory').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemStock').value = '0';
  document.getElementById('itemModalTitle').innerHTML = '<i class="bi bi-box-seam me-1"></i>Tambah Barang';
  const items = getData(STORAGE_KEYS.items);
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  document.getElementById('categoryList').innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">`).join('');
  if (id) {
    const item = items.find(x => x.id === id);
    if (item) {
      document.getElementById('itemId').value = item.id;
      document.getElementById('itemCode').value = item.code || '';
      document.getElementById('itemName').value = item.name;
      document.getElementById('itemCategory').value = item.category || '';
      document.getElementById('itemPrice').value = item.price;
      document.getElementById('itemStock').value = item.stock || 0;
      document.getElementById('itemModalTitle').innerHTML = '<i class="bi bi-pencil me-1"></i>Edit Barang';
    }
  } else {
    document.getElementById('itemCode').value = 'BRG-' + (items.length + 1).toString().padStart(3, '0');
  }
  new bootstrap.Modal(document.getElementById('itemModal')).show();
}

function saveItem() {
  const id = document.getElementById('itemId').value;
  const name = document.getElementById('itemName').value.trim();
  const price = parseFloat(document.getElementById('itemPrice').value);
  if (!name) { showToast('Nama barang harus diisi!', 'warning'); return; }
  if (isNaN(price) || price < 0) { showToast('Harga harus valid!', 'warning'); return; }
  const items = getData(STORAGE_KEYS.items);
  const data = {
    id: id || generateId('ITEM'),
    code: document.getElementById('itemCode').value.trim() || 'BRG-' + (items.length + 1).toString().padStart(3, '0'),
    name: name,
    category: document.getElementById('itemCategory').value.trim(),
    price: price,
    stock: parseInt(document.getElementById('itemStock').value) || 0,
    updatedAt: new Date().toISOString()
  };
  if (id) {
    const idx = items.findIndex(x => x.id === id);
    if (idx >= 0) { data.createdAt = items[idx].createdAt; items[idx] = data; }
  } else {
    data.createdAt = new Date().toISOString();
    items.push(data);
  }
  setData(STORAGE_KEYS.items, items);
  bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
  renderItems();
  if (document.getElementById('page-transaction').classList.contains('active')) renderTxItems();
  showToast(id ? 'Barang diupdate' : 'Barang ditambahkan');
}

function deleteItem(id) {
  if (!confirm('Yakin ingin menghapus barang ini?')) return;
  let items = getData(STORAGE_KEYS.items);
  items = items.filter(x => x.id !== id);
  setData(STORAGE_KEYS.items, items);
  renderItems();
  if (document.getElementById('page-transaction').classList.contains('active')) renderTxItems();
  showToast('Barang dihapus', 'danger');
}

function renderItems() {
  const items = getData(STORAGE_KEYS.items);
  const search = (document.getElementById('itemSearch').value || '').toLowerCase();
  const catFilter = document.getElementById('itemCategoryFilter').value;
  const filtered = items.filter(i => (i.name.toLowerCase().includes(search) || (i.code || '').toLowerCase().includes(search)) && (!catFilter || i.category === catFilter));
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const catSelect = document.getElementById('itemCategoryFilter');
  const currentCat = catSelect.value;
  catSelect.innerHTML = '<option value="">Semua Kategori</option>' + categories.map(c => `<option value="${escapeHtml(c)}" ${c === currentCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  const tbody = document.getElementById('itemTableBody');
  if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state py-2">Tidak ada data</div></td></tr>`; return; }
  tbody.innerHTML = filtered.map(i => `
    <tr>
      <td><span class="badge-glass px-1 py-0">${escapeHtml(i.code)}</span></td>
      <td><strong>${escapeHtml(i.name)}</strong></td>
      <td><span class="category-chip px-2 py-0 fs-7">${escapeHtml(i.category || '-')}</span></td>
      <td>${formatRupiah(i.price)}</td>
      <td class="${i.stock <= 5 ? 'text-danger fw-bold' : ''}">${i.stock}</td>
      <td><button class="btn btn-sm btn-glass-primary me-1" onclick="openItemModal('${i.id}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-glass-danger" onclick="deleteItem('${i.id}')"><i class="bi bi-trash"></i></button></td>
    </tr>
  `).join('');
}

// ============================================
// TRANSACTION (ringkas, fungsi sama tapi sudah ada yang penting)
// ============================================
let cart = [];

function renderTxCustomer() {
  const customers = getData(STORAGE_KEYS.customers);
  const sel = document.getElementById('txCustomer');
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' + customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = current;
}

function renderTxItems() {
  const items = getData(STORAGE_KEYS.items);
  const search = (document.getElementById('txItemSearch').value || '').toLowerCase();
  const filtered = items.filter(i => i.name.toLowerCase().includes(search) || (i.code || '').toLowerCase().includes(search));
  const container = document.getElementById('txItemList');
  if (filtered.length === 0) { container.innerHTML = '<div class="empty-state py-2"><i class="bi bi-inbox"></i><p class="small">Tidak ada barang</p></div>'; return; }
  container.innerHTML = filtered.map(i => {
    const inCart = cart.find(c => c.originalItemId === i.id);
    const isOutOfStock = i.stock <= 0;
    return `<div class="item-card d-flex justify-content-between align-items-center p-2 mb-1" style="${isOutOfStock ? 'opacity:0.5' : ''}" onclick="${!inCart && !isOutOfStock ? `addToCart('${i.id}')` : ''}">
      <div><strong class="fs-6">${escapeHtml(i.name)}</strong><div class="item-price small">${formatRupiah(i.price)}</div><small>Stok: ${i.stock}</small></div>
      <button class="btn btn-sm ${inCart ? 'btn-glass-danger' : (isOutOfStock ? 'btn-secondary disabled' : 'btn-glass-primary')}" onclick="event.stopPropagation();${inCart ? `removeFromCart('${i.id}')` : (!isOutOfStock ? `addToCart('${i.id}')` : '')}"><i class="bi bi-${inCart ? 'dash-lg' : 'plus-lg'}"></i></button>
    </div>`;
  }).join('');
}

function addToCart(itemId) { /* sama seperti sebelumnya, disisipkan saja agar tidak terlalu panjang, intinya fungsi ini tetap ada */ 
  const items = getData(STORAGE_KEYS.items);
  const item = items.find(i => i.id === itemId);
  if (!item || item.stock <= 0) return showToast('Stok habis','warning');
  const existing = cart.find(c => c.originalItemId === itemId);
  if (existing) { if (existing.qty + 1 > item.stock) return showToast(`Stok ${item.name} tidak cukup`,'warning'); existing.qty++; }
  else { cart.push({ itemId: generateId('CART'), originalItemId: item.id, name: item.name, price: item.price, qty: 1 }); }
  renderCart(); renderTxItems(); showToast(`${item.name} ditambahkan`,'info');
}
function removeFromCart(itemId) { 
  const existing = cart.find(c => c.originalItemId === itemId);
  if (existing) { if (existing.qty > 1) existing.qty--; else cart = cart.filter(c => c.originalItemId !== itemId); renderCart(); renderTxItems(); }
}
function renderCart() { 
  const container = document.getElementById('cartItems');
  if (cart.length===0) { container.innerHTML = '<div class="empty-state py-2">Keranjang kosong</div>'; updateCartTotals(); return; }
  container.innerHTML = cart.map(item => `<div class="cart-item p-2 mb-1"><div class="d-flex justify-content-between"><input type="text" class="editable-field small" value="${escapeHtml(item.name)}" onchange="updateCartItemName('${item.originalItemId}',this.value)" style="flex:1"><button class="btn btn-sm btn-glass-danger" onclick="removeFromCart('${item.originalItemId}')"><i class="bi bi-x"></i></button></div><div class="d-flex justify-content-between align-items-center mt-1"><div class="qty-control"><button class="qty-btn" onclick="updateCartItemQty('${item.originalItemId}',${item.qty-1})">−</button><input type="number" class="form-control form-control-sm text-center" style="width:45px" value="${item.qty}" min="0" onchange="updateCartItemQty('${item.originalItemId}',this.value)"><button class="qty-btn" onclick="updateCartItemQty('${item.originalItemId}',${item.qty+1})">+</button></div><input type="number" class="editable-field cart-price-input" value="${item.price}" onchange="updateCartItemPrice('${item.originalItemId}',this.value)" style="width:80px"><span class="fw-bold">${formatRupiah(item.price*item.qty)}</span></div></div>`).join('');
  updateCartTotals();
}
function updateCartItemQty(oid, qty) { let item = cart.find(c=>c.originalItemId===oid); if(!item) return; qty=parseInt(qty); if(isNaN(qty)) qty=1; let stock=getItemStock(oid); if(qty>stock) { showToast(`Stok maksimal ${stock}`,'warning'); qty=stock; } if(qty<=0) cart=cart.filter(c=>c.originalItemId!==oid); else item.qty=qty; renderCart(); renderTxItems(); }
function updateCartItemPrice(oid,price) { let item = cart.find(c=>c.originalItemId===oid); if(item) { let p=parseFloat(price); if(!isNaN(p) && p>=0) item.price=p; renderCart(); } }
function updateCartItemName(oid,name) { let item = cart.find(c=>c.originalItemId===oid); if(item && name.trim()) item.name=name.trim(); renderCart(); }
function updateCartTotals() { let subtotal = cart.reduce((s,i)=>s+(i.price*i.qty),0); let disc = Math.min(parseFloat(document.getElementById('cartDiscount').value)||0, subtotal); let total = subtotal-disc; document.getElementById('cartSubtotal').innerHTML=formatRupiah(subtotal); document.getElementById('cartDiscountDisplay').innerHTML='- '+formatRupiah(disc); document.getElementById('cartTotal').innerHTML=formatRupiah(total); document.getElementById('cartDiscount').value=disc; }
function clearCart() { if(cart.length && confirm('Kosongkan keranjang?')) { cart=[]; document.getElementById('cartDiscount').value=0; renderCart(); renderTxItems(); showToast('Keranjang kosong','info'); } }
function getItemStock(id) { let item = getData(STORAGE_KEYS.items).find(i=>i.id===id); return item?item.stock:0; }
function validateStockBeforeTransaction() { /* sama */ for(let ci of cart){ let db = getData(STORAGE_KEYS.items).find(i=>i.id===ci.originalItemId); if(!db || db.stock<ci.qty) { showToast(`Stok ${ci.name} tidak cukup`,'warning'); return false; } } return true; }
function initTransactionSwitch() { const sw = document.getElementById('paymentStatusSwitch'), lb = document.getElementById('paymentStatusLabel'); if(sw && lb) { sw.removeEventListener('change', sw._list); const fn = function() { lb.textContent = this.checked ? 'Lunas' : 'Belum Lunas'; }; sw.addEventListener('change', fn); sw._list = fn; sw.checked = false; lb.textContent = 'Belum Lunas'; } }

function processTransaction() {
  if(cart.length===0) return showToast('Keranjang kosong','warning');
  if(!validateStockBeforeTransaction()) return;
  const custId = document.getElementById('txCustomer').value;
  const customers = getData(STORAGE_KEYS.customers);
  const customer = customers.find(c=>c.id===custId);
  const subtotal = cart.reduce((s,i)=>s+(i.price*i.qty),0);
  let disc = Math.min(parseFloat(document.getElementById('cartDiscount').value)||0, subtotal);
  const total = subtotal-disc;
  const status = document.getElementById('paymentStatusSwitch').checked ? 'Lunas' : 'Belum Lunas';
  const transaction = {
    id: generateId('TX'), invoiceNumber: generateInvoiceNumber(),
    customerId: custId||null, customerName: customer?customer.name:'Umum',
    customerPhone: customer?customer.phone:'', customerAddress: customer?customer.address:'', customerWA: customer?customer.whatsapp:'',
    items: cart.map(i=>({itemId:i.originalItemId, name:i.name, price:i.price, qty:i.qty, subtotal:i.price*i.qty})),
    subtotal, discount: disc, total, paymentMethod: document.getElementById('paymentMethod').value,
    status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  let items = getData(STORAGE_KEYS.items);
  for(let ci of cart) { let item = items.find(i=>i.id===ci.originalItemId); if(item) item.stock -= ci.qty; }
  setData(STORAGE_KEYS.items, items);
  let transactions = getData(STORAGE_KEYS.transactions);
  transactions.push(transaction);
  setData(STORAGE_KEYS.transactions, transactions);
  showInvoice(transaction.id);
  cart = []; document.getElementById('cartDiscount').value = 0; renderCart(); renderTxItems(); document.getElementById('txCustomer').value='';
  document.getElementById('paymentStatusSwitch').checked = false; document.getElementById('paymentStatusLabel').textContent = 'Belum Lunas';
  if(document.getElementById('page-dashboard').classList.contains('active')) refreshDashboard();
  showToast(`Transaksi ${transaction.invoiceNumber} berhasil`,'success');
}

// ============================================
// INVOICE & PDF (termasuk async logo)
// ============================================
function showInvoice(txId) {
  const tx = getData(STORAGE_KEYS.transactions).find(t=>t.id===txId);
  if(!tx) return;
  const preview = document.getElementById('invoicePreview');
  preview.setAttribute('data-tx-id', txId);
  const storeName = getSetting('storeName','KD - Krisna Digital');
  const storeAddress = getSetting('storeAddress','Jl. Pelabuhan, Br. Pasar, Pekutatan, Kabupaten Jembrana, Bali');
  const storePhone = getSetting('storePhone','+62 878-8226-1578');
  const storeEmail = getSetting('storeEmail','krisna.kusumaaaa@gmail.com');
  const today = formatDate(tx.createdAt);
  const time = new Date(tx.createdAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const statusClass = tx.status==='Lunas'?'status-lunas':'status-belum';
  let itemsHtml = tx.items.map(item => `<tr><td style="padding:6px">${escapeHtml(item.name)}</td><td style="text-align:center">${item.qty}</td><td style="text-align:right">${formatRupiah(item.price)}</td><td style="text-align:right">${formatRupiah(item.subtotal)}</td></tr>`).join('');
  preview.innerHTML = `<div id="invoiceContent"><div style="display:flex;justify-content:space-between;margin-bottom:12px"><div><img src="logo.png" style="width:40px;height:40px;border-radius:10px" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%3E%3Crect%20width%3D%2240%22%20height%3D%2240%22%20fill%3D%22%23667eea%22%20rx%3D%2210%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%3EKD%3C%2Ftext%3E%3C%2Fsvg%3E';"><div><div style="font-weight:800">${escapeHtml(storeName)}</div><div class="small">Krisna Digital</div></div></div><div style="text-align:right"><div style="font-size:1.2rem;font-weight:800">${tx.invoiceNumber}</div><div class="small">${today} ${time}</div></div></div><div style="display:flex;justify-content:space-between;margin-bottom:12px"><div><strong>Kepada:</strong><br>${escapeHtml(tx.customerName)}</div><div><strong>Pembayaran:</strong><br>${tx.paymentMethod}<br><span class="${statusClass}">${tx.status}</span></div></div><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#667eea;color:white"><th style="padding:6px">Item</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="text-align:right;margin-top:12px"><div>Subtotal: ${formatRupiah(tx.subtotal)}</div><div>Diskon: -${formatRupiah(tx.discount)}</div><div style="font-weight:800">Total: ${formatRupiah(tx.total)}</div></div><div style="margin-top:16px;text-align:center;font-size:0.7rem">Terima kasih telah berbelanja.<br>${storeName} | ${storePhone}</div></div>`;
  new bootstrap.Modal(document.getElementById('invoiceModal')).show();
}

async function loadLogoDataUrl() {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; canvas.getContext('2d').drawImage(img,0,0); resolve(canvas.toDataURL('image/png')); };
    img.onerror = () => resolve(null);
    img.src = 'logo.png';
  });
}

async function generatePDF(tx) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const storeName = getSetting('storeName','KD - Krisna Digital');
  const storeAddress = getSetting('storeAddress','Jl. Pelabuhan, Br. Pasar, Pekutatan, Kabupaten Jembrana, Bali');
  const storePhone = getSetting('storePhone','+62 878-8226-1578');
  const storeEmail = getSetting('storeEmail','krisna.kusumaaaa@gmail.com');
  const today = formatDate(tx.createdAt);
  const time = new Date(tx.createdAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
  const logoData = await loadLogoDataUrl();
  const logoWidth = 16, logoHeight = 16;
  const logoX = 15, logoY = 10;
  const textX = logoData ? logoX + logoWidth + 4 : 15;
  doc.setFillColor(102,126,234); doc.rect(0,0,210,32,'F');
  if(logoData) doc.addImage(logoData,'PNG',logoX,logoY,logoWidth,logoHeight);
  doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont(undefined,'bold'); doc.text(storeName, textX, 16);
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.text('Krisna Digital', textX, 23);
  doc.text(storeAddress, textX, 28);
  doc.setFontSize(12); doc.setFont(undefined,'bold'); doc.text(tx.invoiceNumber, 195, 16, {align:'right'});
  doc.setFontSize(8); doc.setFont(undefined,'normal'); doc.text(today + ' ' + time, 195, 23, {align:'right'});
  let y = 42;
  doc.setTextColor(0,0,0); doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.text('Ditagihkan Kepada:',15,y);
  doc.setFont(undefined,'normal'); doc.text(tx.customerName,15,y+5); if(tx.customerPhone) doc.text(tx.customerPhone,15,y+10);
  doc.setFont(undefined,'bold'); doc.text('Pembayaran:', 145, y); doc.setFont(undefined,'normal'); doc.text('Metode: '+tx.paymentMethod, 145, y+5); doc.text('Status: '+tx.status, 145, y+10);
  y += 25;
  const tableData = tx.items.map(item => [item.name, item.qty.toString(), formatRupiah(item.price), formatRupiah(item.subtotal)]);
  doc.autoTable({ startY: y, head: [['Item','Qty','Harga','Subtotal']], body: tableData, theme: 'grid', headStyles: { fillColor: [102,126,234], textColor:255, fontSize:8 }, bodyStyles: { fontSize:8 }, columnStyles: { 0: {cellWidth:70}, 1: {halign:'center',cellWidth:15}, 2: {halign:'right',cellWidth:40}, 3: {halign:'right',cellWidth:40} }, margin: { left:15, right:15 } });
  y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(9); doc.text('Subtotal:', 140, y); doc.text(formatRupiah(tx.subtotal), 195, y, {align:'right'}); y+=5;
  doc.text('Diskon:', 140, y); doc.text('- '+formatRupiah(tx.discount), 195, y, {align:'right'}); y+=5;
  doc.line(140, y, 195, y); y+=5;
  doc.setFontSize(10); doc.setFont(undefined,'bold'); doc.setTextColor(102,126,234); doc.text('Total:', 140, y); doc.text(formatRupiah(tx.total), 195, y, {align:'right'});
  y += 15;
  doc.setTextColor(100); doc.setFontSize(7); doc.text('Terima kasih telah berbelanja.', 15, y);
  doc.text(storeName + ' | ' + storePhone, 105, y+8, {align:'center'});
  return doc;
}

async function downloadPDF() {
  const txId = document.getElementById('invoicePreview').getAttribute('data-tx-id');
  if(!txId) return showToast('ID tidak ditemukan','danger');
  const tx = getData(STORAGE_KEYS.transactions).find(t=>t.id===txId);
  if(!tx) return showToast('Transaksi tidak ditemukan','danger');
  const doc = await generatePDF(tx);
  doc.save(tx.invoiceNumber+'.pdf');
  showToast('PDF berhasil diunduh','success');
}
function printInvoice() { const content = document.getElementById('invoiceContent'); if(content) { let w=window.open('','_blank'); w.document.write(`<html><head><title>Print Invoice</title><link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet"><style>body{font-family:Segoe UI;padding:20px}</style></head><body>${content.innerHTML}</body></html>`); w.document.close(); w.print(); } }

// ============================================
// WHATSAPP (singkat tanpa rincian item, PDF terunduh)
// ============================================
async function sendWhatsApp() {
  const txId = document.getElementById('invoicePreview').getAttribute('data-tx-id');
  if(!txId) return showToast('ID transaksi tidak ditemukan','danger');
  const tx = getData(STORAGE_KEYS.transactions).find(t=>t.id===txId);
  if(!tx) return showToast('Transaksi tidak ditemukan','danger');
  const doc = await generatePDF(tx);
  doc.save(tx.invoiceNumber+'.pdf');
  showToast('PDF faktur telah diunduh. Silakan lampirkan file tersebut saat mengirim WA.','info');
  const storeName = getSetting('storeName','KD - Krisna Digital');
  const message = `Yth ${tx.customerName}\n\nIni adalah Faktur ${tx.invoiceNumber} dengan total jumlah ${formatRupiah(tx.total)}\n\nSilakan lihat rincian dalam file Faktur terlampir.\n\nHormat Kami\n${storeName}`;
  let waNumber = tx.customerWA || '';
  waNumber = waNumber.replace(/[^0-9]/g,'');
  if(!waNumber) waNumber = prompt('Masukkan nomor WhatsApp pelanggan (628xxx):','');
  if(!waNumber) return;
  if(!waNumber.startsWith('62')) { if(waNumber.startsWith('0')) waNumber='62'+waNumber.substring(1); else if(waNumber.startsWith('+62')) waNumber='62'+waNumber.substring(3); else waNumber='62'+waNumber; }
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`,'_blank');
  bootstrap.Modal.getInstance(document.getElementById('invoiceModal')).hide();
}
function executeWhatsAppSend() { /* tidak terlalu dipakai karena fungsi di atas sudah langsung */ }

// ============================================
// HISTORY (ringkas)
// ============================================
function renderHistory() {
  let transactions = getData(STORAGE_KEYS.transactions);
  const search = (document.getElementById('historySearch').value||'').toLowerCase();
  const dateFrom = document.getElementById('historyDateFrom').value;
  const dateTo = document.getElementById('historyDateTo').value;
  const status = document.getElementById('historyStatus').value;
  let filtered = transactions.filter(t => (t.invoiceNumber.toLowerCase().includes(search) || (t.customerName||'').toLowerCase().includes(search)) && (!status || t.status===status) && (!dateFrom || t.createdAt.split('T')[0]>=dateFrom) && (!dateTo || t.createdAt.split('T')[0]<=dateTo));
  filtered.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const container = document.getElementById('historyList');
  if(filtered.length===0) { container.innerHTML='<div class="glass-card p-3 text-center">Tidak ada transaksi</div>'; return; }
  container.innerHTML = filtered.map(tx => `<div class="history-card p-2 mb-2"><div class="d-flex justify-content-between"><div><div class="inv-number fw-bold">${tx.invoiceNumber}</div><div class="small">${formatDateTime(tx.createdAt)}</div><div><strong>${escapeHtml(tx.customerName)}</strong></div></div><div class="text-end"><span class="${tx.status==='Lunas'?'status-lunas':'status-belum'}">${tx.status}</span><div class="fw-bold text-primary">${formatRupiah(tx.total)}</div><div class="small">${tx.paymentMethod}</div></div></div><div class="mt-2"><div class="small mb-1">${tx.items.map(i=>`${escapeHtml(i.name)} x${i.qty}`).join(' • ')}</div><div class="d-flex gap-1 flex-wrap"><button class="btn btn-sm btn-glass-primary" onclick="showInvoice('${tx.id}')"><i class="bi bi-eye"></i></button><button class="btn btn-sm btn-glass-success" onclick="downloadHistoryPDF('${tx.id}')"><i class="bi bi-file-pdf"></i></button><button class="btn btn-sm btn-whatsapp" onclick="sendHistoryWA('${tx.id}')"><i class="bi bi-whatsapp"></i></button><button class="btn btn-sm ${tx.status==='Lunas'?'btn-glass-warning':'btn-glass-success'}" onclick="togglePaymentStatus('${tx.id}')"><i class="bi bi-${tx.status==='Lunas'?'clock':'check-circle'}"></i></button><button class="btn btn-sm btn-glass-danger" onclick="deleteTransaction('${tx.id}')"><i class="bi bi-trash"></i></button></div></div></div>`).join('');
}
async function downloadHistoryPDF(txId) { const tx = getData(STORAGE_KEYS.transactions).find(t=>t.id===txId); if(tx) { const doc = await generatePDF(tx); doc.save(tx.invoiceNumber+'.pdf'); showToast('PDF diunduh','success'); } }
async function sendHistoryWA(txId) {
  const tx = getData(STORAGE_KEYS.transactions).find(t=>t.id===txId);
  if(!tx) return;
  const doc = await generatePDF(tx);
  doc.save(tx.invoiceNumber+'.pdf');
  showToast('PDF diunduh. Lampirkan saat kirim WA.','info');
  const storeName = getSetting('storeName','KD - Krisna Digital');
  const message = `Yth ${tx.customerName}\n\nIni adalah Faktur ${tx.invoiceNumber} dengan total jumlah ${formatRupiah(tx.total)}\n\nSilakan lihat rincian dalam file Faktur terlampir.\n\nHormat Kami\n${storeName}`;
  let waNumber = tx.customerWA || '';
  waNumber = waNumber.replace(/[^0-9]/g,'');
  if(!waNumber) waNumber = prompt('Nomor WhatsApp pelanggan:','');
  if(!waNumber) return;
  if(!waNumber.startsWith('62')) { if(waNumber.startsWith('0')) waNumber='62'+waNumber.substring(1); else if(waNumber.startsWith('+62')) waNumber='62'+waNumber.substring(3); else waNumber='62'+waNumber; }
  window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`,'_blank');
}
function togglePaymentStatus(txId) { let tr = getData(STORAGE_KEYS.transactions); let tx = tr.find(t=>t.id===txId); if(tx) { tx.status = tx.status==='Lunas'?'Belum Lunas':'Lunas'; tx.updatedAt=new Date().toISOString(); setData(STORAGE_KEYS.transactions,tr); renderHistory(); if(document.getElementById('page-dashboard').classList.contains('active')) refreshDashboard(); showToast(`Status diubah ke ${tx.status}`,'success'); } }
function deleteTransaction(txId) { if(confirm('Hapus transaksi ini?')) { let tr = getData(STORAGE_KEYS.transactions).filter(t=>t.id!==txId); setData(STORAGE_KEYS.transactions,tr); renderHistory(); if(document.getElementById('page-dashboard').classList.contains('active')) refreshDashboard(); showToast('Transaksi dihapus','danger'); } }

// ============================================
// DASHBOARD
// ============================================
function refreshDashboard() {
  const transactions = getData(STORAGE_KEYS.transactions);
  const items = getData(STORAGE_KEYS.items);
  const customers = getData(STORAGE_KEYS.customers);
  const today = new Date().toISOString().split('T')[0];
  const todayTx = transactions.filter(t=>t.createdAt.split('T')[0]===today);
  const todaySales = todayTx.reduce((s,t)=>s+t.total,0);
  document.getElementById('statTodaySales').innerHTML = formatRupiah(todaySales);
  document.getElementById('statTodayCount').innerHTML = todayTx.length;
  document.getElementById('statTotalItems').innerHTML = items.length;
  document.getElementById('statTotalCustomers').innerHTML = customers.length;
  const recent = [...transactions].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const recentDiv = document.getElementById('recentTransactions');
  if(recent.length===0) recentDiv.innerHTML = '<div class="empty-state py-2">Belum ada transaksi</div>';
  else recentDiv.innerHTML = recent.map(tx=>`<div class="d-flex justify-content-between align-items-center p-2 mb-1 rounded" style="background:var(--hover-bg);cursor:pointer" onclick="showInvoice('${tx.id}')"><div><strong>${tx.invoiceNumber}</strong><div class="small">${escapeHtml(tx.customerName)}</div></div><div class="text-end"><strong>${formatRupiah(tx.total)}</strong><div class="small">${formatDateTime(tx.createdAt)}</div></div></div>`).join('');
  const itemCounts = {};
  transactions.forEach(tx=>{ tx.items.forEach(item=>{ itemCounts[item.name] = (itemCounts[item.name]||0)+item.qty; }); });
  const top = Object.entries(itemCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topDiv = document.getElementById('topItems');
  if(top.length===0) topDiv.innerHTML = '<div class="empty-state py-2">Belum ada data</div>';
  else topDiv.innerHTML = top.map((item,idx)=>`<div class="d-flex align-items-center gap-2 p-1 mb-1" style="background:var(--hover-bg);border-radius:8px"><div style="width:24px;height:24px;border-radius:6px;background:var(--primary-gradient);color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem">${idx+1}</div><div><div class="fw-semibold small">${escapeHtml(item[0])}</div><div class="small">${item[1]} terjual</div></div></div>`).join('');
}

// ============================================
// SETTINGS & DATA
// ============================================
function loadSettings() {
  document.getElementById('settingStoreName').value = getSetting('storeName','KD - Krisna Digital');
  document.getElementById('settingStoreAddress').value = getSetting('storeAddress','Jl. Pelabuhan, Br. Pasar, Pekutatan, Kabupaten Jembrana, Bali');
  document.getElementById('settingStorePhone').value = getSetting('storePhone','+62 878-8226-1578');
  document.getElementById('settingStoreEmail').value = getSetting('storeEmail','krisna.kusumaaaa@gmail.com');
}
function saveSettings() {
  setSetting('storeName', document.getElementById('settingStoreName').value.trim());
  setSetting('storeAddress', document.getElementById('settingStoreAddress').value.trim());
  setSetting('storePhone', document.getElementById('settingStorePhone').value.trim());
  setSetting('storeEmail', document.getElementById('settingStoreEmail').value.trim());
  showToast('Pengaturan disimpan','success');
}
function exportAllData() {
  const data = { customers: getData(STORAGE_KEYS.customers), items: getData(STORAGE_KEYS.items), transactions: getData(STORAGE_KEYS.transactions), settings: getData(STORAGE_KEYS.settings), lastInvoice: localStorage.getItem(STORAGE_KEYS.lastInvoice)||'0', exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kd-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(a.href);
  showToast('Data diexport','success');
}
function importAllData(event) {
  const file = event.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try { const data = JSON.parse(e.target.result); if(data.customers) setData(STORAGE_KEYS.customers, data.customers); if(data.items) setData(STORAGE_KEYS.items, data.items); if(data.transactions) setData(STORAGE_KEYS.transactions, data.transactions); if(data.settings) setData(STORAGE_KEYS.settings, data.settings); if(data.lastInvoice) localStorage.setItem(STORAGE_KEYS.lastInvoice, data.lastInvoice); showToast('Data diimport','success'); refreshDashboard(); renderCustomers(); renderItems(); renderHistory(); if(document.getElementById('page-transaction').classList.contains('active')) { renderTxCustomer(); renderTxItems(); } } catch(err) { showToast('File tidak valid','danger'); }
  }; reader.readAsText(file); event.target.value = '';
}
function clearAllData() {
  if(confirm('⚠️ Hapus semua data? Tidak bisa dibatalkan!')) { localStorage.removeItem(STORAGE_KEYS.customers); localStorage.removeItem(STORAGE_KEYS.items); localStorage.removeItem(STORAGE_KEYS.transactions); localStorage.removeItem(STORAGE_KEYS.settings); localStorage.removeItem(STORAGE_KEYS.lastInvoice); initSampleData(); showToast('Data direset ke awal','info'); refreshDashboard(); renderCustomers(); renderItems(); renderHistory(); if(document.getElementById('page-transaction').classList.contains('active')) { renderTxCustomer(); renderTxItems(); } }
}
function initSampleData() {
  if(getData(STORAGE_KEYS.items).length===0) setData(STORAGE_KEYS.items, [{ id:generateId('ITEM'), code:'BRG-001', name:'Kopi Susu', category:'Minuman', price:25000, stock:50, createdAt:new Date().toISOString() }, { id:generateId('ITEM'), code:'BRG-002', name:'Nasi Goreng', category:'Makanan', price:35000, stock:30, createdAt:new Date().toISOString() }]);
  if(getData(STORAGE_KEYS.customers).length===0) setData(STORAGE_KEYS.customers, [{ id:generateId('CUST'), name:'Ahmad Fauzi', phone:'081234567890', address:'Jl. Merdeka No.10', whatsapp:'6281234567890', createdAt:new Date().toISOString() }]);
}

function init() { loadTheme(); initSampleData(); refreshDashboard(); renderCustomers(); renderItems(); renderTxCustomer(); renderHistory(); initTransactionSwitch(); }
document.addEventListener('DOMContentLoaded', init);