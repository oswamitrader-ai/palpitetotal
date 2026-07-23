// =============================================
// PalpiteTotal - Supabase & LocalStorage Data Store
// =============================================

const SUPABASE_URL = 'https://xybbhnteetzoccazcdae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

let supabaseClient = null;
if (window.supabase && window.supabase.createClient) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---- AUTHENTICATION STATE ----
let isLoggedIn = localStorage.getItem('palpitetotal_logged_in') === 'true';
let loggedInUser = localStorage.getItem('palpitetotal_username') || '';
if (loggedInUser === 'PalpiteiroMestre') {
  loggedInUser = '';
  localStorage.removeItem('palpitetotal_username');
}

// ---- DATA STORE (localStorage + Supabase backed) ----
const STORE_KEY = 'palpitetotal_data_v2';

function getDefaultStore() {
  return {
    bets: [],
    userBets: [],
    portfolios: [],
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
    nextBetId: 1,
    nextUserBetId: 1,
    nextTxId: 1,
    nextPostId: 1,
    nextNotifId: 1
  };
}

function loadStore() {
  try {
    const cached = localStorage.getItem(STORE_KEY);
    if (cached) return JSON.parse(cached);
  } catch(e) {}
  return null;
}

function saveStore(s) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch(e) {}
}

let store = loadStore() || getDefaultStore();
if (loggedInUser) {
  store.profile.username = loggedInUser;
}

// ---- PLATFORM SETTINGS FROM ADMIN ----
let appSettings = {
  creator_royalty_pct: 3.0,
  house_margin_pct: 8.0,
  xp_create_bet: 100,
  xp_place_bet: 50,
  xp_share_feed: 50,
  xp_referral: 300,
  welcome_bonus: 1000.0
};

// ---- SUPABASE SYNC FUNCTION ----
async function syncFromSupabase() {
  if (!supabaseClient) return;
  try {
    // ALL queries in parallel for maximum speed
    const [settingsRes, betsRes, betOptionsRes, betHistoryRes, catRes, userBetsRes, ordersRes, portfoliosRes, txRes, postsRes, profilesRes, likesRes, commentsRes] = await Promise.all([
      supabaseClient.from('platform_settings').select('*').eq('id', 'default').single(),
      supabaseClient.from('bets').select('*').order('id', { ascending: true }),
      supabaseClient.from('bet_options').select('*').order('id', { ascending: true }),
      supabaseClient.from('bet_history').select('*').order('created_at', { ascending: true }),
      supabaseClient.from('categories').select('*').order('name', { ascending: true }),
      supabaseClient.from('user_bets').select('*').eq('username', store.profile.username).order('id', { ascending: true }),
      supabaseClient.from('orders').select('*').eq('user_id', store.profile.username).eq('status', 'OPEN'),
      supabaseClient.from('user_portfolios').select('*').eq('username', store.profile.username).order('id', { ascending: true }),
      supabaseClient.from('transactions').select('*').eq('username', store.profile.username).order('id', { ascending: true }),
      supabaseClient.from('posts').select('*').order('id', { ascending: false }),
      isLoggedIn && store.profile.username ? supabaseClient.from('profiles').select('*').eq('username', store.profile.username) : Promise.resolve({ data: null }),
      supabaseClient.from('post_likes').select('*').catch(() => ({ data: [] })),
      supabaseClient.from('post_comments').select('*').order('created_at', { ascending: true }).catch(() => ({ data: [] }))
    ]);

    const stData = settingsRes.data;
    if (stData) {
      appSettings = stData;
    }


    const dbBets = betsRes.data;
    const dbBetOptions = betOptionsRes.data || [];
    const dbBetHistory = betHistoryRes.data || [];
    if (catRes.data) store.categories = catRes.data.map(c => c.name);

    if (dbBets && dbBets.length > 0) {
      store.bets = dbBets.map(b => {
        const betOptions = dbBetOptions.filter(o => o.bet_id === b.id);
        const betHistory = dbBetHistory.filter(h => h.bet_id === b.id);

        return {
          id: Number(b.id),
          title: b.title,
          description: b.description,
          category: b.category,
          creatorName: b.creator_name,
          options: betOptions,
          history: betHistory,
          status: b.status,
          isTrending: b.is_trending,
          totalPool: Number(b.total_pool) || 100,
          createdAt: new Date(b.created_at).getTime(),
        // Campos de Palpite de Contagem
        betType: b.bet_type || 'CLASSIC',
        countTarget: Number(b.count_target || 0),
        countSubject: b.count_subject || 'pessoas',
        countLocation: b.count_location || '',
        liveCount: Number(b.live_count || 0),
        countMin: Number(b.count_min || 0),
        countMax: Number(b.count_max || 0),
        cameraLabel: b.camera_label || '',
        cameraUrl: b.camera_url || '',
        expiresAt: b.expires_at ? new Date(b.expires_at).getTime() : null
      };
    });
  }

    const dbUserBets = userBetsRes.data;
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
    } else {
      store.userBets = [];
    }

    // Fetch new AMM Orders and map them to userBets (Pending)
    const dbOrders = ordersRes.data;
    if (dbOrders && dbOrders.length > 0) {
      dbOrders.forEach(order => {
        const bet = store.bets.find(b => Number(b.id) === Number(order.bet_id));
        if (!bet || bet.status !== 'OPEN') return; // Ignore open orders on resolved markets
        const opt = bet.options ? bet.options.find(o => o.option_label === order.option) : null;
        if (!store.userBets.find(u => u.id === order.id + 1000000)) {
           store.userBets.push({
             id: order.id + 1000000,
             betId: bet.id,
             betTitle: bet.title,
             chosenOption: order.option,
             chosenOptionText: opt ? opt.title : order.option,
             amount: Math.round(order.price * order.shares_total),
             odds: order.price > 0 ? (1 / order.price) : 1,
             potentialWin: Math.round(order.shares_total),
             status: 'PENDING',
             createdAt: new Date(order.created_at).getTime()
           });
        }
      });
    }

    const dbPortfolios = portfoliosRes.data;
    if (dbPortfolios && dbPortfolios.length > 0) {
      store.portfolios = dbPortfolios.map(p => ({
        id: Number(p.id),
        bet_id: Number(p.bet_id),
        option_label: p.option_label,
        shares: Number(p.shares)
      }));
    }

    const dbTx = txRes.data;
    if (dbTx && dbTx.length > 0) {
      store.transactions = dbTx.map(t => ({
        id: Number(t.id),
        amount: Number(t.amount),
        description: t.description,
        type: t.type,
        status: t.status || 'COMPLETED',
        timestamp: new Date(t.timestamp).getTime()
      }));
    } else {
      store.transactions = [];
    }

    
    // Populate Likes and Comments
    if (likesRes && likesRes.data) {
      store.postLikes = likesRes.data;
    } else {
      store.postLikes = store.postLikes || [];
    }
    if (commentsRes && commentsRes.data) {
      store.postComments = commentsRes.data;
    } else {
      store.postComments = store.postComments || [];
    }
const dbPosts = postsRes.data;
    if (dbPosts && dbPosts.length > 0) {
      store.posts = dbPosts.map(p => ({
        id: Number(p.id),
        username: p.username,
        userLevel: Number(p.user_level),
        userBadge: p.user_badge,
        betId: Number(p.bet_id),
        betTitle: p.bet_title,
        chosenOption: p.chosen_option,
        chosenOptionText: p.chosen_option_text,
        odds: Number(p.odds),
        comment: p.comment,
        likes: Number(p.likes),
        timestamp: new Date(p.created_at).getTime()
      }));
    } else {
      store.posts = [];
    }

    if (isLoggedIn && store.profile.username) {
      const dbProfiles = profilesRes.data;
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


// Cache do último frame recebido da câmera para cards recém-renderizados
const lastCamFrameStore = {};

// ---- SUPABASE REALTIME — TEMPO REAL ----
let realtimeSubscribed = false;
function initRealtimeSubscriptions() {
  if (realtimeSubscribed) return;
  realtimeSubscribed = true;
  if (!supabaseClient) return;

  // Canal único para todas as tabelas relevantes
  supabaseClient
    .channel('palpitetotal-realtime')

    // Nova aposta ou aposta atualizada (admin cria/edita/resolve)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, async (payload) => {
      const row = payload.new;
      const old = payload.old;
      let isOnlyCounterUpdate = false;

      if (payload.eventType === 'INSERT') {
        const poolA = Number(row.pool_a) || 100;
        const poolB = Number(row.pool_b) || 100;
        const totalP = poolA + poolB;
        const exists = store.bets.find(b => Number(b.id) === Number(row.id));
        if (!exists) {
          store.bets.push({
            id: Number(row.id), title: row.title, description: row.description,
            category: row.category, creatorName: row.creator_name,
            optionA: row.option_a, optionB: row.option_b,
            oddsA: totalP / poolA, oddsB: totalP / poolB,
            poolA: poolA, poolB: poolB,
            status: row.status, isTrending: row.is_trending,
            totalPool: Number(row.total_pool) > 0 ? Number(row.total_pool) : totalP,
            createdAt: new Date(row.created_at).getTime(),
            betType: row.bet_type || 'CLASSIC', countTarget: Number(row.count_target || 0),
            countSubject: row.count_subject || 'pessoas', countLocation: row.count_location || '',
            liveCount: Number(row.live_count || 0), countMin: Number(row.count_min || 0),
            countMax: Number(row.count_max || 0), cameraLabel: row.camera_label || '',
            cameraUrl: row.camera_url || ''
          });
          showSnackbar('🆕 Novo palpite disponível no Feed!');
        }
      } else if (payload.eventType === 'UPDATE') {
        const idx = store.bets.findIndex(b => Number(b.id) === Number(row.id));
        if (idx >= 0) {
          const prevBet = store.bets[idx];
          const oldCount = prevBet.liveCount || 0;
          const newCount = Number(row.live_count || 0);

          const isCamUrlChanged = (prevBet.cameraUrl || '') !== (row.camera_url || '');
          const isStatusChanged = prevBet.status !== row.status;

          const poolA = Number(row.pool_a) || 100;
          const poolB = Number(row.pool_b) || 100;
          const totalP = poolA + poolB;

          store.bets[idx] = {
            ...store.bets[idx],
            title: row.title, description: row.description, category: row.category,
            optionA: row.option_a, optionB: row.option_b,
            oddsA: totalP / poolA, oddsB: totalP / poolB,
            poolA: poolA, poolB: poolB,
            status: row.status, isTrending: row.is_trending,
            totalPool: Number(row.total_pool) > 0 ? Number(row.total_pool) : totalP,
            betType: row.bet_type || 'CLASSIC',
            countTarget: Number(row.count_target || 0),
            countSubject: row.count_subject || 'pessoas',
            countLocation: row.count_location || '',
            liveCount: newCount,
            countMin: Number(row.count_min || 0),
            countMax: Number(row.count_max || 0),
            cameraLabel: row.camera_label || '',
            cameraUrl: row.camera_url || '',
            expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null
          };

          // Anima atualização do contador em tempo real
          if (newCount !== oldCount && prevBet.betType === 'COUNTER') {
            animateCounterUpdate(Number(row.id), oldCount, newCount);
            if (!isCamUrlChanged && !isStatusChanged) {
              isOnlyCounterUpdate = true;
            }
            // Confete quando atinge a meta
            if (oldCount < Number(row.count_target) && newCount >= Number(row.count_target)) {
              launchConfetti(60);
              showSnackbar(`🎉 Meta atingida! ${newCount.toLocaleString('pt-BR')} ${row.count_subject || 'registros'}!`);
            }
          }

          if ((row.status === 'CLOSED' || row.status === 'RESOLVED_A' || row.status === 'RESOLVED_B') && old && old.status === 'OPEN') {
            showSnackbar(`⚖️ Resultado do palpite "${row.title}" foi divulgado!`);
            setTimeout(() => syncFromSupabase(), 800);
          } else if (row.status === 'EXPIRED' && old && old.status === 'OPEN') {
            showSnackbar(`⏰ Aposta "${row.title}" expirou! Valores serão reembolsados.`);
            addNotification('⏰ Aposta Expirada', `"${row.title}" encerrou por tempo. Seu valor foi reembolsado.`, 'SYSTEM');
            setTimeout(() => syncFromSupabase(), 800);
          } else if (row.bet_type !== 'COUNTER' && old && (row.odds_a !== old.odds_a || row.odds_b !== old.odds_b)) {
            showSnackbar(`📊 Odds atualizadas: "${row.title}"`);
          }
        }
      } else if (payload.eventType === 'DELETE') {
        store.bets = store.bets.filter(b => Number(b.id) !== Number(old.id));
      }

      saveStore(store);
      if (!isOnlyCounterUpdate) {
        renderCurrentTab();
      }
    })

    // Nova transação (depósito/saque/prêmio creditado pelo admin)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, (payload) => {
      const row = payload.new;
      const exists = store.transactions.find(t => Number(t.id) === Number(row.id));
      if (!exists) {
        store.transactions.push({
          id: Number(row.id),
          amount: Number(row.amount),
          description: row.description,
          type: row.type,
          timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        });

        if (row.type === 'DEPOSIT' || row.type === 'REFUND') {
          showSnackbar(`💰 ${row.description} — ${formatMoney(Math.abs(Number(row.amount)))} creditados!`);
        }

        saveStore(store);
        renderCurrentTab();
      }
    })

    // Atualização em user_bets (admin resolve aposta → WON / LOST)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_bets' }, async (payload) => {
      const row = payload.new;
      const idx = store.userBets.findIndex(ub => Number(ub.id) === Number(row.id));

      if (idx >= 0) {
        const prev = store.userBets[idx];
        store.userBets[idx] = {
          ...prev,
          status: row.status,
          potentialWin: Number(row.potential_win)
        };
        if (row.status === 'WON' && prev.status !== 'WON') {
          showSnackbar(`🏆 Você GANHOU! R$ ${Number(row.potential_win).toFixed(2)} creditados!`);
          addNotification('🏆 Você Ganhou!', `Seu palpite foi vencedor! R$ ${Number(row.potential_win).toFixed(2)} creditados.`, 'RESULT');
        } else if (row.status === 'LOST' && prev.status !== 'LOST') {
          showSnackbar('😔 Resultado divulgado — seu palpite não foi o vencedor dessa vez.');
          addNotification('😔 Resultado Divulgado', `Infelizmente seu palpite não foi o vencedor: ${prev.betTitle}`, 'RESULT');
        } else if (row.status === 'REFUNDED' && prev.status !== 'REFUNDED') {
          showSnackbar(`💸 Reembolso de R$ ${Number(row.potential_win).toFixed(2)} creditado! Aposta expirada.`);
          addNotification('💸 Reembolso', `R$ ${Number(row.potential_win).toFixed(2)} devolvidos — "${prev.betTitle}" expirou.`, 'SYSTEM');
        }
        saveStore(store);
        renderCurrentTab();
      } else {
        // Registro não está no store local — faz sync completo para puxar do banco
        await syncFromSupabase();
      }
    })

    // Novo post na comunidade (outro usuário publicou)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
      const row = payload.new;
      const exists = store.posts.find(p => Number(p.id) === Number(row.id));
      if (!exists) {
        store.posts.unshift({
          id: Number(row.id), username: row.username,
          userLevel: row.user_level, userBadge: row.user_badge,
          betId: row.bet_id ? Number(row.bet_id) : null,
          betTitle: row.bet_title, chosenOption: row.chosen_option,
          chosenOptionText: row.chosen_option_text, odds: Number(row.odds || 1.90),
          comment: row.comment, likes: row.likes || 0,
          timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now()
        });

        if (row.username !== store.profile.username) {
          showSnackbar(`💬 ${row.username} publicou no Feed Social!`);
        }

        saveStore(store);
        if (currentTab === 'social') renderCurrentTab();
      }
    })

    // Transmissão ao vivo de câmera (frames de smartphone/webcam)
    .on('broadcast', { event: 'cam_frame' }, (payload) => {
      const { betId, frameData } = payload.payload || {};
      if (betId && frameData) {
        lastCamFrameStore[betId] = frameData;

        // Atualiza TODAS as instâncias do card dessa bet no DOM
        document.querySelectorAll(`[id="cam-feed-img-${betId}"]`).forEach(img => {
          img.src = frameData;
          img.style.display = 'block';
          img.style.zIndex = '5';
        });
        document.querySelectorAll(`[id="cam-placeholder-${betId}"]`).forEach(p => {
          p.style.display = 'none';
        });
        document.querySelectorAll(`[id="cam-status-badge-${betId}"]`).forEach(b => {
          b.innerHTML = `<div class="camera-status-dot live"></div> REC ● TRANSMISSÃO AO VIVO`;
          b.style.color = '#EF4444';
        });
      }
    })

    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('✅ PalpiteTotal Realtime conectado ao Supabase!');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('⚠️ Realtime desconectado:', status, err);
        // Re-sync completo para garantir dados atualizados
        setTimeout(() => syncFromSupabase(), 3000);
      } else if (status === 'CLOSED') {
        console.log('🔌 Canal Realtime fechado — tentando reconectar...');
        setTimeout(() => initRealtimeSubscriptions(), 5000);
      }
    });
}

