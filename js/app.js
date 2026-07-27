// ========== ESTADO GLOBAL ==========
let currentUser = null;
let userProfile = null;
let allProducts = [];
let allTables = [];
let allOrders = [];
let allUsers = [];
let currentOrderItems = [];
let selectedTable = null;
let currentOrderFilter = 'all';
let performanceChart = null;

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
function closeModal(id) { document.getElementById(id).classList.remove('active'); if (id === 'comandaModal') { document.getElementById('comandaEditSave')?.remove(); document.getElementById('comandaEditCancel')?.remove(); } }
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
            <td style="font-weight:600;">${o.comandas || '-'}</td>
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
                    <td>${item.station === 'cozinha' ? 'Cozinha' : item.station === 'churrasqueiro' ? 'Churrasqueiro' : item.station === 'pizzaria' ? 'Pizzaria' : item.station}</td>
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
    const dateFilter = document.getElementById('orderDateFilter');
    const dateVal = dateFilter ? dateFilter.value : 'today';

    let f = currentOrderFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentOrderFilter);
    if (tableVal) f = f.filter(o => o.table_id === tableVal);
    if (dateVal === 'today') {
        const today = new Date().toISOString().slice(0,10);
        f = f.filter(o => (o.created_at||'').startsWith(today));
    }

    document.getElementById('ordersBody').innerHTML = f.map(o => `
        <tr>
            <td>#${(o.id||'').slice(0,8)}</td>
            <td>${o.tables ? o.tables.number : '-'}</td>
            <td><strong>${o.comandas || 'Comanda'}</strong></td>
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
            <span style="margin-left:16px;color:#a0a0a0;">Comanda: </span><strong>${o.comandas || '-'}</strong>
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
    showToast('Status atualizado!');
    loadOrders();
}

function openNewOrderModal() {
    selectedTable = null;
    currentOrderItems = [];
    document.getElementById('comandaName').value = '';
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
            : p.station === 'churrasqueiro' ? '<span style="font-size:0.65rem;color:#f39c12;font-weight:700;display:block;">CHURRASQUEIRO</span>'
            : p.station === 'pizzaria' ? '<span style="font-size:0.65rem;color:#9b59b6;font-weight:700;display:block;">PIZZARIA</span>' : '';
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
        comandas: document.getElementById('comandaName').value || 'Comanda',
        items: currentOrderItems,
        total,
        status: 'pending',
        user_id: currentUser,
        user_name: userProfile.name
    }).select().single();
    await sb.from('tables').update({ status: 'occupied', occupied_at: new Date().toISOString() }).eq('id', selectedTable.id);
    if (newOrder) {
        const comandaName = document.getElementById('comandaName').value || 'Comanda';
        const stationItems = [];
        for (const item of currentOrderItems) {
            const prod = allProducts.find(p => p.id === item.product_id);
            if (prod && prod.station) {
                for (let i = 0; i < item.quantity; i++) {
                    stationItems.push({
                        order_id: newOrder.id,
                        table_number: selectedTable.number,
                        comanda_name: comandaName,
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
            <td>${p.station==='cozinha'?'<span style="color:#3498db;font-weight:700;">Cozinha</span>':p.station==='churrasqueiro'?'<span style="color:#f39c12;font-weight:700;">Churrasqueiro</span>':p.station==='pizzaria'?'<span style="color:#9b59b6;font-weight:700;">Pizzaria</span>':'-'}</td>
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
    allOrdersCache = oRes.data || [];

    Object.keys(tableTimers).forEach(k => clearInterval(tableTimers[k]));
    tableTimers = {};

    renderTablesGrid();
}

let allOrdersCache = [];

function renderTablesGrid() {
    const filtered = currentTableFilter === 'all' ? allTables : allTables.filter(t => (t.table_type || 'fisica') === currentTableFilter);

    document.getElementById('tablesGrid').innerHTML = filtered.map(t => {
        const tableOrders = allOrdersCache.filter(o => o.table_id === t.id);
        const pendingOrders = tableOrders.filter(o => o.status === 'pending' || o.status === 'preparing');
        const totalSpent = tableOrders.filter(o => o.status === 'delivered').reduce((s,o) => s + parseFloat(o.total||0), 0);
        const totalPending = pendingOrders.reduce((s,o) => s + parseFloat(o.total||0), 0);
        const allItems = tableOrders.flatMap(o => (o.items||[]).map(it => ({...it, orderStatus: o.status, orderId: o.id})));
        const timerId = `timer-${t.id}`;
        const typeLabel = t.table_type === 'virtual' ? '<span style="background:#f39c12;color:#fff;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;margin-left:6px;">VIRTUAL</span>' : '<span style="background:#333;color:#a0a0a0;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;margin-left:6px;">FIXA</span>';

        if (t.status === 'occupied') {
            const occupiedSince = t.occupied_at || (pendingOrders.length > 0 ? pendingOrders[0].created_at : null);
            return `
            <div class="card" style="border-color:#e63946;">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <h2 style="margin:0;">Mesa ${t.number} <span style="font-size:0.75rem;color:#a0a0a0;">${t.capacity} lugares</span>${typeLabel}</h2>
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
                    <div style="margin-bottom:8px;">
                        ${tableOrders.map(o => {
                            const statusColor = o.status === 'delivered' ? '#2ecc71' : o.status === 'cancelled' ? '#666' : '#e63946';
                            const cursor = o.status === 'pending' || o.status === 'preparing' ? 'pointer' : 'default';
                            return `<span onclick="openComanda('${o.id}')" style="display:inline-block;background:#1e1e1e;border:1px solid ${statusColor};border-radius:12px;padding:3px 10px;font-size:0.75rem;margin:2px;color:${statusColor};font-weight:600;cursor:${cursor};transition:all 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">${o.comandas || 'Comanda'} ${o.status==='delivered'?'✓':o.status==='cancelled'?'✗':''}</span>`;
                        }).join('')}
                    </div>
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
                        <h2 style="margin:0;">Mesa ${t.number} <span style="font-size:0.75rem;color:#a0a0a0;">${t.capacity} lugares</span>${typeLabel}</h2>
                        <div style="font-size:0.85rem;color:#2ecc71;margin-top:4px;">Disponivel</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-warning btn-sm" onclick="openNewOrderForTable('${t.id}',${t.number})">Ocupar</button>
                    </div>
                </div>
            </div>`;
        }
    }).join('') || '<div style="color:#666;text-align:center;grid-column:1/-1;padding:40px;">Nenhuma mesa encontrada</div>';

    allTables.forEach(t => {
        if (t.status === 'occupied') {
            const occupiedSince = t.occupied_at || (allOrdersCache.filter(o => o.table_id === t.id && (o.status === 'pending' || o.status === 'preparing')).length > 0 ? allOrdersCache.filter(o => o.table_id === t.id)[0]?.created_at : null);
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

async function openNewOrderForTable(tableId, tableNumber) {
    if (!allProducts.length) { const { data } = await sb.from('products').select('*').order('name'); allProducts = data || []; }
    selectedTable = allTables.find(t => t.id === tableId) || { id: tableId, number: tableNumber };
    currentOrderItems = [];
    document.getElementById('comandaName').value = '';
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
            : p.station === 'churrasqueiro' ? '<span style="font-size:0.65rem;color:#f39c12;font-weight:700;display:block;">CHURRASQUEIRO</span>'
            : p.station === 'pizzaria' ? '<span style="font-size:0.65rem;color:#9b59b6;font-weight:700;display:block;">PIZZARIA</span>' : '';
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

function openTableModal() {}

let maintenanceNewTables = [];

function openMaintenanceModal() {
    maintenanceNewTables = [];
    renderMaintenanceRows();
    document.getElementById('tableModal').classList.add('active');
}

function renderMaintenanceRows() {
    const sorted = [...allTables].sort((a,b) => a.number - b.number);
    const rows = sorted.map(t => {
        const isOccupied = t.status === 'occupied';
        const typeBadge = t.table_type === 'virtual'
            ? '<span style="background:#f39c12;color:#fff;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;">VIRTUAL</span>'
            : '<span style="background:#333;color:#a0a0a0;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;">FIXA</span>';
        return `
        <div class="maintenance-row" data-id="${t.id}" style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid #333;border-radius:8px;margin-bottom:8px;background:#1a1a1a;">
            <span style="font-weight:700;min-width:70px;">Mesa ${t.number}</span>
            ${typeBadge}
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="color:#a0a0a0;font-size:0.8rem;">Lugares:</span>
                <input type="number" min="1" max="50" value="${t.capacity}" class="maint-cap" data-id="${t.id}" style="width:60px;padding:6px;text-align:center;border:1px solid #444;border-radius:4px;background:#0d0d0d;color:#f5f5f5;font-size:0.9rem;">
            </div>
            ${isOccupied ? '<span style="color:#e63946;font-size:0.75rem;margin-left:auto;">OCUPADA</span>' : `<button class="btn btn-danger btn-sm" style="margin-left:auto;" onclick="removeMaintenanceRow('${t.id}')">Remover</button>`}
        </div>`;
    }).join('');

    const newRows = maintenanceNewTables.map((t, i) => `
        <div class="maintenance-row maintenance-new" style="display:flex;align-items:center;gap:12px;padding:10px;border:1px solid #f39c12;border-radius:8px;margin-bottom:8px;background:rgba(243,156,18,0.05);">
            <input type="number" min="1" max="999" value="${t.number}" class="maint-new-num" data-idx="${i}" style="width:70px;padding:6px;text-align:center;border:1px solid #f39c12;border-radius:4px;background:#0d0d0d;color:#f5f5f5;font-size:0.9rem;font-weight:700;">
            <span style="background:#f39c12;color:#fff;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:700;">NOVA</span>
            <div style="display:flex;align-items:center;gap:4px;">
                <span style="color:#a0a0a0;font-size:0.8rem;">Lugares:</span>
                <input type="number" min="1" max="50" value="${t.capacity}" class="maint-new-cap" data-idx="${i}" style="width:60px;padding:6px;text-align:center;border:1px solid #444;border-radius:4px;background:#0d0d0d;color:#f5f5f5;font-size:0.9rem;">
            </div>
            <select class="maint-new-type" data-idx="${i}" style="padding:6px;border:1px solid #444;border-radius:4px;background:#0d0d0d;color:#f5f5f5;font-size:0.8rem;margin-left:auto;">
                <option value="fisica" ${t.table_type==='fisica'?'selected':''}>Fixa</option>
                <option value="virtual" ${t.table_type==='virtual'?'selected':''}>Virtual</option>
            </select>
            <button class="btn btn-danger btn-sm" onclick="removeNewTableRow(${i})">X</button>
        </div>
    `).join('');

    document.getElementById('maintenanceBody').innerHTML = rows + newRows || '<div style="color:#666;text-align:center;">Nenhuma mesa</div>';
}

function addNewTableRow() {
    const maxNum = [...allTables, ...maintenanceNewTables].reduce((m, t) => Math.max(m, t.number || 0), 0);
    maintenanceNewTables.push({ number: maxNum + 1, capacity: 4, table_type: 'virtual' });
    renderMaintenanceRows();
}

function removeNewTableRow(idx) {
    maintenanceNewTables.splice(idx, 1);
    renderMaintenanceRows();
}

function removeMaintenanceRow(id) {
    const row = document.querySelector(`.maintenance-row[data-id="${id}"]`);
    if (row) { row.style.opacity = '0.3'; row.style.borderColor = '#e63946'; }
    row.dataset.delete = 'true';
}

async function saveMaintenance() {
    const updates = [];
    document.querySelectorAll('.maintenance-row[data-id]').forEach(row => {
        if (row.dataset.delete === 'true') {
            updates.push(sb.from('tables').delete().eq('id', row.dataset.id));
            return;
        }
        const id = row.dataset.id;
        const cap = row.querySelector('.maint-cap');
        if (cap) updates.push(sb.from('tables').update({ capacity: parseInt(cap.value) }).eq('id', id));
    });

    for (const t of maintenanceNewTables) {
        const num = document.querySelector(`.maint-new-num[data-idx="${maintenanceNewTables.indexOf(t)}"]`);
        const cap = document.querySelector(`.maint-new-cap[data-idx="${maintenanceNewTables.indexOf(t)}"]`);
        const typ = document.querySelector(`.maint-new-type[data-idx="${maintenanceNewTables.indexOf(t)}"]`);
        if (num && cap) {
            updates.push(sb.from('tables').insert({
                number: parseInt(num.value),
                capacity: parseInt(cap.value),
                table_type: typ ? typ.value : 'virtual',
                status: 'available'
            }));
        }
    }

    await Promise.all(updates);
    closeModal('tableModal');
    showToast('Mesas atualizadas!');
    loadTables();
}

let currentTableFilter = 'all';

function filterTables(f, el) {
    currentTableFilter = f;
    document.querySelectorAll('#section-tables .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderTablesGrid();
}

// ========== COMANDA ==========
let currentComanda = null;

async function openComanda(orderId) {
    const { data: order } = await sb.from('orders').select('*').eq('id', orderId).single();
    if (!order) return;
    currentComanda = order;
    renderComandaDetails();
    document.getElementById('comandaModal').classList.add('active');
}

function renderComandaDetails() {
    const o = currentComanda;
    if (!o) return;
    const isActive = o.status === 'pending' || o.status === 'preparing';
    document.getElementById('comandaModalTitle').textContent = `Comanda: ${o.comandas || 'Sem nome'}`;

    const items = o.items || [];
    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

    document.getElementById('btnComandaEdit').style.display = isActive ? '' : 'none';
    document.getElementById('btnComandaReceipt').style.display = items.length ? '' : 'none';

    let html = `
        <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
            ${statusBadge(o.status)}
            <span style="color:#a0a0a0;font-size:0.8rem;">${fmtDate(o.created_at)}</span>
        </div>
        <div style="border-top:1px solid #333;padding-top:12px;">
            ${items.map((it, i) => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222;">
                    <div>
                        <strong>${it.quantity}x ${it.name}</strong>
                        <span style="color:#a0a0a0;margin-left:8px;">${fmt(it.price)}</span>
                    </div>
                    <span style="color:#f39c12;font-weight:600;">${fmt(it.price * it.quantity)}</span>
                </div>
            `).join('')}
            ${items.length === 0 ? '<div style="color:#666;text-align:center;padding:16px;">Nenhum item</div>' : ''}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid #333;display:flex;justify-content:space-between;">
            <strong style="font-size:1rem;">TOTAL</strong>
            <strong style="font-size:1.2rem;color:#e63946;">${fmt(total)}</strong>
        </div>
    `;

    document.getElementById('comandaModalBody').innerHTML = html;
}

let comandaEditItems = [];

function openComandaEdit() {
    if (!currentComanda) return;
    if (!allProducts.length) { sb.from('products').select('*').order('name').then(({ data }) => { allProducts = data || []; renderComandaEdit(); }); return; }
    renderComandaEdit();
}

function renderComandaEdit() {
    const o = currentComanda;
    if (!o) return;
    comandaEditItems = JSON.parse(JSON.stringify(o.items || []));
    document.getElementById('comandaModalTitle').textContent = `Editar: ${o.comandas || 'Sem nome'}`;

    let html = `
        <div class="form-group">
            <label>Produtos</label>
            <div class="product-grid" style="max-height:250px;overflow-y:auto;">
                ${allProducts.filter(p => p.active).map(p => {
                    const st = p.station === 'cozinha' ? 'COZINHA' : p.station === 'churrasqueiro' ? 'CHURRASQUEIRO' : p.station === 'pizzaria' ? 'PIZZARIA' : '';
                    const stColor = p.station === 'cozinha' ? '#3498db' : p.station === 'churrasqueiro' ? '#f39c12' : p.station === 'pizzaria' ? '#9b59b6' : '';
                    return `
                    <div class="product-chip" onclick="editComandaAddItem('${p.id}',${JSON.stringify(p.name).replace(/"/g,'&quot;')},${p.price})">
                        ${st ? `<span style="font-size:0.65rem;color:${stColor};font-weight:700;display:block;">${st}</span>` : ''}
                        <div class="product-name">${p.name}</div>
                        <div class="product-price">${fmt(p.price)}</div>
                    </div>`;
                }).join('')}
            </div>
        </div>
        <div class="form-group" style="margin-top:12px;">
            <label>Itens da Comanda</label>
            <div id="comandaEditItems"></div>
        </div>
        <div class="order-total" style="margin-top:8px;">
            <span class="total-label">Total</span>
            <span class="total-value" id="comandaEditTotal">R$ 0,00</span>
        </div>
    `;

    document.getElementById('comandaModalBody').innerHTML = html;
    renderComandaEditItems();

    document.getElementById('btnComandaEdit').style.display = 'none';
    document.getElementById('btnComandaReceipt').style.display = 'none';

    const footer = document.querySelector('#comandaModal .modal-footer');
    if (!footer.querySelector('#comandaEditSave')) {
        const saveBtn = document.createElement('button');
        saveBtn.id = 'comandaEditSave';
        saveBtn.className = 'btn btn-success btn-sm';
        saveBtn.textContent = 'Salvar Alteracoes';
        saveBtn.onclick = saveComandaEdit;
        footer.appendChild(saveBtn);
    }
    if (!footer.querySelector('#comandaEditCancel')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'comandaEditCancel';
        cancelBtn.className = 'btn btn-secondary btn-sm';
        cancelBtn.textContent = 'Voltar';
        cancelBtn.onclick = () => { document.getElementById('comandaEditSave')?.remove(); document.getElementById('comandaEditCancel')?.remove(); renderComandaDetails(); };
        footer.insertBefore(cancelBtn, footer.firstChild);
    }
}

