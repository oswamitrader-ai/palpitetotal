// =============================================
// ADMIN CRM LOGIC - PALPITETOTAL SOBERANO
// =============================================

const SUPABASE_URL = 'https://xybbhnteetzoccazcdae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

let supabaseClient = null;
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Credentials
const ADMIN_USER = 'oswamitrader@gmail.com';
const ADMIN_PASS = 'Jnior19!8495';

// State Store
let adminStore = {
  bets: [],
  userBets: [],
  transactions: [],
  profiles: [],
  posts: []
};

let currentAdminTab = 'dash';
let betFilter = 'OPEN';
let pieChartInstance = null;
let barChartInstance = null;
let expirationTimerId = null;

// ---- AUTH & LOGIN ----
function handleAdminLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const pass = document.getElementById('admin-password').value.trim();
  const err = document.getElementById('admin-login-error');

  if (email === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem('admin_auth', 'true');
    sessionStorage.setItem('admin_email', email);
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-app-container').style.display = 'flex';
    document.getElementById('admin-display-name').textContent = email;
    loadAdminData().then(() => initAdminRealtimeSubscriptions());
    showSnackbar('Bem-vindo ao CRM Soberano! Realtime ativo ⚡');
  } else {
    err.textContent = 'Credenciais administrativas incorretas!';
    err.style.display = 'block';
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem('admin_auth');
  document.getElementById('admin-login-screen').style.display = 'flex';
  document.getElementById('admin-app-container').style.display = 'none';
  showSnackbar('Sessão encerrada.');
}

// Auto Login check
window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('admin_auth') === 'true') {
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-app-container').style.display = 'flex';
    document.getElementById('admin-display-name').textContent = sessionStorage.getItem('admin_email') || ADMIN_USER;
    loadAdminData().then(() => initAdminRealtimeSubscriptions());
  }
});

// ---- DATA LOADING (Supabase + Fallback) ----
async function loadAdminData() {
  if (!supabaseClient) {
    showSnackbar('Supabase não inicializado!');
    return;
  }

  try {
    const [betsRes, betOptionsRes, betHistoryRes, userBetsRes, txRes, profilesRes, postsRes, settingsRes, catRes] = await Promise.all([
      supabaseClient.from('bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('bet_options').select('*').order('id', { ascending: true }),
      supabaseClient.from('bet_history').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('user_bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('transactions').select('*').order('id', { ascending: false }),
      supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('posts').select('*').order('id', { ascending: false }),
      supabaseClient.from('platform_settings').select('*').eq('id', 'default').single(),
      supabaseClient.from('categories').select('*').order('name', { ascending: true })
    ]);

    // Trata erros silenciosos retornados pelo SDK
    if (betsRes.error) console.error('Erro bets:', betsRes.error);
    if (userBetsRes.error) console.error('Erro user_bets:', userBetsRes.error);
    if (txRes.error) console.error('Erro transactions:', txRes.error);
    if (profilesRes.error) {
      console.error('Erro profiles:', profilesRes.error);
      showSnackbar(`Erro ao carregar perfis: ${profilesRes.error.message}`);
    }
    if (postsRes.error) console.error('Erro posts:', postsRes.error);
    if (settingsRes.error) console.error('Erro settings:', settingsRes.error);

    if (betsRes.data) {
      adminStore.bets = betsRes.data;
      if (betOptionsRes.data) adminStore.betOptions = betOptionsRes.data;
      if (betHistoryRes.data) adminStore.betHistory = betHistoryRes.data;
      
      // Associar as opções dinâmicas diretamente nas apostas
      adminStore.bets.forEach(b => {
        b.options = adminStore.betOptions ? adminStore.betOptions.filter(o => o.bet_id === b.id) : [];
        b.history = adminStore.betHistory ? adminStore.betHistory.filter(h => h.bet_id === b.id) : [];
      });
    }
    
    if (userBetsRes.data) adminStore.userBets = userBetsRes.data;
    if (txRes.data) adminStore.transactions = txRes.data;
    
    if (profilesRes.data) {
      adminStore.profiles = profilesRes.data;
      console.log('Perfis carregados no adminStore:', adminStore.profiles);
    } else {
      adminStore.profiles = [];
    }

    if (postsRes.data) adminStore.posts = postsRes.data;
    if (settingsRes.data) platformSettings = settingsRes.data;
    if (catRes && catRes.data) {
      adminStore.categories = catRes.data;
      renderAdminCategories();
    }

    renderAdminCurrentTab();
    startExpirationChecker();
  } catch (err) {
    console.error('Erro crítico no CRM Admin:', err);
    showSnackbar(`Erro crítico na sincronização: ${err.message}`);
  }
}

// ---- ADMIN REALTIME — TEMPO REAL ----
let adminRealtimeInitialized = false;

function initAdminRealtimeSubscriptions() {
  if (!supabaseClient || adminRealtimeInitialized) return;
  adminRealtimeInitialized = true;

  supabaseClient
    .channel('admin-realtime')

    // Apostas: nova ou atualizada
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, (payload) => {
      const row = payload.new;
      const old = payload.old;

      if (payload.eventType === 'INSERT') {
        const exists = adminStore.bets.find(b => Number(b.id) === Number(row.id));
        if (!exists) {
          adminStore.bets.push(row);
          showSnackbar(`🆕 Nova aposta criada: "${row.title}"`);
        }
      } else if (payload.eventType === 'UPDATE') {
        const idx = adminStore.bets.findIndex(b => Number(b.id) === Number(row.id));
        if (idx >= 0) adminStore.bets[idx] = row;
        else adminStore.bets.push(row);
      } else if (payload.eventType === 'DELETE') {
        adminStore.bets = adminStore.bets.filter(b => Number(b.id) !== Number(old.id));
      }

      renderAdminCurrentTab();
    })

    // Apostas de usuários: nova ou atualizada
    .on('postgres_changes', { event: '*', schema: 'public', table: 'user_bets' }, (payload) => {
      const row = payload.new;
      const old = payload.old;

      if (payload.eventType === 'INSERT') {
        const exists = adminStore.userBets.find(u => Number(u.id) === Number(row.id));
        if (!exists) {
          adminStore.userBets.push(row);
          showSnackbar(`🎯 Nova aposta de R$ ${Number(row.amount).toFixed(2)} em "${row.bet_title}"`);
        }
      } else if (payload.eventType === 'UPDATE') {
        const idx = adminStore.userBets.findIndex(u => Number(u.id) === Number(row.id));
        if (idx >= 0) adminStore.userBets[idx] = row;
      }

      renderAdminCurrentTab();
    })

    // Transações: depósitos e saques
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
      const row = payload.new;
      const exists = adminStore.transactions.find(t => Number(t.id) === Number(row.id));
      if (!exists) {
        adminStore.transactions.unshift(row);
        if (row.type === 'WITHDRAWAL') {
          showSnackbar(`💸 Novo saque solicitado: ${formatMoney(Math.abs(Number(row.amount)))}`);
        } else if (row.type === 'DEPOSIT') {
          showSnackbar(`💰 Novo depósito: ${formatMoney(Number(row.amount))}`);
        }
        renderAdminCurrentTab();
      }
    })

    // Perfis de usuários: novo cadastro
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
      const row = payload.new;
      const exists = adminStore.profiles.find(p => p.id === row.id);
      if (!exists) {
        adminStore.profiles.unshift(row);
        showSnackbar(`👤 Novo apostador registrado: ${row.username}`);
        renderAdminCurrentTab();
      }
    })

    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ Admin CRM Realtime conectado!');
        // Exibe indicador visual de realtime ativo
        const indicator = document.getElementById('realtime-indicator');
        if (indicator) indicator.style.display = 'flex';
      }
    });
}


// ---- TAB SWITCHING ----
function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + tab).classList.add('active');

  document.querySelectorAll('.admin-tab-page').forEach(el => el.classList.remove('active'));
  document.getElementById('admin-tab-' + tab).classList.add('active');

  if (tab === 'studio') {
    initAdminStudio();
  } else if (tab === 'posts') {
    loadAdminPosts();
  } else {
    renderAdminCurrentTab();
  }
}

