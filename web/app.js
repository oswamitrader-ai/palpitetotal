// =============================================
// PalpiteTotal - Supabase & LocalStorage Data Store
// =============================================

const SUPABASE_URL = 'https://xybbhnteetzoccazcdae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

let supabaseClient = null;
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---- DATA STORE (localStorage + Supabase backed) ----
const STORE_KEY = 'palpitetotal_data_v3';

function getDefaultStore() {
  return {
    bets: [],
    userBets: [],
    transactions: [],
    profile: {
      username: '',
      xp: 0,
      level: 1,
      referralCount: 0,
      interests: ''
    },
    posts: [],
    notifications: [],
    nextBetId: 7,
    nextUserBetId: 1,
    nextTxId: 2,
    nextPostId: 4,
    nextNotifId: 1
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

let store = loadStore();

if (!store) {
  store = getDefaultStore();
  seedInitialData();
  seedInitialPosts();
  saveStore(store);
}

// ---- SUPABASE SYNC FUNCTION ----
async function syncFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data: dbBets } = await supabaseClient.from('bets').select('*').order('id', { ascending: true });
    if (dbBets && dbBets.length > 0) {
      store.bets = dbBets.map(b => ({
        id: Number(b.id),
        title: b.title,
        description: b.description,
        category: b.category,
        creatorName: b.creator_name,
        optionA: b.option_a,
        optionB: b.option_b,
        oddsA: Number(b.odds_a),
        oddsB: Number(b.odds_b),
        status: b.status,
        isTrending: b.is_trending,
        totalPool: Number(b.total_pool),
        createdAt: new Date(b.created_at).getTime()
      }));
    }

    const { data: dbUserBets } = await supabaseClient.from('user_bets').select('*').order('id', { ascending: true });
    if (dbUserBets && dbUserBets.length > 0) {
      store.userBets = dbUserBets.map(ub => ({
        id: Number(ub.id),
        betId: Number(ub.bet_id),
        betTitle: ub.bet_title,
        chosenOption: ub.chosen_option,
        chosenOptionText: ub.chosen_option_text,
        amount: Number(ub.amount),
        odds: Number(ub.odds),
        potentialWin: Number(ub.potential_win),
        status: ub.status,
        createdAt: new Date(ub.created_at).getTime()
      }));
    }

    const { data: dbTx } = await supabaseClient.from('transactions').select('*').order('id', { ascending: true });
    if (dbTx && dbTx.length > 0) {
      store.transactions = dbTx.map(t => ({
        id: Number(t.id),
        amount: Number(t.amount),
        description: t.description,
        type: t.type,
        timestamp: new Date(t.timestamp).getTime()
      }));
    }

    const { data: dbPosts } = await supabaseClient.from('posts').select('*').order('id', { ascending: false });
    if (dbPosts && dbPosts.length > 0) {
      store.posts = dbPosts.map(p => ({
        id: Number(p.id),
        username: p.username,
        userLevel: p.user_level,
        userBadge: p.user_badge,
        betId: Number(p.bet_id),
        betTitle: p.bet_title,
        chosenOption: p.chosen_option,
        chosenOptionText: p.chosen_option_text,
        odds: Number(p.odds),
        comment: p.comment,
        likes: p.likes,
        timestamp: new Date(p.timestamp).getTime()
      }));
    }

    if (isLoggedIn && store.profile.username) {
      const { data: dbProfiles } = await supabaseClient.from('profiles').select('*').eq('username', store.profile.username);
      if (dbProfiles && dbProfiles.length > 0) {
        const p = dbProfiles[0];
        store.profile = {
          username: p.username,
          xp: p.xp,
          level: p.level,
          referralCount: p.referral_count,
          interests: p.interests
        };
      }
    }

    saveStore(store);
    renderCurrentTab();
  } catch (err) {
    console.warn('Usando dados do cache local:', err);
  }
}

// Inicia sync com Supabase
syncFromSupabase();

function seedInitialData() {
  // Welcome bonus
  store.transactions.push({
    id: 1, amount: 1000, description: 'Bônus de Boas-Vindas Seguro',
    type: 'DEPOSIT', timestamp: Date.now()
  });

  store.bets = [
    { id: 1, title: 'Será que chove hoje em São Paulo?', description: 'Baseado na previsão oficial do tempo de Congonhas.', category: 'Tempo', creatorName: 'Sistema', optionA: 'Sim', optionB: 'Não', oddsA: 1.80, oddsB: 2.10, status: 'OPEN', isTrending: true, totalPool: 12450, createdAt: Date.now() },
    { id: 2, title: "O próximo debate eleitoral mencionará 'Moeda Única'?", description: 'Palavra exata dita por qualquer candidato na TV aberta.', category: 'Política', creatorName: 'Sistema', optionA: 'Sim', optionB: 'Não', oddsA: 1.95, oddsB: 1.85, status: 'OPEN', isTrending: true, totalPool: 35200, createdAt: Date.now() },
    { id: 3, title: 'O Palmeiras ganhará o clássico paulista neste domingo?', description: 'Partida oficial do Campeonato Brasileiro de Futebol.', category: 'Esportes', creatorName: 'Sistema', optionA: 'Sim', optionB: 'Não', oddsA: 2.15, oddsB: 1.75, status: 'OPEN', isTrending: true, totalPool: 84000, createdAt: Date.now() },
    { id: 4, title: 'O metrô da Linha Amarela atrasará no pico amanhã?', description: 'Definido como interrupção reportada por mais de 5 minutos.', category: 'Dia-a-dia', creatorName: 'Sistema', optionA: 'Sim', optionB: 'Não', oddsA: 1.65, oddsB: 2.30, status: 'OPEN', isTrending: true, totalPool: 5400, createdAt: Date.now() },
    { id: 5, title: 'O preço do pão francês passará de R$ 22/kg na padaria central?', description: 'Acompanhamento da tabela de preços na zona sul.', category: 'Dia-a-dia', creatorName: 'Sistema', optionA: 'Sim', optionB: 'Não', oddsA: 1.90, oddsB: 1.90, status: 'OPEN', isTrending: false, totalPool: 1200, createdAt: Date.now() },
    { id: 6, title: 'Quem levará o prêmio de melhor álbum no festival nacional?', description: 'Escolha oficial do júri técnico do evento.', category: 'Entretenimento', creatorName: 'Sistema', optionA: 'Favorito', optionB: 'Indie Revelação', oddsA: 1.40, oddsB: 3.10, status: 'OPEN', isTrending: true, totalPool: 15800, createdAt: Date.now() }
  ];
}