function renderComandaEditItems() {
    const total = comandaEditItems.reduce((s, it) => s + it.price * it.quantity, 0);
    document.getElementById('comandaEditTotal').textContent = fmt(total);
    document.getElementById('comandaEditItems').innerHTML = comandaEditItems.map((it, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #222;">
            <div style="display:flex;align-items:center;gap:8px;">
                <button class="btn btn-secondary btn-sm" style="padding:2px 8px;" onclick="editComandaChangeQty(${i},-1)">-</button>
                <span>${it.quantity}</span>
                <button class="btn btn-secondary btn-sm" style="padding:2px 8px;" onclick="editComandaChangeQty(${i},1)">+</button>
                <strong>${it.name}</strong>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:#f39c12;font-weight:600;">${fmt(it.price * it.quantity)}</span>
                <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:0.7rem;" onclick="editComandaRemoveItem(${i})">X</button>
            </div>
        </div>
    `).join('') || '<div style="color:#666;text-align:center;padding:12px;">Nenhum item</div>';
}

function editComandaAddItem(pid, name, price) {
    const existing = comandaEditItems.find(it => it.product_id === pid);
    if (existing) existing.quantity++;
    else comandaEditItems.push({ product_id: pid, name, price, quantity: 1 });
    renderComandaEditItems();
}

function editComandaChangeQty(idx, delta) {
    comandaEditItems[idx].quantity += delta;
    if (comandaEditItems[idx].quantity <= 0) comandaEditItems.splice(idx, 1);
    renderComandaEditItems();
}

function editComandaRemoveItem(idx) {
    comandaEditItems.splice(idx, 1);
    renderComandaEditItems();
}

async function saveComandaEdit() {
    if (!currentComanda) return;
    const total = comandaEditItems.reduce((s, it) => s + it.price * it.quantity, 0);
    await sb.from('orders').update({ items: comandaEditItems, total }).eq('id', currentComanda.id);

    const { data: updated } = await sb.from('orders').select('*').eq('id', currentComanda.id).single();
    currentComanda = updated;

    for (const item of comandaEditItems) {
        const prod = allProducts.find(p => p.id === item.product_id);
        if (prod && prod.station) {
            const existingKO = await sb.from('kitchen_orders').select('id').eq('order_id', currentComanda.id).eq('product_name', item.name).eq('status', 'pending');
            if (!existingKO.data || existingKO.data.length < item.quantity) {
                await sb.from('kitchen_orders').insert({
                    order_id: currentComanda.id,
                    table_number: currentComanda.table_id ? allTables.find(t => t.id === currentComanda.table_id)?.number || 0 : 0,
                    comanda_name: currentComanda.comandas || 'Comanda',
                    product_name: item.name,
                    quantity: 1,
                    station: prod.station,
                    status: 'pending'
                });
            }
        }
    }

    document.getElementById('comandaEditSave')?.remove();
    document.getElementById('comandaEditCancel')?.remove();
    renderComandaDetails();
    showToast('Comanda atualizada!');
}

function openComandaReceipt() {
    if (!currentComanda) return;
    const o = currentComanda;
    const items = o.items || [];
    const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

    document.getElementById('comandaModalTitle').textContent = `Conta: ${o.comandas || 'Sem nome'}`;

    let html = `
        <div style="text-align:center;padding:16px 0 8px;border-bottom:2px dashed #333;">
            <div style="font-size:1.1rem;font-weight:700;color:#e63946;">BONSAI ESPETOS</div>
            <div style="color:#a0a0a0;font-size:0.8rem;margin-top:4px;">${o.table_id ? 'Mesa ' + (allTables.find(t => t.id === o.table_id)?.number || '-') : 'Balcao'}</div>
            <div style="color:#a0a0a0;font-size:0.75rem;margin-top:2px;">${fmtDate(o.created_at)}</div>
        </div>
        <div style="padding:12px 0;">
            ${items.map(it => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #222;">
                    <span>${it.quantity}x ${it.name}</span>
                    <span style="font-weight:600;">${fmt(it.price * it.quantity)}</span>
                </div>
            `).join('')}
        </div>
        <div style="text-align:center;padding:12px 0;border-top:2px dashed #333;">
            <div style="color:#a0a0a0;font-size:0.8rem;">TOTAL A PAGAR</div>
            <div style="font-size:1.5rem;font-weight:700;color:#2ecc71;margin-top:4px;">${fmt(total)}</div>
        </div>
    `;

    document.getElementById('comandaModalBody').innerHTML = html;
    document.getElementById('btnComandaEdit').style.display = 'none';
    document.getElementById('btnComandaReceipt').style.display = 'none';
}

async function fecharComanda() {
    if (!currentComanda) return;
    await sb.from('orders').update({ status: 'delivered' }).eq('id', currentComanda.id);
    await sb.from('kitchen_orders').update({ status: 'cancelled' }).eq('order_id', currentComanda.id).in('status', ['pending']);
    closeModal('comandaModal');
    showToast('Comanda fechada!');
    loadTables();
    loadOrders();
}

// ========== FLUXO DE CAIXA ==========
async function loadCashflow() {
    const [cRes, dcRes, oRes] = await Promise.all([
        sb.from('cashflow').select('*').order('created_at', { ascending: false }),
        sb.from('daily_closes').select('*').order('created_at', { ascending: false }).limit(5),
        sb.from('orders').select('*')
    ]);
    const allCash = cRes.data || [];
    const closes = dcRes.data || [];
    const allOrders = oRes.data || [];

    const lastClose = closes[0] || null;
    const sinceDate = lastClose ? lastClose.close_date : null;

    const today = new Date().toISOString().slice(0,10);
    const todayCash = allCash.filter(c => (c.created_at||'').startsWith(today));
    const sinceCash = sinceDate ? allCash.filter(c => (c.created_at||'').slice(0,10) >= sinceDate) : todayCash;

    const dayEnt = todayCash.filter(c => c.type==='entrada').reduce((s,c) => s+parseFloat(c.amount||0), 0);
    const daySai = todayCash.filter(c => c.type==='saida').reduce((s,c) => s+parseFloat(c.amount||0), 0);

    const periodEnt = sinceCash.filter(c => c.type==='entrada').reduce((s,c) => s+parseFloat(c.amount||0), 0);
    const periodSai = sinceCash.filter(c => c.type==='saida').reduce((s,c) => s+parseFloat(c.amount||0), 0);

    const todayOrders = allOrders.filter(o => (o.created_at||'').startsWith(today) && o.status==='delivered');
    const todayRevenue = todayOrders.reduce((s,o) => s+parseFloat(o.total||0), 0);

    document.getElementById('cashStats').innerHTML = `
        <div class="stat-card green"><div class="stat-label">Entradas Hoje</div><div class="stat-value">${fmt(dayEnt)}</div></div>
        <div class="stat-card red"><div class="stat-label">Saidas Hoje</div><div class="stat-value">${fmt(daySai)}</div></div>
        <div class="stat-card blue"><div class="stat-label">Saldo Hoje</div><div class="stat-value">${fmt(dayEnt-daySai)}</div></div>
        <div class="stat-card green"><div class="stat-label">Receita Pedidos Hoje</div><div class="stat-value">${fmt(todayRevenue)}</div></div>
        ${sinceDate ? `<div class="stat-card yellow"><div class="stat-label">Desde Ultimo Fechamento</div><div class="stat-value">${fmt(periodEnt-periodSai)}</div></div>` : ''}
    `;

    if (lastClose) {
        document.getElementById('lastCloseCard').style.display = 'block';
        document.getElementById('lastCloseBody').innerHTML = `
            <div style="display:flex;gap:24px;flex-wrap:wrap;">
                <div><span style="color:#a0a0a0;">Data:</span> <strong>${fmtDate(lastClose.created_at)}</strong></div>
                <div><span style="color:#a0a0a0;">Fechado por:</span> <strong>${lastClose.closed_by_name}</strong></div>
                <div><span style="color:#a0a0a0;">Receita:</span> <strong style="color:#2ecc71;">${fmt(lastClose.total_revenue)}</strong></div>
                <div><span style="color:#a0a0a0;">Entradas:</span> <strong>${fmt(lastClose.total_cash_in)}</strong></div>
                <div><span style="color:#a0a0a0;">Saidas:</span> <strong>${fmt(lastClose.total_cash_out)}</strong></div>
                <div><span style="color:#a0a0a0;">Saldo Informado:</span> <strong>${fmt(lastClose.closing_balance)}</strong></div>
                <div><span style="color:#a0a0a0;">Divergencia:</span> <strong style="color:${Math.abs(lastClose.discrepancy) > 0.01 ? '#e63946' : '#2ecc71'};">${fmt(lastClose.discrepancy)}</strong></div>
                ${lastClose.notes ? `<div><span style="color:#a0a0a0;">Obs:</span> <strong>${lastClose.notes}</strong></div>` : ''}
            </div>
        `;
    } else {
        document.getElementById('lastCloseCard').style.display = 'none';
    }

    document.getElementById('cashflowBody').innerHTML = todayCash.map(c => `
        <tr>
            <td>${fmtDate(c.created_at)}</td>
            <td>${c.type==='entrada'?'<span style="color:#2ecc71;">Entrada</span>':'<span style="color:#e63946;">Saida</span>'}</td>
            <td>${c.description}</td>
            <td>${c.category||'-'}</td>
            <td style="color:${c.type==='entrada'?'#2ecc71':'#e63946'};font-weight:700;">${c.type==='entrada'?'+':'-'} ${fmt(c.amount)}</td>
            <td>${c.user_name||'-'}</td>
        </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center;color:#666;">Nenhuma movimentacao hoje</td></tr>';
}

let closeDayData = {};

async function openCloseDayModal() {
    const today = new Date().toISOString().slice(0,10);
    const [cRes, oRes] = await Promise.all([
        sb.from('cashflow').select('*'),
        sb.from('orders').select('*')
    ]);
    const allCash = cRes.data || [];
    const allOrders = oRes.data || [];

    const todayCash = allCash.filter(c => (c.created_at||'').startsWith(today));
    const todayOrders = allOrders.filter(o => (o.created_at||'').startsWith(today));
    const delivered = todayOrders.filter(o => o.status === 'delivered');
    const cancelled = todayOrders.filter(o => o.status === 'cancelled');

    const totalRevenue = delivered.reduce((s,o) => s + parseFloat(o.total||0), 0);
    const totalItems = delivered.reduce((s,o) => s + (o.items||[]).reduce((si,it) => si + it.quantity, 0), 0);
    const cashIn = todayCash.filter(c => c.type==='entrada').reduce((s,c) => s+parseFloat(c.amount||0), 0);
    const cashOut = todayCash.filter(c => c.type==='saida').reduce((s,c) => s+parseFloat(c.amount||0), 0);
    const expectedBalance = cashIn - cashOut;

    closeDayData = { totalRevenue, totalItems, totalOrders: delivered.length, cancelledCount: cancelled.length, cashIn, cashOut, expectedBalance };

    document.getElementById('closeDayBody').innerHTML = `
        <div style="margin-bottom:16px;color:#a0a0a0;">Resumo do dia <strong style="color:#fff;">${today}</strong>:</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Pedidos Entregues</span><strong>${delivered.length}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Pedidos Cancelados</span><strong style="color:#e63946;">${cancelled.length}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Itens Vendidos</span><strong>${totalItems}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Receita Total</span><strong style="color:#2ecc71;">${fmt(totalRevenue)}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Entradas no Caixa</span><strong style="color:#2ecc71;">${fmt(cashIn)}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Saidas no Caixa</span><strong style="color:#e63946;">${fmt(cashOut)}</strong></div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Saldo Esperado</span><strong style="color:#f39c12;">${fmt(expectedBalance)}</strong></div>
        </div>
        <div class="form-group" style="margin-top:16px;">
            <label>Saldo em Caixa (contado fisicamente)</label>
            <input type="number" id="closingBalance" step="0.01" value="${expectedBalance.toFixed(2)}" style="width:100%;padding:10px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#f5f5f5;font-size:1rem;">
        </div>
        <div id="discrepancyDisplay" style="margin-top:8px;padding:8px;border-radius:6px;text-align:center;font-weight:700;"></div>
        <div class="form-group" style="margin-top:12px;">
            <label>Observacoes</label>
            <textarea id="closingNotes" rows="2" style="width:100%;padding:8px;border-radius:6px;border:1px solid #333;background:#1a1a1a;color:#f5f5f5;resize:vertical;" placeholder="Observacoes do fechamento..."></textarea>
        </div>
    `;

    const input = document.getElementById('closingBalance');
    input.addEventListener('input', () => {
        const val = parseFloat(input.value) || 0;
        const disc = val - expectedBalance;
        const el = document.getElementById('discrepancyDisplay');
        if (Math.abs(disc) < 0.01) {
            el.style.background = 'rgba(46,204,113,0.1)';
            el.style.border = '1px solid #2ecc71';
            el.style.color = '#2ecc71';
            el.textContent = 'Caixa batido!';
        } else {
            el.style.background = 'rgba(230,57,70,0.1)';
            el.style.border = '1px solid #e63946';
            el.style.color = '#e63946';
            el.textContent = `Divergencia: ${disc >= 0 ? '+' : ''}${fmt(disc)}`;
        }
    });
    input.dispatchEvent(new Event('input'));

    document.getElementById('closeDayModal').classList.add('active');
}

async function confirmCloseDay() {
    const balance = parseFloat(document.getElementById('closingBalance').value) || 0;
    const notes = document.getElementById('closingNotes').value;
    const today = new Date().toISOString().slice(0,10);

    await sb.from('daily_closes').insert({
        close_date: today,
        closed_by: currentUser,
        closed_by_name: userProfile.name,
        total_orders: closeDayData.totalOrders,
        total_revenue: closeDayData.totalRevenue,
        total_items: closeDayData.totalItems,
        total_cash_in: closeDayData.cashIn,
        total_cash_out: closeDayData.cashOut,
        closing_balance: balance,
        expected_balance: closeDayData.expectedBalance,
        discrepancy: balance - closeDayData.expectedBalance,
        notes
    });

    closeModal('closeDayModal');
    showToast('Caixa fechado com sucesso!');
    loadCashflow();
}

function openCashModal(type) {
    document.getElementById('cashType').value = type;
    const titleEl = document.getElementById('cashModalTitle');
    const infoEl = document.getElementById('cashCorrecaoInfo');
    if (type === 'entrada') { titleEl.textContent = 'Nova Entrada'; infoEl.style.display = 'none'; }
    else if (type === 'saida') { titleEl.textContent = 'Nova Saida'; infoEl.style.display = 'none'; }
    else { titleEl.textContent = 'Correcao de Caixa'; infoEl.style.display = 'block'; }
    document.getElementById('cashDescription').value = '';
    document.getElementById('cashAmount').value = '';
    document.getElementById('cashCategory').value = type === 'correcao' ? 'Correcao' : '';
    document.getElementById('cashModal').classList.add('active');
}

async function saveCashflow() {
    const type = document.getElementById('cashType').value;
    const amount = parseFloat(document.getElementById('cashAmount').value);
    const desc = document.getElementById('cashDescription').value;
    const cat = document.getElementById('cashCategory').value;

    if (type === 'correcao') {
        if (amount > 0) {
            await sb.from('cashflow').insert({ type: 'entrada', description: '[CORRECAO] ' + desc, amount, category: cat || 'Correcao', user_id: currentUser, user_name: userProfile.name });
        } else {
            await sb.from('cashflow').insert({ type: 'saida', description: '[CORRECAO] ' + desc, amount: Math.abs(amount), category: cat || 'Correcao', user_id: currentUser, user_name: userProfile.name });
        }
    } else {
        await sb.from('cashflow').insert({ type, description: desc, amount, category: cat, user_id: currentUser, user_name: userProfile.name });
    }
    closeModal('cashModal');
    showToast('Movimentacao registrada!');
    loadCashflow();
}

// ========== RELATORIOS ==========
let reportData = {};
let currentReportTab = 'general';

function showReportTab(tab, el) {
    currentReportTab = tab;
    document.querySelectorAll('#section-reports .tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    renderReportTab();
}

function getDateFilter() {
    const v = document.getElementById('reportPeriod').value;
    if (v === 'all' || v === 'today') return v;
    const d = new Date();
    d.setDate(d.getDate() - parseInt(v));
    return d.toISOString().slice(0,10);
}

function filterByDate(arr, field='created_at') {
    const df = getDateFilter();
    if (df === 'all') return arr;
    if (df === 'today') {
        const today = new Date().toISOString().slice(0,10);
        return arr.filter(x => (x[field]||'').startsWith(today));
    }
    return arr.filter(x => (x[field]||'') >= df);
}

async function loadReports() {
    const [oRes, cRes, pRes, sRes, uRes, tRes] = await Promise.all([
        sb.from('orders').select('*').order('created_at', { ascending: false }),
        sb.from('cashflow').select('*').order('created_at', { ascending: false }),
        sb.from('products').select('*'),
        sb.from('stock_history').select('*').order('created_at', { ascending: false }),
        sb.from('users').select('*'),
        sb.from('tables').select('*')
    ]);

    const allOrders = oRes.data || [];
    const allCash = cRes.data || [];
    const allProducts = pRes.data || [];
    const allStock = sRes.data || [];
    const allUsers = uRes.data || [];
    const allTables = tRes.data || [];

    const filteredOrders = filterByDate(allOrders);
    const filteredCash = filterByDate(allCash);

    const delivered = filteredOrders.filter(o => o.status === 'delivered');
    const cancelled = filteredOrders.filter(o => o.status === 'cancelled');
    const pending = filteredOrders.filter(o => o.status === 'pending' || o.status === 'preparing');

    const totalRevenue = delivered.reduce((s,o) => s + parseFloat(o.total||0), 0);
    const totalCancelledValue = cancelled.reduce((s,o) => s + parseFloat(o.total||0), 0);
    const avgTicket = delivered.length > 0 ? totalRevenue / delivered.length : 0;

    const cashIn = filteredCash.filter(c => c.type === 'entrada').reduce((s,c) => s + parseFloat(c.amount||0), 0);
    const cashOut = filteredCash.filter(c => c.type === 'saida').reduce((s,c) => s + parseFloat(c.amount||0), 0);

    const totalCost = delivered.reduce((s,o) => {
        return s + (o.items||[]).reduce((si, it) => {
            const prod = allProducts.find(p => p.id === it.product_id);
            return si + (parseFloat(prod?.cost||0) * it.quantity);
        }, 0);
    }, 0);

    const totalItems = delivered.reduce((s,o) => s + (o.items||[]).reduce((si,it) => si + it.quantity, 0), 0);

    reportData = { allOrders, filteredOrders, filteredCash, allCash, allProducts, allStock, allUsers, allTables,
        delivered, cancelled, pending, totalRevenue, totalCancelledValue, avgTicket,
        cashIn, cashOut, totalCost, totalItems };
    renderReportTab();
}

function renderReportTab() {
    const el = document.getElementById('reportContent');
    switch(currentReportTab) {
        case 'general': el.innerHTML = reportGeneral(); break;
        case 'cash': el.innerHTML = reportCash(); break;
        case 'cancellations': el.innerHTML = reportCancellations(); break;
        case 'staff': el.innerHTML = reportStaff(); break;
        case 'products': el.innerHTML = reportProducts(); break;
        case 'alerts': el.innerHTML = reportAlerts(); break;
    }
}

function reportGeneral() {
    const d = reportData;
    const profit = d.totalRevenue - d.totalCost;
    const margin = d.totalRevenue > 0 ? ((profit / d.totalRevenue) * 100).toFixed(1) : 0;
    const today = new Date().toISOString().slice(0,10);
    const todayOrders = d.delivered.filter(o => (o.created_at||'').startsWith(today));
    const todayRevenue = todayOrders.reduce((s,o) => s + parseFloat(o.total||0), 0);

    const ticketByDay = {};
    d.delivered.forEach(o => {
        const day = (o.created_at||'').slice(0,10);
        if (!ticketByDay[day]) ticketByDay[day] = { count: 0, total: 0 };
        ticketByDay[day].count++;
        ticketByDay[day].total += parseFloat(o.total||0);
    });
    const days = Object.keys(ticketByDay).sort().slice(-14);
    const dailyData = days.map(day => ({
        day,
        count: ticketByDay[day].count,
        total: ticketByDay[day].total,
        avg: ticketByDay[day].total / ticketByDay[day].count
    }));

    return `
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="stat-card green"><div class="stat-label">Receita Total</div><div class="stat-value">${fmt(d.totalRevenue)}</div></div>
            <div class="stat-card red"><div class="stat-label">Custo Total</div><div class="stat-value">${fmt(d.totalCost)}</div></div>
            <div class="stat-card blue"><div class="stat-label">Lucro Bruto</div><div class="stat-value">${fmt(profit)}</div></div>
            <div class="stat-card yellow"><div class="stat-label">Margem</div><div class="stat-value">${margin}%</div></div>
            <div class="stat-card green"><div class="stat-label">Receita Hoje</div><div class="stat-value">${fmt(todayRevenue)}</div></div>
            <div class="stat-card blue"><div class="stat-label">Ticket Medio</div><div class="stat-value">${fmt(d.avgTicket)}</div></div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h2>Resumo Geral</h2></div>
                <div class="card-body">
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Total Pedidos</span><strong>${d.filteredOrders.length}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Entregues</span><strong style="color:#2ecc71;">${d.delivered.length}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Cancelados</span><strong style="color:#e63946;">${d.cancelled.length}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Pendentes/Preparando</span><strong style="color:#f39c12;">${d.pending.length}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Total Itens Vendidos</span><strong>${d.totalItems}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Ticket Medio</span><strong>${fmt(d.avgTicket)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Valor Cancelado</span><strong style="color:#e63946;">${fmt(d.totalCancelledValue)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Taxa Cancelamento</span><strong style="color:#e63946;">${d.filteredOrders.length > 0 ? ((d.cancelled.length / d.filteredOrders.length)*100).toFixed(1) : 0}%</strong></div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h2>Fluxo de Caixa Resumido</h2></div>
                <div class="card-body">
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Entradas (Caixa)</span><strong style="color:#2ecc71;">${fmt(d.cashIn)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Saidas (Caixa)</span><strong style="color:#e63946;">${fmt(d.cashOut)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Saldo Caixa</span><strong>${fmt(d.cashIn - d.cashOut)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Receita Pedidos</span><strong style="color:#2ecc71;">${fmt(d.totalRevenue)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Custo Produtos</span><strong style="color:#e63946;">${fmt(d.totalCost)}</strong></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 0;"><span>Lucro Bruto</span><strong style="color:${profit>=0?'#2ecc71':'#e63946'};">${fmt(profit)}</strong></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h2>Desempenho Diario</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Dia</th><th>Pedidos</th><th>Receita</th><th>Ticket Medio</th></tr></thead>
                        <tbody>
                            ${dailyData.reverse().map(r => `<tr><td>${r.day}</td><td>${r.count}</td><td>${fmt(r.total)}</td><td>${fmt(r.avg)}</td></tr>`).join('')}
                            ${dailyData.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#666;">Sem dados</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function reportCash() {
    const d = reportData;
    const entries = d.filteredCash;
    const delivered = d.delivered;
    const expectedCash = delivered.reduce((s,o) => s + parseFloat(o.total||0), 0);
    const actualCash = entries.filter(c => c.type === 'entrada').reduce((s,c) => s + parseFloat(c.amount||0), 0);
    const discrepancy = actualCash - expectedCash;
    const totalSaidas = entries.filter(c => c.type === 'saida').reduce((s,c) => s + parseFloat(c.amount||0), 0);

    const saidasByCategory = {};
    entries.filter(c => c.type === 'saida').forEach(c => {
        const cat = c.category || 'Sem Categoria';
        if (!saidasByCategory[cat]) saidasByCategory[cat] = 0;
        saidasByCategory[cat] += parseFloat(c.amount||0);
    });

    const entradasByCategory = {};
    entries.filter(c => c.type === 'entrada').forEach(c => {
        const cat = c.category || 'Sem Categoria';
        if (!entradasByCategory[cat]) entradasByCategory[cat] = 0;
        entradasByCategory[cat] += parseFloat(c.amount||0);
    });

    const largeWithdrawals = entries.filter(c => c.type === 'saida' && parseFloat(c.amount||0) > 100);

    return `
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="stat-card green"><div class="stat-label">Entradas Caixa</div><div class="stat-value">${fmt(actualCash)}</div></div>
            <div class="stat-card red"><div class="stat-label">Saidas Caixa</div><div class="stat-value">${fmt(totalSaidas)}</div></div>
            <div class="stat-card blue"><div class="stat-label">Saldo</div><div class="stat-value">${fmt(actualCash - totalSaidas)}</div></div>
            <div class="stat-card" style="border-color:${Math.abs(discrepancy) > 50 ? '#e63946' : '#333'};"><div class="stat-label">Divergencia</div><div class="stat-value" style="color:${discrepancy < 0 ? '#e63946' : '#2ecc71'};">${fmt(discrepancy)}</div></div>
        </div>

        <div class="card" style="border-color:${Math.abs(discrepancy) > 50 ? '#e63946' : '#333'};margin-bottom:16px;">
            <div class="card-header"><h2 style="color:${Math.abs(discrepancy) > 50 ? '#e63946' : '#fff'};">Controle de Divergencia</h2></div>
            <div class="card-body">
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Receita Esperada (Pedidos Entregues)</span><strong>${fmt(expectedCash)}</strong></div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Entradas Registradas no Caixa</span><strong>${fmt(actualCash)}</strong></div>
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>Diferenca</span><strong style="color:${discrepancy < 0 ? '#e63946' : '#2ecc71'};">${fmt(discrepancy)}</strong></div>
                    <div style="padding:8px;border-radius:6px;background:${Math.abs(discrepancy) > 50 ? 'rgba(230,57,70,0.1)' : 'rgba(46,204,113,0.1)'};border:1px solid ${Math.abs(discrepancy) > 50 ? '#e63946' : '#2ecc71'};">
                        ${Math.abs(discrepancy) > 50
                            ? '<span style="color:#e63946;font-weight:700;">ATENCAO: Divergencia significativa detectada! Verifique as movimentacoes de caixa.</span>'
                            : '<span style="color:#2ecc71;">Caixa dentro do esperado.</span>'}
                    </div>
                </div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h2>Saidas por Categoria</h2></div>
                <div class="card-body">
                    ${Object.entries(saidasByCategory).sort((a,b) => b[1]-a[1]).map(([cat, val]) => `
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>${cat}</span><strong style="color:#e63946;">${fmt(val)}</strong></div>
                    `).join('') || '<div style="color:#666;text-align:center;">Sem saidas</div>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h2>Entradas por Categoria</h2></div>
                <div class="card-body">
                    ${Object.entries(entradasByCategory).sort((a,b) => b[1]-a[1]).map(([cat, val]) => `
                        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;"><span>${cat}</span><strong style="color:#2ecc71;">${fmt(val)}</strong></div>
                    `).join('') || '<div style="color:#666;text-align:center;">Sem entradas</div>'}
                </div>
            </div>
        </div>

        ${largeWithdrawals.length > 0 ? `
        <div class="card" style="margin-top:16px;border-color:#f39c12;">
            <div class="card-header"><h2 style="color:#f39c12;">Saidas Acima de R$ 100,00</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Data</th><th>Descricao</th><th>Categoria</th><th>Valor</th><th>Responsavel</th></tr></thead>
                        <tbody>
                            ${largeWithdrawals.map(c => `<tr><td>${fmtDate(c.created_at)}</td><td>${c.description}</td><td>${c.category||'-'}</td><td style="color:#e63946;font-weight:700;">${fmt(c.amount)}</td><td>${c.user_name||'-'}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>` : ''}

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h2>Todas as Movimentacoes</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Data</th><th>Tipo</th><th>Descricao</th><th>Categoria</th><th>Valor</th><th>Responsavel</th></tr></thead>
                        <tbody>
                            ${entries.slice(0, 50).map(c => `<tr>
                                <td>${fmtDate(c.created_at)}</td>
                                <td>${c.type==='entrada'?'<span style="color:#2ecc71;">Entrada</span>':'<span style="color:#e63946;">Saida</span>'}</td>
                                <td>${c.description}</td>
                                <td>${c.category||'-'}</td>
                                <td style="color:${c.type==='entrada'?'#2ecc71':'#e63946'};font-weight:700;">${c.type==='entrada'?'+':'-'} ${fmt(c.amount)}</td>
                                <td>${c.user_name||'-'}</td>
                            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#666;">Sem movimentacoes</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function reportCancellations() {
    const d = reportData;
    const cancelled = d.cancelled;
    const totalValue = d.totalCancelledValue;
    const totalOrders = d.filteredOrders.length;
    const cancelRate = totalOrders > 0 ? ((cancelled.length / totalOrders)*100).toFixed(1) : 0;

    const byUser = {};
    cancelled.forEach(o => {
        const name = o.user_name || 'Desconhecido';
        if (!byUser[name]) byUser[name] = { count: 0, value: 0 };
        byUser[name].count++;
        byUser[name].value += parseFloat(o.total||0);
    });

    const byHour = {};
    cancelled.forEach(o => {
        const h = new Date(o.created_at).getHours();
        if (!byHour[h]) byHour[h] = 0;
        byHour[h]++;
    });

    const byTable = {};
    cancelled.forEach(o => {
        const t = o.table_id || 'N/A';
        if (!byTable[t]) byTable[t] = { count: 0, value: 0 };
        byTable[t].count++;
        byTable[t].value += parseFloat(o.total||0);
    });

    return `
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="stat-card red"><div class="stat-label">Total Cancelados</div><div class="stat-value">${cancelled.length}</div></div>
            <div class="stat-card red"><div class="stat-label">Valor Cancelado</div><div class="stat-value">${fmt(totalValue)}</div></div>
            <div class="stat-card yellow"><div class="stat-label">Taxa Cancelamento</div><div class="stat-value">${cancelRate}%</div></div>
            <div class="stat-card blue"><div class="stat-label">Pedidos no Periodo</div><div class="stat-value">${totalOrders}</div></div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h2>Cancelamentos por Atendente</h2></div>
                <div class="card-body">
                    <div class="table-container">
                        <table>
                            <thead><tr><th>Atendente</th><th>Qtd</th><th>Valor</th></tr></thead>
                            <tbody>
                                ${Object.entries(byUser).sort((a,b) => b[1].count - a[1].count).map(([name, data]) => `
                                    <tr><td>${name}</td><td>${data.count}</td><td style="color:#e63946;font-weight:700;">${fmt(data.value)}</td></tr>
                                `).join('') || '<tr><td colspan="3" style="text-align:center;color:#666;">Sem cancelamentos</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h2>Cancelamentos por Hora</h2></div>
                <div class="card-body">
                    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;">
                        ${Array.from({length:24}, (_,i) => {
                            const count = byHour[i] || 0;
                            const maxH = Math.max(...Object.values(byHour), 1);
                            const intensity = count / maxH;
                            return `<div style="text-align:center;padding:6px;border-radius:4px;background:rgba(230,57,70,${intensity * 0.6});font-size:0.7rem;"><div style="color:#a0a0a0;">${i.toString().padStart(2,'0')}h</div><div style="font-weight:700;">${count}</div></div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h2>Pedidos Cancelados (Detalhado)</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Data</th><th>Pedido</th><th>Mesa</th><th>Itens</th><th>Valor</th><th>Responsavel</th></tr></thead>
                        <tbody>
                            ${cancelled.slice(0, 30).map(o => `<tr>
                                <td>${fmtDate(o.created_at)}</td>
                                <td>#${(o.id||'').slice(0,8)}</td>
                                <td>${o.table_id ? o.table_id.slice(0,8) : '-'}</td>
                                <td>${(o.items||[]).length} itens</td>
                                <td style="color:#e63946;font-weight:700;">${fmt(o.total)}</td>
                                <td>${o.user_name||'-'}</td>
                            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#666;">Sem cancelamentos</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function reportStaff() {
    const d = reportData;
    const staff = {};
    d.delivered.forEach(o => {
        const name = o.user_name || 'Desconhecido';
        if (!staff[name]) staff[name] = { orders: 0, revenue: 0, items: 0, cancelled: 0, cancelValue: 0 };
        staff[name].orders++;
        staff[name].revenue += parseFloat(o.total||0);
        staff[name].items += (o.items||[]).reduce((s,it) => s + it.quantity, 0);
    });
    d.cancelled.forEach(o => {
        const name = o.user_name || 'Desconhecido';
        if (!staff[name]) staff[name] = { orders: 0, revenue: 0, items: 0, cancelled: 0, cancelValue: 0 };
        staff[name].cancelled++;
        staff[name].cancelValue += parseFloat(o.total||0);
    });

    const entries = d.filteredCash;
    const byUserCash = {};
    entries.forEach(c => {
        const name = c.user_name || 'Desconhecido';
        if (!byUserCash[name]) byUserCash[name] = { entradas: 0, saidas: 0 };
        if (c.type === 'entrada') byUserCash[name].entradas += parseFloat(c.amount||0);
        else byUserCash[name].saidas += parseFloat(c.amount||0);
    });

    return `
        <div class="card">
            <div class="card-header"><h2>Desempenho por Atendente</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Atendente</th><th>Pedidos</th><th>Receita</th><th>Ticket Medio</th><th>Itens</th><th>Cancelamentos</th><th>Val. Cancelado</th></tr></thead>
                        <tbody>
                            ${Object.entries(staff).sort((a,b) => b[1].revenue - a[1].revenue).map(([name, s]) => {
                                const avg = s.orders > 0 ? s.revenue / s.orders : 0;
                                const cancelRate = (s.orders + s.cancelled) > 0 ? ((s.cancelled / (s.orders + s.cancelled))*100).toFixed(1) : 0;
                                return `<tr>
                                    <td><strong>${name}</strong></td>
                                    <td>${s.orders}</td>
                                    <td>${fmt(s.revenue)}</td>
                                    <td>${fmt(avg)}</td>
                                    <td>${s.items}</td>
                                    <td style="color:${s.cancelled > 3 ? '#e63946' : '#f5f5f5'};">${s.cancelled} (${cancelRate}%)</td>
                                    <td style="color:#e63946;">${fmt(s.cancelValue)}</td>
                                </tr>`;
                            }).join('') || '<tr><td colspan="7" style="text-align:center;color:#666;">Sem dados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h2>Movimentacoes de Caixa por Atendente</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Atendente</th><th>Entradas</th><th>Saidas</th><th>Saldo</th></tr></thead>
                        <tbody>
                            ${Object.entries(byUserCash).sort((a,b) => (b[1].entradas - b[1].saidas) - (a[1].entradas - a[1].saidas)).map(([name, c]) => `
                                <tr>
                                    <td><strong>${name}</strong></td>
                                    <td style="color:#2ecc71;">${fmt(c.entradas)}</td>
                                    <td style="color:#e63946;">${fmt(c.saidas)}</td>
                                    <td style="color:${c.entradas-c.saidas>=0?'#2ecc71':'#e63946'};font-weight:700;">${fmt(c.entradas - c.saidas)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="4" style="text-align:center;color:#666;">Sem dados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function reportProducts() {
    const d = reportData;
    const productSales = {};
    d.delivered.forEach(o => {
        (o.items||[]).forEach(it => {
            if (!productSales[it.product_id]) productSales[it.product_id] = { name: it.name, qty: 0, revenue: 0 };
            productSales[it.product_id].qty += it.quantity;
            productSales[it.product_id].revenue += it.price * it.quantity;
        });
    });

    const sorted = Object.entries(productSales).sort((a,b) => b[1].revenue - a[1].revenue);
    const top5 = sorted.slice(0,5);
    const bottom5 = sorted.slice(-5).reverse();

    const categoryRevenue = {};
    d.delivered.forEach(o => {
        (o.items||[]).forEach(it => {
            const prod = d.allProducts.find(p => p.id === it.product_id);
            const cat = prod?.category || 'Outros';
            if (!categoryRevenue[cat]) categoryRevenue[cat] = { qty: 0, revenue: 0 };
            categoryRevenue[cat].qty += it.quantity;
            categoryRevenue[cat].revenue += it.price * it.quantity;
        });
    });

    return `
        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h2 style="color:#2ecc71;">Top 5 Mais Vendidos</h2></div>
                <div class="card-body">
                    ${top5.map(([id, p], i) => `
                        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #222;">
                            <span><span style="color:#a0a0a0;">${i+1}.</span> <strong>${p.name}</strong></span>
                            <span style="color:#2ecc71;font-weight:700;">${p.qty}x - ${fmt(p.revenue)}</span>
                        </div>
                    `).join('') || '<div style="color:#666;text-align:center;">Sem dados</div>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h2 style="color:#e63946;">Top 5 Menos Vendidos</h2></div>
                <div class="card-body">
                    ${bottom5.map(([id, p], i) => `
                        <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #222;">
                            <span><span style="color:#a0a0a0;">${i+1}.</span> <strong>${p.name}</strong></span>
                            <span style="color:#f39c12;font-weight:700;">${p.qty}x - ${fmt(p.revenue)}</span>
                        </div>
                    `).join('') || '<div style="color:#666;text-align:center;">Sem dados</div>'}
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h2>Receita por Categoria</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Categoria</th><th>Itens Vendidos</th><th>Receita</th><th>% do Total</th></tr></thead>
                        <tbody>
                            ${Object.entries(categoryRevenue).sort((a,b) => b[1].revenue - a[1].revenue).map(([cat, data]) => {
                                const pct = d.totalRevenue > 0 ? ((data.revenue / d.totalRevenue)*100).toFixed(1) : 0;
                                return `<tr><td><strong>${cat}</strong></td><td>${data.qty}</td><td>${fmt(data.revenue)}</td><td>${pct}%</td></tr>`;
                            }).join('') || '<tr><td colspan="4" style="text-align:center;color:#666;">Sem dados</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:16px;">
            <div class="card-header"><h2>Todos os Produtos Vendidos</h2></div>
            <div class="card-body">
                <div class="table-container">
                    <table>
                        <thead><tr><th>Produto</th><th>Qtd Vendida</th><th>Receita</th><th>Custo Unit.</th><th>Lucro</th><th>Margem</th></tr></thead>
                        <tbody>
                            ${sorted.map(([id, p]) => {
                                const prod = d.allProducts.find(x => x.id === id);
                                const cost = parseFloat(prod?.cost||0) * p.qty;
                                const profit = p.revenue - cost;
                                const margin = p.revenue > 0 ? ((profit/p.revenue)*100).toFixed(1) : 0;
                                return `<tr>
                                    <td><strong>${p.name}</strong></td>
                                    <td>${p.qty}</td>
                                    <td>${fmt(p.revenue)}</td>
                                    <td>${fmt(prod?.cost||0)}</td>
                                    <td style="color:${profit>=0?'#2ecc71':'#e63946'};">${fmt(profit)}</td>
                                    <td>${margin}%</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

function reportAlerts() {
    const d = reportData;
    const alerts = [];

    const cancelRate = d.filteredOrders.length > 0 ? (d.cancelled.length / d.filteredOrders.length) * 100 : 0;
    if (cancelRate > 10) alerts.push({ level: 'high', title: 'Taxa de cancelamento alta', desc: `${cancelRate.toFixed(1)}% dos pedidos foram cancelados (${d.cancelled.length}/${d.filteredOrders.length}). Valor total: ${fmt(d.totalCancelledValue)}` });

    const discrepancy = d.cashIn - d.totalRevenue;
    if (Math.abs(discrepancy) > 50) alerts.push({ level: 'high', title: 'Divergencia no caixa', desc: `Diferenca de ${fmt(discrepancy)} entre entradas no caixa (${fmt(d.cashIn)}) e receita de pedidos (${fmt(d.totalRevenue)})` });

    const staff = {};
    d.cancelled.forEach(o => {
        const name = o.user_name || 'Desconhecido';
        if (!staff[name]) staff[name] = { orders: 0, cancelled: 0 };
        staff[name].cancelled++;
    });
    d.delivered.forEach(o => {
        const name = o.user_name || 'Desconhecido';
        if (!staff[name]) staff[name] = { orders: 0, cancelled: 0 };
        staff[name].orders++;
    });
    Object.entries(staff).forEach(([name, s]) => {
        const total = s.orders + s.cancelled;
        const rate = total > 0 ? (s.cancelled / total) * 100 : 0;
        if (rate > 20 && s.cancelled >= 3) alerts.push({ level: 'medium', title: `Atendente com muitos cancelamentos: ${name}`, desc: `${s.cancelled} cancelamentos de ${total} pedidos (${rate.toFixed(1)}%)` });
    });

    const largeOrders = d.delivered.filter(o => parseFloat(o.total||0) > 200);
    if (largeOrders.length > 0) alerts.push({ level: 'low', title: `${largeOrders.length} pedido(s) acima de R$ 200,00`, desc: 'Verifique se os valores estao corretos.' });

    const saidas = d.filteredCash.filter(c => c.type === 'saida');
    const largeSaidas = saidas.filter(c => parseFloat(c.amount||0) > 200);
    if (largeSaidas.length > 0) alerts.push({ level: 'high', title: `${largeSaidas.length} saida(s) acima de R$ 200,00`, desc: largeSaidas.map(c => `${c.description}: ${fmt(c.amount)} (${c.user_name||'?'})`).join('; ') });

    const nightOrders = d.delivered.filter(o => {
        const h = new Date(o.created_at).getHours();
        return h >= 0 && h < 6;
    });
    if (nightOrders.length > 3) alerts.push({ level: 'medium', title: `${nightOrders.length} pedidos entre 00h-06h`, desc: `Valor total: ${fmt(nightOrders.reduce((s,o) => s + parseFloat(o.total||0), 0))}. Verifique se e operacao normal.` });

    const pending = d.filteredOrders.filter(o => o.status === 'pending');
    if (pending.length > 5) alerts.push({ level: 'medium', title: `${pending.length} pedidos pendentes`, desc: 'Ha muitos pedidos pendentes. Verifique se nao foram abandonados.' });

    d.delivered.forEach(o => {
        (o.items||[]).forEach(it => {
            const prod = d.allProducts.find(p => p.id === it.product_id);
            if (prod && prod.cost > 0) {
                const costPct = (prod.cost / it.price) * 100;
                if (costPct > 80) alerts.push({ level: 'low', title: `Produto com margem baixa: ${it.name}`, desc: `Custo ${costPct.toFixed(0)}% do preco de venda (${fmt(prod.cost)} / ${fmt(it.price)})` });
            }
        });
    });

    const levelOrder = { high: 0, medium: 1, low: 2 };
    alerts.sort((a,b) => levelOrder[a.level] - levelOrder[b.level]);

    const levelColor = { high: '#e63946', medium: '#f39c12', low: '#3498db' };
    const levelLabel = { high: 'ALTO', medium: 'MEDIO', low: 'BAIXO' };

    return `
        <div class="stats-grid" style="margin-bottom:16px;">
            <div class="stat-card red"><div class="stat-label">Alertas Altos</div><div class="stat-value">${alerts.filter(a => a.level==='high').length}</div></div>
            <div class="stat-card yellow"><div class="stat-label">Alertas Medios</div><div class="stat-value">${alerts.filter(a => a.level==='medium').length}</div></div>
            <div class="stat-card blue"><div class="stat-label">Alertas Baixos</div><div class="stat-value">${alerts.filter(a => a.level==='low').length}</div></div>
        </div>

        ${alerts.length === 0 ? '<div class="card"><div class="card-body" style="text-align:center;color:#2ecc71;"><h2>Nenhum alerta detectado</h2><p>O sistema nao identificou irregularidades no periodo.</p></div></div>' :

        alerts.map(a => `
            <div class="card" style="margin-bottom:12px;border-color:${levelColor[a.level]};">
                <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
                    <h2>${a.title}</h2>
                    <span style="background:${levelColor[a.level]};color:#fff;padding:4px 10px;border-radius:12px;font-size:0.7rem;font-weight:700;">${levelLabel[a.level]}</span>
                </div>
                <div class="card-body" style="color:#a0a0a0;">${a.desc}</div>
            </div>
        `).join('')}`;
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