function setAppVisibility(visible) {
  const main = document.querySelector('.main-content');
  const topbar = document.querySelector('.topbar');
  const nav = document.querySelector('.bottom-nav');
  if (main) main.style.display = visible ? 'block' : 'none';
  if (topbar) topbar.style.display = visible ? 'flex' : 'none';
  if (nav) nav.style.display = visible ? 'flex' : 'none';
}

async function initApp() {
  if (loggedInUser) {
    const avatarLetter = document.getElementById('avatar-letter');
    if (avatarLetter) avatarLetter.textContent = loggedInUser.charAt(0).toUpperCase();
  }
  if (!isLoggedIn) {
    setAppVisibility(false);
    openAuthModal('login');
    setTimeout(() => {
      const closeBtn = document.querySelector('#modal-auth .modal-close');
      if (closeBtn) closeBtn.style.display = 'none';
    }, 50);
    return;
  }
  
    setAppVisibility(true);
  switchTab('feed');
  renderCurrentTab(); // Show local cached data INSTANTLY!
  
  // Sync from Supabase in background - UI already visible with cached data
  syncFromSupabase().then(() => {
    renderCurrentTab();
    initRealtimeSubscriptions();
  }).catch(err => {
    console.warn('Sync error:', err);
    initRealtimeSubscriptions();
  });
}

// Inicializa a aplicação (movido para o final do arquivo)
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
  return store.transactions
    .filter(tx => !(tx.type === 'DEPOSIT' && tx.status === 'PENDING'))
    .filter(tx => !(tx.type === 'DEPOSIT' && tx.status === 'REJECTED'))
    .filter(tx => !(tx.type === 'WITHDRAWAL' && tx.status === 'REJECTED'))
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function formatMoney(val) {
  return 'R$ ' + val.toFixed(2).replace('.', ',');
}


function formatTimeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Agora';
  if (m < 60) return m + 'm';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  return d + 'd';
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
  if (fab) {
    fab.style.display = ['feed', 'manage', 'social'].includes(tab) ? 'flex' : 'none';
  }

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
  const balEl = document.getElementById('topbar-balance');
  const authNavBtn = document.getElementById('auth-nav-btn');
  const avatarRing = document.getElementById('avatar-ring');
  const p = store.profile;

  if (isLoggedIn) {
    if (balEl) balEl.textContent = formatMoney(bal);
    if (authNavBtn) authNavBtn.style.display = 'none';
    if (avatarRing) {
      avatarRing.style.display = 'flex';
      document.getElementById('avatar-letter').textContent = p.username.charAt(0).toUpperCase();
      document.getElementById('avatar-level').textContent = p.level;
    }
  } else {
    if (balEl) balEl.textContent = 'Entrar';
    if (authNavBtn) authNavBtn.style.display = 'flex';
    if (avatarRing) avatarRing.style.display = 'none';
  }

  const unread = store.notifications.filter(n => !n.isRead).length;
  const badge = document.getElementById('notif-badge');
  if (unread > 0 && isLoggedIn) {
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
  const dynamicCats = store.categories || ['Tempo', 'Política', 'Dia-a-dia', 'Esportes', 'Entretenimento'];
  const cats = ['Todos', '📹 Ao Vivo', ...dynamicCats.filter(c => c !== '📹 Ao Vivo')];
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
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    const val = searchInput.value.trim();
    const currentUsername = (store?.profile?.username || '').toLowerCase();
    const lowerVal = val.toLowerCase();
    if (val.includes('@') || lowerVal === currentUsername || lowerVal.includes('oswamitrader')) {
      searchInput.value = '';
    }
  }
  const query = (searchInput?.value || '').toLowerCase().trim();
  const openBets = store.bets.filter(b => b.status === 'OPEN');

  // Separação em dois grupos distintos para evitar qualquer duplicidade no feed:
  // 1. Apostas de Contagem Ao Vivo (COUNTER)
  // 2. Apostas Clássicas (CLASSIC)
  const counterBets = openBets.filter(b => b.betType === 'COUNTER');
  const classicBets = openBets.filter(b => b.betType !== 'COUNTER');

  // RENDERIZAÇÃO DA SEÇÃO EXCLUSIVA DE TRANSMISSÕES AO VIVO
  const trendingSection = document.getElementById('trending-section');
  const showLiveSection = (selectedCategory === 'Todos' || selectedCategory === '📹 Ao Vivo' || selectedCategory === 'Contagem');

  const filteredCounterBets = counterBets.filter(b => {
    return b.title.toLowerCase().includes(query) || b.description.toLowerCase().includes(query) || (b.countLocation || '').toLowerCase().includes(query);
  });

  if (showLiveSection && filteredCounterBets.length > 0) {
    trendingSection.innerHTML = `
      <div style="margin-bottom:24px;">
        <div class="trending-header" style="margin-bottom:14px;display:flex;align-items:center;gap:8px;">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" style="color:#A78BFA;"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>
          <span style="color:#A78BFA;font-weight:900;font-size:1.05rem;">📹 Transmissões & Contagem Ao Vivo</span>
        </div>
        ${filteredCounterBets.map(b => renderCounterBetCard(b)).join('')}
      </div>
    `;
  } else {
    trendingSection.innerHTML = '';
  }

  // RENDERIZAÇÃO DA LISTA DE PALPITES CLÁSSICOS
  const filteredClassic = classicBets.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(query) || b.description.toLowerCase().includes(query);
    const matchCat = selectedCategory === 'Todos' || b.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Feed header
  const header = document.getElementById('feed-list-header');
  if (selectedCategory === '📹 Ao Vivo') {
    header.innerHTML = filteredClassic.length > 0 ? `<h2 style="font-weight:800;font-size:1.1rem;color:var(--text-white);margin-bottom:12px;">Outros Palpites em Destaque</h2>` : '';
  } else {
    header.innerHTML = `<h2 style="font-weight:800;font-size:1.1rem;color:var(--text-white);margin-bottom:12px;">${selectedCategory === 'Todos' ? 'Lista de Palpites Disponíveis' : 'Palpites em: ' + selectedCategory}</h2>`;
  }

  // Feed list
  const list = document.getElementById('feed-list');
  if (filteredClassic.length === 0) {
    if (selectedCategory === '📹 Ao Vivo' && filteredCounterBets.length > 0) {
      list.innerHTML = '';
    } else {
      list.innerHTML = `<div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>
        <h3>Sem palpites ativos nesta seção</h3>
        <p>Seja o pioneiro a propor um palpite customizado clicando em 'Novo Palpite'!</p>
      </div>`;
    }
  } else {
    list.innerHTML = filteredClassic.map(b => renderBetCard(b, false)).join('');
  }
  
  // Renderiza os gráficos do Chart.js após inserir o HTML
  renderAllCharts(filteredClassic);
}

function renderAllCharts(bets) {
  if (typeof Chart === 'undefined') return;

  bets.forEach(bet => {
    const canvas = document.getElementById(`chart-${bet.id}`);
    if (!canvas) return;

    if (!bet.history || bet.history.length === 0) return;

    const ctx = canvas.getContext('2d');
    const datasets = [];
    const colors = ['#10B981', '#EF4444', '#FBBF24', '#3B82F6', '#A855F7'];
    
    if (bet.options) {
      bet.options.forEach((opt, idx) => {
        const hist = bet.history.filter(h => h.option_label === opt.option_label).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
        
        if (hist.length > 0) {
          const plotData = hist.map(h => ({ x: new Date(h.created_at).getTime(), y: (100 / (h.odds || 1)) }));
          if (plotData.length === 1) {
             plotData.unshift({ x: plotData[0].x - 3600000, y: plotData[0].y });
          }
          
          datasets.push({
            label: opt.title,
            data: plotData,
            borderColor: colors[idx % colors.length],
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 150);
              gradient.addColorStop(0, colors[idx % colors.length] + '40');
              gradient.addColorStop(1, colors[idx % colors.length] + '00');
              return gradient;
            },
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 1.5,
            pointHitRadius: 25,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: colors[idx % colors.length],
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2
          });
        }
      });
    }

    if (datasets.length > 0) {
      new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              display: true, 
              position: 'top', 
              labels: { color: 'rgba(255,255,255,0.7)', usePointStyle: true, boxWidth: 8, font: { size: 10 } } 
            },
            tooltip: {
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleColor: 'rgba(148, 163, 184, 1)',
              titleFont: { size: 11 },
              bodyFont: { size: 13, weight: 'bold' },
              padding: 12,
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  const prob = context.parsed.y;
                  const odd = (100 / prob).toFixed(2);
                  return `${context.dataset.label}: ${prob.toFixed(1)}% (Odd ${odd})`;
                }
              }
            }
          },
          scales: {
            x: { 
              type: 'time', 
              display: false 
            },
            y: { 
              display: true, 
              min: 0, 
              max: 100,
              grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
              ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 }, callback: function(value) { return value + '%' } }
            }
          },
          interaction: { mode: 'index', intersect: false }
        }
      });
    }
  });
}

function renderBetCard(bet, isTrending) {
  if (bet.betType === 'COUNTER') return renderCounterBetCard(bet);

  const catClass = getCatClass(bet.category);
  
  let buttonsHtml = '';
  let probBarHtml = '';
  
  if (bet.options && bet.options.length > 0) {
    const colors = ['buy-yes', 'buy-no', 'buy-opt3', 'buy-opt4', 'buy-opt5'];
    buttonsHtml = bet.options.map((opt, i) => {
      const prob = opt.current_odds > 0 ? Math.round(100 / opt.current_odds) : 0;
      const c = colors[i % colors.length];
      const extraStyle = i >= 2 ? 'background:rgba(255,255,255,0.05);color:var(--text-white);border:1px solid rgba(255,255,255,0.2);' : '';
      return `
        <button class="odds-btn ${c}" onclick="handleBetClick(${bet.id},'${opt.option_label}')" style="${extraStyle}">
          <span class="odds-label">${opt.title}</span>
          <span class="odds-value">${prob}%</span>
        </button>
      `;
    }).join('');
    
    if (bet.options.length === 2) {
       const pA = Math.round(100 / bet.options[0].current_odds);
       probBarHtml = `<div class="market-bar-container"><div class="market-bar-fill" style="width: ${pA}%;"></div></div>`;
    }
  } else {
    buttonsHtml = `<div style="color:var(--text-gray); font-size:0.8rem;">Opções indisponíveis</div>`;
  }

  return `
    <div class="bet-card${isTrending ? ' trending' : ''}">
      <div class="bet-header">
        <div class="bet-header-left">
          <span class="cat-badge ${catClass}">${bet.category}</span>
          ${bet.isTrending ? '<svg class="trending-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/></svg>' : ''}
        </div>
      </div>
      <div class="bet-title">${bet.title}</div>
      ${bet.description.length > 80 ? `
      <div id="desc-mob-${bet.id}" class="bet-desc" style="max-height: 40px; overflow: hidden; position: relative; transition: max-height 0.3s ease;">
        ${bet.description}
      </div>
      <button type="button" onclick="
        const d = document.getElementById('desc-mob-${bet.id}');
        if(d.style.maxHeight === '40px') { d.style.maxHeight = '1000px'; this.innerText = 'Ler menos'; }
        else { d.style.maxHeight = '40px'; this.innerText = 'Ler mais'; }
      " style="background:none;border:none;color:var(--gold-accent);font-size:0.75rem;padding:0;cursor:pointer;margin-bottom:8px;font-weight:600;">Ler mais</button>
      ` : `<div class="bet-desc">${bet.description}</div>`}
      
      <!-- Volatility Chart -->
      <div style="margin-top: 10px; margin-bottom: 4px;">
        <span style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-gray); font-weight: 700;">📊 Probabilidade no Tempo <span style="font-size: 0.55rem; font-weight: 400; opacity: 0.7; text-transform: none;">(Toque p/ detalhes)</span></span>
      </div>
      <div style="height: 140px; margin-bottom: 16px; width: 100%;">
         <canvas id="chart-${bet.id}" class="volatility-chart"></canvas>
      </div>

      ${probBarHtml}
      
      <div class="bet-odds-row" style="margin-top:12px; flex-wrap:wrap;">
        ${buttonsHtml}
      </div>
      
      <div class="bet-footer" style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <span class="pool-text" style="color:var(--text-gray);font-size:0.75rem;">💰 Volume: R$ ${Math.round(bet.totalPool).toLocaleString('pt-BR')}</span>
        ${bet.expiresAt ? (() => {
          const diff = bet.expiresAt - Date.now();
          if (diff > 0) {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const urgentColor = diff < 3600000 ? '#EF4444' : 'var(--gold-accent)';
            return `<span id="countdown-${bet.id}" data-expires="${bet.expiresAt}" style="font-size:0.7rem;font-weight:700;color:${urgentColor};">⏰ ${h}h ${m}min</span>`;
          } else {
            return `<span id="countdown-${bet.id}" data-expires="${bet.expiresAt}" style="font-size:0.7rem;font-weight:700;color:#EF4444;">⏰ Encerrando...</span>`;
          }
        })() : ''}
      </div>
    </div>
  `;
}

// ---- COUNTER BET RENDERING — GAMIFICADO ----

const activePeerConnections = {};

function connectWebRTCStream(betId) {
  if (typeof Peer === 'undefined' || activePeerConnections[betId]) return;
  try {
    const peer = new Peer(null, { debug: 0 });
    const targetPeerId = `palpitetotal-cam-${betId}`;

    peer.on('open', () => {
      const call = peer.call(targetPeerId, null);
      if (call) {
        call.on('stream', (remoteStream) => {
          activePeerConnections[betId] = { peer, call, stream: remoteStream };
          document.querySelectorAll(`.cam-webrtc-video-${betId}`).forEach(vid => {
            vid.srcObject = remoteStream;
            vid.style.display = 'block';
            vid.style.zIndex = '10';
          });
          document.querySelectorAll(`[id="cam-placeholder-${betId}"]`).forEach(p => p.style.display = 'none');
          document.querySelectorAll(`[id="cam-status-badge-${betId}"]`).forEach(b => {
            b.innerHTML = `<div class="camera-status-dot live"></div> REC ● TRANSMISSÃO AO VIVO (WEBRTC)`;
            b.style.color = '#EF4444';
          });
        });
      }
    });
  } catch (err) {
    console.warn('Erro ao conectar WebRTC no mobile:', err);
  }
}

