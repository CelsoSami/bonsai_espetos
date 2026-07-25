// ========== ESTADO GLOBAL ==========
let currentUser = null;
let userProfile = null;
let allProducts = [];
let allTables = [];
let allOrders = [];
let allUsers = [];
let allCashflow = [];
let currentOrderItems = [];
let selectedTable = null;
let currentOrderFilter = 'all';
let performanceChart = null;
let salesChart = null;
let orderStatusChart = null;

// ========== INICIALIZACAO ==========
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const saved = localStorage.getItem('bonsai_user');
        if (saved) {
            currentUser = saved;
            const { data, error } = await sb.from('users').select('*').eq('id', saved).single();
            if (!error && data && data.approved) {
                userProfile = data;
                showDashboard();
                return;
            }
            localStorage.removeItem('bonsai_user');
            currentUser = null;
        }
    } catch (err) {
        console.error('Auto-login failed:', err);
        localStorage.removeItem('bonsai_user');
        currentUser = null;
    }
    setupForms();
});

function setupForms() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const login = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await doLogin(login, password);
    });
}

// ========== AUTENTICACAO ==========
async function doLogin(login, password) {
    try {
        const { data: users, error } = await sb.from('users').select('*').eq('email', login);
        if (error) { showToast('Erro ao buscar usuario: ' + error.message, 'error'); return; }
        if (!users || users.length === 0) { showToast('Usuario ou senha invalidos', 'error'); return; }
        const user = users[0];
        if (user.password !== password) { showToast('Usuario ou senha invalidos', 'error'); return; }
        if (!user.approved) { showToast('Cadastro pendente de aprovacao', 'error'); return; }
        currentUser = user.id;
        userProfile = user;
        localStorage.setItem('bonsai_user', user.id);
        showDashboard();
    } catch (err) {
        showToast('Erro de conexao: ' + err.message, 'error');
    }
}

async function logout() {
    localStorage.removeItem('bonsai_user');
    currentUser = null;
    userProfile = null;
    document.getElementById('page-dashboard').classList.remove('active');
    document.getElementById('page-auth').classList.add('active');
}

function showDashboard() {
    document.getElementById('page-auth').classList.remove('active');
    document.getElementById('page-dashboard').classList.add('active');
    updateUserUI();
    updateManagerSections();
    loadDashboard();
}

function updateUserUI() {
    if (!userProfile) return;
    document.getElementById('userAvatar').textContent = (userProfile.name || 'U')[0].toUpperCase();
    document.getElementById('userName').textContent = userProfile.name || 'Usuario';
    document.getElementById('userRole').textContent = userProfile.is_master ? 'Master' : userProfile.is_manager ? 'Gerente' : 'Garcom';
}

function updateManagerSections() {
    const isMgr = isManager();
    document.querySelectorAll('.manager-section').forEach(el => {
        el.style.display = isMgr ? '' : 'none';
    });
}

// ========== NAVEGACAO ==========
function closeSidebar() { document.querySelector('.sidebar').classList.remove('open'); }

function showSection(name) {
    closeSidebar();
    document.querySelectorAll('.section').forEach(s => { s.style.display = 'none'; s.classList.remove('active'); });
    document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
    const section = document.getElementById('section-' + name);
    if (section) { section.style.display = 'block'; section.classList.add('active'); }
    const nav = document.querySelector(`.nav-item[data-section="${name}"]`);
    if (nav) nav.classList.add('active');
    switch(name) {
        case 'dashboard': loadDashboard(); break;
        case 'orders': loadOrders(); break;
        case 'products': loadProducts(); break;
        case 'stock': loadStock(); break;
        case 'tables': loadTables(); break;
        case 'cashflow': loadCashflow(); break;
        case 'reports': loadReports(); break;
        case 'users': loadUsers(); break;
    }
}

// ========== UTILITARIOS ==========
function fmt(v) { return 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ','); }
function fmtDate(s) {
    if (!s) return '-';
    return new Date(s).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function statusBadge(status) {
    const m = { pending:['Pendente','badge-pending'], preparing:['Preparando','badge-preparing'], delivered:['Entregue','badge-delivered'], cancelled:['Cancelado','badge-cancelled'], available:['Disponivel','badge-available'], occupied:['Ocupada','badge-occupied'] };
    const [t,c] = m[status] || [status,''];
    return `<span class="badge ${c}">${t}</span>`;
}
function showToast(msg, type='success') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}
function isMaster() { return userProfile && userProfile.is_master === true; }
function isManager() { return userProfile && (userProfile.is_master || userProfile.is_manager); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('.menu-toggle')) {
        sidebar.classList.remove('open');
    }
});