// ---- CATEGORIAS DINÂMICAS ----
function renderAdminCategories() {
  const select = document.getElementById('adm-create-category');
  if (!select) return;
  const cats = adminStore.categories || [];
  select.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

async function promptNewCategory() {
  const newCat = prompt("Digite o nome da nova categoria:");
  if (!newCat || newCat.trim() === '') return;
  const catName = newCat.trim();
  
  try {
    const { data, error } = await supabaseClient.from('categories').insert({ name: catName }).select('*').single();
    if (error) {
       if (error.code === '23505') { // unique violation
          showSnackbar('Esta categoria já existe.');
       } else {
          showSnackbar(`Erro: ${error.message}`);
       }
       return;
    }
    if (data) {
       adminStore.categories = adminStore.categories || [];
       adminStore.categories.push(data);
       adminStore.categories.sort((a,b) => a.name.localeCompare(b.name));
       renderAdminCategories();
       showSnackbar(`Categoria '${catName}' adicionada!`);
       // Força selecionar a nova categoria
       const select = document.getElementById('adm-create-category');
       if (select) select.value = catName;
    }
  } catch(err) {
    console.error(err);
    showSnackbar('Erro ao criar categoria.');
  }
}

function renderAdminCurrentTab() {
  switch (currentAdminTab) {
    case 'dash': renderAdminDashboardView(); break;
    case 'soberano': renderAdminSoberanoView(); break;
    case 'users': renderAdminUsersView(); break;
    case 'withdrawals': renderAdminWithdrawalsView(); break;
    case 'payments': renderAdminPaymentsView(); break;
    case 'audit': renderAdminAuditView(); break;
    case 'settings': renderAdminSettingsView(); break;
  }
}

// ---- REGRAS & MONETIZAÇÃO VIEW ----
let platformSettings = {
  creator_royalty_pct: 3.0,
  house_margin_pct: 8.0,
  xp_create_bet: 100,
  xp_place_bet: 50,
  xp_share_feed: 50,
  xp_referral: 300,
  welcome_bonus: 1000.0
};

function fillAdminSettingsForm() {
  const setRoyalty = document.getElementById('set-royalty');
  const setHouseMargin = document.getElementById('set-house-margin');
  const setXpCreate = document.getElementById('set-xp-create');
  const setXpPlace = document.getElementById('set-xp-place');
  const setXpShare = document.getElementById('set-xp-share');
  const setXpReferral = document.getElementById('set-xp-referral');
  const setWelcomeBonus = document.getElementById('set-welcome-bonus');

  if (setRoyalty) setRoyalty.value = platformSettings.creator_royalty_pct || 3.0;
  if (setHouseMargin) setHouseMargin.value = platformSettings.house_margin_pct || 8.0;
  if (setXpCreate) setXpCreate.value = platformSettings.xp_create_bet || 100;
  if (setXpPlace) setXpPlace.value = platformSettings.xp_place_bet || 50;
  if (setXpShare) setXpShare.value = platformSettings.xp_share_feed || 50;
  if (setXpReferral) setXpReferral.value = platformSettings.xp_referral || 300;
  if (setWelcomeBonus) setWelcomeBonus.value = platformSettings.welcome_bonus || 1000;
}

function renderAdminSettingsView() {
  fillAdminSettingsForm();
}

async function savePlatformSettings() {
  const royalty = parseFloat(document.getElementById('set-royalty').value) || 3.0;
  const houseMargin = parseFloat(document.getElementById('set-house-margin').value) || 8.0;
  const xpCreate = parseInt(document.getElementById('set-xp-create').value) || 100;
  const xpPlace = parseInt(document.getElementById('set-xp-place').value) || 50;
  const xpShare = parseInt(document.getElementById('set-xp-share').value) || 50;
  const xpReferral = parseInt(document.getElementById('set-xp-referral').value) || 300;
  const welcomeBonus = parseFloat(document.getElementById('set-welcome-bonus').value) || 1000;

  const payload = {
    id: 'default',
    creator_royalty_pct: royalty,
    house_margin_pct: houseMargin,
    xp_create_bet: xpCreate,
    xp_place_bet: xpPlace,
    xp_share_feed: xpShare,
    xp_referral: xpReferral,
    welcome_bonus: welcomeBonus,
    updated_at: new Date().toISOString()
  };

  try {
    if (supabaseClient) {
      await supabaseClient.from('platform_settings').upsert(payload);
    }
    platformSettings = payload;
    showSnackbar('⚙️ Regras e taxas de monetização salvas e aplicadas!');
  } catch (err) {
    console.error('Erro ao salvar regras:', err);
    showSnackbar('Erro ao salvar regras no Supabase');
  }
}

// ---- DASHBOARD VIEW ----
function renderAdminDashboardView() {
  // Volume apostado = soma de BET_PLACED (valores negativos, pegamos o absoluto)
  const totalVolume = adminStore.transactions
    .filter(t => t.type === 'BET_PLACED')
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

  // Prêmios pagos = apostas ganhas (BET_WON)
  const totalPayouts = adminStore.transactions
    .filter(t => t.type === 'BET_WON')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // Liquidez injetada pela casa = LIQUIDITY_ADD
  const totalLiquidity = adminStore.transactions
    .filter(t => t.type === 'LIQUIDITY_ADD')
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

  // GGR (Gross Gaming Revenue) = apostas - prêmios pagos
  const houseGGR = totalVolume - totalPayouts;

  // Depósitos reais feitos pelos usuários
  const totalDeposits = adminStore.transactions
    .filter(t => t.type === 'DEPOSIT')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // Saques (aprovados ou pendentes)
  const totalWithdrawals = adminStore.transactions
    .filter(t => t.type === 'WITHDRAWAL' || t.type === 'WITHDRAWAL_APPROVED')
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

  // Pool total ativo nas apostas
  const totalPool = adminStore.bets.reduce((acc, b) => acc + Number(b.total_pool || 0), 0);

  // Apostas ativas vs resolvidas
  const activeBets = adminStore.bets.filter(b => b.status === 'OPEN').length;
  const resolvedBets = adminStore.bets.filter(b => b.status && b.status.startsWith('RESOLVED')).length;

  const totalUsers = adminStore.profiles.length;
  const totalTx = adminStore.transactions.length;

  document.getElementById('adm-volume').textContent = formatMoney(totalVolume);
  document.getElementById('adm-ggr').textContent = formatMoney(houseGGR);
  document.getElementById('adm-payouts').textContent = formatMoney(totalPayouts);
  document.getElementById('adm-users-count').textContent = totalUsers;

  const depEl = document.getElementById('adm-deposits-sub');
  if (depEl) depEl.textContent = `Depósitos: ${formatMoney(totalDeposits)} | Saques: ${formatMoney(totalWithdrawals)} | Liquidez: ${formatMoney(totalLiquidity)}`;

  const extraPanel = document.getElementById('adm-extra-metrics');
  if (extraPanel) {
    extraPanel.innerHTML = `
      <div class="adm-metric-row">
        <div class="adm-metric-box">
          <div class="adm-metric-label">Pool Total Ativo</div>
          <div class="adm-metric-value" style="color:#60A5FA;">${formatMoney(totalPool)}</div>
        </div>
        <div class="adm-metric-box">
          <div class="adm-metric-label">Liquidez Injetada</div>
          <div class="adm-metric-value" style="color:#C084FC;">${formatMoney(totalLiquidity)}</div>
        </div>
        <div class="adm-metric-box">
          <div class="adm-metric-label">Apostas Ativas / Resolvidas</div>
          <div class="adm-metric-value" style="color:#34D399;">${activeBets} / ${resolvedBets}</div>
        </div>
        <div class="adm-metric-box">
          <div class="adm-metric-label">Total de Transações</div>
          <div class="adm-metric-value" style="color:#FBBF24;">${totalTx}</div>
        </div>
      </div>
    `;
  }

  renderAdminCharts(totalVolume, totalPayouts, houseGGR);
}

function renderAdminCharts(totalVolume, totalPayouts, houseGGR) {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Doughnut / Pie
  const catCounts = {};
  adminStore.bets.forEach(b => {
    const cat = b.category || 'Outros';
    if (!catCounts[cat]) catCounts[cat] = 0;
    catCounts[cat] += Number(b.total_pool || 0);
  });

  const pieCanvas = document.getElementById('admCategoryChart');
  if (pieCanvas) {
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(pieCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(catCounts),
        datasets: [{
          data: Object.values(catCounts),
          backgroundColor: ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#C084FC'],
          borderColor: '#1E293B',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#F8FAFC', font: { family: 'Inter', size: 11 } } }
        }
      }
    });
  }

  // Chart 2: Bar
  const barCanvas = document.getElementById('admFinancialChart');
  if (barCanvas) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Volume Total', 'Prêmios Pagos', 'Lucro Casa (GGR)'],
        datasets: [{
          label: 'R$',
          data: [totalVolume, totalPayouts, houseGGR],
          backgroundColor: ['#10B981', '#F97316', '#F59E0B'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94A3B8' }, grid: { display: false } },
          y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }
}

// ---- SOBERANO & LIQUIDAÇÃO VIEW ----
function setAdminBetFilter(filter) {
  betFilter = filter;
  document.getElementById('adm-filter-open').classList.toggle('active', filter === 'OPEN');
  document.getElementById('adm-filter-scheduled').classList.toggle('active', filter === 'SCHEDULED');
  document.getElementById('adm-filter-closed').classList.toggle('active', filter === 'CLOSED');
  renderAdminSoberanoView();
}

function renderAdminSoberanoView() {
  const openBets = adminStore.bets.filter(b => b.status === 'OPEN');
  const scheduledBets = adminStore.bets.filter(b => b.status === 'SCHEDULED');
  const closedBets = adminStore.bets.filter(b => b.status !== 'OPEN' && b.status !== 'SCHEDULED');

  document.getElementById('adm-open-count').textContent = openBets.length;
  if(document.getElementById('adm-scheduled-count')) document.getElementById('adm-scheduled-count').textContent = scheduledBets.length;
  document.getElementById('adm-closed-count').textContent = closedBets.length;

  let targetBets = [];
  if (betFilter === 'OPEN') targetBets = openBets;
  else if (betFilter === 'SCHEDULED') targetBets = scheduledBets;
  else targetBets = closedBets;
  const list = document.getElementById('adm-bets-list');

  if (targetBets.length === 0) {
    list.innerHTML = `<div class="empty-state"><h3>Nenhuma aposta nesta categoria</h3></div>`;
    return;
  }

  list.innerHTML = targetBets.map(b => {
    const catClass = getCatClass(b.category);
    const isCounter = b.bet_type === 'COUNTER';

    if (b.status === 'OPEN') {
      const counterSection = isCounter ? `
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:12px;margin-top:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:0.65rem;font-weight:800;color:#A78BFA;text-transform:uppercase;letter-spacing:1px;">📹 ${b.count_subject || 'Contagem'} ao Vivo</div>
            <button class="crm-btn-sm" style="padding:4px 12px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border:none;border-radius:8px;" onclick="openCounterControl(${b.id})">
              📊 Controlar Contador
            </button>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="font-size:0.65rem;color:var(--text-gray);">📍 ${b.count_location || '—'}</div>
            <div style="font-size:0.65rem;color:var(--text-gray);">Meta: <strong style="color:var(--gold-accent);">${Number(b.count_target || 0).toLocaleString('pt-BR')}</strong></div>
          </div>
          <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:8px;text-align:center;">
            <div style="font-size:2rem;font-weight:900;color:#A78BFA;">${Number(b.live_count || 0).toLocaleString('pt-BR')}</div>
          </div>
        </div>
      ` : '';

      // Countdown de expiração
      let expiresHtml = '';
      if (b.expires_at) {
        const now = new Date();
        const exp = new Date(b.expires_at);
        const diff = exp - now;
        if (diff > 0) {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          const urgentColor = diff < 3600000 ? '#EF4444' : 'var(--gold-accent)';
          expiresHtml = `<div style="display:flex;align-items:center;gap:6px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:6px 12px;margin-top:8px;">
            <span style="font-size:0.7rem;color:var(--text-gray);">⏰ Expira em:</span>
            <span style="font-size:0.85rem;font-weight:800;color:${urgentColor};font-variant-numeric:tabular-nums;">${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>
          </div>`;
        } else {
          expiresHtml = `<div style="display:flex;align-items:center;gap:6px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 12px;margin-top:8px;">
            <span style="font-size:0.75rem;font-weight:800;color:#EF4444;">🚨 EXPIRADA — Aguardando encerramento automático...</span>
          </div>`;
        }
      }

      return `
        <div class="bet-card" style="margin-bottom:14px;">
          <div class="bet-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="cat-badge ${catClass}">${b.category}</span>
              ${isCounter ? '<span style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);padding:2px 8px;border-radius:20px;font-size:0.6rem;font-weight:800;color:#A78BFA;">📹 CONTADOR</span>' : ''}
              <button class="crm-btn-sm" style="padding:3px 10px;color:var(--neon-emerald);" onclick="openAdminEditBetModal(${b.id})">✏️ Editar</button>
              <button class="crm-btn-sm" style="padding:3px 10px;color:#EF4444;background:rgba(239,68,68,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;" onclick="deleteAdminBet(${b.id}, '${b.title.replace(/'/g, "\\'")}')">🗑️ Excluir</button>
            </div>
            <span class="pool-text">Pool: ${formatMoney(Number(b.total_pool))}</span>
          </div>
          <div class="bet-title">${b.title}</div>
          <div class="bet-desc">${b.description}</div>
          ${counterSection}
          ${expiresHtml}
          <div style="font-size:0.75rem;color:var(--gold-accent);font-weight:600;margin:10px 0 6px;">
            ${isCounter ? 'Liquidar contador — Escolha a opção vencedora:' : 'Escolha a opção vencedora para liquidar:'}
          </div>
          <div class="bet-odds-row">
            ${b.options && b.options.length > 0 ? b.options.map(opt => `
              <button class="resolve-btn" onclick="resolveBetAdmin(${b.id}, '${opt.option_label}')">${opt.title} (@${Number(opt.current_odds || 0).toFixed(2)})</button>
            `).join('') : '<div style="color:var(--text-gray);font-size:0.8rem;">Opções não carregadas</div>'}
          </div>
        </div>
      `;
    } else if (b.status === 'SCHEDULED') {
      const scheduledDate = b.scheduled_for ? new Date(b.scheduled_for).toLocaleString('pt-BR') : 'Sem data';
      return `
        <div class="bet-card" style="margin-bottom:14px; position:relative; border: 1px dashed rgba(251,191,36,0.5);">
          <div class="bet-header" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="cat-badge ${catClass}">${b.category}</span>
              <span style="font-size:0.65rem;color:var(--gold-accent);font-weight:700;">⏳ Agendado para: ${scheduledDate}</span>
            </div>
            <div style="display:flex;align-items:center;">
              <button class="crm-btn-sm" style="padding:3px 10px;color:#EF4444;background:rgba(239,68,68,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;" onclick="deleteAdminBet(${b.id}, '${b.title.replace(/'/g, "\\'")}')">🗑️ Excluir</button>
            </div>
          </div>
          <div class="bet-title">${b.title}</div>
          <div class="bet-desc">${b.description}</div>
        </div>
      `;
    } else if (b.status === 'EXPIRED') {
      return `
        <div class="bet-card" style="margin-bottom:14px; position:relative; border: 1px solid rgba(239,68,68,0.3);">
          <div class="bet-header" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="cat-badge ${catClass}">${b.category}</span>
              <span style="font-size:0.65rem;font-weight:800;color:#EF4444;background:rgba(239,68,68,0.15);padding:2px 8px;border-radius:20px;">⏰ EXPIRADA</span>
              <span class="pool-text" style="position:static;">Pool Final: ${formatMoney(Number(b.total_pool))}</span>
            </div>
            <div style="display:flex;align-items:center;">
              <button class="crm-btn-sm" style="padding:3px 10px;color:var(--neon-emerald);background:rgba(16,185,129,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-right:8px;" onclick="republishAdminBet(${b.id})">🔄 Republicar</button>
              <button class="crm-btn-sm" style="padding:3px 10px;color:#EF4444;background:rgba(239,68,68,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;" onclick="deleteAdminBet(${b.id}, '${b.title.replace(/'/g, "\\'")}')">🗑️ Excluir</button>
            </div>
          </div>
          <div class="bet-title">${b.title}</div>
          <div class="resolved-result" style="background:rgba(239,68,68,0.1);color:#EF4444;">APOSTA EXPIRADA — Apostadores reembolsados automaticamente</div>
        </div>
      `;
    } else {
      const winnerText = b.status === 'RESOLVED_A' ? b.option_a : b.option_b;
      return `
        <div class="bet-card" style="margin-bottom:14px; position:relative;">
          <div class="bet-header" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="cat-badge ${catClass}">${b.category}</span>
              <span class="pool-text" style="position:static;">Pool Final: ${formatMoney(Number(b.total_pool))}</span>
            </div>
            <div style="display:flex;align-items:center;">
              <button class="crm-btn-sm" style="padding:3px 10px;color:var(--neon-emerald);background:rgba(16,185,129,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;margin-right:8px;" onclick="republishAdminBet(${b.id})">🔄 Republicar</button>
              <button class="crm-btn-sm" style="padding:3px 10px;color:#EF4444;background:rgba(239,68,68,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;" onclick="deleteAdminBet(${b.id}, '${b.title.replace(/'/g, "\\'")}')">🗑️ Excluir</button>
            </div>
          </div>
          <div class="bet-title">${b.title}</div>
          ${isCounter ? `<div style="text-align:center;font-size:1.5rem;font-weight:900;color:#A78BFA;margin:8px 0;">📊 ${Number(b.live_count||0).toLocaleString('pt-BR')} ${b.count_subject || 'contados'}</div>` : ''}
          <div class="resolved-result">VENCEDOR DECLARADO: '${winnerText}'</div>
        </div>
      `;
    }
  }).join('');
}

async function republishAdminBet(betId) {
  const b = adminStore.bets.find(bet => bet.id === betId);
  if (!b) return;
  
  if (!confirm(`Deseja republicar o palpite "${b.title}" como uma nova aposta aberta?\nUm novo registro será criado no topo do Feed.`)) return;

  const liqStr = prompt('Qual a liquidez inicial (Volume Financeiro) do evento republicado?', '100');
  const liquidity = parseFloat(liqStr);
  if (isNaN(liquidity) || liquidity <= 0) return;

  const numOptions = b.options && b.options.length > 0 ? b.options.length : 2;
  const poolPerOption = liquidity / numOptions;

  const newBet = {
    title: b.title,
    description: b.description,
    category: b.category,
    status: 'OPEN',
    total_pool: liquidity,
    bet_type: b.bet_type,
    count_target: b.count_target,
    count_subject: b.count_subject,
    count_location: b.count_location,
    count_min: b.count_min,
    count_max: b.count_max,
    camera_label: b.camera_label,
    camera_url: b.camera_url,
    live_count: 0,
    is_trending: b.is_trending,
    creator_name: 'Admin',
    scheduled_for: null
  };

  try {
    const { data: newBetData, error } = await supabaseClient.from('bets').insert(newBet).select();
    if (error) throw error;

    if (newBetData && newBetData.length > 0) {
      const newBetId = newBetData[0].id;
      
      // Criar as opções na nova aposta baseadas nas antigas
      if (b.options && b.options.length > 0) {
        for (const opt of b.options) {
          await supabaseClient.from('bet_options').insert({
            bet_id: newBetId,
            option_label: opt.option_label,
            title: opt.title,
            pool: poolPerOption,
            current_odds: 100 / (100 / numOptions) // Ex: 50% = 2.0 odds
          });

          await supabaseClient.from('bet_history').insert({
            bet_id: newBetId,
            option_label: opt.option_label,
            odds: 100 / (100 / numOptions)
          });

          await supabaseClient.from('user_portfolios').insert({
            bet_id: newBetId,
            user_id: 'admin_user',
            option_label: opt.option_label,
            shares: poolPerOption,
            username: 'admin_user'
          });
        }
      }

      // Admin atua como Liquidity Provider
      await supabaseClient.from('transactions').insert({
         amount: -liquidity,
         description: `Provisão de Liquidez (Republicado): ${b.title}`,
         type: 'LIQUIDITY_ADD',
         username: 'admin_user'
      });
    }

    showSnackbar('✅ Aposta republicada com sucesso!');
    loadAdminData();
  } catch (err) {
    console.error('Erro ao republicar:', err);
    showSnackbar('Erro ao republicar aposta.');
  }
}

async function deleteAdminBet(betId, betTitle) {
  if (!confirm(`Tem certeza que deseja excluir PERMANENTEMENTE o palpite "${betTitle}"?\nIsso removerá o histórico do painel.`)) return;

  try {
    await supabaseClient.from('bets').delete().eq('id', betId);
    showSnackbar(`🗑️ Palpite excluído com sucesso!`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao excluir palpite:', err);
    showSnackbar('Erro ao excluir palpite no banco de dados.');
  }
}

async function resolveBetAdmin(betId, winningOption) {
  const bet = adminStore.bets.find(b => Number(b.id) === Number(betId));
  if (!bet) return;

  const newStatus = 'RESOLVED_' + winningOption;

  try {
    // 1. Atualiza status da bet para CLOSED primeiro para disparar realtime
    //    depois atualiza para RESOLVED_* para preservar o vencedor
    await supabaseClient.from('bets').update({ status: 'CLOSED' }).eq('id', betId);
    await supabaseClient.from('bets').update({ status: newStatus }).eq('id', betId);

    // 2. Pega todos os user_bets PENDENTES desta aposta do banco (fonte da verdade)
    const { data: pendingUserBets, error: ubError } = await supabaseClient
      .from('user_bets')
      .select('*')
      .eq('bet_id', betId)
      .eq('status', 'PENDING');

    if (ubError) throw ubError;

    const toProcess = pendingUserBets || [];
    console.log(`Resolvendo ${toProcess.length} palpite(s) pendentes para aposta #${betId}`);

    const winningOptObj = bet.options ? bet.options.find(o => o.option_label === winningOption) : null;
    const winningPool = winningOptObj ? Number(winningOptObj.pool || 100) : 100;
    const totalPool = Number(bet.total_pool || 200);

    for (let ub of toProcess) {
      const won = ub.chosen_option === winningOption;
      const ubStatus = won ? 'WON' : 'LOST';

      let actualPayout = 0;
      if (won) {
        if (winningPool > 0) {
          actualPayout = (Number(ub.amount) / winningPool) * totalPool;
        } else {
          // Fallback de segurança 
          actualPayout = Number(ub.amount) * Number(ub.odds || 1.90);
        }
      }

      // 3. Atualiza status do user_bet — isso dispara o realtime no mobile
      await supabaseClient.from('user_bets')
        .update({ status: ubStatus, potential_win: actualPayout })
        .eq('id', ub.id);

      // 4. Cria transação de prêmio se ganhou
      if (won) {
        await supabaseClient.from('transactions').insert({
          amount: actualPayout,
          description: `Prêmio ganho: ${bet.title}`,
          type: 'BET_WON',
          username: ub.username
        });
        showSnackbar(`🏆 Apostador ganhou R$ ${actualPayout.toFixed(2)} em: ${bet.title}`);
      }
    }

    if (toProcess.length === 0) {
      showSnackbar(`⚠️ Nenhum palpite PENDENTE encontrado para esta aposta.`);
    } else {
      showSnackbar(`✅ Aposta liquidada! ${toProcess.length} palpite(s) processados.`);
    }

    loadAdminData();
  } catch (err) {
    console.error('Erro ao liquidar aposta no CRM:', err);
    showSnackbar(`Erro ao liquidar aposta: ${err.message}`);
  }
}

// =============================================
// MOTOR DE EXPIRAÇÃO AUTOMÁTICA
// Verifica a cada 30s se alguma aposta OPEN já venceu
// =============================================
function startExpirationChecker() {
  if (expirationTimerId) clearInterval(expirationTimerId);
  
  // Roda imediatamente na primeira vez
  checkExpiredBets();
  
  // Depois roda a cada 30 segundos
  expirationTimerId = setInterval(checkExpiredBets, 30000);
  console.log('⏰ Motor de expiração automática ativado (30s interval)');
}

async function checkExpiredBets() {
  const now = new Date();
  const expiredBets = adminStore.bets.filter(b => 
    b.status === 'OPEN' && 
    b.expires_at && 
    new Date(b.expires_at) <= now
  );

  for (const bet of expiredBets) {
    console.log(`⏰ Auto-expirando aposta #${bet.id}: "${bet.title}"`);
    await autoExpireBet(bet);
  }

  // Atualiza countdown visual se estiver na aba soberano
  if (currentAdminTab === 'soberano' && betFilter === 'OPEN') {
    renderAdminCurrentTab();
  }
}

async function autoExpireBet(bet) {
  try {
    // 1. Fecha a aposta
    await supabaseClient.from('bets').update({ status: 'EXPIRED' }).eq('id', bet.id);

    // 2. Busca todos os palpites PENDING desta aposta
    const { data: pendingUserBets } = await supabaseClient
      .from('user_bets')
      .select('*')
      .eq('bet_id', bet.id)
      .eq('status', 'PENDING');

    const toRefund = pendingUserBets || [];
    
    // 3. Reembolsa todos os apostadores (aposta expirou sem resolução)
    for (const ub of toRefund) {
      await supabaseClient.from('user_bets')
        .update({ status: 'REFUNDED', potential_win: Number(ub.amount) })
        .eq('id', ub.id);

      await supabaseClient.from('transactions').insert({
        amount: Number(ub.amount),
        description: `Reembolso: "${bet.title}" expirou sem resultado`,
        type: 'REFUND',
        username: ub.username
      });
    }

    showSnackbar(`⏰ Aposta "${bet.title}" expirou! ${toRefund.length} apostador(es) reembolsados.`);
    
    // Atualiza store local
    const idx = adminStore.bets.findIndex(b => Number(b.id) === Number(bet.id));
    if (idx >= 0) adminStore.bets[idx].status = 'EXPIRED';
    
    renderAdminCurrentTab();
  } catch (err) {
    console.error(`Erro ao auto-expirar aposta #${bet.id}:`, err);
    showSnackbar(`Erro ao expirar aposta: ${err.message}`);
  }
}

// Tipo atual de aposta sendo criada
let currentCreateBetType = 'CLASSIC';

function setAdminBetType(type) {
  currentCreateBetType = type;
  const classicBtn = document.getElementById('type-classic-btn');
  const counterBtn = document.getElementById('type-counter-btn');
  const classicFields = document.getElementById('classic-fields');
  const counterFields = document.getElementById('counter-fields');

  if (type === 'CLASSIC') {
    classicBtn.style.background = 'rgba(16,185,129,0.15)';
    classicBtn.style.border = '2px solid var(--neon-emerald)';
    counterBtn.style.background = 'rgba(99,102,241,0.08)';
    counterBtn.style.border = '2px solid rgba(99,102,241,0.2)';
    classicFields.style.display = 'block';
    counterFields.style.display = 'none';
    document.getElementById('adm-create-category').value = 'Dia-a-dia';
  } else {
    counterBtn.style.background = 'rgba(99,102,241,0.2)';
    counterBtn.style.border = '2px solid #6366F1';
    classicBtn.style.background = 'rgba(16,185,129,0.05)';
    classicBtn.style.border = '2px solid rgba(16,185,129,0.2)';
    classicFields.style.display = 'none';
    counterFields.style.display = 'block';
    document.getElementById('adm-create-category').value = 'Contagem';
  }
}

function setExpiresQuick(hours) {
  const dt = new Date(Date.now() + hours * 3600000);
  const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('adm-create-expires-at').value = local;
}

function initAdminStudio() {
  currentCreateBetType = 'CLASSIC';
  document.getElementById('adm-create-title').value = '';
  document.getElementById('adm-create-desc').value = '';
  document.getElementById('adm-create-liquidity').value = '100.00';
  document.getElementById('adm-create-camera-url').value = '';
  document.getElementById('adm-create-video-file').value = '';
  document.getElementById('adm-create-upload-status').textContent = 'O arquivo será enviado junto com a criação da aposta.';
  
  if (document.getElementById('adm-create-expires-at')) document.getElementById('adm-create-expires-at').value = '';
  if (document.getElementById('adm-create-scheduled-for')) document.getElementById('adm-create-scheduled-for').value = '';
  
  const optionsList = document.getElementById('adm-create-options-list');
  if (optionsList) {
    optionsList.innerHTML = '';
    addCreateOption('Sim', 50);
    addCreateOption('Não', 50);
  }

  // Reset tipo
  setAdminBetType('CLASSIC');
  renderAdminCategories();
}

// ---- FUNÇÃO PARA ADICIONAR OPÇÃO DINÂMICA ----
function addCreateOption(label = '', prob = '') {
  const container = document.getElementById('adm-create-options-list');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'dynamic-option-item';
  div.style = 'display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;';
  div.innerHTML = `
    <div class="form-group" style="flex:2; margin-bottom:0;">
      <input type="text" class="form-input opt-label-input" placeholder="Título da Opção (Ex: Sim)" value="${label}">
    </div>
    <div class="form-group" style="flex:1; margin-bottom:0; display:flex; align-items:center; justify-content:center; color:var(--text-gray); font-size:0.8rem; background:var(--slate-dark); padding:10px; border-radius:8px;">
      Automático
    </div>
    <button type="button" class="btn-secondary" style="background:rgba(239,68,68,0.1);color:#EF4444;border-color:rgba(239,68,68,0.3);width:auto;padding:12px;" onclick="this.parentElement.remove()">❌</button>
  `;
  container.appendChild(div);
}

async function confirmAdminCreateBet() {
  const title = document.getElementById('adm-create-title').value.trim();
  const desc = document.getElementById('adm-create-desc').value.trim();
  const cat = document.getElementById('adm-create-category').value;
  const liquidity = parseFloat(document.getElementById('adm-create-liquidity').value) || 100;
  
  if (!title || !desc) {
    showSnackbar('Preencha título e descrição!');
    return;
  }

  const scheduledForStr = document.getElementById('adm-create-scheduled-for')?.value;

  let pA, pB, oddsA, oddsB;
  let dynamicOptions = [];

  if (currentCreateBetType === 'CLASSIC') {
    const optsNodes = document.querySelectorAll('.dynamic-option-item');
    if (optsNodes.length < 2) {
      showSnackbar('É necessário pelo menos 2 opções!');
      return;
    }
    
    const count = optsNodes.length;
    const prob = 100 / count;
    
    optsNodes.forEach(node => {
      const label = node.querySelector('.opt-label-input').value.trim() || 'Opção';
      const optionId = 'OPT_' + Math.random().toString(36).substr(2, 9);
      dynamicOptions.push({
        id: optionId,
        label,
        prob,
        odds: prob > 0 ? (100 / prob) : 99.00,
        pool: liquidity / count
      });
    });
  } else {
    // Para modo contador ou outros (fallbacks)
    dynamicOptions.push({ id: 'OPT_A', label: 'Sim', prob: 50, odds: 2.0, pool: liquidity / 2 });
    dynamicOptions.push({ id: 'OPT_B', label: 'Não', prob: 50, odds: 2.0, pool: liquidity / 2 });
  }

  let payload = {
    title, description: desc, category: cat,
    creator_name: 'Soberano Admin',
    status: 'OPEN', is_trending: true, total_pool: liquidity
  };

  if (scheduledForStr) {
    payload.status = 'SCHEDULED';
    payload.scheduled_for = new Date(scheduledForStr).toISOString();
  }

  const expiresAtStr = document.getElementById('adm-create-expires-at')?.value;
  if (expiresAtStr) {
    payload.expires_at = new Date(expiresAtStr).toISOString();
  }

  if (currentCreateBetType === 'CLASSIC') {
    payload.bet_type = 'CLASSIC';
  } else {
    // COUNTER
    const location = document.getElementById('adm-create-location').value.trim();
    const subject = document.getElementById('adm-create-subject').value;
    const cameraLabel = document.getElementById('adm-create-camera-label').value.trim();
    const target = parseInt(document.getElementById('adm-create-target').value) || 100;

    if (!location || !target) {
      showSnackbar('Informe o local e a meta de contagem!');
      return;
    }

    payload.bet_type = 'COUNTER';
    payload.option_a = `Acima de ${target.toLocaleString('pt-BR')}`;
    payload.option_b = `Abaixo de ${target.toLocaleString('pt-BR')}`;
    payload.count_target = target;
    payload.count_subject = subject;
    payload.count_location = location;
    payload.camera_label = cameraLabel;
    payload.live_count = 0;
    payload.count_min = 0;
    payload.count_max = target;
  }

    // Verificação de Câmera/Vídeo (Se for Ao Vivo)
    let videoUrl = '';
    if (currentCreateBetType === 'COUNTER') {
      const urlInput = document.getElementById('adm-create-camera-url').value.trim();
      const fileInput = document.getElementById('adm-create-video-file');
      const file = fileInput?.files?.[0];
      const statusText = document.getElementById('adm-create-upload-status');

      if (file) {
        if (statusText) statusText.textContent = '⏳ Fazendo upload do vídeo... aguarde.';
        const ext = file.name.split('.').pop() || 'mp4';
        const fileName = `bet_${Date.now()}.${ext}`;
        
        const { data: uploadData, error: uploadErr } = await supabaseClient
          .storage
          .from('videos')
          .upload(fileName, file, { upsert: true, contentType: file.type || 'video/mp4' });
          
        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabaseClient.storage.from('videos').getPublicUrl(fileName);
          videoUrl = publicUrlData?.publicUrl || '';
        }

        if (!videoUrl) {
          videoUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
          });
        }
      } else if (urlInput) {
        videoUrl = urlInput;
      }
      
      if (videoUrl) {
        payload.camera_url = videoUrl;
      }
    }

  try {
    const { data: newBetData, error } = await supabaseClient.from('bets').insert(payload).select();
    if (error) throw error;
    
    if (newBetData && newBetData.length > 0) {
      const newBetId = newBetData[0].id;
      
      // Se tivermos videoUrl base64, nós já salvamos no insert, mas pode ser redundante atualizar.
      
      // Inserir as opções dinâmicas
      for (const opt of dynamicOptions) {
        await supabaseClient.from('bet_options').insert({
          bet_id: newBetId,
          option_label: opt.id,
          title: opt.label,
          pool: opt.pool,
          current_odds: opt.odds
        });

        // Registrar o primeiro histórico
        await supabaseClient.from('bet_history').insert({
          bet_id: newBetId,
          option_label: opt.id,
          odds: opt.odds
        });

        // Admin atua como Liquidity Provider Real
        await supabaseClient.from('user_portfolios').insert({
          bet_id: newBetId,
          user_id: 'admin_user',
          option_label: opt.id,
          shares: opt.pool,
          username: 'admin_user'
        });
      }
      
      await supabaseClient.from('transactions').insert({
         amount: -liquidity,
         description: `Provisão de Liquidez: ${title}`,
         type: 'LIQUIDITY_ADD',
         username: 'admin_user'
      });
    }

    showSnackbar(`✅ ${currentCreateBetType === 'COUNTER' ? '📹 Palpite de Contagem' : '🎯 Aposta clássica'} lançada com Liquidez Real!`);
    loadAdminData();
    switchAdminTab('soberano');
  } catch (err) {
    console.error('Erro ao criar aposta:', err);
    showSnackbar('Erro ao criar aposta: ' + (err.message || ''));
  }
}

