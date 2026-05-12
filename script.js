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
  toast.className = 'toast-glass p-3 d-flex align-items-center gap-3';
  toast.style.animation = 'fadeInUp 0.3s ease';
  toast.innerHTML = `
    <i class="bi bi-${icons[type]}" style="color:${colors[type]};font-size:1.3rem"></i>
    <span style="flex:1;font-size:0.9rem">${message}</span>
    <button type="button" class="btn-close" style="font-size:0.7rem" onclick="this.parentElement.remove()"></button>
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
    initTransactionSwitch(); // inisialisasi switch status
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
// CUSTOMERS CRUD
// ============================================
let pendingCustomerCallback = null;

function openCustomerModal(id = null, fromTransaction = false) {
  document.getElementById('customerId').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('customerPhone').value = '';
  document.getElementById('customerAddress').value = '';
  document.getElementById('customerWA').value = '';
  document.getElementById('customerModalTitle').innerHTML = '<i class="bi bi-person-plus me-2" style="color:#667eea"></i>Tambah Pelanggan';
  
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
      document.getElementById('customerModalTitle').innerHTML = '<i class="bi bi-pencil me-2" style="color:#667eea"></i>Edit Pelanggan';
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
  if (pendingCustomerCallback) {
    pendingCustomerCallback();
    pendingCustomerCallback = null;
    renderTxCustomer();
  }
  showToast(id ? 'Pelanggan berhasil diupdate!' : 'Pelanggan berhasil ditambahkan!');
}

function deleteCustomer(id) {
  if (!confirm('Yakin ingin menghapus pelanggan ini?')) return;
  let customers = getData(STORAGE_KEYS.customers);
  customers = customers.filter(x => x.id !== id);
  setData(STORAGE_KEYS.customers, customers);
  renderCustomers();
  if (document.getElementById('page-transaction').classList.contains('active')) renderTxCustomer();
  showToast('Pelanggan berhasil dihapus!', 'danger');
}

function renderCustomers() {
  const customers = getData(STORAGE_KEYS.customers);
  const search = (document.getElementById('customerSearch').value || '').toLowerCase();
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search) ||
    (c.phone || '').includes(search) ||
    (c.id || '').toLowerCase().includes(search)
  );

  const tbody = document.getElementById('customerTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-inbox"></i><p class="mt-2 mb-0">Tidak ada data pelanggan</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td><span class="badge-glass" style="font-size:0.75rem">${c.id}</span></td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="customer-avatar">${c.name.charAt(0).toUpperCase()}</div>
          <strong>${escapeHtml(c.name)}</strong>
        </div>
      </td>
      <td>${c.phone || '-'}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.address || '-')}</td>
      <td>${c.whatsapp || '-'}</td>
      <td>
        <button class="btn btn-sm btn-glass-primary me-1" onclick="openCustomerModal('${c.id}')" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-glass-danger" onclick="deleteCustomer('${c.id}')" title="Hapus">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// ITEMS CRUD
// ============================================
function openItemModal(id = null) {
  document.getElementById('itemId').value = '';
  document.getElementById('itemCode').value = '';
  document.getElementById('itemName').value = '';
  document.getElementById('itemCategory').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemStock').value = '0';
  document.getElementById('itemModalTitle').innerHTML = '<i class="bi bi-box-seam me-2" style="color:#667eea"></i>Tambah Barang';

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
      document.getElementById('itemModalTitle').innerHTML = '<i class="bi bi-pencil me-2" style="color:#667eea"></i>Edit Barang';
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
  if (isNaN(price) || price < 0) { showToast('Harga harus valid dan tidak negatif!', 'warning'); return; }

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
  showToast(id ? 'Barang berhasil diupdate!' : 'Barang berhasil ditambahkan!');
}

function deleteItem(id) {
  if (!confirm('Yakin ingin menghapus barang ini?')) return;
  let items = getData(STORAGE_KEYS.items);
  items = items.filter(x => x.id !== id);
  setData(STORAGE_KEYS.items, items);
  renderItems();
  if (document.getElementById('page-transaction').classList.contains('active')) renderTxItems();
  showToast('Barang berhasil dihapus!', 'danger');
}

function renderItems() {
  const items = getData(STORAGE_KEYS.items);
  const search = (document.getElementById('itemSearch').value || '').toLowerCase();
  const catFilter = document.getElementById('itemCategoryFilter').value;
  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search) || (i.code || '').toLowerCase().includes(search);
    const matchCat = !catFilter || i.category === catFilter;
    return matchSearch && matchCat;
  });

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
  const catSelect = document.getElementById('itemCategoryFilter');
  const currentCat = catSelect.value;
  catSelect.innerHTML = '<option value="">Semua Kategori</option>' + categories.map(c => `<option value="${escapeHtml(c)}" ${c === currentCat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');

  const tbody = document.getElementById('itemTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-inbox"></i><p class="mt-2 mb-0">Tidak ada data barang</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(i => `
    <tr>
      <td><span class="badge-glass" style="font-size:0.75rem">${escapeHtml(i.code)}</span></td>
      <td><strong>${escapeHtml(i.name)}</strong></td>
      <td><span class="category-chip">${escapeHtml(i.category || '-')}</span></td>
      <td><strong>${formatRupiah(i.price)}</strong></td>
      <td>
        <span class="${i.stock <= 5 ? 'text-danger fw-bold' : ''}">${i.stock}</span>
      </td>
      <td>
        <button class="btn btn-sm btn-glass-primary me-1" onclick="openItemModal('${i.id}')" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-glass-danger" onclick="deleteItem('${i.id}')" title="Hapus">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ============================================
// TRANSACTION
// ============================================
let cart = [];

function renderTxCustomer() {
  const customers = getData(STORAGE_KEYS.customers);
  const sel = document.getElementById('txCustomer');
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' +
    customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = current;
}

function renderTxItems() {
  const items = getData(STORAGE_KEYS.items);
  const search = (document.getElementById('txItemSearch').value || '').toLowerCase();
  const filtered = items.filter(i => i.name.toLowerCase().includes(search) || (i.code || '').toLowerCase().includes(search));

  const container = document.getElementById('txItemList');
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state py-3"><i class="bi bi-inbox" style="font-size:2rem"></i><p class="mt-2 mb-0" style="font-size:0.85rem">Tidak ada barang ditemukan</p></div>';
    return;
  }

  container.innerHTML = filtered.map(i => {
    const inCart = cart.find(c => c.originalItemId === i.id);
    const isOutOfStock = i.stock <= 0;
    return `
      <div class="item-card d-flex align-items-center justify-content-between" style="${isOutOfStock ? 'opacity:0.6;cursor:not-allowed' : ''}" onclick="${!inCart && !isOutOfStock ? `addToCart('${i.id}')` : ''}">
        <div>
          <strong>${escapeHtml(i.name)}</strong>
          <div class="item-price">${formatRupiah(i.price)}</div>
          <small class="text-muted">Stok: ${i.stock}</small>
        </div>
        <button class="btn btn-sm ${inCart ? 'btn-glass-danger' : (isOutOfStock ? 'btn-secondary disabled' : 'btn-glass-primary')}" onclick="event.stopPropagation();${inCart ? `removeFromCart('${i.id}')` : (!isOutOfStock ? `addToCart('${i.id}')` : '')}">
          <i class="bi bi-${inCart ? 'dash-lg' : 'plus-lg'}"></i>
        </button>
      </div>
    `;
  }).join('');
}

function getItemStock(itemId) {
  const items = getData(STORAGE_KEYS.items);
  const item = items.find(i => i.id === itemId);
  return item ? item.stock : 0;
}

function addToCart(itemId) {
  const items = getData(STORAGE_KEYS.items);
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  if (item.stock <= 0) {
    showToast(`Stok ${item.name} habis!`, 'warning');
    return;
  }

  const existing = cart.find(c => c.originalItemId === itemId);
  const currentQtyInCart = existing ? existing.qty : 0;
  if (currentQtyInCart + 1 > item.stock) {
    showToast(`Stok ${item.name} tidak mencukupi! (tersisa ${item.stock})`, 'warning');
    return;
  }

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      itemId: generateId('CART'),
      originalItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1
    });
  }
  renderCart();
  renderTxItems();
  showToast(`${item.name} ditambahkan ke keranjang`, 'info');
}