function getCameraMediaHTML(url) {
  if (!url) {
    return `<img src="https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.7) contrast(1.1);" />`;
  }

  // Detecção de YouTube Live ou Vídeo (youtube.com/live/ID, watch?v=ID, youtu.be/ID, embed/ID)
  const ytMatch = url.match(/(?:youtube\.com\/(?:live\/|watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&enablejsapi=1&playsinline=1" style="position:absolute;inset:0;width:100%;height:100%;border:none;object-fit:cover;z-index:2;pointer-events:none;" allow="autoplay; encrypted-media"></iframe>`;
  }

  // Arquivos de vídeo direto (MP4, WebM, OGG, m3u8 stream ou data:video)
  if (url.includes('.mp4') || url.includes('.webm') || url.includes('.m3u8') || url.startsWith('data:video')) {
    return `<video src="${url}" autoplay loop muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:2;"></video>`;
  }

  // Câmera IP / MJPEG Stream ou imagem
  return `<img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.7) contrast(1.1);" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80';" />`;
}

function renderCounterBetCard(bet) {
  const pct = bet.countTarget > 0 ? Math.min(100, Math.round((bet.liveCount / bet.countTarget) * 100)) : 0;
  const overshot = bet.liveCount >= bet.countTarget && bet.countTarget > 0;
  const isOpen = bet.status === 'OPEN';
  const icon = bet.countSubject === 'veiculos' ? '🚗' : (bet.countSubject === 'carros' ? '🚗' : '🚶');
  const subjectLabel = bet.countSubject || 'pessoas';

  const hasCamUrl = Boolean(bet.cameraUrl && bet.cameraUrl.trim() !== '');
  const cachedFrame = !hasCamUrl ? lastCamFrameStore[bet.id] : null;
  setTimeout(() => connectWebRTCStream(bet.id), 200);

  return `
    <div class="counter-bet-card" id="counter-card-${bet.id}">
      <div class="counter-card-header">
        <div class="counter-type-badge">
          <div class="counter-live-dot"></div>
          📹 Contagem Ao Vivo
        </div>
        <div class="counter-status-ring ${isOpen ? 'live' : 'closed'}">
          ${isOpen ? '● Aberto' : '✓ Encerrado'}
        </div>
      </div>
      <div class="counter-card-body">
        <div class="counter-card-title">${bet.title}</div>
        <div class="counter-card-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          ${bet.countLocation || 'Local não especificado'}
          ${bet.cameraLabel ? `&nbsp;• 📷 ${bet.cameraLabel}` : ''}
        </div>

        <!-- CAMERA LIVE FEED PLAYER -->
        <div class="camera-feed-wrapper">
          <div class="camera-status-badge" id="cam-status-badge-${bet.id}">
            <div class="camera-status-dot live"></div> REC ● TRANSMISSÃO AO VIVO
          </div>
          <div class="camera-scan-overlay">
            <div class="camera-scan-line"></div>
            <div class="camera-corner tl"></div><div class="camera-corner tr"></div>
            <div class="camera-corner bl"></div><div class="camera-corner br"></div>
          </div>
          
          <!-- LINHA INTELIGENTE DE DETECÇÃO AUTOMÁTICA DA IA -->
          <div class="smart-detection-line" id="smart-line-${bet.id}" style="top:${bet.countMin || 52}%;transform:rotate(${bet.countMax || 0}deg);"></div>

          <video class="cam-webrtc-video-${bet.id}" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none;position:absolute;inset:0;z-index:10;"></video>
          <img id="cam-feed-img-${bet.id}" src="${cachedFrame || ''}" style="width:100%;height:100%;object-fit:cover;display:${cachedFrame ? 'block' : 'none'};position:absolute;inset:0;z-index:5;" />
          <div class="camera-offline-placeholder" id="cam-placeholder-${bet.id}" style="display:${cachedFrame ? 'none' : 'flex'};">
            ${getCameraMediaHTML(bet.cameraUrl)}
          </div>
        </div>

        <div class="counter-display-wrapper">
          <div class="counter-subject-label">${icon} ${subjectLabel} contados</div>
          <div class="counter-number-display" id="counter-num-${bet.id}">${(bet.liveCount || 0).toLocaleString('pt-BR')}</div>
          <div class="counter-target-label">Meta: <strong>${(bet.countTarget || 0).toLocaleString('pt-BR')}</strong></div>
        </div>

        <div class="counter-progress-track">
          <div class="counter-progress-fill${overshot ? ' overshot' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="counter-progress-labels">
          <span>0</span>
          <span style="color:${pct >= 80 ? '#FDE047' : 'inherit'};font-weight:${pct >= 80 ? '700' : '400'};">${pct}% da meta</span>
          <span>${(bet.countTarget || 0).toLocaleString('pt-BR')}</span>
        </div>

        ${isOpen ? `
        <div class="counter-bet-options">
          <div class="counter-option-btn" onclick="handleBetClick(${bet.id},'A')">
            <div class="counter-option-label">ACIMA de</div>
            <div class="counter-option-value">${(bet.countMax || bet.countTarget).toLocaleString('pt-BR')}</div>
            <div class="counter-option-odds">${bet.oddsA.toFixed(2)}</div>
          </div>
          <div class="counter-option-btn" onclick="handleBetClick(${bet.id},'B')">
            <div class="counter-option-label">ABAIXO de</div>
            <div class="counter-option-value">${(bet.countMin || bet.countTarget).toLocaleString('pt-BR')}</div>
            <div class="counter-option-odds">${bet.oddsB.toFixed(2)}</div>
          </div>
        </div>
        ` : `
        <div style="text-align:center;padding:12px;color:var(--text-gray);font-size:0.8rem;">
          ⚖️ Contagem encerrada — aguardando resultado oficial
        </div>
        `}
      </div>
      <div class="counter-card-footer">
        <div class="counter-pool-info">Pool total: <strong>${formatMoney(bet.totalPool || 0)}</strong></div>
        ${bet.expiresAt ? (() => {
          const diff = bet.expiresAt - Date.now();
          if (diff > 0) {
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const urgentColor = diff < 3600000 ? '#EF4444' : 'var(--gold-accent)';
            return `<span id="countdown-${bet.id}" data-expires="${bet.expiresAt}" style="font-size:0.7rem;font-weight:700;color:${urgentColor};">⏰ ${h}h ${m}min</span>`;
          } else {
            return `<span id="countdown-${bet.id}" data-expires="${bet.expiresAt}" style="font-size:0.7rem;font-weight:700;color:#EF4444;">⏰ Encerrando...</span>`;
          }
        })() : `<span style="font-size:0.65rem;color:var(--text-gray);">Criado por ${bet.creatorName}</span>`}
      </div>
    </div>
  `;
}

// Anima a atualização do contador ao receber novo valor via Realtime
function animateCounterUpdate(betId, oldCount, newCount) {
  const numEls = document.querySelectorAll(`[id="counter-num-${betId}"]`);
  const overlayNums = document.querySelectorAll(`[id="cam-overlay-num-${betId}"]`);
  if (numEls.length === 0) return;

  const diff = newCount - oldCount;
  const duration = 800;
  const steps = 20;
  const stepVal = diff / steps;
  let current = oldCount;
  let step = 0;

  numEls.forEach(el => {
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 400);
  });

  // Dispara o efeito visual da Linha Inteligente de Detecção da IA
  const smartLineEls = document.querySelectorAll(`[id="smart-line-${betId}"]`);
  smartLineEls.forEach(line => {
    line.classList.add('flash');
    const popup = document.createElement('div');
    popup.className = 'detection-popup-badge';
    popup.innerHTML = `⚡ +${diff > 0 ? diff : 1} DETECTADO!`;
    line.appendChild(popup);

    setTimeout(() => {
      line.classList.remove('flash');
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 850);
  });

  const interval = setInterval(() => {
    step++;
    current += stepVal;
    const formatted = Math.round(current).toLocaleString('pt-BR');
    numEls.forEach(el => el.textContent = formatted);
    overlayNums.forEach(el => el.textContent = formatted);
    if (step >= steps) {
      clearInterval(interval);
      const finalFormatted = newCount.toLocaleString('pt-BR');
      numEls.forEach(el => el.textContent = finalFormatted);
      overlayNums.forEach(el => el.textContent = finalFormatted);
    }
  }, duration / steps);

  // Atualiza a barra de progresso em todas as instâncias
  document.querySelectorAll(`[id="counter-card-${betId}"]`).forEach(card => {
    const bet = store.bets.find(b => b.id === betId);
    if (bet) {
      const pct = bet.countTarget > 0 ? Math.min(100, Math.round((newCount / bet.countTarget) * 100)) : 0;
      const bar = card.querySelector('.counter-progress-fill');
      const pctLabel = card.querySelector('.counter-progress-labels span:nth-child(2)');
      if (bar) {
        bar.style.width = pct + '%';
        if (newCount >= bet.countTarget && bet.countTarget > 0) bar.classList.add('overshot');
      }
      if (pctLabel) pctLabel.textContent = pct + '% da meta';
    }
  });

  // Feedback de ganho flutuante se apostou nesta
  const ub = store.userBets.find(u => u.betId === betId && u.status === 'PENDING');
  if (ub && diff > 0) {
    spawnEarnFloat(`+${diff} ${store.bets.find(b=>b.id===betId)?.countSubject || 'contados'}!`);
  }
}

// Floating text de ganho
function spawnEarnFloat(text) {
  const el = document.createElement('div');
  el.className = 'earn-float';
  el.textContent = text;
  el.style.left = (30 + Math.random() * 40) + '%';
  el.style.bottom = '100px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// Confete de celebração
function launchConfetti(count = 40) {
  const colors = ['#6366F1','#A855F7','#EC4899','#FDE047','#10B981','#F97316'];
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      p.style.cssText = `
        left:${Math.random()*100}%;
        top:${-10 + Math.random()*20}%;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        width:${6+Math.random()*6}px;
        height:${6+Math.random()*6}px;
        animation-duration:${1.5+Math.random()*1}s;
        animation-delay:${Math.random()*0.3}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 2500);
    }, i * 30);
  }
}

// ---- BET PLACEMENT ----
let placeBetTarget = null;


function handleBetClick(betId, option) {
  if (!isLoggedIn) {
    showSnackbar('🔒 Acesse sua conta ou cadastre-se para palpitar!');
    openAuthModal('login');
    return;
  }
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

let tradeMode = 'BUY';
function setTradeMode(mode) {
  tradeMode = mode;
  document.getElementById('tab-buy').className = mode === 'BUY' ? 'trade-tab active' : 'trade-tab';
  document.getElementById('tab-sell').className = mode === 'SELL' ? 'trade-tab active' : 'trade-tab';
  
  // Limpa possíveis estilos residuais
  document.getElementById('tab-buy').style.background = '';
  document.getElementById('tab-sell').style.background = '';
  
  updatePayout();
}

function openPlaceBet(bet, option) {
  placeBetTarget = { bet, option };
  const betOpt = bet.options ? bet.options.find(o => o.option_label === option) : null;
  const optText = betOpt ? betOpt.title : option;
  
  const poolOpt = betOpt ? parseFloat(betOpt.pool) || 0 : 0;
  const poolTot = parseFloat(bet.totalPool) || 0;
  const prob = (poolOpt > 0 && poolTot > 0) ? (poolOpt / poolTot) : (1 / (bet.options ? bet.options.length : 2));
  const probPerc = prob * 100;
  const currentPrice = prob;

  document.getElementById('place-bet-title').textContent = bet.title;
  document.getElementById('place-bet-option').textContent = optText;
  const probEl = document.getElementById('place-bet-prob');
  if (probEl) probEl.textContent = `${Math.round(probPerc)}%`;
  
  const priceEl = document.getElementById('place-bet-price');
  if (priceEl) priceEl.textContent = `${currentPrice.toFixed(2)}¢`;
  document.getElementById('place-bet-balance').textContent = formatMoney(getBalance());
  document.getElementById('place-bet-amount').value = '';
  document.getElementById('place-bet-payout').textContent = '0 Cotas';
  document.getElementById('place-bet-error').style.display = 'none';
  setTradeMode('BUY');
  

  
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
  const bet = placeBetTarget.bet;
  const amount = parseFloat(document.getElementById('place-bet-amount').value) || 0;
  
  const betOpt = bet.options ? bet.options.find(o => o.option_label === placeBetTarget.option) : null;
  const poolOpt = betOpt ? parseFloat(betOpt.pool) || 0 : 0;
  const poolTot = parseFloat(bet.totalPool) || 0;
  const prob = (poolOpt > 0 && poolTot > 0) ? (poolOpt / poolTot) : (1 / (bet.options ? bet.options.length : 2));
  
  const sharesEl = document.getElementById('place-bet-shares');
  const sharesLabelEl = document.getElementById('shares-label');
  const payoutLabel = document.getElementById('payout-label');

  if (tradeMode === 'BUY') {
    const shares = amount / prob;
    if (sharesEl) sharesEl.textContent = `${shares.toFixed(2).replace('.', ',')} cotas`;
    if (sharesLabelEl) sharesLabelEl.textContent = 'Cotas Estimadas:';
    if (payoutLabel) payoutLabel.textContent = 'Pagamento Potencial:';
    document.getElementById('place-bet-payout').textContent = `~ ${formatMoney(shares)}`;
  } else {
    const cash = amount * prob;
    if (sharesEl) sharesEl.textContent = `${amount.toFixed(2).replace('.', ',')} cotas`;
    if (sharesLabelEl) sharesLabelEl.textContent = 'Cotas a Vender:';
    if (payoutLabel) payoutLabel.textContent = 'Cashout (Valor de Venda):';
    document.getElementById('place-bet-payout').textContent = `~ ${formatMoney(cash)}`;
  }

  const pf = store.portfolios.find(p => Number(p.bet_id) === Number(bet.id) && p.option_label === placeBetTarget.option);
  const ownedShares = pf ? parseFloat(pf.shares || 0) : 0;

  const err = document.getElementById('place-bet-error');
  if (tradeMode === 'BUY' && amount > getBalance()) {
    err.textContent = 'Saldo insuficiente para essa compra!';
    err.style.display = 'block';
  } else if (tradeMode === 'SELL' && amount > ownedShares) {
    err.textContent = `Saldo insuficiente: você possui apenas ${ownedShares} cotas.`;
    err.style.display = 'block';
  } else {
    err.style.display = 'none';
  }
}

function confirmPlaceBet() {
  if (!placeBetTarget) return;
  const amount = parseFloat(document.getElementById('place-bet-amount').value) || 0;
  if (amount <= 0) return;
  if (amount > getBalance()) {
    showSnackbar('Saldo insuficiente!');
    return;
  }
  const betOpt = placeBetTarget.bet.options ? placeBetTarget.bet.options.find(o => o.option_label === placeBetTarget.option) : null;
  const poolOpt = betOpt ? parseFloat(betOpt.pool) || 0 : 0;
  const poolTot = parseFloat(placeBetTarget.bet.totalPool) || 0;
  const prob = (poolOpt > 0 && poolTot > 0) ? (poolOpt / poolTot) : (1 / (placeBetTarget.bet.options ? placeBetTarget.bet.options.length : 2));
  
  const pf = store.portfolios.find(p => Number(p.bet_id) === Number(placeBetTarget.bet.id) && p.option_label === placeBetTarget.option);
  const ownedShares = pf ? parseFloat(pf.shares || 0) : 0;

  let shares = 0;
  if (tradeMode === 'BUY') {
    shares = amount / prob;
  } else {
    shares = amount; // user types shares to sell
    if (shares > ownedShares) {
      showSnackbar('Transação Bloqueada: Você não possui essas cotas para vender.');
      return;
    }
  }
  
  executePlaceBet(placeBetTarget.bet, placeBetTarget.option, amount, prob, shares);
  closeModal('modal-place-bet');
}

async function executePlaceBet(bet, optionLabel, amount, price, shares) {
  const betOpt = bet.options ? bet.options.find(o => o.option_label === optionLabel) : null;
  const optText = betOpt ? betOpt.title : optionLabel;
  
  if (tradeMode === 'BUY') {
    showSnackbar(`Ordem de Compra enviada! ${shares} Cotas ao Livro.`);
  } else {
    showSnackbar(`Ordem de Venda enviada! Tentando liquidar ${shares} Cotas...`);
  }

  if (tradeMode === 'BUY' && betOpt) {
    betOpt.pool += amount;
    bet.totalPool += amount;
    // Recalcula odds para todas as opções
    bet.options.forEach(o => {
      o.current_odds = bet.totalPool / (o.pool || 1);
    });
  }

  if (supabaseClient) {
    try {
      // 1. Call RPC for limit order execution
      const { data: orderId, error } = await supabaseClient.rpc('place_limit_order', {
        p_bet_id: bet.id,
        p_user_id: store.profile.username,
        p_option: optionLabel,
        p_order_type: tradeMode,
        p_price: price,
        p_shares: shares
      });
      
      if (error) throw error;
      
      if (tradeMode === 'BUY') {
        // Registra transação
        await supabaseClient.from('transactions').insert({
          amount: -amount,
          description: `Compra de ${shares} Cotas: ${bet.title}`,
          type: 'BET_PLACED',
          username: store.profile.username
        });

        // Atualiza a barra de volume e as odds do evento para os próximos compradores! (AMM Shift)
        supabaseClient.from('bets').update({ total_pool: bet.totalPool }).eq('id', bet.id).then();
        
        if (bet.options) {
          for (const o of bet.options) {
             supabaseClient.from('bet_options').update({ pool: o.pool, current_odds: o.current_odds }).eq('id', o.id).then();
             supabaseClient.from('bet_history').insert({ bet_id: bet.id, option_label: o.option_label, odds: o.current_odds }).then();
          }
        }
      }
      
    } catch (err) {
      console.error(err);
      showSnackbar('Erro ao enviar ordem pro Livro de Ofertas!');
    }
  }

  const newOdds = 1 / price;
  const potentialWin = tradeMode === 'BUY' ? shares : (amount * price);

  // Debit local
  store.transactions.push({
    id: store.nextTxId++,
    amount: -amount,
    description: 'Aposta em: ' + bet.title + ' (' + optText + ')',
    type: 'BET_PLACED',
    timestamp: Date.now()
  });

  // User bet local (Fallback/Cache)
  store.userBets.push({
    id: store.nextUserBetId++,
    betId: bet.id,
    betTitle: bet.title,
    chosenOption: optionLabel,
    chosenOptionText: optText,
    amount,
    odds: newOdds,
    potentialWin,
    status: 'PENDING',
    createdAt: Date.now()
  });

  // Update pool
  bet.totalPool += amount;

  addXp(appSettings.xp_place_bet || 50);
  saveStore(store);
  renderCurrentTab();
}

// ---- APOSTAS SÃO CRIADAS APENAS PELO ADMIN ----

// ---- SOCIAL TAB ----
function renderSocial() {
  const container = document.getElementById('social-list');
  if (!container) return;
  if (!store.posts || store.posts.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhuma postagem ainda. Seja o primeiro!</div>';
    return;
  }
  
  container.innerHTML = store.posts.map(p => {
    // Calcular Likes
    const postLikes = (store.postLikes || []).filter(l => l.post_id === p.id);
    const totalLikes = (p.likes || 0) + postLikes.length;
    const hasLiked = store.profile && store.profile.username && postLikes.some(l => l.username === store.profile.username);
    
    // Calcular Comments
    const postComments = (store.postComments || []).filter(c => c.post_id === p.id);
    const totalComments = postComments.length;

    const likeIconFill = hasLiked ? 'var(--neon-emerald)' : 'none';
    const likeIconColor = hasLiked ? 'var(--neon-emerald)' : 'currentColor';

    return `
      <div class="post-card">
        <div class="post-header">
          <div class="post-user">
            <div class="post-avatar">${p.username.charAt(0).toUpperCase()}</div>
            <div class="post-user-info">
              <span class="post-username">${p.username}</span>
            </div>
          </div>
          <span class="post-time">${formatTimeAgo(p.timestamp)}</span>
        </div>
        <p class="post-text">${p.comment}</p>
        ${p.betTitle ? `<div class="post-bet-ref">
          <div style="font-size:0.75rem;color:var(--text-gray);margin-bottom:4px;">Apostou em:</div>
          <div style="font-weight:600;color:var(--text-white);margin-bottom:6px;">${p.betTitle}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.05);padding:6px;border-radius:4px;">
            <span style="color:var(--neon-emerald);font-weight:600;">${p.chosenOptionText}</span>
            <span style="color:var(--gold-accent);font-weight:700;">Odd ${p.odds ? p.odds.toFixed(2) : '1.00'}</span>
          </div>
        </div>` : ''}
        <div class="post-actions" style="display:flex; gap:16px;">
          <button class="post-action-btn" onclick="likePost(${p.id})" style="color: ${hasLiked ? 'var(--neon-emerald)' : 'var(--text-gray)'}">
            <svg viewBox="0 0 24 24" fill="${likeIconFill}" stroke="${likeIconColor}" stroke-width="2" style="transition:all 0.2s; transform: ${hasLiked ? 'scale(1.1)' : 'scale(1)'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ${totalLikes}
          </button>
          <button class="post-action-btn" onclick="openComments(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            ${totalComments}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openCreatePostModal() {
  if (!isLoggedIn) {
    showSnackbar('🔒 Acesse sua conta para publicar na comunidade!');
    openAuthModal('login');
    return;
  }

  document.getElementById('post-comment-input').value = '';
  const select = document.getElementById('post-bet-select');
  select.innerHTML = '<option value="">Nenhum (Apenas mensagem)</option>' +
    store.bets.filter(b => b.status === 'OPEN').map(b => `<option value="${b.id}">${b.title}</option>`).join('');

  openModal('modal-create-post');
}

async function confirmCreatePost() {
  const comment = document.getElementById('post-comment-input').value.trim();
  if (!comment) {
    showSnackbar('Escreva uma mensagem ou análise para publicar!');
    return;
  }

  const selectedBetId = document.getElementById('post-bet-select').value;
  const matchBet = store.bets.find(b => Number(b.id) === Number(selectedBetId));
  const p = store.profile;

  const newPost = {
    username: p.username,
    user_level: p.level,
    user_badge: getCosmeticPerk(p.level),
    bet_id: matchBet ? matchBet.id : null,
    bet_title: matchBet ? matchBet.title : null,
    chosen_option: matchBet ? 'A' : null,
    chosen_option_text: matchBet ? matchBet.optionA : null,
    odds: matchBet ? matchBet.oddsA : null,
    comment: comment,
    likes: 0
  };

  let assignedPostId = store.nextPostId++;

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from('posts').insert(newPost).select();
      if (data && data[0]) {
        assignedPostId = Number(data[0].id);
      }
    } catch (e) {
      console.warn('Erro ao salvar post no Supabase:', e);
    }
  }

  store.posts.unshift({
    id: assignedPostId,
    username: p.username,
    userLevel: p.level,
    userBadge: getCosmeticPerk(p.level),
    betId: matchBet ? matchBet.id : null,
    betTitle: matchBet ? matchBet.title : null,
    chosenOption: matchBet ? 'A' : null,
    chosenOptionText: matchBet ? matchBet.optionA : null,
    odds: matchBet ? (matchBet.oddsA || 1.90) : 1.90,
    comment: comment,
    likes: 0,
    timestamp: Date.now()
  });

  addXp(appSettings.xp_share_feed || 50);
  saveStore(store);
  closeModal('modal-create-post');
  showSnackbar('🎉 Postagem publicada na comunidade!');
  renderSocial();
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
  const totalWon = store.userBets.filter(ub => ub.status === 'WON').reduce((s, ub) => s + ub.potentialWin, 0);
  const matchedPositions = store.portfolios.filter(p => p.shares > 0).length;
  const pendingPositions = store.userBets.filter(ub => ub.status === 'PENDING').length;
  const activeCount = matchedPositions + pendingPositions;

  document.getElementById('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Aplicado</div><div class="stat-value">${formatMoney(totalInvested)}</div></div>
    <div class="stat-card"><div class="stat-label">Retorno Ganho</div><div class="stat-value green">${formatMoney(totalWon)}</div></div>
    <div class="stat-card"><div class="stat-label">Posições Ativas</div><div class="stat-value gold">${activeCount} ativas</div></div>
  `;

  const list = document.getElementById('my-bets-list');
  let html = '';

  const allBets = store.userBets.sort((a,b) => b.createdAt - a.createdAt);
  if (allBets.length > 0) {
    html += `<h3 style="color:var(--text-gray); margin-top:24px; margin-bottom:12px;">Meus Palpites</h3>`;
    html += allBets.map(ub => {
       const statusClass = ub.status === 'WON' ? 'won' : (ub.status === 'PENDING' ? 'pending' : 'lost');
       const statusText = ub.status === 'WON' ? 'Ganhou' : (ub.status === 'PENDING' ? 'Pendente' : 'Perdeu');
       
       // Calculate dynamic info
       let currentProb = 0;
       let shares = 0;
       let cashoutValue = 0;
       const betData = store.bets.find(b => Number(b.id) === Number(ub.betId));
       
       if (betData && betData.options) {
         const pf = store.portfolios.find(p => Number(p.bet_id) === Number(ub.betId) && p.option_label === ub.chosenOption);
         shares = pf ? parseFloat(pf.shares || 0) : (ub.potentialWin || 0);
         
         const betOpt = betData.options.find(o => o.option_label === ub.chosenOption);
         const poolOpt = betOpt ? parseFloat(betOpt.pool) || 0 : 0;
         const poolTot = parseFloat(betData.totalPool) || 0;
         currentProb = (poolOpt > 0 && poolTot > 0) ? (poolOpt / poolTot) : 0;
         cashoutValue = shares * currentProb;
       }
       
       const profitLoss = cashoutValue - ub.amount;
       const plSign = profitLoss >= 0 ? '+' : '';
       const plColor = profitLoss > 0 ? 'var(--neon-emerald)' : (profitLoss < 0 ? 'var(--neon-orange)' : 'var(--text-gray)');
       
       // For completed bets, show fixed potential win instead of dynamic cashout
       const finalReturn = ub.status === 'PENDING' ? cashoutValue : ub.potentialWin;
       const isPending = ub.status === 'PENDING';
       
       return `
          <div class="user-bet-card" ${isPending && betData ? `onclick="openPlaceBetById(${ub.betId}, '${ub.chosenOption}')" style="cursor:pointer;"` : ''}>
            <div class="user-bet-header">
              <span class="user-bet-title">${ub.betTitle}</span>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="user-bet-details" style="flex-wrap:wrap;gap:8px;">
              <div class="detail-col" style="flex:1 1 45%;min-width:0;">
                <div class="detail-label">Opção Escolhida</div>
                <div class="detail-value">${ub.chosenOptionText}</div>
                ${isPending && shares > 0 ? `<div style="font-size:0.7rem;color:var(--text-gray);margin-top:2px;">${shares.toFixed(2).replace('.', ',')} cotas</div>` : ''}
              </div>
              <div class="detail-col" style="flex:1 1 45%;min-width:0;">
                <div class="detail-label">Apostado</div>
                <div class="detail-value">${formatMoney(ub.amount)}</div>
              </div>
              ${isPending ? `
              <div class="detail-col" style="flex:1 1 45%;min-width:0;">
                <div class="detail-label" style="color:var(--neon-emerald);">🏆 Ganho se Vencer</div>
                <div class="detail-value" style="color:var(--neon-emerald);font-weight:800;font-size:1rem;">
                   ${formatMoney(shares)}
                </div>
                <div style="font-size:0.65rem;color:var(--text-gray);margin-top:2px;">= ${shares.toFixed(2).replace('.', ',')} cotas × R$ 1,00</div>
              </div>
              <div class="detail-col" style="flex:1 1 45%;min-width:0;">
                <div class="detail-label" style="color:var(--gold-accent);">💰 Cashout Atual</div>
                <div class="detail-value" style="color:var(--gold-accent);font-weight:800;font-size:1rem;">
                   ${formatMoney(cashoutValue)}
                </div>
                <div style="font-size:0.65rem;color:${plColor};margin-top:2px;font-weight:600;">
                   ${plSign}${formatMoney(profitLoss)} vs apostado
                </div>
              </div>` : `
              <div class="detail-col" style="flex:1 1 45%;min-width:0;">
                <div class="detail-label">Retorno</div>
                <div class="detail-value" style="color:${ub.status === 'WON' ? 'var(--neon-emerald)' : 'var(--text-white)'}">
                   ${formatMoney(ub.potentialWin)}
                </div>
              </div>`}
            </div>
            ${isPending ? `
            <div style="font-size:0.75rem; color:var(--text-gray); margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
               <span><strong>Data:</strong> ${new Date(ub.createdAt).toLocaleString('pt-BR')}</span>
               <span style="color:var(--neon-blue);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;vertical-align:middle;"><path d="M5 12h14M12 5l7 7-7 7"/></svg> Negociar</span>
            </div>
            ` : `
            <div style="font-size:0.75rem; color:var(--text-gray); margin-top:8px;">
               <strong>Data:</strong> ${new Date(ub.createdAt).toLocaleString('pt-BR')}
            </div>`}
          </div>
       `;
    }).join('');
  }

  if (html === '') {
    list.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><rect x="9" y="2" width="6" height="4" rx="1"/></svg>
      <h3>Ainda não possui cotas</h3>
      <p>Vá para o Feed principal, selecione um evento e compre suas primeiras cotas!</p>
    </div>`;
  } else {
    list.innerHTML = html;
  }
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
    const pendingTag = tx.status === 'PENDING' ? '<span style="color:var(--gold-accent);font-size:0.65rem;font-weight:bold;margin-left:6px;background:rgba(245,158,11,0.2);padding:2px 6px;border-radius:4px;">PENDENTE</span>' : '';
    
    return `
      <div class="tx-card" onclick="openTxDetails(${tx.id})" style="cursor:pointer;">
        <div class="tx-left">
          <div class="tx-icon ${iconClass}">${iconSvg}</div>
          <div>
            <div class="tx-desc" style="display:flex;align-items:center;">${tx.description}${pendingTag}</div>
            <div class="tx-date">${formatDate(tx.timestamp)}</div>
          </div>
        </div>
        <div class="tx-amount ${amtClass}">${sign} ${formatMoney(Math.abs(tx.amount))}</div>
      </div>
    `;
  }).join('');
}