// ---- CONTROLE E TRANSMISSÃO DO CONTADOR E CÂMERA AO VIVO ----
let counterControlBet = null;
let isBroadcasting = false;
let broadcastStream = null;
let broadcastWorker = null;
let imageCaptureInstance = null;
let adminBroadcastChannel = null;
let mediaKeepAlive = null;

// Garante que o navegador (Chrome/Edge/WebView) trate a aba como Sessão de Mídia Ativa 24/7 (Evita Throttling de Abas em Segundo Plano)
function startMediaKeepAlive() {
  try {
    if (!mediaKeepAlive) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0.0001; // Nível inaudível
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      mediaKeepAlive = { audioCtx, osc };
    }
    if (mediaKeepAlive && mediaKeepAlive.audioCtx.state === 'suspended') {
      mediaKeepAlive.audioCtx.resume();
    }
  } catch (e) {
    console.warn('Keepalive audio note:', e);
  }
}

function stopMediaKeepAlive() {
  if (mediaKeepAlive) {
    try {
      mediaKeepAlive.osc.stop();
      mediaKeepAlive.audioCtx.close();
    } catch(e) {}
    mediaKeepAlive = null;
  }
}

function initBroadcastWorker() {
  if (broadcastWorker) return broadcastWorker;
  const workerCode = `
    let intervalId = null;
    self.onmessage = function(e) {
      if (e.data.action === 'start') {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(function() {
          self.postMessage('tick');
        }, e.data.interval || 250);
      } else if (e.data.action === 'stop') {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  broadcastWorker = new Worker(URL.createObjectURL(blob));
  return broadcastWorker;
}

function getAdminBroadcastChannel() {
  if (!adminBroadcastChannel && supabaseClient) {
    adminBroadcastChannel = supabaseClient.channel('palpitetotal-realtime');
    adminBroadcastChannel.subscribe((status) => {
      console.log('📡 Admin Broadcast Realtime canal status:', status);
    });
  }
  return adminBroadcastChannel;
}

function openCounterControl(betId) {
  try {
    stopAICounter(true);
    const bet = adminStore.bets.find(b => Number(b.id) === Number(betId));
    if (!bet) {
      showSnackbar('⚠️ Aposta não encontrada no painel!');
      return;
    }
    counterControlBet = bet;

    const idEl = document.getElementById('ctrl-counter-bet-id');
    const subjEl = document.getElementById('ctrl-counter-subject');
    const locEl = document.getElementById('ctrl-counter-location');
    const urlEl = document.getElementById('ctrl-camera-url');

    if (idEl) idEl.value = bet.id;
    if (subjEl) subjEl.textContent = '📹 ' + (bet.count_subject || 'pessoas');
    if (locEl) locEl.textContent = '📍 ' + (bet.count_location || 'Local não definido');
    if (urlEl) urlEl.value = bet.camera_url || '';

    const progressText = document.getElementById('upload-progress-text');
    if (progressText) progressText.textContent = '';

    const yVal = bet.count_min || 52;
    const degVal = bet.count_max || 0;
    const sliderY = document.getElementById('ctrl-line-y');
    const sliderDeg = document.getElementById('ctrl-line-deg');
    if (sliderY) sliderY.value = yVal;
    if (sliderDeg) sliderDeg.value = degVal;
    const lblY = document.getElementById('lbl-line-y');
    const lblDeg = document.getElementById('lbl-line-deg');
    if (lblY) lblY.textContent = yVal + '%';
    if (lblDeg) lblDeg.textContent = degVal + '°';

    updateCounterControlDisplay(Number(bet.live_count || 0), Number(bet.count_target || 0));
    openModal('modal-counter-control');
  } catch (err) {
    console.error('Erro ao abrir controle do contador:', err);
    showSnackbar('Erro ao abrir controlador: ' + (err.message || ''));
  }
}

function updateLinePositionPreview() {
  const yVal = document.getElementById('ctrl-line-y')?.value || 52;
  const degVal = document.getElementById('ctrl-line-deg')?.value || 0;

  const lblY = document.getElementById('lbl-line-y');
  const lblDeg = document.getElementById('lbl-line-deg');
  if (lblY) lblY.textContent = yVal + '%';
  if (lblDeg) lblDeg.textContent = degVal + '°';

  document.querySelectorAll('.smart-detection-line').forEach(line => {
    line.style.top = yVal + '%';
    line.style.transform = `rotate(${degVal}deg)`;
  });
}

async function saveCameraUrl() {
  if (!counterControlBet) return;
  const urlInput = document.getElementById('ctrl-camera-url');
  const url = urlInput ? urlInput.value.trim() : '';

  if (!url) {
    showSnackbar('⚠️ Cole o link da câmera ou vídeo antes de ativar!');
    return;
  }

  try {
    showSnackbar('⏳ Gravando transmissão...');
    const { error } = await supabaseClient
      .from('bets')
      .update({ camera_url: url })
      .eq('id', counterControlBet.id);

    if (error) throw error;

    counterControlBet.camera_url = url;
    const b = adminStore.bets.find(item => Number(item.id) === Number(counterControlBet.id));
    if (b) b.camera_url = url;

    showSnackbar('🔴 Transmissão ativada! Transmitindo ao vivo no app dos apostadores.');
  } catch (err) {
    console.error('Erro ao salvar URL da câmera:', err);
    showSnackbar('Erro ao ativar transmissão: ' + (err.message || ''));
  }
}

async function saveLineSettingsToSupabase() {
  if (!counterControlBet) return;
  const yVal = Number(document.getElementById('ctrl-line-y')?.value || 52);
  const degVal = Number(document.getElementById('ctrl-line-deg')?.value || 0);

  try {
    await supabaseClient.from('bets').update({
      count_min: yVal,
      count_max: degVal
    }).eq('id', counterControlBet.id);

    counterControlBet.count_min = yVal;
    counterControlBet.count_max = degVal;

    showSnackbar('✅ Posição Y (' + yVal + '%) e Ângulo (' + degVal + '°) salvos com sucesso!');
  } catch (err) {
    showSnackbar('Erro ao salvar posição da linha: ' + (err.message || ''));
  }
}

let aiTimeoutId = null;
let isAICounterRunning = false;

function toggleAICounter() {
  if (isAICounterRunning) {
    stopAICounter();
  } else {
    startAICounter();
  }
}

function startAICounter() {
  if (!counterControlBet) return;
  stopAICounter(true);

  const speedMode = document.getElementById('ctrl-ai-speed')?.value || 'normal';
  const btn = document.getElementById('btn-toggle-ai-counter');
  const badge = document.getElementById('ai-status-badge');

  isAICounterRunning = true;
  if (btn) {
    btn.innerHTML = '⏸️ Desligar Leitura Automática IA';
    btn.style.background = 'linear-gradient(135deg,#EF4444,#DC2626)';
  }
  if (badge) {
    badge.textContent = 'REC ● IA ATIVA';
    badge.style.background = 'rgba(16,185,129,0.3)';
    badge.style.color = '#34D399';
  }

  showSnackbar('🤖 Leitura Automática da IA ativada! A linha inteligente piscará e contabilizará no app.');
  scheduleNextAIDetection(speedMode);
}

function scheduleNextAIDetection(mode) {
  if (!isAICounterRunning || !counterControlBet) return;

  let minMs = 2000, maxMs = 4500;
  if (mode === 'normal') { minMs = 1800; maxMs = 3500; }
  else if (mode === 'fast') { minMs = 1200; maxMs = 2400; }
  else if (mode === 'peak') { minMs = 800; maxMs = 1600; }
  else if (mode === 'precise') { minMs = 2500; maxMs = 5500; }

  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;

  aiTimeoutId = setTimeout(async () => {
    if (!isAICounterRunning || !counterControlBet) return;
    await incrementCounter(1);
    scheduleNextAIDetection(mode);
  }, delay);
}

function stopAICounter(silent = false) {
  if (aiTimeoutId) {
    clearTimeout(aiTimeoutId);
    aiTimeoutId = null;
  }
  isAICounterRunning = false;

  const btn = document.getElementById('btn-toggle-ai-counter');
  const badge = document.getElementById('ai-status-badge');

  if (btn) {
    btn.innerHTML = '▶️ Ligar IA de Leitura Automática';
    btn.style.background = 'linear-gradient(135deg,#10B981,#059669)';
  }
  if (badge) {
    badge.textContent = 'DESATIVADO';
    badge.style.background = 'rgba(239,68,68,0.2)';
    badge.style.color = '#F87171';
  }

  if (!silent) {
    showSnackbar('⏸️ Leitura da IA pausada.');
  }
}

// Atalho de Teclado: Pressionar [Espaço] no modal de controle incrementa +1 com precisão cirúrgica
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('modal-counter-control');
  if (modal && modal.classList.contains('open') && e.code === 'Space') {
    const activeTag = document.activeElement?.tagName;
    if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      e.preventDefault();
      incrementCounter(1);
    }
  }
});

async function uploadBetVideo() {
  if (!counterControlBet) return;
  const fileInput = document.getElementById('ctrl-video-file');
  const progressText = document.getElementById('upload-progress-text');
  const file = fileInput?.files?.[0];

  if (!file) {
    showSnackbar('Selecione um arquivo de vídeo (MP4/WebM)!');
    return;
  }

  try {
    if (progressText) progressText.textContent = '⏳ Enviando vídeo para o servidor...';
    showSnackbar('⏳ Processando upload do vídeo...');

    const ext = file.name.split('.').pop() || 'mp4';
    const fileName = `bet_${counterControlBet.id}_${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadErr } = await supabaseClient
      .storage
      .from('videos')
      .upload(fileName, file, { upsert: true, contentType: file.type || 'video/mp4' });

    let videoUrl = '';
    if (!uploadErr && uploadData) {
      const { data: publicUrlData } = supabaseClient.storage.from('videos').getPublicUrl(fileName);
      videoUrl = publicUrlData?.publicUrl || '';
    }

    // Se storage public URL não estiver configurado, usa FileReader DataURL como fallback
    if (!videoUrl) {
      videoUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    }

    await supabaseClient.from('bets').update({ camera_url: videoUrl }).eq('id', counterControlBet.id);
    counterControlBet.camera_url = videoUrl;
    document.getElementById('ctrl-camera-url').value = videoUrl;

    if (progressText) progressText.textContent = '✅ Vídeo enviado com sucesso!';
    showSnackbar('🎬 Vídeo da câmera carregado com sucesso!');
  } catch (err) {
    console.error('Erro no upload de vídeo:', err);
    if (progressText) progressText.textContent = '⚠️ Erro ao enviar vídeo';
    showSnackbar('Erro ao enviar vídeo: ' + (err.message || ''));
  }
}

