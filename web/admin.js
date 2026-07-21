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
    loadAdminData();
    showSnackbar('Bem-vindo ao CRM Soberano!');
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
    loadAdminData();
  }
});

// ---- DATA LOADING (Supabase + Fallback) ----
async function loadAdminData() {
  if (!supabaseClient) return;

  try {
    const [betsRes, userBetsRes, txRes, profilesRes, postsRes] = await Promise.all([
      supabaseClient.from('bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('user_bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('transactions').select('*').order('id', { ascending: false }),
      supabaseClient.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('posts').select('*').order('id', { ascending: false })
    ]);

    if (betsRes.data) adminStore.bets = betsRes.data;
    if (userBetsRes.data) adminStore.userBets = userBetsRes.data;
    if (txRes.data) adminStore.transactions = txRes.data;
    if (profilesRes.data) adminStore.profiles = profilesRes.data;
    if (postsRes.data) adminStore.posts = postsRes.data;

    renderAdminCurrentTab();
  } catch (err) {
    console.error('Erro ao carregar dados no CRM Admin:', err);
    showSnackbar('Erro na sincronização com Supabase');
  }
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
    case 'audit': renderAdminAuditView(); break;
  }
}

// ---- DASHBOARD VIEW ----
function renderAdminDashboardView() {
  const totalVolume = adminStore.bets.reduce((acc, b) => acc + Number(b.total_pool || 0), 0);
  const totalPayouts = adminStore.userBets
    .filter(ub => ub.status === 'WON')
    .reduce((acc, ub) => acc + Number(ub.potential_win || 0), 0);
  const houseGGR = Math.max(0, totalVolume - totalPayouts);
  const totalUsers = adminStore.profiles.length || 1;

  document.getElementById('adm-volume').textContent = formatMoney(totalVolume);
  document.getElementById('adm-ggr').textContent = formatMoney(houseGGR);
  document.getElementById('adm-payouts').textContent = formatMoney(totalPayouts);
  document.getElementById('adm-users-count').textContent = totalUsers;

  renderAdminCharts(totalVolume, totalPayouts, houseGGR);
}