// ---- REAL PIX DEPOSIT & WITHDRAWAL LOGIC ----
let pendingPixAmount = 0;
let pendingPixCode = '';

function openDeposit() {
  if (!isLoggedIn) {
    showSnackbar('🔒 Acesse sua conta para realizar movimentações na carteira!');
    openAuthModal('login');
    return;
  }
  resetDepositModal();
  openModal('modal-deposit');
}

function resetDepositModal() {
  pendingPixAmount = 0;
  pendingPixCode = '';
  document.getElementById('deposit-step-1').style.display = 'block';
  document.getElementById('deposit-step-2').style.display = 'none';
  document.getElementById('deposit-amount').value = '';
}

function generatePixDeposit() {
  const amount = parseFloat(document.getElementById('deposit-amount').value) || 0;
  if (amount < 1) {
    showSnackbar('Digite um valor a partir de R$ 1,00!');
    return;
  }

  pendingPixAmount = amount;

  // Chave Pix aleatória (EVP) da plataforma PalpiteTotal
  pendingPixCode = '91742417-caec-4418-9b59-14b81c188a66';

  // QR Code oficial fornecido
  document.getElementById('pix-qr-img').src = 'pix_qrcode.png';
  document.getElementById('pix-display-amount').textContent = `Valor a Depositar: ${formatMoney(amount)}`;
  document.getElementById('pix-copia-cola').value = pendingPixCode;

  document.getElementById('deposit-step-1').style.display = 'none';
  document.getElementById('deposit-step-2').style.display = 'block';
}