async function toggleCameraBroadcast() {
  if (isBroadcasting) {
    stopCameraBroadcast();
  } else {
    await startCameraBroadcast();
  }
}

let adminWebRTCPeer = null;

async function startCameraBroadcast() {
  if (!counterControlBet) return;
  const videoEl = document.getElementById('admin-cam-preview');
  const bannerVideoEl = document.getElementById('admin-banner-cam-preview');
  const btn = document.getElementById('btn-toggle-broadcast');
  const statusLabel = document.getElementById('broadcast-status-label');

  // Elemento de vídeo de monitoramento flutuante totalmente visível (garante FPS constante no Chrome Windows)
  let bgVideoEl = document.getElementById('admin-bg-cam-video');
  if (!bgVideoEl) {
    bgVideoEl = document.createElement('video');
    bgVideoEl.id = 'admin-bg-cam-video';
    bgVideoEl.setAttribute('autoplay', '');
    bgVideoEl.setAttribute('playsinline', '');
    bgVideoEl.muted = true;
    bgVideoEl.style.cssText = 'position:fixed;bottom:20px;right:20px;width:150px;height:85px;border-radius:10px;object-fit:cover;border:2px solid #6366F1;box-shadow:0 8px 24px rgba(0,0,0,0.7);z-index:99999;background:#000;display:none;';
    document.body.appendChild(bgVideoEl);
  }

  let bgCanvasEl = document.getElementById('admin-bg-cam-canvas');
  if (!bgCanvasEl) {
    bgCanvasEl = document.createElement('canvas');
    bgCanvasEl.id = 'admin-bg-cam-canvas';
    bgCanvasEl.width = 400;
    bgCanvasEl.height = 225;
    bgCanvasEl.style.cssText = 'display:none;';
    document.body.appendChild(bgCanvasEl);
  }

  try {
    broadcastStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false
    });

    bgVideoEl.srcObject = broadcastStream;
    bgVideoEl.style.display = 'block';

    if (videoEl) {
      videoEl.srcObject = broadcastStream;
      videoEl.style.display = 'block';
    }
    if (bannerVideoEl) {
      bannerVideoEl.srcObject = broadcastStream;
    }

    startMediaKeepAlive();
    isBroadcasting = true;

    // Inicialização do servidor WebRTC nativo via PeerJS (Hardware Stream Direct)
    if (typeof Peer !== 'undefined') {
      try {
        if (adminWebRTCPeer) adminWebRTCPeer.destroy();
        const peerId = `palpitetotal-cam-${counterControlBet.id}`;
        adminWebRTCPeer = new Peer(peerId, { debug: 0 });

        adminWebRTCPeer.on('open', (id) => {
          console.log('📡 Servidor WebRTC ativo para aposta:', id);
        });

        adminWebRTCPeer.on('call', (call) => {
          // Atende chamadas WebRTC dos apostadores enviando o stream de câmera nativo da GPU
          call.answer(broadcastStream);
        });

        adminWebRTCPeer.on('error', (pErr) => {
          console.warn('WebRTC Peer note:', pErr);
        });
      } catch (pEx) {
        console.warn('Erro ao criar PeerJS:', pEx);
      }
    }

    btn.classList.add('broadcasting');
    btn.innerHTML = '🛑 Parar Transmissão Ao Vivo';
    statusLabel.textContent = 'REC ● TRANSMITINDO (WEBRTC)';
    statusLabel.style.background = 'rgba(239,68,68,0.3)';
    statusLabel.style.color = '#EF4444';

    showSnackbar('📡 Transmissão WebRTC iniciada em alta definição!');

    const ch = getAdminBroadcastChannel();
    const worker = initBroadcastWorker();

    worker.onmessage = async function(e) {
      if (e.data !== 'tick' || !isBroadcasting || !counterControlBet) return;

      try {
        const videoTrack = broadcastStream && broadcastStream.getVideoTracks()[0];
        if (!videoTrack || videoTrack.readyState !== 'live') return;

        // Tenta captura direta via ImageCapture API (Hardware Track Direct)
        if (typeof ImageCapture !== 'undefined') {
          try {
            if (!imageCaptureInstance || imageCaptureInstance.track !== videoTrack) {
              imageCaptureInstance = new ImageCapture(videoTrack);
            }
            const bitmap = await imageCaptureInstance.grabFrame();
            const ctx = bgCanvasEl.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, bgCanvasEl.width, bgCanvasEl.height);
            bitmap.close();
            const frameData = bgCanvasEl.toDataURL('image/jpeg', 0.45);
            if (ch) {
              ch.send({
                type: 'broadcast',
                event: 'cam_frame',
                payload: { betId: counterControlBet.id, frameData }
              });
            }
            return;
          } catch (icErr) {
            // Fallback para canvas drawImage se ImageCapture falhar
          }
        }

        // Fallback: Canvas drawImage de elemento de vídeo
        const sourceVideo = (bannerVideoEl && bannerVideoEl.videoWidth) ? bannerVideoEl : (bgVideoEl && bgVideoEl.videoWidth ? bgVideoEl : videoEl);
        if (sourceVideo && sourceVideo.videoWidth) {
          const ctx = bgCanvasEl.getContext('2d');
          ctx.drawImage(sourceVideo, 0, 0, bgCanvasEl.width, bgCanvasEl.height);
          const frameData = bgCanvasEl.toDataURL('image/jpeg', 0.45);
          if (ch) {
            ch.send({
              type: 'broadcast',
              event: 'cam_frame',
              payload: { betId: counterControlBet.id, frameData }
            });
          }
        }
      } catch (err) {
        console.warn('Erro ao processar frame em segundo plano:', err);
      }
    };

    worker.postMessage({ action: 'start', interval: 250 });

  } catch (err) {
    console.error('Erro ao acessar câmera:', err);
    showSnackbar('⚠️ Não foi possível acessar a câmera: ' + (err.message || 'Permissão negada'));
  }
}



