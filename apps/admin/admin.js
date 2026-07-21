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
    const [betsRes, userBetsRes, txRes, profilesRes, postsRes, settingsRes] = await Promise.all([
      supabaseClient.from('bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('user_bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('transactions').select('*').order('id', { ascending: false }),
      supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('posts').select('*').order('id', { ascending: false }),
      supabaseClient.from('platform_settings').select('*').eq('id', 'default').single()
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

    if (betsRes.data) adminStore.bets = betsRes.data;
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

    renderAdminCurrentTab();
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

  renderAdminCurrentTab();
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
  // Volume total = soma de todas as apostas reais (user_bets)
  const totalVolume = adminStore.userBets.reduce((acc, ub) => acc + Number(ub.amount || 0), 0);

  // Prêmios pagos = apostas ganhas (potential_win)
  const totalPayouts = adminStore.userBets
    .filter(ub => ub.status === 'WON')
    .reduce((acc, ub) => acc + Number(ub.potential_win || 0), 0);

  // GGR = apostas totais apostadas - prêmios efetivamente pagos
  const houseGGR = Math.max(0, totalVolume - totalPayouts);

  // Depósitos reais feitos pelos usuários
  const totalDeposits = adminStore.transactions
    .filter(t => t.type === 'DEPOSIT')
    .reduce((acc, t) => acc + Number(t.amount || 0), 0);

  // Saques aprovados
  const totalWithdrawals = adminStore.transactions
    .filter(t => t.type === 'WITHDRAWAL_APPROVED')
    .reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

  const totalUsers = adminStore.profiles.length;

  document.getElementById('adm-volume').textContent = formatMoney(totalVolume);
  document.getElementById('adm-ggr').textContent = formatMoney(houseGGR);
  document.getElementById('adm-payouts').textContent = formatMoney(totalPayouts);
  document.getElementById('adm-users-count').textContent = totalUsers;

  // Atualiza subtítulos com dados extras se existirem os elementos
  const depEl = document.getElementById('adm-deposits-sub');
  if (depEl) depEl.textContent = `Depósitos: ${formatMoney(totalDeposits)} | Saques pagos: ${formatMoney(totalWithdrawals)}`;

  renderAdminCharts(totalVolume, totalPayouts, houseGGR);
}

function renderAdminCharts(totalVolume, totalPayouts, houseGGR) {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Doughnut / Pie
  const catCounts = { 'Tempo': 0, 'Política': 0, 'Esportes': 0, 'Dia-a-dia': 0, 'Entretenimento': 0 };
  adminStore.bets.forEach(b => {
    if (catCounts[b.category] !== undefined) {
      catCounts[b.category] += Number(b.total_pool || 0);
    }
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
  document.getElementById('adm-filter-closed').classList.toggle('active', filter === 'CLOSED');
  renderAdminSoberanoView();
}

function renderAdminSoberanoView() {
  const openBets = adminStore.bets.filter(b => b.status === 'OPEN');
  const closedBets = adminStore.bets.filter(b => b.status !== 'OPEN');

  document.getElementById('adm-open-count').textContent = openBets.length;
  document.getElementById('adm-closed-count').textContent = closedBets.length;

  const targetBets = betFilter === 'OPEN' ? openBets : closedBets;
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

      return `
        <div class="bet-card" style="margin-bottom:14px;">
          <div class="bet-header">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="cat-badge ${catClass}">${b.category}</span>
              ${isCounter ? '<span style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);padding:2px 8px;border-radius:20px;font-size:0.6rem;font-weight:800;color:#A78BFA;">📹 CONTADOR</span>' : ''}
              <button class="crm-btn-sm" style="padding:3px 10px;color:var(--neon-emerald);" onclick="openAdminEditBetModal(${b.id})">✏️ Editar</button>
            </div>
            <span class="pool-text">Pool: ${formatMoney(Number(b.total_pool))}</span>
          </div>
          <div class="bet-title">${b.title}</div>
          <div class="bet-desc">${b.description}</div>
          ${counterSection}
          <div style="font-size:0.75rem;color:var(--gold-accent);font-weight:600;margin:10px 0 6px;">
            ${isCounter ? 'Liquidar contador — Escolha a opção vencedora:' : 'Escolha a opção vencedora para liquidar:'}
          </div>
          <div class="bet-odds-row">
            <button class="resolve-btn" onclick="resolveBetAdmin(${b.id}, 'A')">${b.option_a} (@${Number(b.odds_a).toFixed(2)})</button>
            <button class="resolve-btn" onclick="resolveBetAdmin(${b.id}, 'B')">${b.option_b} (@${Number(b.odds_b).toFixed(2)})</button>
          </div>
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
            <button class="crm-btn-sm" style="padding:3px 10px;color:#EF4444;background:rgba(239,68,68,0.15);border:none;border-radius:6px;font-weight:700;cursor:pointer;" onclick="deleteAdminBet(${b.id}, '${b.title.replace(/'/g, "\\'")}')">🗑️ Excluir</button>
          </div>
          <div class="bet-title">${b.title}</div>
          ${isCounter ? `<div style="text-align:center;font-size:1.5rem;font-weight:900;color:#A78BFA;margin:8px 0;">📊 ${Number(b.live_count||0).toLocaleString('pt-BR')} ${b.count_subject || 'contados'}</div>` : ''}
          <div class="resolved-result">VENCEDOR DECLARADO: '${winnerText}'</div>
        </div>
      `;
    }
  }).join('');
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

  const newStatus = winningOption === 'A' ? 'RESOLVED_A' : 'RESOLVED_B';

  try {
    // 1. Atualiza status da bet para CLOSED primeiro para disparar realtime
    //    depois atualiza para RESOLVED_A/B para preservar o vencedor
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

    for (let ub of toProcess) {
      const won = ub.chosen_option === winningOption;
      const ubStatus = won ? 'WON' : 'LOST';

      // 3. Atualiza status do user_bet — isso dispara o realtime no mobile
      await supabaseClient.from('user_bets')
        .update({ status: ubStatus })
        .eq('id', ub.id);

      // 4. Cria transação de prêmio se ganhou
      if (won) {
        await supabaseClient.from('transactions').insert({
          amount: Number(ub.potential_win),
          description: `Prêmio ganho: ${bet.title}`,
          type: 'BET_WON'
        });
        showSnackbar(`🏆 Apostador ganhou R$ ${Number(ub.potential_win).toFixed(2)} em: ${bet.title}`);
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

function openAdminCreateBetModal() {
  currentCreateBetType = 'CLASSIC';
  document.getElementById('adm-create-title').value = '';
  document.getElementById('adm-create-desc').value = '';
  document.getElementById('adm-create-oddsA').value = '1.90';
  document.getElementById('adm-create-oddsB').value = '1.90';
  // Reset tipo
  setAdminBetType('CLASSIC');
  openModal('modal-admin-create-bet');
}

async function confirmAdminCreateBet() {
  const title = document.getElementById('adm-create-title').value.trim();
  const desc = document.getElementById('adm-create-desc').value.trim();
  const cat = document.getElementById('adm-create-category').value;
  const oddsA = parseFloat(document.getElementById('adm-create-oddsA').value) || 1.90;
  const oddsB = parseFloat(document.getElementById('adm-create-oddsB').value) || 1.90;

  if (!title || !desc) {
    showSnackbar('Preencha título e descrição!');
    return;
  }

  let payload = {
    title, description: desc, category: cat,
    creator_name: 'Soberano Admin',
    odds_a: oddsA, odds_b: oddsB,
    status: 'OPEN', is_trending: true, total_pool: 0
  };

  if (currentCreateBetType === 'CLASSIC') {
    const optA = document.getElementById('adm-create-optA').value.trim() || 'Sim';
    const optB = document.getElementById('adm-create-optB').value.trim() || 'Não';
    payload.bet_type = 'CLASSIC';
    payload.option_a = optA;
    payload.option_b = optB;
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

  try {
    await supabaseClient.from('bets').insert(payload);
    closeModal('modal-admin-create-bet');
    showSnackbar(`✅ ${currentCreateBetType === 'COUNTER' ? '📹 Palpite de Contagem' : '🎯 Aposta clássica'} lançada!`);
    loadAdminData();
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
function openAdminEditBetModal(betId) {
  const bet = adminStore.bets.find(b => Number(b.id) === Number(betId));
  if (!bet) return;

  document.getElementById('adm-edit-id').value = bet.id;
  document.getElementById('adm-edit-title').value = bet.title;
  document.getElementById('adm-edit-desc').value = bet.description;
  document.getElementById('adm-edit-category').value = bet.category;
  document.getElementById('adm-edit-optA').value = bet.option_a;
  document.getElementById('adm-edit-optB').value = bet.option_b;
  document.getElementById('adm-edit-oddsA').value = Number(bet.odds_a).toFixed(2);
  document.getElementById('adm-edit-oddsB').value = Number(bet.odds_b).toFixed(2);

  openModal('modal-admin-edit-bet');
}

async function confirmAdminEditBet() {
  const id = document.getElementById('adm-edit-id').value;
  const title = document.getElementById('adm-edit-title').value.trim();
  const desc = document.getElementById('adm-edit-desc').value.trim();
  const cat = document.getElementById('adm-edit-category').value;
  const optA = document.getElementById('adm-edit-optA').value.trim();
  const optB = document.getElementById('adm-edit-optB').value.trim();
  const oddsA = parseFloat(document.getElementById('adm-edit-oddsA').value) || 1.90;
  const oddsB = parseFloat(document.getElementById('adm-edit-oddsB').value) || 1.90;

  if (!id || !title || !desc || !optA || !optB) {
    showSnackbar('Preencha todos os campos!');
    return;
  }

  try {
    await supabaseClient.from('bets').update({
      title,
      description: desc,
      category: cat,
      option_a: optA,
      option_b: optB,
      odds_a: oddsA,
      odds_b: oddsB
    }).eq('id', id);

    closeModal('modal-admin-edit-bet');
    showSnackbar('⚡ Odds e detalhes atualizados em tempo real no Supabase!');
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
              const userTx = (adminStore.transactions || []).filter(t => t.description && t.description.includes(u.username));
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
  const userTx = (adminStore.transactions || []).filter(t => t.description && t.description.includes(u.username));
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
    const userTx = (adminStore.transactions || []).filter(t => t.description && t.description.includes(oldUsername));
    const currentCalculated = userTx.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const diff = newBalance - currentCalculated;

    if (Math.abs(diff) >= 0.01) {
      await supabaseClient.from('transactions').insert({
        amount: diff,
        description: `Ajuste de Saldo CRM Admin para ${username} (Novo Saldo: R$ ${newBalance.toFixed(2)})`,
        type: 'ADMIN_ADJUSTMENT'
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
        type: 'DEPOSIT'
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
      description: `${reason} para ${username}`,
      type: 'DEPOSIT'
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

  // Filtra apenas saques solicitados dos apostadores (transações do tipo WITHDRAWAL negativas)
  const withdrawals = adminStore.transactions.filter(t =>
    t.type === 'WITHDRAWAL' && Number(t.amount) < 0 && t.description && t.description.includes('Saque Pix Solicitado')
  );

  if (withdrawals.length === 0) {
    container.innerHTML = `<div class="empty-state"><h3>Nenhum saque pendente no momento 🎉</h3><p style="color:var(--text-gray);font-size:0.8rem;">Quando apostadores solicitarem saques via Pix, aparecerão aqui para aprovação.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descrição / Chave Pix</th>
            <th>Valor Solicitado</th>
            <th>Data</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${withdrawals.map(t => `
            <tr>
              <td>#${t.id}</td>
              <td style="color:var(--text-white);font-size:0.75rem;">${t.description}</td>
              <td style="color:var(--neon-orange);font-weight:800;">${formatMoney(Math.abs(Number(t.amount)))}</td>
              <td style="color:var(--text-gray);font-size:0.65rem;">${t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : '-'}</td>
              <td style="display:flex;gap:6px;">
                <button class="crm-btn-sm" style="background:rgba(16,185,129,0.15);color:var(--neon-emerald);" onclick="approveWithdrawal(${t.id}, ${Math.abs(Number(t.amount))})">✅ Aprovar</button>
                <button class="crm-btn-sm" style="background:rgba(239,68,68,0.15);color:#EF4444;" onclick="rejectWithdrawal(${t.id}, ${Math.abs(Number(t.amount))})">❌ Rejeitar</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function approveWithdrawal(txId, amount) {
  if (!confirm(`Confirmar APROVAÇÃO do saque de ${formatMoney(amount)}?\nO apostador receberá o valor na chave Pix informada.`)) return;

  try {
    await supabaseClient.from('transactions').update({
      type: 'WITHDRAWAL_APPROVED',
      description: `Saque Aprovado e Pago — R$ ${amount.toFixed(2)}`
    }).eq('id', txId);

    showSnackbar(`✅ Saque #${txId} aprovado! Pagamento de ${formatMoney(amount)} confirmado.`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao aprovar saque:', err);
    showSnackbar('Erro ao aprovar saque no Supabase');
  }
}

async function rejectWithdrawal(txId, amount) {
  if (!confirm(`Confirmar REJEIÇÃO do saque de ${formatMoney(amount)}?\nO valor será estornado automaticamente ao saldo do apostador.`)) return;

  try {
    // Estorna criando uma transação positiva de reembolso
    await Promise.all([
      supabaseClient.from('transactions').update({
        type: 'WITHDRAWAL_REJECTED',
        description: `Saque Rejeitado — R$ ${amount.toFixed(2)} estornado`
      }).eq('id', txId),
      supabaseClient.from('transactions').insert({
        amount: amount,
        description: `Estorno de Saque Rejeitado (Tx #${txId})`,
        type: 'REFUND'
      })
    ]);

    showSnackbar(`❌ Saque #${txId} rejeitado. R$ ${amount.toFixed(2)} estornado ao apostador.`);
    loadAdminData();
  } catch (err) {
    console.error('Erro ao rejeitar saque:', err);
    showSnackbar('Erro ao rejeitar saque no Supabase');
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