function renderAdminCharts(totalVolume, totalPayouts, houseGGR) {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Doughnut / Pie
  const catCounts = { 'Tempo': 0, 'Política': 0, 'Esportes': 0, 'Dia-a-dia': 0, 'Entretenimento': 0 };
  adminStore.bets.forEach(b => {
    if (catCounts[b.category] !== undefined) {
      catCounts[b.category] += Number(b.total_pool || 100);
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
    if (b.status === 'OPEN') {
      return `
        <div class="bet-card" style="margin-bottom:14px;">
          <div class="bet-header">
            <span class="cat-badge ${catClass}">${b.category}</span>
            <span class="pool-text">Pool: ${formatMoney(Number(b.total_pool))}</span>
          </div>
          <div class="bet-title">${b.title}</div>
          <div class="bet-desc">${b.description}</div>
          <div style="font-size:0.75rem;color:var(--gold-accent);font-weight:600;margin:10px 0 6px;">Escolha a opção vencedora para liquidar:</div>
          <div class="bet-odds-row">
            <button class="resolve-btn" onclick="resolveBetAdmin(${b.id}, 'A')">${b.option_a} (@${Number(b.odds_a).toFixed(2)})</button>
            <button class="resolve-btn" onclick="resolveBetAdmin(${b.id}, 'B')">${b.option_b} (@${Number(b.odds_b).toFixed(2)})</button>
          </div>
        </div>
      `;
    } else {
      const winnerText = b.status === 'RESOLVED_A' ? b.option_a : b.option_b;
      return `
        <div class="bet-card" style="margin-bottom:14px;">
          <div class="bet-header">
            <span class="cat-badge ${catClass}">${b.category}</span>
            <span class="pool-text">Pool Final: ${formatMoney(Number(b.total_pool))}</span>
          </div>
          <div class="bet-title">${b.title}</div>
          <div class="resolved-result">VENCEDOR DECLARADO: '${winnerText}'</div>
        </div>
      `;
    }
  }).join('');
}

async function resolveBetAdmin(betId, winningOption) {
  const bet = adminStore.bets.find(b => Number(b.id) === Number(betId));
  if (!bet) return;

  const newStatus = winningOption === 'A' ? 'RESOLVED_A' : 'RESOLVED_B';
  bet.status = newStatus;

  try {
    // Update bet status in Supabase
    await supabaseClient.from('bets').update({ status: newStatus }).eq('id', betId);

    // Update pending user bets
    const pendingUserBets = adminStore.userBets.filter(ub => Number(ub.bet_id) === Number(betId) && ub.status === 'PENDING');

    for (let ub of pendingUserBets) {
      const won = ub.chosen_option === winningOption;
      const ubStatus = won ? 'WON' : 'LOST';

      await supabaseClient.from('user_bets').update({ status: ubStatus }).eq('id', ub.id);

      if (won) {
        await supabaseClient.from('transactions').insert({
          amount: Number(ub.potential_win),
          description: 'Prêmio ganho: ' + bet.title,
          type: 'BET_WON'
        });
      }
    }

    showSnackbar('Aposta liquidada com sucesso!');
    loadAdminData();
  } catch (err) {
    console.error('Erro ao liquidar aposta no CRM:', err);
    showSnackbar('Erro ao liquidar aposta');
  }
}

function openAdminCreateBetModal() {
  document.getElementById('adm-create-title').value = '';
  document.getElementById('adm-create-desc').value = '';
  openModal('modal-admin-create-bet');
}

async function confirmAdminCreateBet() {
  const title = document.getElementById('adm-create-title').value.trim();
  const desc = document.getElementById('adm-create-desc').value.trim();
  const cat = document.getElementById('adm-create-category').value;
  const optA = document.getElementById('adm-create-optA').value.trim();
  const optB = document.getElementById('adm-create-optB').value.trim();
  const oddsA = parseFloat(document.getElementById('adm-create-oddsA').value) || 1.90;
  const oddsB = parseFloat(document.getElementById('adm-create-oddsB').value) || 1.90;

  if (!title || !desc || !optA || !optB) {
    showSnackbar('Preencha todos os campos!');
    return;
  }

  try {
    await supabaseClient.from('bets').insert({
      title,
      description: desc,
      category: cat,
      creator_name: 'Soberano Admin',
      option_a: optA,
      option_b: optB,
      odds_a: oddsA,
      odds_b: oddsB,
      status: 'OPEN',
      is_trending: true,
      total_pool: 0
    });

    closeModal('modal-admin-create-bet');
    showSnackbar('Aposta oficial lançada no sistema!');
    loadAdminData();
  } catch (err) {
    console.error('Erro ao criar aposta:', err);
    showSnackbar('Erro ao criar aposta no Supabase');
  }
}

// ---- GESTÃO DE APOSTADORES VIEW ----
function renderAdminUsersView() {
  const container = document.getElementById('adm-users-table');
  if (!container) return;

  const users = adminStore.profiles.length > 0 ? adminStore.profiles : [
    { username: 'PalpiteiroMestre', level: 1, xp: 150, interests: 'Tempo,Esportes' }
  ];

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>Apostador</th>
            <th>Nível</th>
            <th>XP</th>
            <th>Interesses</th>
            <th>Ações CRM</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.username}</strong></td>
              <td><span class="crm-user-badge">Nív. ${u.level || 1}</span></td>
              <td style="color:var(--gold-accent);font-weight:700;">${u.xp || 0} XP</td>
              <td style="color:var(--text-gray);">${u.interests || 'Geral'}</td>
              <td style="display:flex;gap:6px;">
                <button class="crm-btn-sm" onclick="grantAdminUserBonus('${u.username}', 100)">+ R$100</button>
                <button class="crm-btn-sm" style="color:var(--neon-orange);" onclick="grantAdminUserBonus('${u.username}', 500)">+ R$500 VIP</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function grantAdminUserBonus(username, amount) {
  try {
    await supabaseClient.from('transactions').insert({
      amount: amount,
      description: `Bônus CRM Admin para ${username}`,
      type: 'DEPOSIT'
    });
    showSnackbar(`Bônus de R$ ${amount},00 concedido a ${username}!`);
    loadAdminData();
  } catch (err) {
    showSnackbar('Erro ao conceder bônus');
  }
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
  document.getElementById(id).classList.remove('open');
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