function copyPixCode() {
  const input = document.getElementById('pix-copia-cola');
  if (!input || !input.value) return;
  input.select();
  navigator.clipboard?.writeText(input.value);
  showSnackbar('📋 Código Pix Copia e Cola copiado!');
}

async function confirmDepositPayment() {
  if (pendingPixAmount <= 0) return;

  const amount = pendingPixAmount;
  let assignedTxId = store.nextTxId++;

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from('transactions').insert({
        amount: amount,
        description: `Depósito Pix Confirmado (R$ ${amount.toFixed(2)})`,
        type: 'DEPOSIT',
        status: 'PENDING',
        username: store.profile.username
      }).select();
      if (data && data[0]) assignedTxId = Number(data[0].id);
    } catch (e) {
      console.warn('Erro ao registrar depósito no Supabase:', e);
    }
  }

  store.transactions.push({
    id: assignedTxId,
    amount: amount,
    description: `Depósito Pix Confirmado (R$ ${amount.toFixed(2)})`,
    type: 'DEPOSIT',
    status: 'PENDING',
    timestamp: Date.now()
  });

  saveStore(store);
  closeModal('modal-deposit');
  showSnackbar(`🎉 R$ ${amount.toFixed(2)} creditados via Pix na sua carteira!`);
  renderCurrentTab();
}