function seedInitialPosts() {
  store.posts = [
    { id: 1, username: 'VidenteDasOdds', userLevel: 4, userBadge: 'Especialista', betId: 1, betTitle: 'Será que chove hoje em São Paulo?', chosenOption: 'A', chosenOptionText: 'Sim', odds: 1.80, comment: 'Chovendo canivete aqui na Zona Sul! Essa odd 1.80 é dinheiro grátis, confia!', likes: 12, timestamp: Date.now() - 300000 },
    { id: 2, username: 'DebatedorProfissional', userLevel: 3, userBadge: 'Palpiteiro', betId: 2, betTitle: "O próximo debate eleitoral mencionará 'Moeda Única'?", chosenOption: 'A', chosenOptionText: 'Sim', odds: 1.95, comment: 'Sempre trazem pauta econômica no segundo bloco. Vai ser citado de certeza!', likes: 8, timestamp: Date.now() - 600000 },
    { id: 3, username: 'VerdaoDeCoracao', userLevel: 5, userBadge: 'Mestre Supremo', betId: 3, betTitle: 'O Palmeiras ganhará o clássico paulista neste domingo?', chosenOption: 'A', chosenOptionText: 'Sim', odds: 2.15, comment: 'O retrospecto em casa é absurdo e o rival tá poupando elenco. All-in!', likes: 24, timestamp: Date.now() - 1200000 }
  ];
}

// ---- WALLET HELPERS ----
function getBalance() {
  return store.transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

function formatMoney(val) {
  return 'R$ ' + val.toFixed(2).replace('.', ',');
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Agora mesmo';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm atrás';
  return Math.floor(diff / 3600000) + 'h atrás';
}

// ---- XP & LEVELING ----
function getCosmeticPerk(level) {
  if (level === 1) return 'Bronze';
  if (level === 2) return 'Prata';
  if (level === 3) return 'Ouro';
  if (level === 4) return 'Platina (Efeito Brilho)';
  return 'Mestre Neon';
}

function addXp(amount) {
  let p = store.profile;
  p.xp += amount;
  let threshold = p.level * 200;
  while (p.xp >= threshold) {
    p.xp -= threshold;
    p.level += 1;
    threshold = p.level * 200;
    showSnackbar('🎉 SUBIU DE NÍVEL! Nível ' + p.level + ' atingido!');
    addNotification('🎉 Novo Nível: Nível ' + p.level + '!', 'Parabéns! Você desbloqueou a moldura \'' + getCosmeticPerk(p.level) + '\'. Continue palpitando!', 'LEVEL_UP');
  }
  saveStore(store);
}

// ---- CATEGORY HELPERS ----
function getCatClass(cat) {
  const map = { 'Tempo': 'tempo', 'Política': 'politica', 'Dia-a-dia': 'dia', 'Esportes': 'esportes', 'Entretenimento': 'entretenimento' };
  return map[cat] || 'dia';
}

// ---- SNACKBAR ----
let snackTimeout = null;
function showSnackbar(msg) {
  const el = document.getElementById('snackbar');
  el.textContent = msg;
  el.classList.add('show');
  if (snackTimeout) clearTimeout(snackTimeout);
  snackTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

// ---- TAB SWITCHING ----
let currentTab = 'feed';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => {
    const isActive = el.dataset.tab === tab;
    el.classList.toggle('active', isActive);
    el.classList.toggle('gold', isActive && tab === 'manage');
  });

  // Show/hide FAB
  const fab = document.getElementById('fab-btn');
  fab.style.display = ['feed', 'manage', 'social'].includes(tab) ? 'flex' : 'none';

  renderCurrentTab();
}

function renderCurrentTab() {
  updateTopbar();
  switch (currentTab) {
    case 'feed': renderFeed(); break;
    case 'social': renderSocial(); break;
    case 'my_bets': renderMyBets(); break;
    case 'wallet': renderWallet(); break;
  }
}

// ---- TOPBAR UPDATE ----
function updateTopbar() {
  const bal = getBalance();
  document.getElementById('topbar-balance').textContent = formatMoney(bal);
  const p = store.profile;
  document.getElementById('avatar-letter').textContent = p.username.charAt(0).toUpperCase();
  document.getElementById('avatar-level').textContent = p.level;

  const unread = store.notifications.filter(n => !n.isRead).length;
  const badge = document.getElementById('notif-badge');
  if (unread > 0) {
    badge.style.display = 'flex';
    badge.textContent = unread;
  } else {
    badge.style.display = 'none';
  }
}

// ---- QUICK BET ----
let quickBetEnabled = false;
let quickBetAmount = 5;

function toggleQuickBet() {
  quickBetEnabled = document.getElementById('quick-bet-toggle').checked;
  const panel = document.getElementById('quick-bet-panel');
  const amounts = document.getElementById('quick-bet-amounts');
  const desc = document.getElementById('quick-bet-status');
  panel.classList.toggle('active', quickBetEnabled);
  amounts.style.display = quickBetEnabled ? 'grid' : 'none';
  desc.textContent = quickBetEnabled ? 'Ativado • Palpite direto no clique!' : 'Ative para apostar sem abrir popups';
}