// ========== DASHBOARD ==========
async function loadDashboard() {
    const { data: orders } = await sb.from('orders').select('*, tables(number)').order('created_at', { ascending: false });
    const { data: tables } = await sb.from('tables').select('*').order('number');
    const { data: products } = await sb.from('products').select('*');

    const all = orders || [];
    const tbls = tables || [];
    const prods = products || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = all.filter(o => (o.created_at || '').startsWith(today));
    const pending = all.filter(o => o.status === 'pending').length;
    const preparing = all.filter(o => o.status === 'preparing').length;
    const delivered = all.filter(o => o.status === 'delivered').length;
    const todayRev = todayOrders.filter(o => o.status === 'delivered').reduce((s,o) => s + parseFloat(o.total||0), 0);
    const totalRev = all.filter(o => o.status === 'delivered').reduce((s,o) => s + parseFloat(o.total||0), 0);
    const occupied = tbls.filter(t => t.status === 'occupied').length;

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card red"><div class="stat-label">Pedidos Hoje</div><div class="stat-value">${todayOrders.length}</div></div>
        <div class="stat-card yellow"><div class="stat-label">Pendentes</div><div class="stat-value">${pending}</div></div>
        <div class="stat-card blue"><div class="stat-label">Preparando</div><div class="stat-value">${preparing}</div></div>
        <div class="stat-card green"><div class="stat-label">Receita Hoje</div><div class="stat-value">${fmt(todayRev)}</div></div>
        <div class="stat-card green"><div class="stat-label">Receita Total</div><div class="stat-value">${fmt(totalRev)}</div></div>
        <div class="stat-card red"><div class="stat-label">Mesas Ocupadas</div><div class="stat-value">${occupied}/${tbls.length}</div></div>
    `;

    document.getElementById('recentOrdersBody').innerHTML = all.slice(0, 10).map(o => `
        <tr>
            <td>#${(o.id||'').slice(0,8)}</td>
            <td>${o.tables ? o.tables.number : '-'}</td>
            <td>${o.comandas || 1}</td>
            <td>${fmt(o.total)}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${fmtDate(o.created_at)}</td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:#666;">Nenhum pedido</td></tr>';

    const ctx = document.getElementById('performanceChart');
    if (performanceChart) performanceChart.destroy();
    performanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pendentes','Preparando','Entregues'],
            datasets: [{ data: [pending, preparing, delivered], backgroundColor: ['#f39c12','#3498db','#2ecc71'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0a0a0' } } } }
    });

    loadReadyItems();
}

async function loadReadyItems() {
    try {
        const { data: ready } = await sb.from('kitchen_orders')
            .select('*')
            .eq('status', 'ready')
            .order('completed_at', { ascending: false })
            .limit(20);
        const items = ready || [];
        const card = document.getElementById('readyItemsCard');
        if (items.length === 0) {
            card.style.display = 'none';
            return;
        }
        card.style.display = 'block';
        document.getElementById('readyItemsBody').innerHTML = items.map(item => {
            const ago = Math.floor((Date.now() - new Date(item.completed_at).getTime()) / 60000);
            const timeAgo = ago < 1 ? 'agora' : `${ago} min`;
            return `
                <tr>
                    <td>Mesa ${item.table_number}</td>
                    <td>${item.product_name}</td>
                    <td>${item.quantity}x</td>
                    <td>${item.station === 'cozinha' ? 'Cozinha' : 'Churrasqueiro'}</td>
                    <td>${timeAgo}</td>
                    <td><button class="btn btn-primary btn-sm" onclick="acknowledgeReady('${item.id}')">Recebido</button></td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('loadReadyItems error:', err);
    }
}

async function acknowledgeReady(id) {
    await sb.from('kitchen_orders').update({ status: 'delivered' }).eq('id', id);
    loadReadyItems();
}

// ========== PEDIDOS ==========
async function loadOrders() {
    const [o, t, p] = await Promise.all([
        sb.from('orders').select('*, tables(number)').order('created_at', { ascending: false }),
        sb.from('tables').select('*').order('number'),
        sb.from('products').select('*').eq('active', true)
    ]);
    allOrders = o.data || [];
    allTables = (t.data || []).sort((a,b) => a.number - b.number);
    allProducts = p.data || [];
    populateTableFilter();
    renderOrders();
}

function renderOrders() {
    const tblFilter = document.getElementById('orderTableFilter');
    const tableVal = tblFilter ? tblFilter.value : '';
    let f = currentOrderFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentOrderFilter);
    if (tableVal) f = f.filter(o => o.table_id === tableVal);

    document.getElementById('ordersBody').innerHTML = f.map(o => `
        <tr>
            <td>#${(o.id||'').slice(0,8)}</td>
            <td>${o.tables ? o.tables.number : '-'}</td>
            <td>${o.comandas || 1}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="viewOrderDetail('${o.id}')">${(o.items||[]).length} itens</button></td>
            <td>${fmt(o.total)}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${o.user_name || '-'}</td>
            <td class="action-buttons">
                ${o.status==='pending'?`<button class="btn btn-warning btn-sm" onclick="updateOrderStatus('${o.id}','preparing')">Preparar</button>`:''}
                ${o.status==='preparing'?`<button class="btn btn-success btn-sm" onclick="updateOrderStatus('${o.id}','delivered')">Entregar</button>`:''}
                ${o.status!=='delivered'&&o.status!=='cancelled'?`<button class="btn btn-danger btn-sm" onclick="updateOrderStatus('${o.id}','cancelled')">Cancelar</button>`:''}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center;color:#666;">Nenhum pedido</td></tr>';
}

function populateTableFilter() {
    const sel = document.getElementById('orderTableFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todas as Mesas</option>' + allTables.sort((a,b) => a.number - b.number).map(t =>
        `<option value="${t.id}" ${t.id===current?'selected':''}>Mesa ${t.number}</option>`
    ).join('');
}

function viewOrderDetail(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    document.getElementById('orderDetailTitle').textContent = `Pedido #${(o.id||'').slice(0,8)} - Mesa ${o.tables ? o.tables.number : '-'}`;
    const items = o.items || [];
    document.getElementById('orderDetailBody').innerHTML = `
        <div style="margin-bottom:16px;">
            <span style="color:#a0a0a0;">Status: </span>${statusBadge(o.status)}
            <span style="margin-left:16px;color:#a0a0a0;">Comandas: </span><strong>${o.comandas || 1}</strong>
            <span style="margin-left:16px;color:#a0a0a0;">Atendente: </span><strong>${o.user_name || '-'}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="border-bottom:1px solid #333;"><th style="text-align:left;padding:8px 0;color:#a0a0a0;">Produto</th><th style="text-align:center;padding:8px 0;color:#a0a0a0;">Qtd</th><th style="text-align:right;padding:8px 0;color:#a0a0a0;">Preco</th><th style="text-align:right;padding:8px 0;color:#a0a0a0;">Subtotal</th></tr></thead>
            <tbody>
                ${items.map(it => `<tr style="border-bottom:1px solid #222;">
                    <td style="padding:10px 0;font-weight:600;">${it.name}</td>
                    <td style="text-align:center;padding:10px 0;">${it.quantity}x</td>
                    <td style="text-align:right;padding:10px 0;">${fmt(it.price)}</td>
                    <td style="text-align:right;padding:10px 0;font-weight:700;color:#e63946;">${fmt(it.price * it.quantity)}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #333;display:flex;justify-content:space-between;">
            <strong style="font-size:1.1rem;">TOTAL</strong>
            <strong style="font-size:1.3rem;color:#e63946;">${fmt(o.total)}</strong>
        </div>
        <div style="margin-top:8px;color:#666;font-size:0.8rem;">
            Criado em: ${fmtDate(o.created_at)}
        </div>
    `;
    document.getElementById('orderDetailModal').classList.add('active');
}

function filterOrders(f, el) {
    currentOrderFilter = f;
    document.querySelectorAll('#section-orders .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderOrders();
}

async function updateOrderStatus(id, status) {
    await sb.from('orders').update({ status }).eq('id', id);
    if (status === 'cancelled') {
        await sb.from('kitchen_orders').update({ status: 'cancelled' }).eq('order_id', id).eq('status', 'pending');
    }
    if (status === 'delivered' || status === 'cancelled') {
        const { data: o } = await sb.from('orders').select('table_id').eq('id', id).single();
        if (o) {
            const { data: others } = await sb.from('orders').select('id').eq('table_id', o.table_id).eq('status', 'pending');
            if (!others || others.length === 0) {
                await sb.from('tables').update({ status: 'available', occupied_at: null }).eq('id', o.table_id);
            }
        }
    }
    showToast('Status atualizado!');
    loadOrders();
}

function openNewOrderModal() {
    selectedTable = null;
    currentOrderItems = [];
    document.getElementById('comandaCount').value = 1;
    document.getElementById('orderItems').innerHTML = '';
    document.getElementById('orderTotal').textContent = 'R$ 0,00';

    document.getElementById('tableSelector').innerHTML = allTables.map(t => `
        <button class="table-btn ${t.status==='occupied'?'occupied':''}" onclick="selectTable('${t.id}',${t.number},${t.capacity})">
            <div class="table-number">${t.number}</div>
            <div class="table-capacity">${t.capacity} lug</div>
        </button>
    `).join('');

    document.getElementById('productGrid').innerHTML = allProducts.map(p => {
        const stationTag = p.station === 'cozinha' ? '<span style="font-size:0.65rem;color:#3498db;font-weight:700;display:block;">COZINHA</span>'
            : p.station === 'churrasqueiro' ? '<span style="font-size:0.65rem;color:#f39c12;font-weight:700;display:block;">CHURRASQUEIRO</span>' : '';
        return `
        <div class="product-chip" onclick="addToOrder('${p.id}',${JSON.stringify(p.name).replace(/"/g,'&quot;')},${p.price})">
            ${stationTag}
            <div class="product-name">${p.name}</div>
            <div class="product-price">${fmt(p.price)}</div>
        </div>
    `}).join('');

    document.getElementById('newOrderModal').classList.add('active');
}

function selectTable(id, num, cap) {
    selectedTable = { id, number: num, capacity: cap };
    document.querySelectorAll('.table-btn').forEach(b => b.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

function addToOrder(pid, name, price) {
    const ex = currentOrderItems.find(i => i.product_id === pid);
    if (ex) ex.quantity++;
    else currentOrderItems.push({ product_id: pid, name, price, quantity: 1 });
    renderOrderItems();
}

function renderOrderItems() {
    document.getElementById('orderItems').innerHTML = currentOrderItems.map((it, i) => `
        <div class="order-item">
            <div class="item-info"><div class="item-name">${it.name}</div><div class="item-price">${fmt(it.price)}</div></div>
            <div class="item-qty">
                <button onclick="changeQty(${i},-1)">-</button>
                <span>${it.quantity}</span>
                <button onclick="changeQty(${i},1)">+</button>
            </div>
            <div class="item-total">${fmt(it.price * it.quantity)}</div>
        </div>
    `).join('');
    const total = currentOrderItems.reduce((s,i) => s + i.price * i.quantity, 0);
    document.getElementById('orderTotal').textContent = fmt(total);
}

function changeQty(i, d) {
    currentOrderItems[i].quantity += d;
    if (currentOrderItems[i].quantity <= 0) currentOrderItems.splice(i, 1);
    renderOrderItems();
}

async function submitOrder() {
    if (!selectedTable) { showToast('Selecione uma mesa!', 'error'); return; }
    if (currentOrderItems.length === 0) { showToast('Adicione itens!', 'error'); return; }
    const total = currentOrderItems.reduce((s,i) => s + i.price * i.quantity, 0);
    const { data: newOrder } = await sb.from('orders').insert({
        table_id: selectedTable.id,
        comandas: parseInt(document.getElementById('comandaCount').value) || 1,
        items: currentOrderItems,
        total,
        status: 'pending',
        user_id: currentUser,
        user_name: userProfile.name
    }).select().single();
    await sb.from('tables').update({ status: 'occupied', occupied_at: new Date().toISOString() }).eq('id', selectedTable.id);
    if (newOrder) {
        const stationItems = [];
        for (const item of currentOrderItems) {
            const prod = allProducts.find(p => p.id === item.product_id);
            if (prod && prod.station) {
                for (let i = 0; i < item.quantity; i++) {
                    stationItems.push({
                        order_id: newOrder.id,
                        table_number: selectedTable.number,
                        product_name: item.name,
                        quantity: 1,
                        station: prod.station,
                        status: 'pending'
                    });
                }
            }
        }
        if (stationItems.length > 0) {
            console.log('Inserindo kitchen_orders:', stationItems);
            const { data: koData, error: koErr } = await sb.from('kitchen_orders').insert(stationItems);
            if (koErr) console.error('Erro ao inserir kitchen_orders:', koErr);
            else console.log('Kitchen_orders inseridos:', koData);
        }
    }
    closeModal('newOrderModal');
    showToast('Pedido criado!');
    loadOrders();
}

// ========== PRODUTOS ==========
async function loadProducts() {
    const { data } = await sb.from('products').select('*').order('name');
    allProducts = data || [];
    renderProducts();
}

function renderProducts() {
    const s = (document.getElementById('productSearch')?.value || '').toLowerCase();
    const c = document.getElementById('categoryFilter')?.value || '';
    let f = allProducts;
    if (s) f = f.filter(p => p.name.toLowerCase().includes(s));
    if (c) f = f.filter(p => p.category === c);
    document.getElementById('productsBody').innerHTML = f.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.category||'-'}</td>
            <td>${p.type||'-'}</td>
            <td>${fmt(p.price)}</td>
            <td>${fmt(p.cost||0)}</td>
            <td style="color:${p.stock<=p.min_stock?'#e63946':'#2ecc71'}"><strong>${p.stock}</strong></td>
            <td>${p.min_stock||5}</td>
            <td>${p.station==='cozinha'?'<span style="color:#3498db;font-weight:700;">Cozinha</span>':p.station==='churrasqueiro'?'<span style="color:#f39c12;font-weight:700;">Churrasqueiro</span>':'-'}</td>
            <td><label class="switch"><input type="checkbox" ${p.active?'checked':''} onchange="toggleProduct('${p.id}',this.checked)"><span class="slider"></span></label></td>
            <td class="action-buttons">
                <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">Excluir</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="10" style="text-align:center;color:#666;">Nenhum produto</td></tr>';
}

function filterProducts() { renderProducts(); }

function openProductModal(p = null) {
    document.getElementById('productModalTitle').textContent = p ? 'Editar Produto' : 'Novo Produto';
    document.getElementById('productId').value = p ? p.id : '';
    document.getElementById('productName').value = p ? p.name : '';
    document.getElementById('productDescription').value = p ? p.description||'' : '';
    document.getElementById('productCategory').value = p ? p.category||'Espetos' : 'Espetos';
    document.getElementById('productPrice').value = p ? p.price : '';
    document.getElementById('productCost').value = p ? p.cost||0 : 0;
    document.getElementById('productStock').value = p ? p.stock||0 : 0;
    document.getElementById('productMinStock').value = p ? p.min_stock||5 : 5;
    document.getElementById('productType').value = p ? p.type||'' : '';
    document.getElementById('productUnit').value = p ? p.unit||'un' : 'un';
    document.getElementById('productStation').value = p ? p.station||'' : '';
    document.getElementById('productModal').classList.add('active');
}

function editProduct(id) { const p = allProducts.find(x => x.id === id); if (p) openProductModal(p); }

async function saveProduct() {
    const id = document.getElementById('productId').value;
    const data = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value),
        cost: parseFloat(document.getElementById('productCost').value),
        stock: parseInt(document.getElementById('productStock').value),
        min_stock: parseInt(document.getElementById('productMinStock').value),
        type: document.getElementById('productType').value,
        unit: document.getElementById('productUnit').value,
        station: document.getElementById('productStation').value,
        active: true
    };
    if (id) await sb.from('products').update(data).eq('id', id);
    else await sb.from('products').insert(data);
    closeModal('productModal');
    showToast('Produto salvo!');
    loadProducts();
}

async function toggleProduct(id, active) {
    await sb.from('products').update({ active }).eq('id', id);
}

async function deleteProduct(id) {
    if (!confirm('Excluir este produto?')) return;
    await sb.from('products').delete().eq('id', id);
    showToast('Produto excluido!');
    loadProducts();
}

// ========== ESTOQUE ==========
async function loadStock() {
    const [p, h] = await Promise.all([
        sb.from('products').select('*'),
        sb.from('stock_history').select('*').order('created_at', { ascending: false }).limit(100)
    ]);
    allProducts = p.data || [];
    const prods = allProducts;
    const low = prods.filter(p => p.stock <= p.min_stock);
    const totalItems = prods.reduce((s,p) => s + p.stock, 0);
    const totalVal = prods.reduce((s,p) => s + p.stock * (p.cost||0), 0);

    document.getElementById('stockStats').innerHTML = `
        <div class="stat-card red"><div class="stat-label">Estoque Baixo</div><div class="stat-value">${low.length}</div></div>
        <div class="stat-card yellow"><div class="stat-label">Total Itens</div><div class="stat-value">${totalItems}</div></div>
        <div class="stat-card green"><div class="stat-label">Valor Estoque</div><div class="stat-value">${fmt(totalVal)}</div></div>
    `;

    document.getElementById('stockHistoryBody').innerHTML = (h.data||[]).map(x => `
        <tr>
            <td>${fmtDate(x.created_at)}</td>
            <td>${x.product_name||'-'}</td>
            <td>${x.previous_stock}</td>
            <td style="color:${x.adjustment>0?'#2ecc71':'#e63946'};font-weight:700;">${x.adjustment>0?'+':''}${x.adjustment}</td>
            <td>${x.new_stock}</td>
            <td>${x.reason||'-'}</td>
            <td>${x.user_name||'-'}</td>
        </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;color:#666;">Nenhum historico</td></tr>';
}

function openStockAdjustModal() {
    document.getElementById('stockProduct').innerHTML = allProducts.map(p => `<option value="${p.id}">${p.name} (atual: ${p.stock})</option>`).join('');
    document.getElementById('stockAdjustment').value = '';
    document.getElementById('stockReason').value = '';
    document.getElementById('stockAdjustModal').classList.add('active');
}

async function adjustStock() {
    const pid = document.getElementById('stockProduct').value;
    const adj = parseInt(document.getElementById('stockAdjustment').value);
    const reason = document.getElementById('stockReason').value;
    const { data: prod } = await sb.from('products').select('stock, name').eq('id', pid).single();
    if (prod) {
        const newStock = Math.max(0, prod.stock + adj);
        await sb.from('products').update({ stock: newStock }).eq('id', pid);
        await sb.from('stock_history').insert({
            product_id: pid, product_name: prod.name, previous_stock: prod.stock,
            new_stock: newStock, adjustment: adj, reason,
            user_id: currentUser, user_name: userProfile.name
        });
    }
    closeModal('stockAdjustModal');
    showToast('Estoque ajustado!');
    loadStock();
}

// ========== MESAS ==========
let tableTimers = {};

async function loadTables() {
    const [tRes, oRes] = await Promise.all([
        sb.from('tables').select('*').order('number'),
        sb.from('orders').select('*, tables(number)').order('created_at', { ascending: true })
    ]);
    allTables = (tRes.data || []).sort((a,b) => a.number - b.number);
    const allOrdersList = oRes.data || [];

    Object.keys(tableTimers).forEach(k => clearInterval(tableTimers[k]));
    tableTimers = {};

    document.getElementById('tablesGrid').innerHTML = allTables.map(t => {
        const tableOrders = allOrdersList.filter(o => o.table_id === t.id);
        const pendingOrders = tableOrders.filter(o => o.status === 'pending' || o.status === 'preparing');
        const totalSpent = tableOrders.filter(o => o.status === 'delivered').reduce((s,o) => s + parseFloat(o.total||0), 0);
        const totalPending = pendingOrders.reduce((s,o) => s + parseFloat(o.total||0), 0);
        const allItems = tableOrders.flatMap(o => (o.items||[]).map(it => ({...it, orderStatus: o.status, orderId: o.id})));
        const timerId = `timer-${t.id}`;

        if (t.status === 'occupied') {
            const occupiedSince = t.occupied_at || (pendingOrders.length > 0 ? pendingOrders[0].created_at : null);
            return `
            <div class="card" style="border-color:#e63946;">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0;">Mesa ${t.number} <span style="font-size:0.75rem;color:#a0a0a0;">${t.capacity} lugares</span></h2>
                        <div style="font-size:0.85rem;color:#f39c12;margin-top:4px;">
                            Ocupada ha: <strong id="${timerId}">--:--</strong>
                            ${occupiedSince ? `<span style="color:#666;font-size:0.75rem;margin-left:8px;">desde ${fmtDate(occupiedSince)}</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-primary btn-sm" onclick="openNewOrderForTable('${t.id}',${t.number})">+ Pedido</button>
                        <button class="btn btn-success btn-sm" onclick="closeTable('${t.id}')">Liberar</button>
                    </div>
                </div>
                <div class="card-body">
                    <div style="display:flex;gap:16px;margin-bottom:12px;">
                        <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:10px 16px;text-align:center;flex:1;">
                            <div style="font-size:0.7rem;text-transform:uppercase;color:#a0a0a0;">Pendente</div>
                            <div style="font-size:1.2rem;font-weight:700;color:#f39c12;">${fmt(totalPending)}</div>
                        </div>
                        <div style="background:#1e1e1e;border:1px solid #333;border-radius:8px;padding:10px 16px;text-align:center;flex:1;">
                            <div style="font-size:0.7rem;text-transform:uppercase;color:#a0a0a0;">Entregue</div>
                            <div style="font-size:1.2rem;font-weight:700;color:#2ecc71;">${fmt(totalSpent)}</div>
                        </div>
                    </div>
                    ${allItems.length > 0 ? `
                    <div style="border-top:1px solid #333;padding-top:12px;">
                        <div style="font-size:0.75rem;text-transform:uppercase;color:#a0a0a0;margin-bottom:8px;letter-spacing:1px;">Todos os Itens</div>
                        ${allItems.map(it => `
                            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #222;">
                                <span>${it.quantity}x ${it.name}</span>
                                <span style="color:#a0a0a0;">${fmt(it.price * it.quantity)}</span>
                            </div>
                        `).join('')}
                    </div>` : '<div style="color:#666;text-align:center;padding:12px;">Nenhum item ainda</div>'}
                </div>
            </div>`;
        } else {
            return `
            <div class="card" style="border-color:#333;">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0;">Mesa ${t.number} <span style="font-size:0.75rem;color:#a0a0a0;">${t.capacity} lugares</span></h2>
                        <div style="font-size:0.85rem;color:#2ecc71;margin-top:4px;">Disponivel</div>
                    </div>
                    <button class="btn btn-warning btn-sm" onclick="openNewOrderForTable('${t.id}',${t.number})">Ocupar</button>
                </div>
            </div>`;
        }
    }).join('');

    allTables.forEach(t => {
        if (t.status === 'occupied') {
            const occupiedSince = t.occupied_at || (allOrdersList.filter(o => o.table_id === t.id && (o.status === 'pending' || o.status === 'preparing')).length > 0 ? allOrdersList.filter(o => o.table_id === t.id)[0]?.created_at : null);
            if (occupiedSince) {
                const start = new Date(occupiedSince).getTime();
                const el = document.getElementById(`timer-${t.id}`);
                function updateTimer() {
                    if (!el) return;
                    const diff = Date.now() - start;
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    el.textContent = h > 0 ? `${h}h ${m.toString().padStart(2,'0')}m` : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
                }
                updateTimer();
                tableTimers[t.id] = setInterval(updateTimer, 1000);
            }
        }
    });
}

function openNewOrderForTable(tableId, tableNumber) {
    selectedTable = allTables.find(t => t.id === tableId) || { id: tableId, number: tableNumber };
    currentOrderItems = [];
    document.getElementById('comandaCount').value = 1;
    document.getElementById('orderItems').innerHTML = '';
    document.getElementById('orderTotal').textContent = 'R$ 0,00';

    document.getElementById('tableSelector').innerHTML = allTables.map(t => `
        <button class="table-btn ${t.id===tableId?'selected':''} ${t.status==='occupied'?'occupied':''}" onclick="selectTable('${t.id}',${t.number},${t.capacity})">
            <div class="table-number">${t.number}</div>
            <div class="table-capacity">${t.capacity} lug</div>
        </button>
    `).join('');

    document.getElementById('productGrid').innerHTML = allProducts.map(p => {
        const stationTag = p.station === 'cozinha' ? '<span style="font-size:0.65rem;color:#3498db;font-weight:700;display:block;">COZINHA</span>'
            : p.station === 'churrasqueiro' ? '<span style="font-size:0.65rem;color:#f39c12;font-weight:700;display:block;">CHURRASQUEIRO</span>' : '';
        return `
        <div class="product-chip" onclick="addToOrder('${p.id}',${JSON.stringify(p.name).replace(/"/g,'&quot;')},${p.price})">
            ${stationTag}
            <div class="product-name">${p.name}</div>
            <div class="product-price">${fmt(p.price)}</div>
        </div>
    `}).join('');

    document.getElementById('newOrderModal').classList.add('active');
}

async function closeTable(id) {
    if (!confirm('Liberar esta mesa? Pedidos pendentes serao cancelados.')) return;
    const { data: pendings } = await sb.from('orders').select('id').eq('table_id', id).in('status', ['pending','preparing']);
    if (pendings && pendings.length > 0) {
        const pendingIds = pendings.map(p => p.id);
        await sb.from('orders').update({ status: 'cancelled' }).in('id', pendingIds);
        await sb.from('kitchen_orders').update({ status: 'cancelled' }).in('order_id', pendingIds).eq('status', 'pending');
    }
    await sb.from('tables').update({ status: 'available', occupied_at: null }).eq('id', id);
    showToast('Mesa liberada!');
    loadTables();
}

function openTableModal() {
    document.getElementById('tableNumber').value = '';
    document.getElementById('tableCapacity').value = 4;
    document.getElementById('tableModal').classList.add('active');
}

async function saveTable() {
    await sb.from('tables').insert({
        number: parseInt(document.getElementById('tableNumber').value),
        capacity: parseInt(document.getElementById('tableCapacity').value),
        status: 'available'
    });
    closeModal('tableModal');
    showToast('Mesa criada!');
    loadTables();
}

// ========== FLUXO DE CAIXA ==========
async function loadCashflow() {
    const { data } = await sb.from('cashflow').select('*').order('created_at', { ascending: false });
    allCashflow = data || [];
    const ent = allCashflow.filter(c => c.type==='entrada').reduce((s,c) => s+c.amount, 0);
    const sai = allCashflow.filter(c => c.type==='saida').reduce((s,c) => s+c.amount, 0);

    document.getElementById('cashStats').innerHTML = `
        <div class="stat-card green"><div class="stat-label">Entradas</div><div class="stat-value">${fmt(ent)}</div></div>
        <div class="stat-card red"><div class="stat-label">Saidas</div><div class="stat-value">${fmt(sai)}</div></div>
        <div class="stat-card blue"><div class="stat-label">Saldo</div><div class="stat-value">${fmt(ent-sai)}</div></div>
    `;

    document.getElementById('cashflowBody').innerHTML = allCashflow.map(c => `
        <tr>
            <td>${fmtDate(c.created_at)}</td>
            <td>${c.type==='entrada'?'<span style="color:#2ecc71;font-weight:700;">Entrada</span>':'<span style="color:#e63946;font-weight:700;">Saida</span>'}</td>
            <td>${c.description}</td>
            <td>${c.category||'-'}</td>
            <td style="color:${c.type==='entrada'?'#2ecc71':'#e63946'};font-weight:700;">${c.type==='entrada'?'+':'-'}${fmt(c.amount)}</td>
            <td>${c.user_name||'-'}</td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:#666;">Nenhuma movimentacao</td></tr>';
}

function openCashModal(type) {
    document.getElementById('cashType').value = type;
    document.getElementById('cashModalTitle').textContent = type==='entrada'?'Nova Entrada':'Nova Saida';
    document.getElementById('cashDescription').value = '';
    document.getElementById('cashAmount').value = '';
    document.getElementById('cashCategory').value = '';
    document.getElementById('cashModal').classList.add('active');
}

async function saveCashflow() {
    await sb.from('cashflow').insert({
        type: document.getElementById('cashType').value,
        description: document.getElementById('cashDescription').value,
        amount: parseFloat(document.getElementById('cashAmount').value),
        category: document.getElementById('cashCategory').value,
        user_id: currentUser,
        user_name: userProfile.name
    });
    closeModal('cashModal');
    showToast('Movimentacao registrada!');
    loadCashflow();
}

// ========== RELATORIOS ==========
async function loadReports() {
    const { data: orders } = await sb.from('orders').select('*');
    const all = orders || [];
    const delivered = all.filter(o => o.status==='delivered').length;
    const pending = all.filter(o => o.status==='pending').length;
    const preparing = all.filter(o => o.status==='preparing').length;
    const totalRev = all.filter(o => o.status==='delivered').reduce((s,o) => s+parseFloat(o.total||0), 0);
    const today = new Date().toISOString().slice(0,10);
    const todayRev = all.filter(o => o.status==='delivered' && (o.created_at||'').startsWith(today)).reduce((s,o) => s+parseFloat(o.total||0), 0);

    document.getElementById('reportStats').innerHTML = `
        <div class="stat-card green"><div class="stat-label">Receita Total</div><div class="stat-value">${fmt(totalRev)}</div></div>
        <div class="stat-card red"><div class="stat-label">Total Pedidos</div><div class="stat-value">${all.length}</div></div>
        <div class="stat-card blue"><div class="stat-label">Entregues</div><div class="stat-value">${delivered}</div></div>
        <div class="stat-card yellow"><div class="stat-label">Receita Hoje</div><div class="stat-value">${fmt(todayRev)}</div></div>
    `;

    const ctx1 = document.getElementById('salesChart');
    if (salesChart) salesChart.destroy();
    salesChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Hoje', 'Total'],
            datasets: [{ label: 'Receita (R$)', data: [todayRev, totalRev], backgroundColor: ['#e63946','#2ecc71'], borderWidth: 0, borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#a0a0a0' } } }, scales: { y: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } }, x: { ticks: { color: '#a0a0a0' }, grid: { display: false } } } }
    });

    const ctx2 = document.getElementById('orderStatusChart');
    if (orderStatusChart) orderStatusChart.destroy();
    orderStatusChart = new Chart(ctx2, {
        type: 'pie',
        data: {
            labels: ['Pendentes','Preparando','Entregues'],
            datasets: [{ data: [pending, preparing, delivered], backgroundColor: ['#f39c12','#3498db','#2ecc71'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#a0a0a0' } } } }
    });
}

// ========== USUARIOS (APENAS MASTER) ==========
async function loadUsers() {
    if (!isMaster()) { showToast('Apenas usuarios master podem gerenciar usuarios', 'error'); showSection('dashboard'); return; }
    const { data } = await sb.from('users').select('*');
    allUsers = data || [];
    renderUsers();
}

function renderUsers(filter='all') {
    let f = allUsers;
    if (filter==='pending') f = allUsers.filter(u => !u.approved);
    if (filter==='approved') f = allUsers.filter(u => u.approved);

    document.getElementById('usersBody').innerHTML = f.map(u => `
        <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.email}</td>
            <td>${u.phone||'-'}</td>
            <td>${u.approved?'<span class="badge badge-approved">Aprovado</span>':'<span class="badge badge-pending-user">Pendente</span>'}</td>
            <td>
                <select class="role-select" onchange="setUserRole('${u.id}', this.value)" ${u.is_master?'disabled':''}>
                    <option value="garcom" ${!u.is_manager&&!u.is_master?'selected':''}>Garcom</option>
                    <option value="manager" ${u.is_manager&&!u.is_master?'selected':''}>Gerente</option>
                    ${u.is_master?'<option value="master" selected>Master</option>':''}
                </select>
            </td>
            <td>${u.is_master?'<span class="badge badge-approved">Master</span>':'-'}</td>
            <td>${fmtDate(u.created_at)}</td>
            <td class="action-buttons">
                ${!u.approved&&!u.is_master?`<button class="btn btn-success btn-sm" onclick="approveUser('${u.id}')">Aprovar</button>`:''}
                ${!u.approved&&!u.is_master?`<button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">Rejeitar</button>`:''}
                ${u.approved&&!u.is_master?`<button class="btn btn-danger btn-sm" onclick="rejectUser('${u.id}')">Remover</button>`:''}
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center;color:#666;">Nenhum usuario</td></tr>';
}

function filterUsers(f, el) {
    document.querySelectorAll('#section-users .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderUsers(f);
}

async function approveUser(id) {
    await sb.from('users').update({ approved: true }).eq('id', id);
    showToast('Usuario aprovado!');
    loadUsers();
}

async function rejectUser(id) {
    if (!confirm('Remover este usuario?')) return;
    await sb.from('users').delete().eq('id', id);
    showToast('Usuario removido!');
    loadUsers();
}

async function setUserRole(id, role) {
    const updates = { is_manager: role === 'manager' };
    await sb.from('users').update(updates).eq('id', id);
    showToast('Permissao atualizada!');
    loadUsers();
}

async function createNewUser() {
    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    const phone = document.getElementById('newUserPhone').value;
    const role = document.getElementById('newUserRole').value;

    if (!name || !email || !password) { showToast('Preencha nome, email e senha', 'error'); return; }

    const { data: existing } = await sb.from('users').select('id').eq('email', email).maybeSingle();
    if (existing) { showToast('Email ja cadastrado', 'error'); return; }

    const newUser = {
        id: crypto.randomUUID(),
        name,
        email,
        password,
        phone: phone || '',
        approved: true,
        is_master: false,
        is_manager: role === 'manager'
    };

    const { error } = await sb.from('users').insert(newUser);
    if (error) { showToast('Erro ao criar usuario: ' + error.message, 'error'); return; }

    closeModal('newUserModal');
    showToast('Usuario criado com sucesso!');
    loadUsers();
}

function openNewUserModal() {
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserPhone').value = '';
    document.getElementById('newUserRole').value = 'garcom';
    document.getElementById('newUserModal').classList.add('active');
}