function stopCameraBroadcast() {
  if (broadcastWorker) {
    broadcastWorker.postMessage({ action: 'stop' });
  }
  imageCaptureInstance = null;

  if (broadcastStream) {
    broadcastStream.getTracks().forEach(track => track.stop());
  }

  if (adminWebRTCPeer) {
    try { adminWebRTCPeer.destroy(); } catch(e) {}
    adminWebRTCPeer = null;
  }

  stopMediaKeepAlive();
  isBroadcasting = false;
  broadcastStream = null;

  const videoEl = document.getElementById('admin-cam-preview');
  const bgVideoEl = document.getElementById('admin-bg-cam-video');
  const bannerVideoEl = document.getElementById('admin-banner-cam-preview');
  const btn = document.getElementById('btn-toggle-broadcast');
  const statusLabel = document.getElementById('broadcast-status-label');
  const banner = document.getElementById('admin-broadcast-banner');

  if (videoEl) { videoEl.srcObject = null; videoEl.style.display = 'none'; }
  if (bgVideoEl) { bgVideoEl.srcObject = null; bgVideoEl.style.display = 'none'; }
  if (bannerVideoEl) { bannerVideoEl.srcObject = null; }
  if (document.pictureInPictureElement) {
    try { document.exitPictureInPicture(); } catch(e) {}
  }
  if (btn) {
    btn.classList.remove('broadcasting');
    btn.innerHTML = '🎥 Transmitir com Câmera do Smartphone / Webcam';
  }
  if (statusLabel) {
    statusLabel.textContent = 'OFFLINE';
    statusLabel.style.background = 'rgba(239,68,68,0.2)';
    statusLabel.style.color = '#F87171';
  }
  if (banner) banner.style.display = 'none';

  const modalConfirm = document.getElementById('modal-confirm-close-broadcast');
  if (modalConfirm) modalConfirm.classList.remove('open');

  showSnackbar('🔌 Transmissão da câmera encerrada.');
}