function setQuickAmount(val) {
  quickBetAmount = val;
  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.amount) === val);
  });
}

// ---- FEED RENDERING ----
let selectedCategory = 'Todos';

function renderCategoryChips() {
  const cats = ['Todos', 'Tempo', 'Política', 'Dia-a-dia', 'Esportes', 'Entretenimento'];
  const container = document.getElementById('category-chips');
  container.innerHTML = cats.map(c =>
    `<button class="chip${selectedCategory === c ? ' active' : ''}" onclick="selectCategory('${c}')">${c}</button>`
  ).join('');
}

function selectCategory(cat) {
  selectedCategory = cat;
  renderFeed();
}

function renderFeed() {
  renderCategoryChips();
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  const openBets = store.bets.filter(b => b.status === 'OPEN');
  const filtered = openBets.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(query) || b.description.toLowerCase().includes(query);
    const matchCat = selectedCategory === 'Todos' || b.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Trending
  const trending = openBets.filter(b => b.isTrending);
  const trendingSection = document.getElementById('trending-section');
  if (trending.length > 0 && !query && selectedCategory === 'Todos') {
    trendingSection.innerHTML = `
      <div class="trending-header">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>
        <span>Bombando na Comunidade</span>
      </div>
      <div class="trending-scroll">${trending.map(b => renderBetCard(b, true)).join('')}</div>
    `;
  } else {
    trendingSection.innerHTML = '';
  }

  // Feed header
  const header = document.getElementById('feed-list-header');
  header.innerHTML = `<h2 style="font-weight:800;font-size:1.1rem;color:var(--text-white);margin-bottom:12px;">${selectedCategory === 'Todos' ? 'Lista de Palpites Disponíveis' : 'Palpites em: ' + selectedCategory}</h2>`;

  // Feed list
  const list = document.getElementById('feed-list');
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
      <h3>Sem palpites ativos</h3>
      <p>Seja o pioneiro a propor um palpite customizado clicando em 'Novo Palpite'!</p>
    </div>`;
  } else {
    list.innerHTML = filtered.map(b => renderBetCard(b, false)).join('');
  }
}

function renderBetCard(bet, isTrending) {
  const catClass = getCatClass(bet.category);
  return `
    <div class="bet-card${isTrending ? ' trending' : ''}">
      <div class="bet-header">
        <div class="bet-header-left">
          <span class="cat-badge ${catClass}">${bet.category}</span>
          ${bet.isTrending ? '<svg class="trending-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>' : ''}
        </div>
        <span class="pool-text">Pool: R$ ${Math.round(bet.totalPool).toLocaleString('pt-BR')}</span>
      </div>
      <div class="bet-title">${bet.title}</div>
      <div class="bet-desc">${bet.description}</div>
      <div class="bet-odds-row">
        <button class="odds-btn" onclick="handleBetClick(${bet.id},'A')">
          <span class="odds-label">${bet.optionA}</span>
          <span class="odds-value">${bet.oddsA.toFixed(2)}</span>
        </button>
        <button class="odds-btn" onclick="handleBetClick(${bet.id},'B')">
          <span class="odds-label">${bet.optionB}</span>
          <span class="odds-value">${bet.oddsB.toFixed(2)}</span>
        </button>
      </div>
      <div class="bet-footer"><span class="creator-text">Criado por: ${bet.creatorName}</span></div>
    </div>
  `;
}

// ---- BET PLACEMENT ----
let placeBetTarget = null;

function handleBetClick(betId, option) {
  const bet = store.bets.find(b => b.id === betId);
  if (!bet) return;

  if (quickBetEnabled) {
    const bal = getBalance();
    if (bal >= quickBetAmount) {
      executePlaceBet(bet, option, quickBetAmount);
      showSnackbar(`Aposta Rápida: R$ ${quickBetAmount.toFixed(2)} na Opção ${option}!`);
    } else {
      showSnackbar('Saldo insuficiente para Aposta Rápida!');
      openDeposit();
    }
  } else {
    openPlaceBet(bet, option);
  }
}

function openPlaceBet(bet, option) {
  placeBetTarget = { bet, option };
  const optText = option === 'A' ? bet.optionA : bet.optionB;
  const odds = option === 'A' ? bet.oddsA : bet.oddsB;
  document.getElementById('place-bet-title').textContent = bet.title;
  document.getElementById('place-bet-option').textContent = 'Escolha: ' + optText;
  document.getElementById('place-bet-odds').textContent = '@' + odds.toFixed(2);
  document.getElementById('place-bet-balance').textContent = formatMoney(getBalance());
  document.getElementById('place-bet-amount').value = '';
  document.getElementById('place-bet-payout').textContent = 'R$ 0,00';
  document.getElementById('place-bet-error').style.display = 'none';
  openModal('modal-place-bet');
}

function setPlaceBetAmount(val) {
  document.getElementById('place-bet-amount').value = val;
  updatePayout();
}

function setPlaceBetAmountAllIn() {
  document.getElementById('place-bet-amount').value = getBalance().toFixed(2);
  updatePayout();
}

function updatePayout() {
  if (!placeBetTarget) return;
  const odds = placeBetTarget.option === 'A' ? placeBetTarget.bet.oddsA : placeBetTarget.bet.oddsB;
  const amount = parseFloat(document.getElementById('place-bet-amount').value) || 0;
  document.getElementById('place-bet-payout').textContent = formatMoney(amount * odds);

  const err = document.getElementById('place-bet-error');
  if (amount > getBalance()) {
    err.textContent = 'Saldo insuficiente para apostar esse valor!';
    err.style.display = 'block';
  } else {
    err.style.display = 'none';
  }
}

function confirmPlaceBet() {
  if (!placeBetTarget) return;
  const amount = parseFloat(document.getElementById('place-bet-amount').value) || 0;
  const bal = getBalance();
  if (amount <= 0 || amount > bal) {
    showSnackbar('Valor inválido ou saldo insuficiente!');
    return;
  }
  executePlaceBet(placeBetTarget.bet, placeBetTarget.option, amount);
  closeModal('modal-place-bet');
  showSnackbar(`Palpite de R$ ${amount.toFixed(2)} confirmado!`);
}

function executePlaceBet(bet, option, amount) {
  const optText = option === 'A' ? bet.optionA : bet.optionB;
  const odds = option === 'A' ? bet.oddsA : bet.oddsB;
  const potentialWin = amount * odds;

  // Debit
  store.transactions.push({
    id: store.nextTxId++, amount: -amount,
    description: 'Aposta em: ' + bet.title + ' (' + optText + ')',
    type: 'BET_PLACED', timestamp: Date.now()
  });

  // User bet
  store.userBets.push({
    id: store.nextUserBetId++, betId: bet.id, betTitle: bet.title,
    chosenOption: option, chosenOptionText: optText,
    amount, odds, potentialWin, status: 'PENDING', createdAt: Date.now()
  });

  // Update pool
  bet.totalPool += amount;

  addXp(50);
  saveStore(store);
  renderCurrentTab();
}

// ---- CREATE BET ----
function openCreateBet() {
  document.getElementById('create-title').value = '';
  document.getElementById('create-desc').value = '';
  document.getElementById('create-optA').value = 'Sim';
  document.getElementById('create-optB').value = 'Não';
  document.getElementById('create-oddsA').value = '1.90';
  document.getElementById('create-oddsB').value = '1.90';
  openModal('modal-create-bet');
}

function confirmCreateBet() {
  const title = document.getElementById('create-title').value.trim();
  const desc = document.getElementById('create-desc').value.trim();
  const cat = document.getElementById('create-category').value;
  const optA = document.getElementById('create-optA').value.trim();
  const optB = document.getElementById('create-optB').value.trim();
  const oddsA = parseFloat(document.getElementById('create-oddsA').value) || 1.90;
  const oddsB = parseFloat(document.getElementById('create-oddsB').value) || 1.90;

  if (!title || !desc || !optA || !optB) {
    showSnackbar('Preencha todos os campos!');
    return;
  }

  store.bets.push({
    id: store.nextBetId++, title, description: desc, category: cat,
    creatorName: 'Você', optionA: optA, optionB: optB,
    oddsA, oddsB, status: 'OPEN', isTrending: false, totalPool: 0, createdAt: Date.now()
  });

  addXp(100);
  simulateTrendingNewBetAlert(title, cat);
  saveStore(store);
  closeModal('modal-create-bet');
  showSnackbar('Aposta criada com sucesso! Já está no feed.');
  renderCurrentTab();
}

// ---- SOCIAL TAB ----
function renderSocial() {
  const list = document.getElementById('social-list');
  if (store.posts.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <h3>Nenhuma postagem comunitária ainda</h3>
      <p>Faça um palpite no Feed e compartilhe no menu 'Palpites'!</p>
    </div>`;
    return;
  }

  list.innerHTML = store.posts.map(post => {
    const bet = store.bets.find(b => b.id === post.betId);
    const isOpen = bet && bet.status === 'OPEN';
    return `
      <div class="post-card">
        <div class="post-header">
          <div class="post-user">
            <div class="post-avatar">${post.username.charAt(0).toUpperCase()}</div>
            <div>
              <div>
                <span class="post-username">${post.username}</span>
                <span class="post-level-badge">Nív. ${post.userLevel}</span>
              </div>
              <div class="post-badge-text">${post.userBadge}</div>
            </div>
          </div>
          <span class="post-time">${timeAgo(post.timestamp)}</span>
        </div>
        <div class="post-comment">${post.comment}</div>
        <div class="post-slip">
          <div class="post-slip-title">${post.betTitle}</div>
          <div class="post-slip-row">
            <span class="post-slip-choice">Palpite: <strong>${post.chosenOptionText}</strong></span>
            <span class="post-slip-odds">@${post.odds.toFixed(2)}</span>
          </div>
        </div>
        <div class="post-actions">
          <button class="like-btn" onclick="likePost(${post.id})">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
            <span>${post.likes} curtidas</span>
          </button>
          ${isOpen ? `<button class="copy-bet-btn" onclick="handleBetClick(${post.betId},'${post.chosenOption}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copiar Palpite
          </button>` : '<span class="closed-badge">Aposta Encerrada</span>'}
        </div>
      </div>
    `;
  }).join('');
}