function openWithdraw() {
  if (!isLoggedIn) {
    showSnackbar('🔒 Acesse sua conta para realizar movimentações na carteira!');
    openAuthModal('login');
    return;
  }
  document.getElementById('withdraw-available').textContent = formatMoney(getBalance());
  document.getElementById('withdraw-amount').value = '';
  document.getElementById('withdraw-key-input').value = '';
  openModal('modal-withdraw');
}

async function confirmWithdraw() {
  const keyType = document.getElementById('withdraw-key-type').value;
  const keyInput = document.getElementById('withdraw-key-input').value.trim();
  const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;

  if (!keyInput) {
    showSnackbar('Preencha sua chave Pix para receber o saque!');
    return;
  }
  if (amount < 1) {
    showSnackbar('Valor mínimo de saque é R$ 1,00!');
    return;
  }
  if (amount > getBalance()) {
    showSnackbar('Saldo insuficiente para realizar este saque!');
    return;
  }

  let assignedTxId = store.nextTxId++;
  const desc = `Saque Pix Solicitado (${keyType}: ${keyInput})`;

  if (supabaseClient) {
    try {
      const { data } = await supabaseClient.from('transactions').insert({
        amount: -amount,
        description: desc,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        username: store.profile.username
      }).select();
      if (data && data[0]) assignedTxId = Number(data[0].id);
    } catch (e) {
      console.warn('Erro ao registrar saque no Supabase:', e);
    }
  }

  store.transactions.push({
    id: assignedTxId,
    amount: -amount,
    description: desc,
    type: 'WITHDRAWAL',
    status: 'PENDING',
    timestamp: Date.now()
  });

  saveStore(store);
  closeModal('modal-withdraw');
  showSnackbar(`💸 Saque de R$ ${amount.toFixed(2)} enviado para a chave Pix!`);
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
    list.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:12px;opacity:0.5;">🔕</div>
        <h3>Tudo tranquilo por aqui</h3>
        <p style="color:var(--text-gray);font-size:0.8rem;">Você não tem nenhuma notificação nova no momento.</p>
      </div>
    `;
    return;
  }
  list.innerHTML = store.notifications.map(n => `
    <div class="notif-item${n.isRead ? '' : ' unread'}" style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:12px;align-items:flex-start;">
      <div style="font-size:1.5rem;background:rgba(16,185,129,0.1);padding:10px;border-radius:12px;">🔔</div>
      <div>
        <div class="notif-title" style="font-weight:700;font-size:0.9rem;margin-bottom:4px;color:var(--text-white);">${n.title}</div>
        <div class="notif-message" style="color:var(--text-gray);font-size:0.8rem;line-height:1.4;">${n.message}</div>
      </div>
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
  if (!isLoggedIn) {
    openAuthModal('login');
    return;
  }
  const p = store.profile;
  document.getElementById('profile-avatar-large').textContent = p.username.charAt(0).toUpperCase();
  document.getElementById('profile-username').textContent = p.username;
  document.getElementById('profile-frame').textContent = 'Moldura ' + getCosmeticPerk(p.level);

  const threshold = p.level * 200;
  document.getElementById('xp-label').textContent = `XP: ${p.xp} / ${threshold}`;
  document.getElementById('level-label').textContent = `Nível ${p.level}`;
  document.getElementById('xp-bar-fill').style.width = (p.xp / threshold * 100) + '%';

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
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    // Não permite fechar o modal de login clicando fora
    if (e.target === overlay && overlay.id !== 'modal-auth') {
      overlay.classList.remove('open');
    }
  });
});

// ---- INITIAL RENDER ----
// Renderização movida para o initApp
// Loop para atualizar countdowns de expiração na tela sem precisar dar reload
setInterval(() => {
  document.querySelectorAll('span[id^="countdown-"]').forEach(el => {
    const expiresAt = Number(el.getAttribute('data-expires'));
    if (!expiresAt) return;
    const diff = expiresAt - Date.now();
    
    if (diff > 0) {
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const urgentColor = diff < 3600000 ? '#EF4444' : 'var(--gold-accent)';
      el.style.color = urgentColor;
      el.innerHTML = `⏰ ${h}h ${m}min`;
    } else {
      el.style.color = '#EF4444';
      el.innerHTML = `⏰ Encerrando...`;
    }
  });
}, 60000); // Atualiza a cada 1 minuto

// Limpa campo de busca para evitar autofill automático do navegador
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
});

// Limpa campo de busca para evitar autofill assíncrono do navegador
window.addEventListener('load', () => {
  [0, 50, 150, 300, 500, 1000].forEach(delay => {
    setTimeout(() => {
      const el = document.getElementById('search-input');
      if (el && el.value) {
        const v = el.value.trim().toLowerCase();
        const u = (store?.profile?.username || '').toLowerCase();
        if (v.includes('@') || v === u || v.includes('oswamitrader')) {
          el.value = '';
          renderFeed();
        }
      }
    }, delay);
  });
});

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
    err.textContent = 'Preencha o e-mail/usuário e a senha!';
    err.style.display = 'block';
    return;
  }

  err.style.display = 'none';
  let authenticatedUsername = email.includes('@') ? email.split('@')[0] : email;

  if (supabaseClient && email.includes('@')) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) {
        // Tenta auto-cadastro se a conta ainda não existia no Supabase Auth
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({ email, password });
        if (!signUpError && signUpData && signUpData.user) {
          authenticatedUsername = signUpData.user.email.split('@')[0];
        }
      } else if (data && data.user) {
        authenticatedUsername = data.user.email.split('@')[0];
      }
    } catch (e) {
      console.warn('Fallback login local:', e);
    }
  }

  store.profile.username = authenticatedUsername;
  isLoggedIn = true;
  localStorage.setItem('palpitetotal_logged_in', 'true');
  localStorage.setItem('palpitetotal_username', authenticatedUsername);
  loggedInUser = authenticatedUsername;
  saveStore(store);

  await syncFromSupabase();
  setAppVisibility(true);
  initRealtimeSubscriptions();
  closeModal('modal-auth');
  switchTab('feed');
  renderCurrentTab();
  showSnackbar(`✨ Bem-vindo de volta, ${authenticatedUsername}!`);
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

  err.style.display = 'none';
  const selectedChips = Array.from(document.querySelectorAll('#reg-interests .interest-chip.selected'))
    .map(c => c.textContent);
  const interests = selectedChips.join(',') || 'Tempo,Esportes';

  if (supabaseClient && email.includes('@')) {
    try {
      await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
    } catch (e) {
      console.warn('Erro registro Supabase:', e);
    }
  }

  store.profile.username = username;
  store.profile.interests = interests;

  // Credit Bônus R$1000
  const bonusAmount = appSettings.welcome_bonus || 1000;
  store.transactions.push({
    id: store.nextTxId++,
    amount: bonusAmount,
    description: 'Bônus de Cadastro Novo Apostador',
    type: 'DEPOSIT',
    timestamp: Date.now()
  });

  if (supabaseClient) {
    supabaseClient.from('transactions').insert({
      amount: bonusAmount,
      description: 'Bônus de Cadastro Novo Apostador',
      type: 'DEPOSIT',
      status: 'COMPLETED',
      username: username
    }).then();
  }

  addXp(150);

  if (supabaseClient) {
    try {
      await supabaseClient.from('profiles').upsert({
        id: 'user_' + Date.now(),
        username,
        email,
        xp: store.profile.xp,
        level: store.profile.level,
        referral_count: 0,
        interests
      });
    } catch (e) { /* fallback */ }
  }

  isLoggedIn = true;
  localStorage.setItem('palpitetotal_logged_in', 'true');
  localStorage.setItem('palpitetotal_username', username);
  loggedInUser = username;
  saveStore(store);
  
  await syncFromSupabase();
  setAppVisibility(true);
  initRealtimeSubscriptions();

  closeModal('modal-auth');
  showSnackbar(`🎉 Conta criada! R$ 1.000,00 de Bônus adicionados!`);
  switchTab('feed');
  renderCurrentTab();
}