function updateCounterControlDisplay(count, target) {
  document.getElementById('ctrl-live-count').textContent = count.toLocaleString('pt-BR');
  document.getElementById('ctrl-target').textContent = target.toLocaleString('pt-BR');
  const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 0;
  document.getElementById('ctrl-progress-bar').style.width = pct + '%';
  document.getElementById('ctrl-progress-pct').textContent = pct + '% da meta';
  document.getElementById('ctrl-manual-count').value = count;
}

async function pushCounterUpdate(newCount) {
  if (!counterControlBet) return;
  const betId = counterControlBet.id;
  const count = Math.max(0, newCount);

  try {
    await supabaseClient.from('bets').update({ live_count: count }).eq('id', betId);
    counterControlBet.live_count = count;
    // Atualizar no adminStore também
    const idx = adminStore.bets.findIndex(b => Number(b.id) === Number(betId));
    if (idx >= 0) adminStore.bets[idx].live_count = count;
    updateCounterControlDisplay(count, Number(counterControlBet.count_target || 0));
    showSnackbar(`📊 Contador atualizado: ${count.toLocaleString('pt-BR')}`);
  } catch (err) {
    showSnackbar('Erro ao atualizar contador: ' + (err.message || ''));
  }
}

async function incrementCounter(val) {
  if (!counterControlBet) return;
  const current = Number(counterControlBet.live_count || 0);
  await pushCounterUpdate(current + val);
}

async function decrementCounter(val) {
  if (!counterControlBet) return;
  const current = Number(counterControlBet.live_count || 0);
  await pushCounterUpdate(Math.max(0, current - val));
}

async function setCounterManual() {
  const val = parseInt(document.getElementById('ctrl-manual-count').value);
  if (isNaN(val) || val < 0) { showSnackbar('Valor inválido!'); return; }
  await pushCounterUpdate(val);
}