function removeFromCart(itemId) {
  const existing = cart.find(c => c.originalItemId === itemId);
  if (!existing) return;
  if (existing.qty > 1) {
    existing.qty--;
    renderCart();
  } else {
    cart = cart.filter(c => c.originalItemId !== itemId);
    renderCart();
  }
  renderTxItems();
}

function updateCartItemQty(originalItemId, newQty) {
  const item = cart.find(c => c.originalItemId === originalItemId);
  if (!item) return;
  newQty = parseInt(newQty);
  if (isNaN(newQty)) newQty = 1;
  
  const stock = getItemStock(originalItemId);
  if (newQty > stock) {
    showToast(`Stok tidak mencukupi! Maksimal ${stock}`, 'warning');
    newQty = stock;
  }
  
  if (newQty <= 0) {
    cart = cart.filter(c => c.originalItemId !== originalItemId);
  } else {
    item.qty = newQty;
  }
  renderCart();
  renderTxItems();
}

function updateCartItemPrice(originalItemId, price) {
  const item = cart.find(c => c.originalItemId === originalItemId);
  if (!item) return;
  price = parseFloat(price);
  if (!isNaN(price) && price >= 0) {
    item.price = price;
  }
  renderCart();
  updateCartTotals();
}

function updateCartItemName(originalItemId, name) {
  const item = cart.find(c => c.originalItemId === originalItemId);
  if (!item) return;
  name = name.trim();
  if (name) {
    item.name = name;
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-state py-3"><i class="bi bi-cart-x" style="font-size:2rem"></i><p class="mt-2 mb-0" style="font-size:0.85rem">Keranjang kosong</p></div>';
    updateCartTotals();
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="d-flex justify-content-between align-items-start mb-2">
        <input type="text" class="editable-field" value="${escapeHtml(item.name)}" onchange="updateCartItemName('${item.originalItemId}', this.value)" style="font-weight:600;width:auto;flex:1;margin-right:8px">
        <button class="btn btn-sm btn-glass-danger" style="padding:2px 8px" onclick="removeFromCart('${item.originalItemId}')">
          <i class="bi bi-x-lg" style="font-size:0.7rem"></i>
        </button>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <div class="qty-control">
          <button class="qty-btn" onclick="updateCartItemQty('${item.originalItemId}', ${item.qty - 1})">−</button>
          <input type="number" class="form-control form-control-glass" style="width:60px;text-align:center;padding:4px;font-size:0.85rem" value="${item.qty}" min="0" onchange="updateCartItemQty('${item.originalItemId}', this.value)">
          <button class="qty-btn" onclick="updateCartItemQty('${item.originalItemId}', ${item.qty + 1})">+</button>
        </div>
        <input type="number" class="editable-field cart-price-input" value="${item.price}" onchange="updateCartItemPrice('${item.originalItemId}', this.value)" style="text-align:right">
        <span class="fw-bold" style="min-width:80px;text-align:right">${formatRupiah(item.price * item.qty)}</span>
      </div>
    </div>
  `).join('');
  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let discount = parseFloat(document.getElementById('cartDiscount').value) || 0;
  if (discount > subtotal) discount = subtotal;
  const total = subtotal - discount;

  document.getElementById('cartSubtotal').textContent = formatRupiah(subtotal);
  document.getElementById('cartDiscountDisplay').textContent = '- ' + formatRupiah(discount);
  document.getElementById('cartTotal').textContent = formatRupiah(total);
  document.getElementById('cartDiscount').value = discount;
}

function clearCart() {
  if (cart.length === 0) return;
  if (!confirm('Yakin ingin mengosongkan keranjang?')) return;
  cart = [];
  document.getElementById('cartDiscount').value = 0;
  renderCart();
  renderTxItems();
  showToast('Keranjang dikosongkan', 'info');
}

function validateStockBeforeTransaction() {
  const items = getData(STORAGE_KEYS.items);
  for (const cartItem of cart) {
    const dbItem = items.find(i => i.id === cartItem.originalItemId);
    if (!dbItem) {
      showToast(`Barang ${cartItem.name} tidak ditemukan di database!`, 'danger');
      return false;
    }
    if (dbItem.stock < cartItem.qty) {
      showToast(`Stok ${dbItem.name} tidak mencukupi! (tersisa ${dbItem.stock}, dibutuhkan ${cartItem.qty})`, 'warning');
      return false;
    }
  }
  return true;
}

function initTransactionSwitch() {
  const statusSwitch = document.getElementById('paymentStatusSwitch');
  const statusLabel = document.getElementById('paymentStatusLabel');
  if (statusSwitch && statusLabel) {
    // Remove old listener to avoid duplicates
    statusSwitch.removeEventListener('change', statusSwitch._listener);
    const listener = function() {
      statusLabel.textContent = this.checked ? 'Lunas' : 'Belum Lunas';
    };
    statusSwitch.addEventListener('change', listener);
    statusSwitch._listener = listener;
    // Reset to default (Belum Lunas)
    statusSwitch.checked = false;
    statusLabel.textContent = 'Belum Lunas';
  }
}

function processTransaction() {
  if (cart.length === 0) { showToast('Keranjang masih kosong!', 'warning'); return; }
  if (!validateStockBeforeTransaction()) return;

  const customerId = document.getElementById('txCustomer').value;
  const customers = getData(STORAGE_KEYS.customers);
  const customer = customers.find(c => c.id === customerId);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  let discount = parseFloat(document.getElementById('cartDiscount').value) || 0;
  if (discount > subtotal) discount = subtotal;
  const total = subtotal - discount;

  // Ambil status dari switch
  const isLunas = document.getElementById('paymentStatusSwitch').checked;
  const paymentStatus = isLunas ? 'Lunas' : 'Belum Lunas';

  const transaction = {
    id: generateId('TX'),
    invoiceNumber: generateInvoiceNumber(),
    customerId: customerId || null,
    customerName: customer ? customer.name : 'Umum',
    customerPhone: customer ? (customer.phone || '') : '',
    customerAddress: customer ? (customer.address || '') : '',
    customerWA: customer ? (customer.whatsapp || '') : '',
    items: cart.map(item => ({
      itemId: item.originalItemId,
      name: item.name,
      price: item.price,
      qty: item.qty,
      subtotal: item.price * item.qty
    })),
    subtotal: subtotal,
    discount: discount,
    total: total,
    paymentMethod: document.getElementById('paymentMethod').value,
    status: paymentStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Update stok
  const items = getData(STORAGE_KEYS.items);
  for (const cartItem of cart) {
    const item = items.find(i => i.id === cartItem.originalItemId);
    if (item) {
      item.stock -= cartItem.qty;
    }
  }
  setData(STORAGE_KEYS.items, items);

  // Simpan transaksi
  const transactions = getData(STORAGE_KEYS.transactions);
  transactions.push(transaction);
  setData(STORAGE_KEYS.transactions, transactions);

  showInvoice(transaction.id);

  cart = [];
  document.getElementById('cartDiscount').value = 0;
  renderCart();
  renderTxItems();
  document.getElementById('txCustomer').value = '';
  // Reset switch ke default
  const statusSwitch = document.getElementById('paymentStatusSwitch');
  if (statusSwitch) statusSwitch.checked = false;
  if (document.getElementById('paymentStatusLabel')) 
    document.getElementById('paymentStatusLabel').textContent = 'Belum Lunas';

  if (document.getElementById('page-dashboard').classList.contains('active')) refreshDashboard();

  showToast(`Transaksi ${transaction.invoiceNumber} berhasil diproses!`, 'success');
}

// ============================================
// INVOICE / PDF (tanpa kolom diskon per item)
// ============================================
function showInvoice(txId) {
  const transactions = getData(STORAGE_KEYS.transactions);
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  const preview = document.getElementById('invoicePreview');
  preview.setAttribute('data-tx-id', txId);

  const storeName = getSetting('storeName', 'KD - Toko Profesional');
  const storeAddress = getSetting('storeAddress', 'Jl. Merdeka Raya No. 123, Jakarta');
  const storePhone = getSetting('storePhone', '+62 812-3456-7890');
  const storeEmail = getSetting('storeEmail', 'info@kd-store.com');

  const today = formatDate(tx.createdAt);
  const time = new Date(tx.createdAt).toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit',second:'2-digit'});

  const statusClass = tx.status === 'Lunas' ? 'status-lunas' : 'status-belum';

  // Tabel tanpa kolom Diskon
  let itemsHtml = tx.items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(item.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${formatRupiah(item.price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${formatRupiah(item.subtotal)}</td>
    </tr>
  `).join('');

  preview.innerHTML = `
    <div id="invoiceContent">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #eee">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="logo.png" alt="Logo" style="width:45px;height:45px;border-radius:12px;object-fit:cover" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2245%22%20height%3D%2245%22%20viewBox%3D%220%200%2045%2045%22%3E%3Crect%20width%3D%2245%22%20height%3D%2245%22%20fill%3D%22%23667eea%22%20rx%3D%2212%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2220%22%3EKD%3C%2Ftext%3E%3C%2Fsvg%3E';">
          <div>
            <div style="font-weight:800;font-size:1.2rem;color:#667eea">${escapeHtml(storeName)}</div>
            <div style="font-size:0.8rem;color:#6c757d">Toko Profesional</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.5rem;font-weight:800;color:#667eea">${tx.invoiceNumber}</div>
          <div style="font-size:0.8rem;color:#6c757d">${today} ${time}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-weight:700;margin-bottom:6px">Ditagihkan Kepada:</div>
          <div style="font-size:0.9rem">${escapeHtml(tx.customerName)}</div>
          ${tx.customerPhone ? `<div style="font-size:0.85rem;color:#6c757d">${escapeHtml(tx.customerPhone)}</div>` : ''}
          ${tx.customerAddress ? `<div style="font-size:0.85rem;color:#6c757d">${escapeHtml(tx.customerAddress)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-weight:700;margin-bottom:6px">Informasi Pembayaran:</div>
          <div style="font-size:0.85rem"><strong>Metode:</strong> ${tx.paymentMethod}</div>
          <div style="font-size:0.85rem;margin-top:4px"><strong>Status:</strong> <span class="${statusClass}">${tx.status}</span></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#667eea;color:white">
            <th style="padding:10px 12px;text-align:left;font-size:0.8rem;text-transform:uppercase">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:0.8rem;text-transform:uppercase">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:0.8rem;text-transform:uppercase">Harga</th>
            <th style="padding:10px 12px;text-align:right;font-size:0.8rem;text-transform:uppercase">Subtotal</th>
           </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
       </table>

      <div style="text-align:right;margin-bottom:20px">
        <div style="display:inline-block;text-align:right;min-width:200px">
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem">
            <span>Subtotal:</span>
            <strong>${formatRupiah(tx.subtotal)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.9rem">
            <span>Diskon:</span>
            <strong>- ${formatRupiah(tx.discount)}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:1.1rem;border-top:2px solid #eee;margin-top:8px">
            <strong>Grand Total:</strong>
            <strong style="color:#667eea">${formatRupiah(tx.total)}</strong>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee">
        <div style="font-size:0.8rem;color:#6c757d;margin-bottom:12px">
          <strong>Catatan:</strong><br>
          Terima kasih telah berbelanja di KD. Pembayaran dapat dilakukan melalui transfer bank atau QRIS.
        </div>
        <div style="text-align:right;margin-top:20px">
          <div style="font-size:0.85rem;color:#6c757d">Hormat Kami,</div>
          <div style="margin-top:30px;font-weight:700;color:#667eea">KD Team</div>
          <div style="font-size:0.75rem;color:#6c757d">( Tanda Tangan Digital )</div>
        </div>
      </div>

      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;text-align:center;font-size:0.75rem;color:#6c757d">
        <div>${escapeHtml(storeName)} | ${escapeHtml(storePhone)} | ${escapeHtml(storeEmail)}</div>
        <div style="margin-top:4px">Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan basah.</div>
      </div>
    </div>
  `;

  new bootstrap.Modal(document.getElementById('invoiceModal')).show();
}

function generatePDF(tx) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const storeName = getSetting('storeName', 'KD - Toko Profesional');
  const storeAddress = getSetting('storeAddress', 'Jl. Merdeka Raya No. 123, Jakarta');
  const storePhone = getSetting('storePhone', '+62 812-3456-7890');
  const storeEmail = getSetting('storeEmail', 'info@kd-store.com');

  const today = formatDate(tx.createdAt);
  const time = new Date(tx.createdAt).toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // Header
  doc.setFillColor(102, 126, 234);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(storeName, 15, 18);
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text('Toko Profesional', 15, 25);
  doc.text(storeAddress, 15, 31);

  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text(tx.invoiceNumber, 195, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(today + ' ' + time, 195, 25, { align: 'right' });

  let y = 45;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Ditagihkan Kepada:', 15, y);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  doc.text(tx.customerName, 15, y + 6);
  if (tx.customerPhone) doc.text(tx.customerPhone, 15, y + 12);
  if (tx.customerAddress) doc.text(tx.customerAddress, 15, y + 18);

  doc.setFont(undefined, 'bold');
  doc.text('Informasi Pembayaran:', 195, y, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.text('Metode: ' + tx.paymentMethod, 195, y + 6, { align: 'right' });
  doc.text('Status: ' + tx.status, 195, y + 12, { align: 'right' });

  y = y + 30;
  const tableData = tx.items.map(item => [
    item.name,
    item.qty.toString(),
    formatRupiah(item.price),
    formatRupiah(item.subtotal)
  ]);

  doc.autoTable({
    startY: y,
    head: [['Item', 'Qty', 'Harga', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [102, 126, 234],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 40 }
    },
    margin: { left: 15, right: 15 }
  });

  y = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(10);
  doc.text('Subtotal:', 140, y);
  doc.text(formatRupiah(tx.subtotal), 195, y, { align: 'right' });
  y += 7;
  doc.text('Diskon:', 140, y);
  doc.text('- ' + formatRupiah(tx.discount), 195, y, { align: 'right' });
  y += 7;
  doc.setDrawColor(200);
  doc.line(140, y, 195, y);
  y += 7;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(102, 126, 234);
  doc.text('Grand Total:', 140, y);
  doc.text(formatRupiah(tx.total), 195, y, { align: 'right' });

  y += 20;
  doc.setTextColor(100);
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.text('Catatan:', 15, y);
  doc.text('Terima kasih telah berbelanja di KD. Pembayaran dapat dilakukan melalui transfer bank atau QRIS.', 15, y + 5);

  doc.text('Hormat Kami,', 195, y + 15, { align: 'right' });
  doc.setFont(undefined, 'bold');
  doc.setTextColor(102, 126, 234);
  doc.text('KD Team', 195, y + 25, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100);
  doc.text('( Tanda Tangan Digital )', 195, y + 31, { align: 'right' });

  doc.setDrawColor(200);
  doc.line(15, y + 40, 195, y + 40);
  doc.setFontSize(7);
  doc.text(storeName + ' | ' + storePhone + ' | ' + storeEmail, 105, y + 47, { align: 'center' });
  doc.text('Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan basah.', 105, y + 52, { align: 'center' });

  return doc;
}

function downloadPDF() {
  const preview = document.getElementById('invoicePreview');
  const txId = preview.getAttribute('data-tx-id');
  if (!txId) { showToast('ID transaksi tidak ditemukan!', 'danger'); return; }
  
  const transactions = getData(STORAGE_KEYS.transactions);
  const tx = transactions.find(t => t.id === txId);
  if (!tx) { showToast('Transaksi tidak ditemukan!', 'danger'); return; }

  const doc = generatePDF(tx);
  doc.save(tx.invoiceNumber + '.pdf');
  showToast('PDF berhasil diunduh!', 'success');
}

function printInvoice() {
  const content = document.getElementById('invoiceContent');
  if (!content) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
    <head>
      <title>Print Invoice</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1a1a2e; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${content.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// WHATSAPP
// ============================================
function sendWhatsApp() {
  const preview = document.getElementById('invoicePreview');
  const txId = preview.getAttribute('data-tx-id');
  if (!txId) { showToast('ID transaksi tidak ditemukan!', 'danger'); return; }
  
  const transactions = getData(STORAGE_KEYS.transactions);
  const tx = transactions.find(t => t.id === txId);
  if (!tx) { showToast('Transaksi tidak ditemukan!', 'danger'); return; }

  // Download PDF terlebih dahulu
  const doc = generatePDF(tx);
  doc.save(tx.invoiceNumber + '.pdf');
  showToast('PDF faktur telah diunduh. Silakan lampirkan file tersebut saat mengirim WA.', 'info');

  // Buat pesan singkat tanpa rincian item
  const storeName = getSetting('storeName', 'KD - Toko Profesional');
  const message = `Yth ${tx.customerName}\n\nIni adalah Faktur ${tx.invoiceNumber} dengan total jumlah ${formatRupiah(tx.total)}\n\nSilakan lihat rincian dalam file Faktur terlampir.\n\nHormat Kami\n${storeName}`;

  // Ambil nomor WhatsApp dari pelanggan (jika ada)
  let waNumber = tx.customerWA || '';
  // Bersihkan nomor (hapus spasi, tanda +, dan karakter non-digit)
  waNumber = waNumber.replace(/[^0-9]/g, '');
  if (!waNumber) {
    // Jika tidak ada nomor, minta user input
    waNumber = prompt('Masukkan nomor WhatsApp pelanggan (awali dengan 628xxx):', '');
    if (!waNumber) return;
  }
  // Pastikan format dimulai dengan 62
  if (!waNumber.startsWith('62')) {
    if (waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1);
    else if (waNumber.startsWith('+62')) waNumber = '62' + waNumber.substring(3);
    else waNumber = '62' + waNumber;
  }

  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  bootstrap.Modal.getInstance(document.getElementById('waModal')).hide();
}

function executeWhatsAppSend() {
  const number = document.getElementById('waNumber').value.trim();
  const message = document.getElementById('waMessage').value.trim();

  if (!number) { showToast('Masukkan nomor WhatsApp!', 'warning'); return; }
  if (!message) { showToast('Pesan tidak boleh kosong!', 'warning'); return; }

  if (window._waInvoice) {
    const doc = generatePDF(window._waInvoice);
    doc.save(window._waInvoice.invoiceNumber + '.pdf');
    showToast('PDF diunduh. Lampirkan file PDF saat mengirim WhatsApp.', 'info');
  }

  const waUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  bootstrap.Modal.getInstance(document.getElementById('waModal')).hide();
}

// ============================================
// HISTORY
// ============================================
function renderHistory() {
  const transactions = getData(STORAGE_KEYS.transactions);
  const search = (document.getElementById('historySearch').value || '').toLowerCase();
  const dateFrom = document.getElementById('historyDateFrom').value;
  const dateTo = document.getElementById('historyDateTo').value;
  const status = document.getElementById('historyStatus').value;

  let filtered = transactions.filter(t => {
    const matchSearch = t.invoiceNumber.toLowerCase().includes(search) ||
      (t.customerName || '').toLowerCase().includes(search);
    const matchStatus = !status || t.status === status;
    const txDate = t.createdAt.split('T')[0];
    const matchDateFrom = !dateFrom || txDate >= dateFrom;
    const matchDateTo = !dateTo || txDate <= dateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  });

  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = document.getElementById('historyList');
  if (filtered.length === 0) {
    container.innerHTML = '<div class="glass-card p-4"><div class="empty-state"><i class="bi bi-inbox"></i><p class="mt-2 mb-0">Tidak ada transaksi</p></div></div>';
    return;
  }

  container.innerHTML = filtered.map(tx => {
    const statusClass = tx.status === 'Lunas' ? 'status-lunas' : 'status-belum';
    return `
      <div class="history-card">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <div class="inv-number">${tx.invoiceNumber}</div>
            <div style="font-size:0.85rem;color:var(--text-secondary)">${formatDateTime(tx.createdAt)}</div>
            <div style="font-size:0.9rem;margin-top:4px"><strong>${escapeHtml(tx.customerName)}</strong></div>
          </div>
          <div class="text-end">
            <span class="${statusClass}">${tx.status}</span>
            <div style="font-size:1.1rem;font-weight:700;color:#667eea;margin-top:6px">${formatRupiah(tx.total)}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">${tx.paymentMethod}</div>
          </div>
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--glass-border)">
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px">
            ${tx.items.map(i => `${escapeHtml(i.name)} x${i.qty}`).join(' • ')}
          </div>
          <div class="d-flex gap-2 flex-wrap mt-3">
            <button class="btn btn-sm btn-glass-primary" onclick="showInvoice('${tx.id}')">
              <i class="bi bi-eye me-1"></i>Detail
            </button>
            <button class="btn btn-sm btn-glass-success" onclick="downloadHistoryPDF('${tx.id}')">
              <i class="bi bi-filetype-pdf me-1"></i>PDF
            </button>
            <button class="btn btn-sm btn-whatsapp" onclick="sendHistoryWA('${tx.id}')">
              <i class="bi bi-whatsapp me-1"></i>WA
            </button>
            <button class="btn btn-sm ${tx.status === 'Lunas' ? 'btn-glass-warning' : 'btn-glass-success'}" onclick="togglePaymentStatus('${tx.id}')">
              <i class="bi bi-${tx.status === 'Lunas' ? 'clock' : 'check-circle'} me-1"></i>${tx.status === 'Lunas' ? 'Belum Lunas' : 'Lunas'}
            </button>
            <button class="btn btn-sm btn-glass-danger" onclick="deleteTransaction('${tx.id}')">
              <i class="bi bi-trash me-1"></i>Hapus
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function downloadHistoryPDF(txId) {
  const transactions = getData(STORAGE_KEYS.transactions);
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;
  const doc = generatePDF(tx);
  doc.save(tx.invoiceNumber + '.pdf');
  showToast('PDF berhasil diunduh!', 'success');
}

function sendHistoryWA(txId) {
  const transactions = getData(STORAGE_KEYS.transactions);
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;

  // Download PDF
  const doc = generatePDF(tx);
  doc.save(tx.invoiceNumber + '.pdf');
  showToast('PDF faktur telah diunduh. Silakan lampirkan file tersebut saat mengirim WA.', 'info');

  // Pesan singkat
  const storeName = getSetting('storeName', 'KD - Toko Profesional');
  const message = `Yth ${tx.customerName}\n\nIni adalah Faktur ${tx.invoiceNumber} dengan total jumlah ${formatRupiah(tx.total)}\n\nSilakan lihat rincian dalam file Faktur terlampir.\n\nHormat Kami\n${storeName}`;

  let waNumber = tx.customerWA || '';
  waNumber = waNumber.replace(/[^0-9]/g, '');
  if (!waNumber) {
    waNumber = prompt('Masukkan nomor WhatsApp pelanggan (awali dengan 628xxx):', '');
    if (!waNumber) return;
  }
  if (!waNumber.startsWith('62')) {
    if (waNumber.startsWith('0')) waNumber = '62' + waNumber.substring(1);
    else if (waNumber.startsWith('+62')) waNumber = '62' + waNumber.substring(3);
    else waNumber = '62' + waNumber;
  }

  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  bootstrap.Modal.getInstance(document.getElementById('waModal')).hide();
}

function togglePaymentStatus(txId) {
  const transactions = getData(STORAGE_KEYS.transactions);
  const tx = transactions.find(t => t.id === txId);
  if (!tx) return;
  tx.status = tx.status === 'Lunas' ? 'Belum Lunas' : 'Lunas';
  tx.updatedAt = new Date().toISOString();
  setData(STORAGE_KEYS.transactions, transactions);
  renderHistory();
  if (document.getElementById('page-dashboard').classList.contains('active')) refreshDashboard();
  showToast(`Status diubah ke: ${tx.status}`, 'success');
}

function deleteTransaction(txId) {
  if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
  let transactions = getData(STORAGE_KEYS.transactions);
  transactions = transactions.filter(t => t.id !== txId);
  setData(STORAGE_KEYS.transactions, transactions);
  renderHistory();
  if (document.getElementById('page-dashboard').classList.contains('active')) refreshDashboard();
  showToast('Transaksi berhasil dihapus!', 'danger');
}

// ============================================
// DASHBOARD
// ============================================
function refreshDashboard() {
  const transactions = getData(STORAGE_KEYS.transactions);
  const items = getData(STORAGE_KEYS.items);
  const customers = getData(STORAGE_KEYS.customers);

  const today = new Date().toISOString().split('T')[0];
  const todayTx = transactions.filter(t => t.createdAt.split('T')[0] === today);
  const todaySales = todayTx.reduce((sum, t) => sum + t.total, 0);

  document.getElementById('statTodaySales').textContent = formatRupiah(todaySales);
  document.getElementById('statTodayCount').textContent = todayTx.length;
  document.getElementById('statTotalItems').textContent = items.length;
  document.getElementById('statTotalCustomers').textContent = customers.length;

  const recent = [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentContainer = document.getElementById('recentTransactions');
  if (recent.length === 0) {
    recentContainer.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>Belum ada transaksi</p></div>';
  } else {
    recentContainer.innerHTML = recent.map(tx => `
      <div class="d-flex justify-content-between align-items-center p-3 rounded-3 mb-2" style="background:var(--hover-bg);border:1px solid var(--glass-border);cursor:pointer" onclick="showInvoice('${tx.id}')">
        <div>
          <strong style="color:#667eea">${tx.invoiceNumber}</strong>
          <div style="font-size:0.8rem;color:var(--text-secondary)">${escapeHtml(tx.customerName)}</div>
        </div>
        <div class="text-end">
          <strong>${formatRupiah(tx.total)}</strong>
          <div style="font-size:0.75rem;color:var(--text-secondary)">${formatDateTime(tx.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

  const itemCounts = {};
  transactions.forEach(tx => {
    tx.items.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.qty;
    });
  });
  const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topContainer = document.getElementById('topItems');
  if (topItems.length === 0) {
    topContainer.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><p>Belum ada data</p></div>';
  } else {
    topContainer.innerHTML = topItems.map((item, idx) => `
      <div class="d-flex align-items-center gap-3 p-2 mb-2" style="background:var(--hover-bg);border-radius:12px">
        <div style="width:28px;height:28px;border-radius:8px;background:var(--primary-gradient);color:white;display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700">${idx + 1}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:0.9rem">${escapeHtml(item[0])}</div>
          <div style="font-size:0.75rem;color:var(--text-secondary)">${item[1]} terjual</div>
        </div>
      </div>
    `).join('');
  }
}

// ============================================
// SETTINGS
// ============================================
function loadSettings() {
  document.getElementById('settingStoreName').value = getSetting('storeName', 'KD - Toko Profesional');
  document.getElementById('settingStoreAddress').value = getSetting('storeAddress', 'Jl. Merdeka Raya No. 123, Jakarta');
  document.getElementById('settingStorePhone').value = getSetting('storePhone', '+62 812-3456-7890');
  document.getElementById('settingStoreEmail').value = getSetting('storeEmail', 'info@kd-store.com');
}

function saveSettings() {
  setSetting('storeName', document.getElementById('settingStoreName').value.trim());
  setSetting('storeAddress', document.getElementById('settingStoreAddress').value.trim());
  setSetting('storePhone', document.getElementById('settingStorePhone').value.trim());
  setSetting('storeEmail', document.getElementById('settingStoreEmail').value.trim());
  showToast('Pengaturan berhasil disimpan!', 'success');
}

// ============================================
// DATA IMPORT/EXPORT
// ============================================
function exportAllData() {
  const data = {
    customers: getData(STORAGE_KEYS.customers),
    items: getData(STORAGE_KEYS.items),
    transactions: getData(STORAGE_KEYS.transactions),
    settings: getData(STORAGE_KEYS.settings),
    lastInvoice: localStorage.getItem(STORAGE_KEYS.lastInvoice) || '0',
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kd-kasir-backup-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data berhasil diexport!', 'success');
}

function importAllData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.customers) setData(STORAGE_KEYS.customers, data.customers);
      if (data.items) setData(STORAGE_KEYS.items, data.items);
      if (data.transactions) setData(STORAGE_KEYS.transactions, data.transactions);
      if (data.settings) setData(STORAGE_KEYS.settings, data.settings);
      if (data.lastInvoice) localStorage.setItem(STORAGE_KEYS.lastInvoice, data.lastInvoice);
      showToast('Data berhasil diimport!', 'success');
      refreshDashboard();
      renderCustomers();
      renderItems();
      renderHistory();
      if (document.getElementById('page-transaction').classList.contains('active')) {
        renderTxCustomer();
        renderTxItems();
      }
    } catch (err) {
      showToast('Gagal import data: file tidak valid!', 'danger');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearAllData() {
  if (!confirm('⚠️ PERINGATAN: Semua data akan dihapus permanen. Yakin?')) return;
  if (!confirm('Ini tidak bisa dibatalkan. Lanjutkan?')) return;
  localStorage.removeItem(STORAGE_KEYS.customers);
  localStorage.removeItem(STORAGE_KEYS.items);
  localStorage.removeItem(STORAGE_KEYS.transactions);
  localStorage.removeItem(STORAGE_KEYS.settings);
  localStorage.removeItem(STORAGE_KEYS.lastInvoice);
  
  initSampleData();
  showToast('Semua data telah direset ke data awal!', 'info');
  refreshDashboard();
  renderCustomers();
  renderItems();
  renderHistory();
  if (document.getElementById('page-transaction').classList.contains('active')) {
    renderTxCustomer();
    renderTxItems();
  }
}

// ============================================
// SAMPLE DATA INIT
// ============================================
function initSampleData() {
  if (getData(STORAGE_KEYS.items).length === 0) {
    const sampleItems = [
      { id: generateId('ITEM'), code: 'BRG-001', name: 'Kopi Susu', category: 'Minuman', price: 25000, stock: 50, createdAt: new Date().toISOString() },
      { id: generateId('ITEM'), code: 'BRG-002', name: 'Nasi Goreng', category: 'Makanan', price: 35000, stock: 30, createdAt: new Date().toISOString() },
      { id: generateId('ITEM'), code: 'BRG-003', name: 'Es Teh Manis', category: 'Minuman', price: 8000, stock: 100, createdAt: new Date().toISOString() },
      { id: generateId('ITEM'), code: 'BRG-004', name: 'Mie Ayam', category: 'Makanan', price: 20000, stock: 25, createdAt: new Date().toISOString() },
      { id: generateId('ITEM'), code: 'BRG-005', name: 'Roti Bakar', category: 'Makanan', price: 15000, stock: 40, createdAt: new Date().toISOString() },
    ];
    setData(STORAGE_KEYS.items, sampleItems);
  }

  if (getData(STORAGE_KEYS.customers).length === 0) {
    const sampleCustomers = [
      { id: generateId('CUST'), name: 'Ahmad Fauzi', phone: '081234567890', address: 'Jl. Merdeka No. 10', whatsapp: '6281234567890', createdAt: new Date().toISOString() },
      { id: generateId('CUST'), name: 'Siti Nurhaliza', phone: '082345678901', address: 'Jl. Sudirman No. 5', whatsapp: '6282345678901', createdAt: new Date().toISOString() },
      { id: generateId('CUST'), name: 'Budi Santoso', phone: '083456789012', address: 'Jl. Gatot Subroto No. 15', whatsapp: '6283456789012', createdAt: new Date().toISOString() },
    ];
    setData(STORAGE_KEYS.customers, sampleCustomers);
  }
}

// ============================================
// INIT
// ============================================
function init() {
  loadTheme();
  initSampleData();
  refreshDashboard();
  renderCustomers();
  renderItems();
  renderTxCustomer();
  renderHistory();
  initTransactionSwitch(); // untuk memastikan switch siap saat pertama kali load
}

document.addEventListener('DOMContentLoaded', init);