function likePost(postId) {
  const post = store.posts.find(p => p.id === postId);
  if (post) {
    post.likes++;
    saveStore(store);
    renderSocial();
  }
}

// ---- MY BETS TAB ----
function renderMyBets() {
  const totalInvested = store.userBets.reduce((s, ub) => s + ub.amount, 0);
  const pendingCount = store.userBets.filter(ub => ub.status === 'PENDING').length;
  const totalWon = store.userBets.filter(ub => ub.status === 'WON').reduce((s, ub) => s + ub.potentialWin, 0);

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Aplicado</div><div class="stat-value">${formatMoney(totalInvested)}</div></div>
    <div class="stat-card"><div class="stat-label">Retorno Ganho</div><div class="stat-value green">${formatMoney(totalWon)}</div></div>
    <div class="stat-card"><div class="stat-label">Pendentes</div><div class="stat-value gold">${pendingCount} slips</div></div>
  `;

  const list = document.getElementById('my-bets-list');
  if (store.userBets.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><rect x="9" y="2" width="6" height="4" rx="1"/></svg>
      <h3>Ainda não palpitou</h3>
      <p>Vá para o Feed principal, selecione um tema e faça suas previsões!</p>
    </div>`;
    return;
  }

  list.innerHTML = store.userBets.map(ub => {
    const statusClass = ub.status === 'PENDING' ? 'pending' : (ub.status === 'WON' ? 'won' : 'lost');
    const statusText = ub.status === 'PENDING' ? 'Pendente' : (ub.status === 'WON' ? 'Ganhou' : 'Perdeu');
    return `
      <div class="user-bet-card">
        <div class="user-bet-header">
          <span class="user-bet-title">${ub.betTitle}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="user-bet-details">
          <div class="detail-col">
            <div class="detail-label">Escolha</div>
            <div class="detail-value">${ub.chosenOptionText} @${ub.odds.toFixed(2)}</div>
          </div>
          <div class="detail-col">
            <div class="detail-label">Apostado</div>
            <div class="detail-value">${formatMoney(ub.amount)}</div>
          </div>
          <div class="detail-col">
            <div class="detail-label">Retorno</div>
            <div class="detail-value" style="color:${ub.status === 'WON' ? 'var(--neon-emerald)' : 'var(--text-white)'}">${formatMoney(ub.potentialWin)}</div>
          </div>
        </div>
        <div class="user-bet-footer">
          <button class="share-btn" onclick="openShare(${ub.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartilhar
          </button>
          <span class="bet-date">Apostado em: ${formatDate(ub.createdAt)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ---- SHARE ----
let shareTarget = null;

function openShare(userBetId) {
  const ub = store.userBets.find(u => u.id === userBetId);
  if (!ub) return;
  shareTarget = ub;
  document.getElementById('share-bet-title').textContent = ub.betTitle;
  document.getElementById('share-comment').value = '';
  openModal('modal-share');
}

function confirmShare() {
  if (!shareTarget) return;
  const comment = document.getElementById('share-comment').value.trim() || 'Deixei meu palpite aqui, quem vem comigo?';
  const p = store.profile;
  store.posts.unshift({
    id: store.nextPostId++, username: p.username, userLevel: p.level,
    userBadge: getCosmeticPerk(p.level), betId: shareTarget.betId,
    betTitle: shareTarget.betTitle, chosenOption: shareTarget.chosenOption,
    chosenOptionText: shareTarget.chosenOptionText, odds: shareTarget.odds,
    comment, likes: 0, timestamp: Date.now()
  });
  addXp(50);
  saveStore(store);
  closeModal('modal-share');
  showSnackbar('Palpite compartilhado no feed da comunidade!');
  renderCurrentTab();
}

// ---- WALLET TAB ----
function renderWallet() {
  document.getElementById('wallet-balance').textContent = formatMoney(getBalance());

  const list = document.getElementById('tx-list');
  if (store.transactions.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <h3>Nenhuma movimentação</h3>
    </div>`;
    return;
  }

  list.innerHTML = [...store.transactions].reverse().map(tx => {
    let iconClass = 'bet';
    let iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>';

    if (tx.type === 'DEPOSIT') {
      iconClass = 'deposit';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>';
    } else if (tx.type === 'WITHDRAWAL') {
      iconClass = 'withdrawal';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>';
    } else if (tx.type === 'BET_WON') {
      iconClass = 'won';
      iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>';
    }

    const sign = tx.amount >= 0 ? '+' : '';
    const amtClass = tx.amount >= 0 ? 'positive' : 'negative';
    return `
      <div class="tx-card">
        <div class="tx-left">
          <div class="tx-icon ${iconClass}">${iconSvg}</div>
          <div>
            <div class="tx-desc">${tx.description}</div>
            <div class="tx-date">${formatDate(tx.timestamp)}</div>
          </div>
        </div>
        <div class="tx-amount ${amtClass}">${sign} ${formatMoney(Math.abs(tx.amount))}</div>
      </div>
    `;
  }).join('');
}