async function confirmLogout() {
  if (supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) { /* ignore */ }
  }

  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem('palpitetotal_logged_in');
  localStorage.removeItem('palpitetotal_username');
  isLoggedIn = false;
  loggedInUser = '';
  store = getDefaultStore();
  saveStore(store);

  setAppVisibility(false);
  closeSheet('sheet-profile');
  showSnackbar('Sessão encerrada com sucesso!');
  openAuthModal('login');
  setTimeout(() => {
    const closeBtn = document.querySelector('#modal-auth .modal-close');
    if (closeBtn) closeBtn.style.display = 'none';
  }, 50);
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

// =============================================
// START APPLICATION
// =============================================
initApp();


function openPlaceBetById(betId, optionLabel) {
  const bet = store.bets.find(b => Number(b.id) === Number(betId));
  if (bet) {
    openPlaceBet(bet, optionLabel);
  }
}


function openTxDetails(txId) {
  const tx = store.transactions.find(t => Number(t.id) === Number(txId));
  if (!tx) return;
  
  let iconClass = 'bet';
  let iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>';
  let typeText = 'Operação (Palpite)';

  if (tx.type === 'DEPOSIT') {
    iconClass = 'deposit';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>';
    typeText = 'Depósito / Bônus';
  } else if (tx.type === 'WITHDRAWAL') {
    iconClass = 'withdrawal';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>';
    typeText = 'Saque';
  } else if (tx.type === 'BET_WON') {
    iconClass = 'won';
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 22V2h4v20"/></svg>';
    typeText = 'Prêmio Ganho';
  }
  
  const sign = tx.amount >= 0 ? '+' : '';
  const amtClass = tx.amount >= 0 ? 'positive' : 'negative';
  
  let bgStyle = 'background: rgba(255,255,255,0.05); color: var(--text-gray);';
  if (iconClass === 'deposit') bgStyle = 'background: rgba(16, 185, 129, 0.1); color: var(--neon-emerald);';
  if (iconClass === 'withdrawal') bgStyle = 'background: rgba(249, 115, 22, 0.1); color: var(--neon-orange);';
  if (iconClass === 'won') bgStyle = 'background: rgba(245, 158, 11, 0.1); color: var(--gold-accent);';
  if (iconClass === 'bet') bgStyle = 'background: rgba(96, 165, 250, 0.1); color: var(--neon-blue);';

  document.getElementById('tx-detail-icon').innerHTML = iconSvg;
  document.getElementById('tx-detail-icon').setAttribute('style', `width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; ${bgStyle}`);
  
  document.getElementById('tx-detail-amount').textContent = `${sign} ${formatMoney(Math.abs(tx.amount))}`;
  document.getElementById('tx-detail-amount').className = `tx-amount ${amtClass}`;
  
  if (tx.status === 'PENDING') {
    document.getElementById('tx-detail-status').innerHTML = '<span style="color:var(--gold-accent);font-size:0.75rem;font-weight:bold;background:rgba(245,158,11,0.2);padding:4px 10px;border-radius:6px;">Processando (Pendente)</span>';
  } else {
    document.getElementById('tx-detail-status').innerHTML = '<span style="color:var(--neon-emerald);font-size:0.75rem;font-weight:bold;background:rgba(16,185,129,0.2);padding:4px 10px;border-radius:6px;">Concluída com Sucesso</span>';
  }
  
  document.getElementById('tx-detail-desc').textContent = tx.description;
  document.getElementById('tx-detail-date').textContent = formatDate(tx.timestamp);
  document.getElementById('tx-detail-type').textContent = typeText;
  
  const optionRow = document.getElementById('tx-detail-option-row');
  if (optionRow) {
    optionRow.style.display = 'none';
    // Extract option from description like "Aposta em: Title (Option)" or "Prêmio ganho: Title"
    const descMatch = tx.description.match(/\(([^)]+)\)$/);
    if (descMatch) {
      document.getElementById('tx-detail-option').textContent = descMatch[1];
      optionRow.style.display = 'flex';
    } else if (tx.type === 'BET_PLACED' || tx.type === 'BET_WON' || tx.type === 'BET') {
      // Fallback: find related userBet by timestamp proximity
      const relatedBet = store.userBets.find(ub => Math.abs(ub.createdAt - tx.timestamp) < 10000);
      if (relatedBet) {
        document.getElementById('tx-detail-option').textContent = relatedBet.chosenOptionText;
        optionRow.style.display = 'flex';
      }
    }
  }
  document.getElementById('tx-detail-id').textContent = `#${tx.id.toString().padStart(6, '0')}`;
  
  openModal('modal-tx-details');
}


// ==========================================
// SOCIAL FEATURES (Posts, Likes, Comments)
// ==========================================

function checkAuth() {
  if (!isLoggedIn) {
    openAuthModal('login');
    return false;
  }
  return true;
}

let currentCommentPostId = null;

function openCreatePostModal() {
  if (!checkAuth()) return;
  
  const betSelect = document.getElementById('create-post-bet');
  betSelect.innerHTML = '<option value="">Nenhuma (Post simples)</option>';
  
  // Populate with user's recent bets (fallback to empty array if undefined)
  const recentBets = (store.userBets || []).slice().reverse().slice(0, 10);
  recentBets.forEach(ub => {
    const opt = document.createElement('option');
    opt.value = ub.id;
    opt.textContent = ub.betTitle + ' (' + ub.chosenOptionText + ')';
    betSelect.appendChild(opt);
  });
  
  document.getElementById('create-post-text').value = '';
  openModal('modal-create-post');
}

async function submitPost() {
  if (!checkAuth()) return;
  const text = document.getElementById('create-post-text').value.trim();
  if (!text) {
    showToast('Escreva algo para publicar!', 'error');
    return;
  }
  
  const betIdVal = document.getElementById('create-post-bet').value;
  let linkedBet = null;
  if (betIdVal) {
    linkedBet = store.userBets.find(b => b.id == betIdVal);
  }
  
  const newPost = {
    username: store.profile.username,
    user_level: store.profile.level || 1,
    user_badge: getBadgeByLevel(store.profile.level || 1),
    comment: text,
    likes: 0,
    created_at: new Date().toISOString(),
    // Default values for DB NOT NULL constraints
    bet_id: 0,
    bet_title: '',
    chosen_option: '',
    chosen_option_text: '',
    odds: 1
  };
  
  if (linkedBet) {
    newPost.bet_id = linkedBet.betId;
    newPost.bet_title = linkedBet.betTitle || '';
    newPost.chosen_option = linkedBet.chosenOption || '';
    newPost.chosen_option_text = linkedBet.chosenOptionText || '';
    newPost.odds = linkedBet.odds || 1;
  }
  
  closeModal('modal-create-post');
  
  // Optimistic UI update
  const localPost = {
    id: Date.now(), // temporary
    username: newPost.username,
    userLevel: newPost.user_level,
    userBadge: newPost.user_badge,
    betId: newPost.bet_id,
    betTitle: newPost.bet_title,
    chosenOption: newPost.chosen_option,
    chosenOptionText: newPost.chosen_option_text,
    odds: newPost.odds,
    comment: newPost.comment,
    likes: 0,
    timestamp: Date.now()
  };
  store.posts.unshift(localPost);
  renderSocial();
  showToast('Post publicado!');
  
  // Send to Supabase
  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('posts').insert([newPost]).select();
    if (!error && data && data.length > 0) {
      localPost.id = data[0].id; // Update with real ID
    }
  }
  saveStore(store);
}

async function likePost(postId) {
  if (!checkAuth()) return;
  const username = store.profile.username;
  
  if (!store.postLikes) store.postLikes = [];
  
  const existingLikeIndex = store.postLikes.findIndex(l => l.post_id === postId && l.username === username);
  
  if (existingLikeIndex > -1) {
    // Un-like
    store.postLikes.splice(existingLikeIndex, 1);
    renderSocial(); // update UI instantly
    
    if (supabaseClient) {
      await supabaseClient.from('post_likes').delete().eq('post_id', postId).eq('username', username);
    }
  } else {
    // Like
    store.postLikes.push({ post_id: postId, username: username });
    renderSocial(); // update UI instantly
    
    if (supabaseClient) {
      await supabaseClient.from('post_likes').insert([{ post_id: postId, username: username }]);
    }
  }
  saveStore(store);
}

function openComments(postId) {
  if (!checkAuth()) return;
  currentCommentPostId = postId;
  renderCommentsList();
  openModal('modal-comments');
}

function renderCommentsList() {
  const container = document.getElementById('comments-list');
  if (!store.postComments) store.postComments = [];
  
  const comments = store.postComments.filter(c => c.post_id === currentCommentPostId);
  
  if (comments.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-gray);margin-top:20px;">Seja o primeiro a comentar!</div>';
    return;
  }
  
  container.innerHTML = comments.map(c => `
    <div style="display:flex; gap:10px; padding:0 12px;">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--slate-gray);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--neon-emerald);flex-shrink:0;">
        ${c.username.charAt(0).toUpperCase()}
      </div>
      <div style="background:var(--slate-gray); padding:10px; border-radius:var(--radius-md); border-top-left-radius:0; flex:1;">
        <div style="font-weight:600;font-size:0.85rem;color:var(--text-white);margin-bottom:4px;">${c.username}</div>
        <div style="font-size:0.9rem;color:var(--text-gray);">${c.text}</div>
      </div>
    </div>
  `).join('');
  
  // Scroll to bottom
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

async function submitComment() {
  if (!checkAuth()) return;
  const input = document.getElementById('new-comment-text');
  const text = input.value.trim();
  if (!text || !currentCommentPostId) return;
  
  const comment = {
    post_id: currentCommentPostId,
    username: store.profile.username,
    text: text,
    created_at: new Date().toISOString()
  };
  
  // Optimistic UI
  if (!store.postComments) store.postComments = [];
  store.postComments.push(comment);
  input.value = '';
  renderCommentsList();
  renderSocial(); // update comment count in feed
  saveStore(store);
  
  // Send to Supabase
  if (supabaseClient) {
    await supabaseClient.from('post_comments').insert([comment]);
  }
}