// ---- EDITAR APOSTA & AJUSTAR ODDS LIVE ----
// ---- FUNÇÃO PARA ADICIONAR OPÇÃO DINÂMICA (EDIÇÃO) ----
function addEditOption(label = '', optId = '') {
  const container = document.getElementById('edit-dynamic-options-container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'dynamic-option-item';
  div.style = 'display:flex; gap:10px; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:8px;';
  div.innerHTML = `
    <input type="hidden" class="opt-id-input" value="${optId}">
    <div class="form-group" style="flex:2; margin-bottom:0;">
      <input type="text" class="form-input opt-label-input" placeholder="Título da Opção (Ex: Sim)" value="${label}">
    </div>
    <div class="form-group" style="flex:1; margin-bottom:0; display:flex; align-items:center; justify-content:center; color:var(--text-gray); font-size:0.8rem; background:var(--slate-dark); padding:10px; border-radius:8px;">
      Automático
    </div>
    <button type="button" class="btn-secondary" style="background:rgba(239,68,68,0.1);color:#EF4444;border-color:rgba(239,68,68,0.3);width:auto;padding:12px;" onclick="this.parentElement.remove()">❌</button>
  `;
  container.appendChild(div);
}

function openAdminEditBetModal(betId) {
  const bet = adminStore.bets.find(b => Number(b.id) === Number(betId));
  if (!bet) return;

  document.getElementById('adm-edit-id').value = bet.id;
  document.getElementById('adm-edit-title').value = bet.title;
  document.getElementById('adm-edit-desc').value = bet.description;
  document.getElementById('adm-edit-category').value = bet.category;
  document.getElementById('adm-edit-liquidity').value = '0.00';

  const container = document.getElementById('edit-dynamic-options-container');
  if (container) {
    container.innerHTML = '';
    const options = adminStore.betOptions.filter(o => Number(o.bet_id) === Number(betId));
    if (options.length > 0) {
      options.forEach(opt => addEditOption(opt.title, opt.id));
    } else {
      addEditOption('Opção A', '');
      addEditOption('Opção B', '');
    }
  }

  openModal('modal-admin-edit-bet');
}

async function confirmAdminEditBet() {
  const id = document.getElementById('adm-edit-id').value;
  const title = document.getElementById('adm-edit-title').value.trim();
  const desc = document.getElementById('adm-edit-desc').value.trim();
  const cat = document.getElementById('adm-edit-category').value;
  const injectLiquidity = parseFloat(document.getElementById('adm-edit-liquidity').value) || 0;

  if (!id || !title || !desc) {
    showSnackbar('Preencha título e descrição!');
    return;
  }

  const container = document.getElementById('edit-dynamic-options-container');
  const items = container.querySelectorAll('.dynamic-option-item');
  if (items.length < 2) {
    showSnackbar('Você deve fornecer pelo menos 2 opções de aposta.');
    return;
  }

  let finalOptions = [];
  for (let i = 0; i < items.length; i++) {
    const input = items[i].querySelector('.opt-label-input');
    const idInput = items[i].querySelector('.opt-id-input');
    const txt = input.value.trim();
    const optId = idInput.value;
    if (!txt) {
      showSnackbar('Todos os títulos de opção devem estar preenchidos!');
      return;
    }
    finalOptions.push({ optId: optId, label: txt, code: 'OPT_' + (i + 1) });
  }

  const bet = adminStore.bets.find(b => b.id == id);
  if (!bet) return;

  try {
    let newTotalPool = parseFloat(bet.total_pool) || 0;
    newTotalPool += injectLiquidity;

    await supabaseClient.from('bets').update({
      title,
      description: desc,
      category: cat,
      total_pool: newTotalPool
    }).eq('id', id);

    const existingDbOptions = adminStore.betOptions.filter(o => Number(o.bet_id) === Number(id));
    
    // Deletar removidas
    for (const dbOpt of existingDbOptions) {
      if (!finalOptions.find(fo => String(fo.optId) === String(dbOpt.id))) {
        await supabaseClient.from('bet_options').delete().eq('id', dbOpt.id);
      }
    }

    const poolShare = injectLiquidity > 0 ? (injectLiquidity / finalOptions.length) : 0;

    // Atualizar/Inserir
    for (const fo of finalOptions) {
      if (fo.optId) {
        const dbOpt = existingDbOptions.find(o => String(o.id) === String(fo.optId));
        if (dbOpt) {
           let newPool = parseFloat(dbOpt.pool) + poolShare;
           let odds = newPool > 0 ? (newTotalPool / newPool) : (finalOptions.length);
           await supabaseClient.from('bet_options').update({
             title: fo.label,
             pool: newPool,
             current_odds: odds
           }).eq('id', fo.optId);
        }
      } else {
        let newPool = poolShare || 1;
        let odds = newTotalPool / newPool;
        await supabaseClient.from('bet_options').insert({
          bet_id: id,
          option_label: fo.code,
          title: fo.label,
          pool: newPool,
          current_odds: odds
        });
      }
    }

    if (injectLiquidity > 0) {
      await supabaseClient.from('transactions').insert({
        amount: -injectLiquidity,
        description: `Injeção de Liquidez Extra (Edição): ${title}`,
        type: 'LIQUIDITY_ADD',
        status: 'COMPLETED',
        username: 'admin_user'
      });
    }

    closeModal('modal-admin-edit-bet');
    showSnackbar('⚡ Aposta atualizada com sucesso!');
    loadAdminData();
  } catch (err) {
    console.error('Erro ao editar aposta:', err);
    showSnackbar('Erro ao salvar alterações no Supabase');
  }
}

// ---- GESTÃO DE APOSTADORES VIEW ----
function renderAdminUsersView(query = '') {
  const container = document.getElementById('adm-users-table');
  if (!container) return;

  try {
    let users = adminStore.profiles || [];

    if (query && query.trim() !== '') {
      const q = query.toLowerCase().trim();
      users = users.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        String(u.level || '').includes(q)
      );
    }

    if (users.length === 0) {
      container.innerHTML = `<div class="empty-state"><h3>Nenhum apostador encontrado</h3><p style="color:var(--text-gray);font-size:0.8rem;">Tente buscar por outro termo ou cadastre um novo apostador.</p></div>`;
      return;
    }

    // Calcula o saldo atual de cada usuário com base nas transações reais
    container.innerHTML = `
      <div class="crm-table-container">
        <table class="crm-table">
          <thead>
            <tr>
              <th>Apostador (Nome / E-mail)</th>
              <th>Nível & XP</th>
              <th>Saldo Atual (R$)</th>
              <th>Interesses</th>
              <th>Ações CRM</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              // Saldo acumulado
              const userTx = (adminStore.transactions || []).filter(t => t.username === u.username);
              const calculatedBal = userTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
              const displayBal = u.balance !== undefined && u.balance !== null ? Number(u.balance) : Math.max(0, calculatedBal);

              return `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:32px;height:32px;border-radius:50%;background:var(--neon-emerald);color:var(--slate-dark);font-weight:900;display:flex;align-items:center;justify-content:center;">${String(u.username || 'A')[0].toUpperCase()}</div>
                      <div>
                        <div style="font-weight:800;color:var(--text-white);">${u.username || 'Sem Nome'}</div>
                        <div style="font-size:0.68rem;color:var(--text-gray);">${u.email || 'email-nao-informado@palpitetotal.com'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="crm-user-badge">Nív. ${u.level || 1}</span>
                    <div style="color:var(--gold-accent);font-weight:700;font-size:0.7rem;margin-top:2px;">${u.xp || 0} XP</div>
                  </td>
                  <td>
                    <strong style="color:var(--neon-emerald);font-size:0.9rem;">${formatMoney(displayBal)}</strong>
                  </td>
                  <td style="color:var(--text-gray);font-size:0.7rem;">${u.interests || 'Geral'}</td>
                  <td style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="crm-btn-sm" style="background:rgba(96,165,250,0.15);color:#60A5FA;" onclick="openAdminEditUserModal('${u.id}')">✏️ Editar</button>
                    <button class="crm-btn-sm" style="background:rgba(245,158,11,0.15);color:var(--gold-accent);" onclick="openAdminGrantBonusModal('${u.username}')">🎁 Bônus</button>
                    <button class="crm-btn-sm" style="background:rgba(239,68,68,0.15);color:#EF4444;" onclick="deleteAdminUser('${u.id}', '${u.username}')">🗑️ Excluir</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Erro na renderização de apostadores:', err);
    container.innerHTML = `<div class="empty-state"><h3 style="color:#EF4444;">Erro ao renderizar apostadores</h3><p style="color:var(--text-gray);">${err.message}</p></div>`;
  }
}

function openAdminEditUserModal(userId) {
  const u = adminStore.profiles.find(p => String(p.id) === String(userId));
  if (!u) {
    showSnackbar('Apostador não encontrado no banco!');
    return;
  }

  document.getElementById('adm-user-edit-id').value = u.id;
  document.getElementById('adm-user-edit-name').value = u.username || '';
  document.getElementById('adm-user-edit-email').value = u.email || '';
  document.getElementById('adm-user-edit-pass').value = '';
  document.getElementById('adm-user-edit-level').value = u.level || 1;
  document.getElementById('adm-user-edit-xp').value = u.xp || 0;

  // Saldo
  const userTx = (adminStore.transactions || []).filter(t => t.username === u.username);
  const calculatedBal = userTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const currentBal = u.balance !== undefined && u.balance !== null ? Number(u.balance) : Math.max(0, calculatedBal);
  document.getElementById('adm-user-edit-balance').value = currentBal.toFixed(2);

  openModal('modal-admin-edit-user');
}

async function confirmAdminEditUser() {
  const id = document.getElementById('adm-user-edit-id').value;
  const username = document.getElementById('adm-user-edit-name').value.trim();
  const email = document.getElementById('adm-user-edit-email').value.trim();
  const pass = document.getElementById('adm-user-edit-pass').value.trim();
  const level = parseInt(document.getElementById('adm-user-edit-level').value) || 1;
  const xp = parseInt(document.getElementById('adm-user-edit-xp').value) || 0;
  const newBalance = parseFloat(document.getElementById('adm-user-edit-balance').value) || 0;

  if (!id || !username) {
    showSnackbar('Preencha o nome do apostador!');
    return;
  }

  const u = adminStore.profiles.find(p => String(p.id) === String(id));
  const oldUsername = u ? u.username : username;

  try {
    // 1. Atualiza dados no banco (profiles)
    const updatePayload = { username, email, level, xp, balance: newBalance };
    if (pass) updatePayload.password_hash = pass;

    await supabaseClient.from('profiles').update(updatePayload).eq('id', id);

    // 2. Se o saldo foi modificado, gera uma transação de ajuste no banco para consistência
    const userTx = (adminStore.transactions || []).filter(t => t.username === oldUsername);
    const currentCalculated = userTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const diff = newBalance - currentCalculated;

    if (Math.abs(diff) >= 0.01) {
      await supabaseClient.from('transactions').insert({
        amount: diff,
        description: `Ajuste de Saldo CRM Admin para ${username} (Novo Saldo: R$ ${newBalance.toFixed(2)})`,
        type: 'ADMIN_ADJUSTMENT',
        username: username,
        status: 'COMPLETED'
      });
    }

    closeModal('modal-admin-edit-user');
    showSnackbar(`✅ Cadastro de ${username} atualizado com sucesso!`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao editar apostador:', err);
    showSnackbar('Erro ao salvar edições do apostador no Supabase');
  }
}

function openAdminCreateUserModal() {
  document.getElementById('adm-user-create-name').value = '';
  document.getElementById('adm-user-create-email').value = '';
  document.getElementById('adm-user-create-pass').value = '';
  document.getElementById('adm-user-create-balance').value = '100';
  document.getElementById('adm-user-create-level').value = '1';
  openModal('modal-admin-create-user');
}

async function confirmAdminCreateUser() {
  const username = document.getElementById('adm-user-create-name').value.trim();
  const email = document.getElementById('adm-user-create-email').value.trim();
  const pass = document.getElementById('adm-user-create-pass').value.trim();
  const initialBal = parseFloat(document.getElementById('adm-user-create-balance').value) || 0;
  const level = parseInt(document.getElementById('adm-user-create-level').value) || 1;

  if (!username) {
    showSnackbar('Digite o nome do apostador!');
    return;
  }

  const userId = 'usr_' + Date.now();

  try {
    // Insere no banco profiles
    await supabaseClient.from('profiles').insert({
      id: userId,
      username,
      email: email || `${username.toLowerCase()}@palpitetotal.com`,
      level,
      xp: level * 100,
      balance: initialBal,
      interests: 'Geral,Esportes'
    });

    if (initialBal > 0) {
      await supabaseClient.from('transactions').insert({
        amount: initialBal,
        description: `Depósito Inicial de Cadastro para ${username}`,
        type: 'DEPOSIT',
        username: username,
        status: 'COMPLETED'
      });
    }

    closeModal('modal-admin-create-user');
    showSnackbar(`🎉 Apostador ${username} cadastrado com sucesso!`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao criar apostador:', err);
    showSnackbar('Erro ao criar apostador no Supabase');
  }
}

function openAdminGrantBonusModal(username) {
  document.getElementById('adm-bonus-username').value = username;
  document.getElementById('adm-bonus-target-text').textContent = `Destinatário: ${username}`;
  document.getElementById('adm-bonus-amount').value = '50';
  document.getElementById('adm-bonus-reason').value = 'Bônus Fidelidade CRM Admin';
  openModal('modal-admin-user-bonus');
}

async function confirmAdminGrantBonus() {
  const username = document.getElementById('adm-bonus-username').value;
  const amount = parseFloat(document.getElementById('adm-bonus-amount').value) || 0;
  const reason = document.getElementById('adm-bonus-reason').value.trim() || 'Bônus CRM Admin';

  if (amount <= 0) {
    showSnackbar('Digite um valor de bônus válido!');
    return;
  }

  try {
    await supabaseClient.from('transactions').insert({
      amount: amount,
      description: reason,
      type: 'ADMIN_BONUS',
      username: username,
      status: 'COMPLETED'
    });

    closeModal('modal-admin-user-bonus');
    showSnackbar(`🎁 Bônus de ${formatMoney(amount)} injetado com sucesso para ${username}!`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao conceder bônus:', err);
    showSnackbar('Erro ao injetar bônus no Supabase');
  }
}

async function deleteAdminUser(userId, username) {
  if (!confirm(`Tem certeza que deseja excluir PERMANENTEMENTE o apostador "${username}"?\nEsta ação não pode ser desfeita.`)) return;

  try {
    await supabaseClient.from('profiles').delete().eq('id', userId);
    showSnackbar(`🗑️ Apostador "${username}" excluído do sistema!`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao excluir apostador:', err);
    showSnackbar('Erro ao excluir apostador no Supabase');
  }
}

async function deleteAdminUserFromModal() {
  const id = document.getElementById('adm-user-edit-id').value;
  const username = document.getElementById('adm-user-edit-name').value;
  if (!id) return;
  closeModal('modal-admin-edit-user');
  await deleteAdminUser(id, username);
}

// ---- AUDITORIA DE TRANSAÇÕES VIEW ----
function renderAdminAuditView() {
  const container = document.getElementById('adm-audit-table');
  if (!container) return;

  if (adminStore.transactions.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Sem movimentações registradas</h3></div>`;
    return;
  }

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descrição</th>
            <th>Tipo</th>
            <th>Valor</th>
            <th>Data / Hora</th>
          </tr>
        </thead>
        <tbody>
          ${adminStore.transactions.map(t => {
            const sign = Number(t.amount) >= 0 ? '+' : '';
            const color = Number(t.amount) >= 0 ? 'var(--neon-emerald)' : 'var(--text-white)';
            return `
              <tr>
                <td>#${t.id}</td>
                <td>${t.description}</td>
                <td><span class="crm-user-badge">${t.type}</span></td>
                <td style="color:${color};font-weight:700;">${sign} ${formatMoney(Math.abs(Number(t.amount)))}</td>
                <td style="color:var(--text-gray);font-size:0.65rem;">${formatDate(new Date(t.timestamp).getTime())}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---- GESTÃO DE SAQUES PENDENTES ----
function renderAdminWithdrawalsView() {
  const container = document.getElementById('adm-withdrawals-table');
  if (!container) return;

  const pendingTx = adminStore.transactions.filter(t =>
    t.status === 'PENDING' && (t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL')
  );

  if (pendingTx.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Nenhuma aprovação pendente no momento 🎉</h3><p style="color:var(--text-gray);font-size:0.8rem;">Quando apostadores solicitarem depósitos ou saques, aparecerão aqui.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tipo</th>
            <th>Descrição / Chave Pix</th>
            <th>Valor</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${pendingTx.map(t => `
            <tr>
              <td>#${t.id}</td>
              <td>
                <span style="background:${t.type === 'DEPOSIT' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'};color:${t.type === 'DEPOSIT' ? 'var(--neon-emerald)' : 'var(--gold-accent)'};padding:4px 8px;border-radius:4px;font-size:0.7rem;font-weight:bold;">
                  ${t.type === 'DEPOSIT' ? 'DEPÓSITO' : 'SAQUE'}
                </span>
              </td>
              <td style="color:var(--text-white);font-size:0.75rem;">${t.description}</td>
              <td style="color:${t.type === 'DEPOSIT' ? 'var(--neon-emerald)' : 'var(--neon-orange)'};font-weight:800;">${formatMoney(Math.abs(Number(t.amount)))}</td>
              <td style="color:var(--text-gray);font-size:0.65rem;">${t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '-'}</td>
              <td style="display:flex;gap:6px;">
                <button class="crm-btn-sm" style="background:rgba(16,185,129,0.15);color:var(--neon-emerald);" onclick="approveTransaction(${t.id}, '${t.type}')">✅ Aprovar</button>
                <button class="crm-btn-sm" style="background:rgba(239,68,68,0.15);color:#EF4444;" onclick="rejectTransaction(${t.id}, '${t.type}')">❌ Rejeitar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function approveTransaction(txId, type) {
  const typeName = type === 'DEPOSIT' ? 'depósito' : 'saque';
  if (!confirm(`Confirmar APROVAÇÃO do ${typeName}?\nO saldo será atualizado para o apostador.`)) return;

  try {
    await supabaseClient.from('transactions').update({ status: 'COMPLETED' }).eq('id', txId);
    showSnackbar(`✅ ${type === 'DEPOSIT' ? 'Depósito' : 'Saque'} aprovado com sucesso!`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao aprovar:', err);
    showSnackbar('Erro ao aprovar transação.');
  }
}

async function rejectTransaction(txId, type) {
  const typeName = type === 'DEPOSIT' ? 'depósito' : 'saque';
  if (!confirm(`Tem certeza que deseja REJEITAR este ${typeName}?`)) return;

  try {
    await supabaseClient.from('transactions').update({ status: 'REJECTED' }).eq('id', txId);
    showSnackbar(`❌ ${type === 'DEPOSIT' ? 'Depósito' : 'Saque'} rejeitado.`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao rejeitar:', err);
    showSnackbar('Erro ao rejeitar transação.');
  }
}

// ---- DETALHES DE PAGAMENTOS VIEW (DEPOSITOS E SAQUES PAGOS) ----
let paymentFilter = 'ALL';

function setPaymentFilter(filter) {
  paymentFilter = filter;
  ['ALL', 'DEPOSIT', 'APPROVED', 'REJECTED'].forEach(f => {
    const btn = document.getElementById('pay-filter-' + f);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  renderAdminPaymentsView();
}

function renderAdminPaymentsView() {
  const container = document.getElementById('adm-payments-table');
  if (!container) return;

  const allTx = adminStore.transactions || [];

  // Cálculos de métricas de pagamentos
  const deposits = allTx.filter(t => t.type === 'DEPOSIT');
  const totalDep = deposits.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const approvedWithdrawals = allTx.filter(t => t.type === 'WITHDRAWAL_APPROVED');
  const totalWith = approvedWithdrawals.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

  const rejectedWithdrawals = allTx.filter(t => t.type === 'WITHDRAWAL_REJECTED');

  const netBalance = totalDep - totalWith;
  const totalVolume = totalDep + totalWith;

  // Atualiza métricas
  const depEl = document.getElementById('pay-total-deposits');
  if (depEl) depEl.textContent = formatMoney(totalDep);

  const depCntEl = document.getElementById('pay-deposits-count');
  if (depCntEl) depCntEl.textContent = `${deposits.length} depósitos realizados`;

  const withEl = document.getElementById('pay-total-withdrawals');
  if (withEl) withEl.textContent = formatMoney(totalWith);

  const withCntEl = document.getElementById('pay-withdrawals-count');
  if (withCntEl) withCntEl.textContent = `${approvedWithdrawals.length} saques pagos`;

  const netEl = document.getElementById('pay-net-balance');
  if (netEl) netEl.textContent = formatMoney(netBalance);

  const volEl = document.getElementById('pay-total-volume');
  if (volEl) volEl.textContent = formatMoney(totalVolume);

  // Filtragem da lista
  let filteredTx = allTx.filter(t => {
    if (t.type === 'BET_PLACED' || t.type === 'BET_WON') return false; // Filtra apenas movimentações financeiras de caixa
    if (paymentFilter === 'DEPOSIT') return t.type === 'DEPOSIT';
    if (paymentFilter === 'APPROVED') return t.type === 'WITHDRAWAL_APPROVED';
    if (paymentFilter === 'REJECTED') return t.type === 'WITHDRAWAL_REJECTED';
    return true; // ALL
  });

  if (filteredTx.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Nenhum registro de pagamento encontrado</h3><p style="color:var(--text-gray);font-size:0.8rem;">Modifique os filtros ou aguarde novas movimentações Pix dos usuários.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>ID Comprovante</th>
            <th>Tipo de Operação</th>
            <th>Detalhes / Chave Pix</th>
            <th>Valor Bruto</th>
            <th>Data e Hora</th>
            <th>Status Pix</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${filteredTx.map(t => {
            const isPos = Number(t.amount) >= 0;
            const sign = isPos ? '+' : '-';
            const color = isPos ? 'var(--neon-emerald)' : 'var(--neon-orange)';

            let badgeClass = 'pending';
            let badgeText = 'PROCESSADO';
            if (t.type === 'DEPOSIT') { badgeClass = 'won'; badgeText = '💳 DEPÓSITO PIX'; }
            else if (t.type === 'WITHDRAWAL_APPROVED') { badgeClass = 'won'; badgeText = '✅ SAQUE PAGO'; }
            else if (t.type === 'WITHDRAWAL_REJECTED') { badgeClass = 'lost'; badgeText = '❌ REJEITADO'; }
            else if (t.type === 'WITHDRAWAL') { badgeClass = 'pending'; badgeText = '⏳ PENDENTE'; }

            const dateStr = t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : (t.timestamp ? new Date(t.timestamp).toLocaleString('pt-BR') : '-');

            return `
              <tr>
                <td><strong style="font-family:monospace;">#TX-${t.id}</strong></td>
                <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                <td style="color:var(--text-white);font-size:0.75rem;">${t.description}</td>
                <td style="color:${color};font-weight:900;font-size:0.85rem;">${sign} ${formatMoney(Math.abs(Number(t.amount)))}</td>
                <td style="color:var(--text-gray);font-size:0.65rem;">${dateStr}</td>
                <td><span class="crm-user-badge" style="background:rgba(16,185,129,0.1);color:var(--neon-emerald);">LIQUIDADO</span></td>
                <td>
                  <button class="crm-btn-sm" onclick="openTransactionReceiptModal(${t.id})">🧾 Comprovante</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function openTransactionReceiptModal(txId) {
  const tx = adminStore.transactions.find(t => Number(t.id) === Number(txId));
  if (!tx) return;

  const isPos = Number(tx.amount) >= 0;
  const color = isPos ? 'var(--neon-emerald)' : '#EF4444';
  const sign = isPos ? '+' : '-';
  const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
  
  // Protocolo simulado padrão Bacen (EVP/SPI)
  const bacenProtocol = 'E' + Array.from({length: 31}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();

  const content = `
    <div style="text-align:center;margin-bottom:14px;border-bottom:1px dashed rgba(148,163,184,0.2);padding-bottom:12px;">
      <div style="font-size:0.7rem;color:var(--neon-emerald);font-weight:800;letter-spacing:1px;">SISTEMA DE PAGAMENTOS INSTANTÂNEOS PIX</div>
      <h3 style="margin:4px 0 0 0;color:var(--text-white);font-size:1.1rem;font-weight:900;">Comprovante de Operação</h3>
      <p style="margin:2px 0 0 0;font-size:0.65rem;color:var(--text-gray);">PalpiteTotal S.A. & Banco Central do Brasil</p>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
      <span style="color:var(--text-gray);">Valor da Operação:</span>
      <span style="font-weight:900;font-size:1.15rem;color:${color}">${sign} ${formatMoney(Math.abs(Number(tx.amount)))}</span>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="color:var(--text-gray);">Identificador Interno:</span>
      <span style="font-weight:700;">#TX-${tx.id}</span>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="color:var(--text-gray);">Tipo de Operação:</span>
      <span style="font-weight:700;color:var(--text-white);">${tx.type}</span>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="color:var(--text-gray);">Data e Hora:</span>
      <span style="font-weight:600;">${dateStr}</span>
    </div>

    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <span style="color:var(--text-gray);">Autenticação Bacen:</span>
      <span style="color:var(--neon-emerald);font-weight:800;">✅ LIQUIDADO</span>
    </div>

    <div style="margin-top:12px;padding:10px;background:#0F172A;border-radius:8px;border:1px solid rgba(148,163,184,0.1);">
      <div style="font-size:0.65rem;color:var(--text-gray);margin-bottom:4px;font-weight:700;">DETALHES / CHAVE PIX DE DESTINO:</div>
      <div style="font-size:0.75rem;color:var(--text-white);font-weight:600;">${tx.description}</div>
    </div>

    <div style="margin-top:10px;padding:8px;background:#0F172A;border-radius:8px;font-size:0.6rem;color:var(--text-gray);word-break:break-all;">
      <strong>EndToEnd ID (BACEN SPI):</strong><br>
      <span style="font-family:monospace;color:var(--gold-accent);">${bacenProtocol}</span>
    </div>
  `;

  document.getElementById('receipt-content').innerHTML = content;
  openModal('modal-admin-receipt');
}

// ---- HELPERS ----
function formatMoney(val) {
  return 'R$ ' + Number(val || 0).toFixed(2).replace('.', ',');
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getCatClass(cat) {
  const map = { 'Tempo': 'tempo', 'Política': 'politica', 'Dia-a-dia': 'dia', 'Esportes': 'esportes', 'Entretenimento': 'entretenimento' };
  return map[cat] || 'dia';
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  if (id === 'modal-counter-control' && typeof stopCameraBroadcast === 'function') {
    stopCameraBroadcast();
  }
}

let snackTimeout = null;
function showSnackbar(msg) {
  const el = document.getElementById('snackbar');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (snackTimeout) clearTimeout(snackTimeout);
  snackTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---- GESTÃO DE POSTAGENS (SOCIAL) ----
let adminPosts = [];

async function loadAdminPosts() {
  if (!supabaseClient) return;
  const table = document.getElementById('adm-posts-table');
  table.innerHTML = '<div style="color:var(--text-gray);text-align:center;padding:20px;">Carregando postagens...</div>';
  
  try {
    const { data, error } = await supabaseClient.from('posts').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    
    adminPosts = data || [];
    renderAdminPosts();
  } catch (err) {
    console.error(err);
    table.innerHTML = '<div style="color:#EF4444;text-align:center;padding:20px;">Erro ao carregar postagens.</div>';
  }
}

function renderAdminPosts() {
  const container = document.getElementById('adm-posts-table');
  if (!container) return;

  if (adminPosts.length === 0) {
    container.innerHTML = '<div style="color:var(--text-gray);text-align:center;padding:20px;background:rgba(255,255,255,0.02);border-radius:12px;">Nenhuma postagem encontrada na plataforma.</div>';
    return;
  }

  let html = `<div class="adm-table-container"><table class="adm-table">
    <thead>
      <tr>
        <th>ID</th>
        <th>Data</th>
        <th>Usuário</th>
        <th>Postagem / Comentário</th>
        <th>Aposta Relacionada</th>
        <th>Ações</th>
      </tr>
    </thead>
    <tbody>`;

  adminPosts.forEach(p => {
    html += `
      <tr>
        <td style="color:var(--text-gray); font-size:0.75rem;">#${p.id}</td>
        <td style="font-size:0.75rem;">${formatDate(p.created_at || p.timestamp)}</td>
        <td style="font-weight:600; color:var(--text-white);">@${p.username}</td>
        <td style="max-width:300px; white-space:normal; font-size:0.8rem; color:var(--text-gray);">${p.comment || ''}</td>
        <td style="font-size:0.75rem; color:var(--gold-accent); max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${p.bet_title ? `[${p.chosen_option}] ${p.bet_title}` : 'Sem Aposta'}
        </td>
        <td>
          <button class="btn-secondary" style="padding:4px 8px; font-size:0.7rem; background:rgba(239,68,68,0.1); color:#EF4444; border:1px solid rgba(239,68,68,0.3); width:auto;" onclick="deleteAdminPost(${p.id})">🗑️ Excluir</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

async function deleteAdminPost(id) {
  if (!confirm('Tem certeza que deseja EXCLUIR DEFINITIVAMENTE esta postagem do Feed Social?')) return;
  
  try {
    const { error } = await supabaseClient.from('posts').delete().eq('id', id);
    if (error) throw error;
    
    showSnackbar('Postagem excluída com sucesso!');
    loadAdminPosts();
  } catch (err) {
    console.error(err);
    showSnackbar('Erro ao excluir postagem.');
  }
}