function openDeposit() {
  document.getElementById('deposit-amount').value = '';
  openModal('modal-deposit');
}

function confirmDeposit() {
  const amount = parseFloat(document.getElementById('deposit-amount').value) || 0;
  if (amount <= 0) { showSnackbar('Valor inválido!'); return; }
  store.transactions.push({
    id: store.nextTxId++, amount, description: 'Depósito via Pix Seguro',
    type: 'DEPOSIT', timestamp: Date.now()
  });
  saveStore(store);
  closeModal('modal-deposit');
  showSnackbar(`R$ ${amount.toFixed(2)} depositados com sucesso!`);
  renderCurrentTab();
}

function openWithdraw() {
  document.getElementById('withdraw-available').textContent = formatMoney(getBalance());
  document.getElementById('withdraw-amount').value = '';
  openModal('modal-withdraw');
}

function confirmWithdraw() {
  const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;
  if (amount <= 0) { showSnackbar('Valor inválido!'); return; }
  if (amount > getBalance()) { showSnackbar('Saldo insuficiente!'); return; }
  store.transactions.push({
    id: store.nextTxId++, amount: -amount, description: 'Saque Rápido via Pix Realizado',
    type: 'WITHDRAWAL', timestamp: Date.now()
  });
  saveStore(store);
  closeModal('modal-withdraw');
  showSnackbar(`R$ ${amount.toFixed(2)} sacados com sucesso!`);
  renderCurrentTab();
}

// ---- MANAGE TAB ----
let manageFilter = 'OPEN';

function setManageFilter(filter) {
  manageFilter = filter;
  document.getElementById('manage-open-btn').classList.toggle('active', filter === 'OPEN');
  document.getElementById('manage-resolved-btn').classList.toggle('active', filter === 'RESOLVED');
  renderManage();
}

function renderManage() {
  const openBets = store.bets.filter(b => b.status === 'OPEN');
  const resolvedBets = store.bets.filter(b => b.status !== 'OPEN');
  document.getElementById('manage-open-count').textContent = openBets.length;
  document.getElementById('manage-resolved-count').textContent = resolvedBets.length;

  const target = manageFilter === 'OPEN' ? openBets : resolvedBets;
  const list = document.getElementById('manage-list');

  if (target.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <h3>Sem pendências!</h3>
    </div>`;
    return;
  }

  list.innerHTML = target.map(bet => {
    const catClass = getCatClass(bet.category);
    if (bet.status === 'OPEN') {
      return `
        <div class="bet-card">
          <div class="bet-header">
            <span class="cat-badge ${catClass}">${bet.category}</span>
            <span class="creator-text">Por: ${bet.creatorName}</span>
          </div>
          <div class="bet-title">${bet.title}</div>
          <div style="font-size:0.75rem;color:var(--gold-accent);font-weight:500;margin:8px 0;">Defina a opção vitoriosa:</div>
          <div class="bet-odds-row">
            <button class="resolve-btn" onclick="resolveBet(${bet.id},'A')">${bet.optionA}</button>
            <button class="resolve-btn" onclick="resolveBet(${bet.id},'B')">${bet.optionB}</button>
          </div>
        </div>
      `;
    } else {
      const resolvedText = bet.status === 'RESOLVED_A' ? bet.optionA : bet.optionB;
      return `
        <div class="bet-card">
          <div class="bet-header">
            <span class="cat-badge ${catClass}">${bet.category}</span>
            <span class="creator-text">Por: ${bet.creatorName}</span>
          </div>
          <div class="bet-title">${bet.title}</div>
          <div class="resolved-result">Resultado: Ganhou '${resolvedText}'</div>
        </div>
      `;
    }
  }).join('');
}

function resolveBet(betId, winningOption) {
  const bet = store.bets.find(b => b.id === betId);
  if (!bet) return;

  bet.status = winningOption === 'A' ? 'RESOLVED_A' : 'RESOLVED_B';

  const pending = store.userBets.filter(ub => ub.betId === betId && ub.status === 'PENDING');
  pending.forEach(ub => {
    const won = ub.chosenOption === winningOption;
    ub.status = won ? 'WON' : 'LOST';

    if (won) {
      store.transactions.push({
        id: store.nextTxId++, amount: ub.potentialWin,
        description: 'Prêmio ganho: ' + bet.title,
        type: 'BET_WON', timestamp: Date.now()
      });
      addXp(150);
    }

    // Result notification
    const title = won ? '🏆 Você Ganhou!' : '❌ Resultado Divulgado';
    const msg = won
      ? `Seu palpite em '${ub.betTitle}' foi resolvido! R$ ${ub.potentialWin.toFixed(2)} creditados!`
      : `O resultado para '${ub.betTitle}' não bateu com a sua escolha. Mais sorte no próximo!`;
    addNotification(title, msg, 'RESULT');
  });

  const winText = winningOption === 'A' ? bet.optionA : bet.optionB;
  saveStore(store);
  showSnackbar(`Aposta resolvida como '${winText}'. Saldos atualizados!`);
  renderCurrentTab();
}

// ---- NOTIFICATIONS ----
function addNotification(title, message, type) {
  store.notifications.unshift({
    id: store.nextNotifId++, title, message, type, isRead: false, timestamp: Date.now()
  });
  saveStore(store);
  updateTopbar();
}

function openNotifications() {
  renderNotifications();
  openModal('modal-notifications');
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if (store.notifications.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-gray);padding:20px;font-size:0.85rem;">Sem notificações</p>';
    return;
  }
  list.innerHTML = store.notifications.map(n => `
    <div class="notif-item${n.isRead ? '' : ' unread'}">
      <div class="notif-title">${n.title}</div>
      <div class="notif-message">${n.message}</div>
    </div>
  `).join('');
}

function clearNotifications() {
  store.notifications.forEach(n => n.isRead = true);
  saveStore(store);
  updateTopbar();
  renderNotifications();
}

function simulateClosingNotif() {
  const pending = store.userBets.find(ub => ub.status === 'PENDING');
  const title = pending ? pending.betTitle : 'Será que chove hoje em São Paulo?';
  addNotification('⏳ Aposta fechando em breve!', `Os palpites para '${title}' se encerram em 15 minutos!`, 'CLOSING');
  showSnackbar('🔔 [Push] Aposta prestes a fechar!');
  renderNotifications();
}

function simulateTrendingNotif() {
  const interests = store.profile.interests.split(',').map(i => i.trim());
  const selectedCat = interests[0] || 'Esportes';
  const matchBet = store.bets.find(b => b.category.toLowerCase() === selectedCat.toLowerCase());
  const betTitle = matchBet ? matchBet.title : 'O Palmeiras ganhará o clássico paulista neste domingo?';
  addNotification('🔥 Sugestão de Tendência: ' + selectedCat, `Com base nas suas áreas preferidas, dê seu palpite em: '${betTitle}'.`, 'TRENDING_INTEREST');
  showSnackbar('🔔 [Push] Recomendação de palpite relevante enviada!');
  renderNotifications();
}

function simulateTrendingNewBetAlert(betTitle, category) {
  const interests = store.profile.interests.split(',').map(i => i.trim().toLowerCase());
  if (interests.includes(category.toLowerCase())) {
    addNotification('🔥 Nova Tendência em ' + category + '!', `Um palpite super quente: '${betTitle}'. Venha participar!`, 'TRENDING_INTEREST');
  }
}

// ---- PROFILE ----
function openProfile() {
  const p = store.profile;
  document.getElementById('profile-avatar-large').textContent = p.username.charAt(0).toUpperCase();
  document.getElementById('profile-username').textContent = p.username;
  document.getElementById('profile-frame').textContent = 'Moldura ' + getCosmeticPerk(p.level);

  const threshold = p.level * 200;
  document.getElementById('xp-label').textContent = `XP: ${p.xp} / ${threshold}`;
  document.getElementById('level-label').textContent = `Nível ${p.level}`;
  document.getElementById('xp-bar-fill').style.width = (p.xp / threshold * 100) + '%';

  // Interests
  const allInterests = ['Tempo', 'Política', 'Dia-a-dia', 'Esportes', 'Entretenimento'];
  const selected = p.interests.split(',').map(i => i.trim());
  const grid = document.getElementById('interests-grid');
  grid.innerHTML = allInterests.map(i =>
    `<button class="interest-chip${selected.includes(i) ? ' selected' : ''}" onclick="toggleInterest('${i}')">${i}</button>`
  ).join('');

  openModal('modal-profile');
}

function toggleInterest(interest) {
  let selected = store.profile.interests.split(',').map(i => i.trim()).filter(i => i);
  if (selected.includes(interest)) {
    selected = selected.filter(i => i !== interest);
  } else {
    selected.push(interest);
  }
  store.profile.interests = selected.join(',');
  saveStore(store);
  showSnackbar('Áreas de interesse atualizadas!');
  openProfile(); // Re-render
}

function referFriend() {
  store.profile.referralCount++;
  addXp(300);
  saveStore(store);
  showSnackbar('Link de indicação compartilhado! +300 XP!');
  openProfile(); // Re-render
}

// ---- MODAL HELPERS ----
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ---- INITIAL RENDER ----
renderCurrentTab();

// ---- CAPACITOR NATIVE INTEGRATIONS ----
// Detecta se está rodando dentro do Capacitor (nativo)
function isCapacitor() {
  return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}

// Inicializa plugins nativos quando disponíveis
document.addEventListener('DOMContentLoaded', async () => {
  if (!isCapacitor()) return;

  try {
    // StatusBar - tema escuro
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setBackgroundColor({ color: '#0F172A' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) { /* plugin não disponível */ }

  try {
    // Keyboard - ajustar layout quando teclado abre
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.body.style.paddingBottom = info.keyboardHeight + 'px';
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.style.paddingBottom = '0px';
    });
  } catch (e) { /* plugin não disponível */ }
});

// ---- ANDROID BACK BUTTON ----
// Fecha modais abertos, ou volta para o feed
document.addEventListener('backbutton', (e) => {
  e.preventDefault();
  // Tenta fechar qualquer modal aberto
  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal) {
    openModal.classList.remove('open');
    return;
  }
  // Se não está no feed, volta para o feed
  if (currentTab !== 'feed') {
    switchTab('feed');
    return;
  }
  // Já está no feed sem modais - deixa o app minimizar (comportamento nativo)
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.minimizeApp();
  }
}, false);

// ---- PREVENIR COMPORTAMENTOS INDESEJADOS EM MOBILE ----
// Previne zoom por gesto de pinch
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

// Previne context menu (long press) em elementos não-input
document.addEventListener('contextmenu', (e) => {
  if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
    e.preventDefault();
  }
});

// Scroll para o topo quando troca de tab
const originalSwitchTab = switchTab;
switchTab = function(tab) {
  originalSwitchTab(tab);
  window.scrollTo({ top: 0, behavior: 'instant' });
};

// =============================================
// AUTHENTICATION LOGIC (Login & Cadastro)
// =============================================
let currentAuthTab = 'login';

function openAuthModal(mode = 'login') {
  switchAuthTab(mode);
  openModal('modal-auth');
}

function switchAuthTab(mode) {
  currentAuthTab = mode;
  document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('auth-tab-register').classList.toggle('active', mode === 'register');
  document.getElementById('auth-form-login').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('auth-form-register').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('reg-error').style.display = 'none';
}

async function confirmLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const err = document.getElementById('login-error');

  if (!email || !password) {
    err.textContent = 'Preencha o e-mail e a senha!';
    err.style.display = 'block';
    return;
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        store.profile.username = email.split('@')[0] || store.profile.username;
      } else if (data.user) {
        store.profile.username = data.user.email.split('@')[0];
      }
    } catch (e) {
      store.profile.username = email.split('@')[0];
    }
  } else {
    store.profile.username = email.split('@')[0];
  }

  saveStore(store);
  closeModal('modal-auth');
  showSnackbar(`Bem-vindo de volta, ${store.profile.username}!`);
  renderCurrentTab();
}

async function confirmRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const err = document.getElementById('reg-error');

  if (!username || !email || !password) {
    err.textContent = 'Preencha o nome, e-mail e senha!';
    err.style.display = 'block';
    return;
  }

  const selectedChips = Array.from(document.querySelectorAll('#reg-interests .interest-chip.selected'))
    .map(c => c.textContent);
  const interests = selectedChips.join(',') || 'Tempo,Esportes';

  store.profile.username = username;
  store.profile.interests = interests;

  // Credit Bônus R$1000
  store.transactions.push({
    id: store.nextTxId++,
    amount: 1000,
    description: 'Bônus de Cadastro Novo Apostador',
    type: 'DEPOSIT',
    timestamp: Date.now()
  });

  addXp(150);

  if (supabaseClient) {
    try {
      await supabaseClient.from('profiles').upsert({
        id: 'user_' + Date.now(),
        username,
        xp: store.profile.xp,
        level: store.profile.level,
        referral_count: 0,
        interests
      });
    } catch (e) { /* fallback */ }
  }

  saveStore(store);
  closeModal('modal-auth');
  showSnackbar(`Conta criada com sucesso! R$ 1.000,00 de Bônus adicionados!`);
  renderCurrentTab();
}

// =============================================
// CRM & ADMIN DASHBOARD LOGIC
// =============================================
let pieChartInstance = null;
let barChartInstance = null;

function renderAdminDashboard() {
  const totalVolume = store.bets.reduce((acc, b) => acc + (b.totalPool || 0), 0);
  const totalPayouts = store.userBets
    .filter(ub => ub.status === 'WON')
    .reduce((acc, ub) => acc + (ub.potentialWin || 0), 0);
  const houseProfit = Math.max(0, totalVolume - totalPayouts);
  const activeUsers = store.posts.length > 0 ? new Set(store.posts.map(p => p.username)).size + 1 : 1;

  const volumeEl = document.getElementById('crm-total-volume');
  const profitEl = document.getElementById('crm-house-profit');
  const usersEl = document.getElementById('crm-active-users');
  const payoutsEl = document.getElementById('crm-total-payouts');

  if (volumeEl) volumeEl.textContent = formatMoney(totalVolume);
  if (profitEl) profitEl.textContent = formatMoney(houseProfit);
  if (usersEl) usersEl.textContent = activeUsers;
  if (payoutsEl) payoutsEl.textContent = formatMoney(totalPayouts);

  // Render Charts
  renderAdminCharts();

  // Render CRM Users Table
  renderCRMUsersTable();

  // Render CRM Risk Bets Table
  renderCRMBetsTable();
}

function renderAdminCharts() {
  if (typeof Chart === 'undefined') return;

  // Chart 1: Pie Chart (Rosca) por Categoria
  const catCounts = { 'Tempo': 0, 'Política': 0, 'Esportes': 0, 'Dia-a-dia': 0, 'Entretenimento': 0 };
  store.bets.forEach(b => {
    if (catCounts[b.category] !== undefined) {
      catCounts[b.category] += (b.totalPool || 100);
    }
  });

  const pieCanvas = document.getElementById('categoryPieChart');
  if (pieCanvas) {
    const pieCtx = pieCanvas.getContext('2d');
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(catCounts),
        datasets: [{
          data: Object.values(catCounts),
          backgroundColor: ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#C084FC'],
          borderWidth: 2,
          borderColor: '#1E293B'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#F8FAFC', font: { family: 'Inter', size: 10 } }
          }
        }
      }
    });
  }

  // Chart 2: Bar Chart (Barras) de Finanças
  const barCanvas = document.getElementById('financialBarChart');
  if (barCanvas) {
    const barCtx = barCanvas.getContext('2d');
    if (barChartInstance) barChartInstance.destroy();

    const totalVol = store.bets.reduce((acc, b) => acc + (b.totalPool || 0), 0);
    const payouts = store.userBets.filter(ub => ub.status === 'WON').reduce((acc, ub) => acc + (ub.potentialWin || 0), 0);
    const houseProf = Math.max(0, totalVol - payouts);

    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Volume Total', 'Prêmios Pagos', 'Lucro Casa'],
        datasets: [{
          label: 'Valores (R$)',
          data: [totalVol, payouts, houseProf],
          backgroundColor: ['#10B981', '#F97316', '#F59E0B'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#94A3B8' }, grid: { display: false } },
          y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(148,163,184,0.1)' } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function renderCRMUsersTable() {
  const container = document.getElementById('crm-user-table');
  if (!container) return;

  const users = [
    { username: store.profile.username, level: store.profile.level, balance: getBalance(), role: 'Você (Soberano)', status: 'Ativo' },
    { username: 'VidenteDasOdds', level: 4, balance: 3450.00, role: 'Apostador Pro', status: 'Ativo' },
    { username: 'DebatedorProfissional', level: 3, balance: 1280.00, role: 'Apostador', status: 'Ativo' },
    { username: 'VerdaoDeCoracao', level: 5, balance: 5900.00, role: 'VIP', status: 'Ativo' }
  ];

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Nível</th>
            <th>Saldo</th>
            <th>Perfil</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.username}</strong></td>
              <td><span class="crm-user-badge">Nív. ${u.level}</span></td>
              <td style="color:var(--neon-emerald);font-weight:700;">${formatMoney(u.balance)}</td>
              <td style="color:var(--text-gray);">${u.role}</td>
              <td>
                <button class="crm-btn-sm" onclick="giveBonusUser('${u.username}')">+ Bônus R$100</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function giveBonusUser(username) {
  if (username === store.profile.username) {
    store.transactions.push({
      id: store.nextTxId++,
      amount: 100,
      description: 'Bônus Administrativo CRM',
      type: 'DEPOSIT',
      timestamp: Date.now()
    });
    saveStore(store);
    showSnackbar('Bônus de R$ 100,00 creditado com sucesso!');
    renderCurrentTab();
  } else {
    showSnackbar(`Bônus de R$ 100,00 concedido a ${username}!`);
  }
}

function renderCRMBetsTable() {
  const container = document.getElementById('crm-bets-table');
  if (!container) return;

  container.innerHTML = `
    <div class="crm-table-container">
      <table class="crm-table">
        <thead>
          <tr>
            <th>Palpite</th>
            <th>Categoria</th>
            <th>Pool de Risco</th>
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${store.bets.map(b => `
            <tr>
              <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.title}</td>
              <td><span class="cat-badge ${getCatClass(b.category)}">${b.category}</span></td>
              <td style="color:var(--gold-accent);font-weight:700;">${formatMoney(b.totalPool)}</td>
              <td><span class="status-badge ${b.status === 'OPEN' ? 'pending' : 'won'}">${b.status}</span></td>
              <td>
                ${b.status === 'OPEN' ? `<button class="crm-btn-sm" onclick="switchTab('manage')">Liquidar</button>` : `<span style="font-size:0.6rem;color:var(--text-gray);">Resolvida</span>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
