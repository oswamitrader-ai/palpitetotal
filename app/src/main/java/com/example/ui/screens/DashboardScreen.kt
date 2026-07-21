package com.example.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import android.widget.Toast
import androidx.compose.ui.platform.LocalContext
import com.example.R
import com.example.data.model.*
import com.example.ui.viewmodel.BetViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

// Aesthetic modern dark theme color palette
private val SlateDark = Color(0xFF0F172A)
private val CardDark = Color(0xFF1E293B)
private val NeonEmerald = Color(0xFF10B981)
private val LightEmerald = Color(0xFF34D399)
private val NeonOrange = Color(0xFFF97316)
private val GoldAccent = Color(0xFFF59E0B)
private val TextWhite = Color(0xFFF8FAFC)
private val TextGray = Color(0xFF94A3B8)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: BetViewModel,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val allBets by viewModel.allBets.collectAsStateWithLifecycle()
    val allUserBets by viewModel.allUserBets.collectAsStateWithLifecycle()
    val allTransactions by viewModel.allTransactions.collectAsStateWithLifecycle()
    val walletBalance by viewModel.walletBalance.collectAsStateWithLifecycle()
    
    // Leveling, Social & Notifications state flows
    val userProfile by viewModel.userProfile.collectAsStateWithLifecycle()
    val allPosts by viewModel.allPosts.collectAsStateWithLifecycle()
    val allNotifications by viewModel.allNotifications.collectAsStateWithLifecycle()
    val unreadNotificationsCount by viewModel.unreadNotificationsCount.collectAsStateWithLifecycle()

    var currentTab by remember { mutableStateOf("feed") }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Todos") }

    var quickBetEnabled by remember { mutableStateOf(false) }
    var quickBetAmount by remember { mutableStateOf(10.0) }

    // Dialog state controllers
    var betToPlace by remember { mutableStateOf<Bet?>(null) }
    var selectedOptionToBet by remember { mutableStateOf<String?>(null) } // "A" or "B"
    var showCreateBetDialog by remember { mutableStateOf(false) }
    var showDepositDialog by remember { mutableStateOf(false) }
    var showWithdrawDialog by remember { mutableStateOf(false) }
    
    var showProfileDialog by remember { mutableStateOf(false) }
    var showNotificationsDialog by remember { mutableStateOf(false) }
    var betToShare by remember { mutableStateOf<UserBet?>(null) }

    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        viewModel.successEvent.collectLatest { message ->
            scope.launch {
                snackbarHostState.showSnackbar(message)
            }
        }
    }

    LaunchedEffect(Unit) {
        viewModel.errorEvent.collectLatest { error ->
            scope.launch {
                snackbarHostState.showSnackbar(
                    message = error,
                    duration = SnackbarDuration.Short
                )
            }
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = SlateDark,
                    titleContentColor = TextWhite
                ),
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Casino,
                            contentDescription = "PalpiteTotal Logo",
                            tint = NeonEmerald,
                            modifier = Modifier.size(28.dp)
                        )
                        Text(
                            text = "PalpiteTotal",
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp,
                            color = TextWhite
                        )
                    }
                },
                actions = {
                    // Quick Wallet balance indicator
                    Box(
                        modifier = Modifier
                            .padding(end = 6.dp)
                            .clip(RoundedCornerShape(50.dp))
                            .background(CardDark)
                            .clickable { currentTab = "wallet" }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountBalanceWallet,
                                contentDescription = "Carteira",
                                tint = NeonEmerald,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "R$ ${String.format("%.2f", walletBalance)}",
                                fontWeight = FontWeight.SemiBold,
                                color = TextWhite,
                                fontSize = 12.sp
                            )
                        }
                    }

                    // Notification Bell Icon with real-time Badge
                    IconButton(onClick = { showNotificationsDialog = true }) {
                        BadgedBox(
                            badge = {
                                if (unreadNotificationsCount > 0) {
                                    Badge(
                                        containerColor = NeonOrange,
                                        contentColor = TextWhite
                                    ) {
                                        Text("$unreadNotificationsCount", fontSize = 10.sp)
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = if (unreadNotificationsCount > 0) Icons.Default.NotificationsActive else Icons.Default.Notifications,
                                contentDescription = "Notificações",
                                tint = if (unreadNotificationsCount > 0) GoldAccent else TextGray
                            )
                        }
                    }

                    // Avatar Icon with dynamic glowing ring level ring
                    val profileLevel = userProfile?.level ?: 1
                    val frameBorderBrush = remember(profileLevel) {
                        getProfileFrameBrush(profileLevel)
                    }

                    Box(
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .size(38.dp)
                            .border(2.dp, frameBorderBrush, CircleShape)
                            .clip(CircleShape)
                            .background(CardDark)
                            .clickable { showProfileDialog = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${userProfile?.username?.take(1)?.uppercase() ?: "P"}",
                            color = TextWhite,
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp
                        )
                        // Tiny level tag at the corner
                        Box(
                            modifier = Modifier
                                .align(Alignment.BottomEnd)
                                .size(14.dp)
                                .clip(CircleShape)
                                .background(NeonEmerald),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "$profileLevel",
                                color = SlateDark,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = SlateDark,
                tonalElevation = 8.dp
            ) {
                NavigationBarItem(
                    selected = currentTab == "feed",
                    onClick = { currentTab = "feed" },
                    icon = {
                        Icon(
                            imageVector = if (currentTab == "feed") Icons.Default.TrendingUp else Icons.Outlined.TrendingUp,
                            contentDescription = "Feed"
                        )
                    },
                    label = { Text("Feed", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = NeonEmerald,
                        selectedTextColor = NeonEmerald,
                        unselectedIconColor = TextGray,
                        unselectedTextColor = TextGray,
                        indicatorColor = CardDark
                    )
                )

                NavigationBarItem(
                    selected = currentTab == "social",
                    onClick = { currentTab = "social" },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Group,
                            contentDescription = "Social"
                        )
                    },
                    label = { Text("Social", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = NeonEmerald,
                        selectedTextColor = NeonEmerald,
                        unselectedIconColor = TextGray,
                        unselectedTextColor = TextGray,
                        indicatorColor = CardDark
                    )
                )

                NavigationBarItem(
                    selected = currentTab == "my_bets",
                    onClick = { currentTab = "my_bets" },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.ReceiptLong,
                            contentDescription = "Minhas Apostas"
                        )
                    },
                    label = { Text("Palpites", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = NeonEmerald,
                        selectedTextColor = NeonEmerald,
                        unselectedIconColor = TextGray,
                        unselectedTextColor = TextGray,
                        indicatorColor = CardDark
                    )
                )

                NavigationBarItem(
                    selected = currentTab == "wallet",
                    onClick = { currentTab = "wallet" },
                    icon = {
                        Icon(
                            imageVector = if (currentTab == "wallet") Icons.Default.AccountBalanceWallet else Icons.Outlined.AccountBalanceWallet,
                            contentDescription = "Carteira"
                        )
                    },
                    label = { Text("Carteira", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = NeonEmerald,
                        selectedTextColor = NeonEmerald,
                        unselectedIconColor = TextGray,
                        unselectedTextColor = TextGray,
                        indicatorColor = CardDark
                    )
                )

                NavigationBarItem(
                    selected = currentTab == "manage",
                    onClick = { currentTab = "manage" },
                    icon = {
                        Icon(
                            imageVector = Icons.Default.Gavel,
                            contentDescription = "Gerenciar"
                        )
                    },
                    label = { Text("Soberano", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = GoldAccent,
                        selectedTextColor = GoldAccent,
                        unselectedIconColor = TextGray,
                        unselectedTextColor = TextGray,
                        indicatorColor = CardDark
                    )
                )
            }
        },
        floatingActionButton = {
            if (currentTab == "feed" || currentTab == "manage" || currentTab == "social") {
                ExtendedFloatingActionButton(
                    text = { Text("Novo Palpite", color = SlateDark, fontWeight = FontWeight.Bold) },
                    icon = { Icon(Icons.Default.Add, contentDescription = "Criar Aposta", tint = SlateDark) },
                    onClick = { showCreateBetDialog = true },
                    containerColor = NeonEmerald,
                    elevation = FloatingActionButtonDefaults.elevation(8.dp)
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .background(SlateDark)
        ) {
            when (currentTab) {
                "feed" -> FeedTab(
                    bets = allBets,
                    searchQuery = searchQuery,
                    onSearchQueryChange = { searchQuery = it },
                    selectedCategory = selectedCategory,
                    onCategoryChange = { selectedCategory = it },
                    onPlaceBetClick = { bet, option ->
                        if (quickBetEnabled) {
                            if (walletBalance >= quickBetAmount) {
                                viewModel.placeBet(bet, option, quickBetAmount)
                                Toast.makeText(
                                    context,
                                    "Aposta Rápida de R$ ${String.format(java.util.Locale.US, "%.2f", quickBetAmount)} realizada com sucesso!",
                                    Toast.LENGTH_LONG
                                ).show()
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        "Aposta Rápida: R$ ${String.format(java.util.Locale.US, "%.2f", quickBetAmount)} na Opção $option!"
                                    )
                                }
                            } else {
                                Toast.makeText(
                                    context,
                                    "Saldo insuficiente para realizar a Aposta Rápida!",
                                    Toast.LENGTH_LONG
                                ).show()
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        "Saldo insuficiente para Aposta Rápida (R$ ${String.format(java.util.Locale.US, "%.2f", quickBetAmount)}). Por favor, mude o valor ou deposite."
                                    )
                                }
                                showDepositDialog = true
                            }
                        } else {
                            betToPlace = bet
                            selectedOptionToBet = option
                        }
                    },
                    quickBetEnabled = quickBetEnabled,
                    onQuickBetEnabledChange = { quickBetEnabled = it },
                    quickBetAmount = quickBetAmount,
                    onQuickBetAmountChange = { quickBetAmount = it }
                )
                "social" -> CommunityTab(
                    posts = allPosts,
                    bets = allBets,
                    onLikeClick = { viewModel.likePost(it) },
                    onCopyBetClick = { bet, option ->
                        if (quickBetEnabled) {
                            if (walletBalance >= quickBetAmount) {
                                viewModel.placeBet(bet, option, quickBetAmount)
                                Toast.makeText(
                                    context,
                                    "Aposta Rápida de R$ ${String.format(java.util.Locale.US, "%.2f", quickBetAmount)} realizada com sucesso!",
                                    Toast.LENGTH_LONG
                                ).show()
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        "Aposta Rápida: R$ ${String.format(java.util.Locale.US, "%.2f", quickBetAmount)} na Opção $option!"
                                    )
                                }
                            } else {
                                Toast.makeText(
                                    context,
                                    "Saldo insuficiente para realizar a Aposta Rápida!",
                                    Toast.LENGTH_LONG
                                ).show()
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        "Saldo insuficiente para Aposta Rápida (R$ ${String.format(java.util.Locale.US, "%.2f", quickBetAmount)}). Por favor, mude o valor ou deposite."
                                    )
                                }
                                showDepositDialog = true
                            }
                        } else {
                            betToPlace = bet
                            selectedOptionToBet = option
                        }
                    }
                )
                "my_bets" -> MyBetsTab(
                    userBets = allUserBets,
                    onShareClick = { betToShare = it }
                )
                "wallet" -> WalletTab(
                    balance = walletBalance,
                    transactions = allTransactions,
                    onDepositClick = { showDepositDialog = true },
                    onWithdrawClick = { showWithdrawDialog = true }
                )
                "manage" -> ManageTab(
                    bets = allBets,
                    onResolveClick = { bet, option ->
                        viewModel.resolveBet(bet, option)
                    }
                )
            }
        }
    }

    // Place Bet Dialog
    betToPlace?.let { bet ->
        selectedOptionToBet?.let { option ->
            PlaceBetDialog(
                bet = bet,
                option = option,
                walletBalance = walletBalance,
                onDismiss = {
                    betToPlace = null
                    selectedOptionToBet = null
                },
                onConfirm = { amount ->
                    if (walletBalance >= amount) {
                        viewModel.placeBet(bet, option, amount)
                        Toast.makeText(
                            context,
                            "Aposta de R$ ${String.format(java.util.Locale.US, "%.2f", amount)} realizada com sucesso!",
                            Toast.LENGTH_LONG
                        ).show()
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                "Aposta realizada: R$ ${String.format(java.util.Locale.US, "%.2f", amount)} na Opção $option!"
                            )
                        }
                    } else {
                        Toast.makeText(
                            context,
                            "Saldo insuficiente para realizar a aposta!",
                            Toast.LENGTH_LONG
                        ).show()
                        scope.launch {
                            snackbarHostState.showSnackbar(
                                "Erro: Saldo insuficiente para realizar essa aposta."
                            )
                        }
                    }
                    betToPlace = null
                    selectedOptionToBet = null
                }
            )
        }
    }

    // Create Bet Dialog
    if (showCreateBetDialog) {
        CreateBetDialog(
            onDismiss = { showCreateBetDialog = false },
            onConfirm = { title, desc, cat, optA, optB, oA, oB ->
                viewModel.createCustomBet(title, desc, cat, optA, optB, oA, oB)
                showCreateBetDialog = false
            }
        )
    }

    // Deposit Dialog
    if (showDepositDialog) {
        PixDepositDialog(
            onDismiss = { showDepositDialog = false },
            onConfirm = { amount ->
                viewModel.depositFunds(amount)
                showDepositDialog = false
            }
        )
    }

    // Withdraw Dialog
    if (showWithdrawDialog) {
        WalletActionDialog(
            title = "Sacar Saldo Seguro",
            description = "Seu dinheiro cai na hora via Pix simulado.",
            actionLabel = "Sacar",
            actionColor = NeonOrange,
            maxAmountLimit = walletBalance,
            onDismiss = { showWithdrawDialog = false },
            onConfirm = { amount ->
                viewModel.withdrawFunds(amount)
                showWithdrawDialog = false
            }
        )
    }

    // Profile & Leveling Dialog
    if (showProfileDialog) {
        ProfileDialog(
            profile = userProfile ?: UserProfile(),
            walletBalance = walletBalance,
            allUserBets = allUserBets,
            allTransactions = allTransactions,
            onDepositClick = {
                showProfileDialog = false
                showDepositDialog = true
            },
            onWithdrawClick = {
                showProfileDialog = false
                showWithdrawDialog = true
            },
            onDismiss = { showProfileDialog = false },
            onSaveInterests = { viewModel.updateInterests(it) },
            onReferFriend = { viewModel.referFriend() }
        )
    }

    // Notifications Dialog
    if (showNotificationsDialog) {
        NotificationsDialog(
            notifications = allNotifications,
            onDismiss = { showNotificationsDialog = false },
            onClearAll = { viewModel.clearNotifications() },
            onSimulateClosing = { viewModel.simulateClosingBetsNotification() },
            onSimulateTrending = { viewModel.simulateTrendingInterestNotification() }
        )
    }

    // Share Bet Dialog
    betToShare?.let { userBet ->
        ShareBetDialog(
            userBet = userBet,
            onDismiss = { betToShare = null },
            onShareConfirm = { comment ->
                viewModel.shareBetToCommunity(userBet, comment)
                betToShare = null
            }
        )
    }
}

// Custom function to return beautiful gradient brushes representing leveling tiers
fun getProfileFrameBrush(level: Int): Brush {
    return when (level) {
        1 -> Brush.sweepGradient(listOf(Color(0xFFCD7F32), Color(0xFF8B5A2B), Color(0xFFCD7F32))) // Bronze
        2 -> Brush.sweepGradient(listOf(Color(0xFFC0C0C0), Color(0xFFE8E8E8), Color(0xFFC0C0C0))) // Silver
        3 -> Brush.sweepGradient(listOf(Color(0xFFFFD700), Color(0xFFFFA500), Color(0xFFFFD700))) // Gold
        4 -> Brush.sweepGradient(listOf(Color(0xFF00FFFF), Color(0xFF10B981), Color(0xFF00FFFF))) // Platinum Spark
        else -> Brush.sweepGradient(listOf(Color(0xFFFF007F), Color(0xFF7F00FF), Color(0xFF10B981), Color(0xFFFF007F))) // Neon Ultimate
    }
}

// ==========================================
// FEED TAB (OPEN & TRENDING BETS)
// ==========================================
@Composable
fun FeedTab(
    bets: List<Bet>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    selectedCategory: String,
    onCategoryChange: (String) -> Unit,
    onPlaceBetClick: (Bet, String) -> Unit,
    quickBetEnabled: Boolean,
    onQuickBetEnabledChange: (Boolean) -> Unit,
    quickBetAmount: Double,
    onQuickBetAmountChange: (Double) -> Unit
) {
    val categories = listOf("Todos", "Tempo", "Política", "Dia-a-dia", "Esportes", "Entretenimento")

    val filteredBets = bets.filter { bet ->
        val matchesSearch = bet.title.contains(searchQuery, ignoreCase = true) ||
                bet.description.contains(searchQuery, ignoreCase = true)
        val matchesCategory = selectedCategory == "Todos" || bet.category.equals(selectedCategory, ignoreCase = true)
        matchesSearch && matchesCategory && bet.status == "OPEN"
    }

    val trendingBets = bets.filter { it.isTrending && it.status == "OPEN" }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Welcome Banner / Search
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Palpites Totais e Seguros!",
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = TextWhite
                )
                Text(
                    text = "Aposte do clima à política local. Ganhe XP e badges de reputação!",
                    fontSize = 14.sp,
                    color = TextGray
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Search Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchQueryChange,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("search_input"),
                    placeholder = { Text("Procurar palpites ativos...", color = TextGray) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = TextGray) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { onSearchQueryChange("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextGray)
                            }
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite,
                        unfocusedTextColor = TextWhite,
                        focusedContainerColor = CardDark,
                        unfocusedContainerColor = CardDark,
                        focusedBorderColor = NeonEmerald,
                        unfocusedBorderColor = Color.Transparent
                    ),
                    shape = RoundedCornerShape(16.dp),
                    singleLine = true
                )
            }
        }

        // Category Chips
        item {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 4.dp)
            ) {
                items(categories) { category ->
                    val isSelected = selectedCategory == category
                    FilterChip(
                        selected = isSelected,
                        onClick = { onCategoryChange(category) },
                        label = { Text(category, fontWeight = FontWeight.Medium) },
                        colors = FilterChipDefaults.filterChipColors(
                            containerColor = CardDark,
                            labelColor = TextGray,
                            selectedContainerColor = NeonEmerald,
                            selectedLabelColor = SlateDark
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            borderColor = Color.Transparent,
                            selectedBorderColor = Color.Transparent,
                            enabled = true,
                            selected = isSelected
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            }
        }

        // Quick Bet Configuration Panel
        item {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (quickBetEnabled) CardDark.copy(alpha = 0.9f) else CardDark.copy(alpha = 0.6f)
                ),
                shape = RoundedCornerShape(16.dp),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (quickBetEnabled) NeonEmerald.copy(alpha = 0.5f) else Color.Transparent
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .animateContentSize()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.FlashOn,
                                contentDescription = "Aposta Rápida",
                                tint = if (quickBetEnabled) NeonEmerald else TextGray,
                                modifier = Modifier.size(24.dp)
                            )
                            Column {
                                Text(
                                    text = "Aposta Rápida (1 Clique)",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 15.sp,
                                    color = TextWhite
                                )
                                Text(
                                    text = if (quickBetEnabled) "Ativado • Palpite direto no clique!" else "Ative para apostar sem abrir popups",
                                    fontSize = 11.sp,
                                    color = if (quickBetEnabled) NeonEmerald else TextGray
                                )
                            }
                        }
                        Switch(
                            checked = quickBetEnabled,
                            onCheckedChange = onQuickBetEnabledChange,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = SlateDark,
                                checkedTrackColor = NeonEmerald,
                                uncheckedThumbColor = TextGray,
                                uncheckedTrackColor = CardDark
                            ),
                            modifier = Modifier.testTag("quick_bet_toggle")
                        )
                    }

                    if (quickBetEnabled) {
                        HorizontalDivider(color = TextGray.copy(alpha = 0.15f))
                        
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = "Valor Padrão da Aposta Rápida:",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = TextGray
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                listOf(5.0, 10.0, 20.0, 50.0).forEach { amount ->
                                    val isSelected = quickBetAmount == amount
                                    OutlinedButton(
                                        onClick = { onQuickBetAmountChange(amount) },
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f),
                                        contentPadding = PaddingValues(vertical = 4.dp),
                                        colors = ButtonDefaults.outlinedButtonColors(
                                            contentColor = if (isSelected) NeonEmerald else TextGray
                                        ),
                                        border = androidx.compose.foundation.BorderStroke(
                                            1.dp,
                                            if (isSelected) NeonEmerald else TextGray.copy(alpha = 0.3f)
                                        )
                                    ) {
                                        Text(
                                            text = "R$ ${amount.toInt()}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Trending Carousel
        if (trendingBets.isNotEmpty() && searchQuery.isEmpty() && selectedCategory == "Todos") {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Whatshot,
                            contentDescription = "Trending",
                            tint = NeonOrange,
                            modifier = Modifier.size(22.dp)
                        )
                        Text(
                            text = "Bombando na Comunidade",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = TextWhite
                        )
                    }

                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(trendingBets) { bet ->
                            TrendingBetCard(bet = bet, onPlaceBetClick = onPlaceBetClick)
                        }
                    }
                }
            }
        }

        // Feed List Header
        item {
            Text(
                text = if (selectedCategory == "Todos") "Lista de Palpites Disponíveis" else "Palpites em: $selectedCategory",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = TextWhite,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // Feed list
        if (filteredBets.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.HourglassEmpty,
                        contentDescription = "Nenhum resultado",
                        tint = TextGray,
                        modifier = Modifier.size(64.dp)
                    )
                    Text(
                        text = "Sem palpites ativos",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextWhite,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "Seja o pioneiro a propor um palpite customizado clicando em 'Novo Palpite'!",
                        fontSize = 14.sp,
                        color = TextGray,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                }
            }
        } else {
            items(filteredBets) { bet ->
                BetCard(bet = bet, onPlaceBetClick = onPlaceBetClick)
            }
        }
    }
}

// ==========================================
// TRENDING BET CARD
// ==========================================
@Composable
fun TrendingBetCard(
    bet: Bet,
    onPlaceBetClick: (Bet, String) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .width(280.dp)
            .height(200.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(NeonOrange.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = bet.category,
                            color = NeonOrange,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Text(
                        text = "Por: ${bet.creatorName}",
                        color = TextGray,
                        fontSize = 11.sp
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = bet.title,
                    color = TextWhite,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Text(
                    text = bet.description,
                    color = TextGray,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Quick Odds Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onPlaceBetClick(bet, "A") },
                    colors = ButtonDefaults.buttonColors(containerColor = SlateDark),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(42.dp),
                    contentPadding = PaddingValues(horizontal = 4.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = bet.optionA, fontSize = 11.sp, color = TextWhite, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(text = "${bet.oddsA}", fontSize = 12.sp, color = NeonEmerald, fontWeight = FontWeight.Bold)
                    }
                }

                Button(
                    onClick = { onPlaceBetClick(bet, "B") },
                    colors = ButtonDefaults.buttonColors(containerColor = SlateDark),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(42.dp),
                    contentPadding = PaddingValues(horizontal = 4.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = bet.optionB, fontSize = 11.sp, color = TextWhite, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(text = "${bet.oddsB}", fontSize = 12.sp, color = NeonEmerald, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ==========================================
// STANDARD BET CARD
// ==========================================
@Composable
fun BetCard(
    bet: Bet,
    onPlaceBetClick: (Bet, String) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val catColor = when (bet.category) {
                        "Tempo" -> Color(0xFF60A5FA)
                        "Política" -> Color(0xFFF87171)
                        "Dia-a-dia" -> Color(0xFFFBBF24)
                        "Esportes" -> Color(0xFF34D399)
                        else -> Color(0xFFC084FC)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(catColor.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = bet.category,
                            color = catColor,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    if (bet.isTrending) {
                        Icon(
                            imageVector = Icons.Default.Whatshot,
                            contentDescription = "Trending",
                            tint = NeonOrange,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                Text(
                    text = "Pool: R$ ${String.format("%.0f", bet.totalPool)}",
                    color = TextGray,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }

            // Title & Description
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = bet.title,
                    color = TextWhite,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )

                Text(
                    text = bet.description,
                    color = TextGray,
                    fontSize = 13.sp
                )
            }

            // Odds Panel
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Option A
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onPlaceBetClick(bet, "A") },
                    colors = CardDefaults.cardColors(containerColor = SlateDark),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = bet.optionA,
                            color = TextWhite,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "${bet.oddsA}",
                            color = NeonEmerald,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }
                }

                // Option B
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onPlaceBetClick(bet, "B") },
                    colors = CardDefaults.cardColors(containerColor = SlateDark),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = bet.optionB,
                            color = TextWhite,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "${bet.oddsB}",
                            color = NeonEmerald,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            modifier = Modifier.padding(start = 4.dp)
                        )
                    }
                }
            }

            // Creator badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = "Criado por: ${bet.creatorName}",
                    fontSize = 10.sp,
                    color = TextGray
                )
            }
        }
    }
}

// ==========================================
// COMMUNITY TAB (SOCIAL BETTING FEED)
// ==========================================
@Composable
fun CommunityTab(
    posts: List<CommunityPost>,
    bets: List<Bet>,
    onLikeClick: (CommunityPost) -> Unit,
    onCopyBetClick: (Bet, String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Feed Social Palpites 🗣️",
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = TextWhite
                )
                Text(
                    text = "Veja em quem seus amigos estão apostando, curta análises e copie palpites certeiros instantaneamente!",
                    fontSize = 14.sp,
                    color = TextGray
                )
            }
        }

        if (posts.isEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    colors = CardDefaults.cardColors(containerColor = CardDark)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Forum,
                            contentDescription = "Vazio",
                            tint = TextGray,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "Nenhuma postagem comunitária ainda",
                            fontWeight = FontWeight.Bold,
                            color = TextWhite,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "Dê o pontapé inicial fazendo um palpite no Feed e compartilhando-o no menu 'Palpites'!",
                            color = TextGray,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(posts) { post ->
                CommunityPostCard(
                    post = post,
                    bets = bets,
                    onLikeClick = onLikeClick,
                    onCopyBetClick = onCopyBetClick
                )
            }
        }
    }
}

@Composable
fun CommunityPostCard(
    post: CommunityPost,
    bets: List<Bet>,
    onLikeClick: (CommunityPost) -> Unit,
    onCopyBetClick: (Bet, String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header: User Info + Level ring
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Profile frame glow ring
                    val ringBrush = getProfileFrameBrush(post.userLevel)
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .border(2.dp, ringBrush, CircleShape)
                            .clip(CircleShape)
                            .background(SlateDark),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = post.username.take(1).uppercase(),
                            color = TextWhite,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }

                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = post.username,
                                color = TextWhite,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(NeonEmerald.copy(alpha = 0.15f))
                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                            ) {
                                Text(
                                    text = "Nív. ${post.userLevel}",
                                    color = LightEmerald,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Text(
                            text = post.userBadge,
                            color = TextGray,
                            fontSize = 11.sp
                        )
                    }
                }

                // Time passed (simple simulation)
                val timeStr = remember(post.timestamp) {
                    val diff = System.currentTimeMillis() - post.timestamp
                    when {
                        diff < 60000 -> "Agora mesmo"
                        diff < 3600000 -> "${diff / 60000}m atrás"
                        else -> "${diff / 3600000}h atrás"
                    }
                }
                Text(
                    text = timeStr,
                    color = TextGray,
                    fontSize = 11.sp
                )
            }

            // Post Content Text (Analysis / Commentary)
            Text(
                text = post.comment,
                color = TextWhite,
                fontSize = 14.sp,
                fontWeight = FontWeight.Normal
            )

            // Inner Shared Slip Details
            Card(
                colors = CardDefaults.cardColors(containerColor = SlateDark),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = post.betTitle,
                        color = TextWhite,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Palpite:",
                                color = TextGray,
                                fontSize = 12.sp
                            )
                            Text(
                                text = post.chosenOptionText,
                                color = GoldAccent,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }

                        Text(
                            text = "@${String.format("%.2f", post.odds)}",
                            color = NeonEmerald,
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            // Actions panel: Like count & Copy/Follow Bet!
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Like Button
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .clickable { onLikeClick(post) }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Favorite,
                        contentDescription = "Curtir",
                        tint = Color.Red,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = "${post.likes} curtidas",
                        color = TextGray,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                // Follow / Copy Bet Action
                val targetBet = bets.find { it.id == post.betId }
                if (targetBet != null && targetBet.status == "OPEN") {
                    Button(
                        onClick = { onCopyBetClick(targetBet, post.chosenOption) },
                        colors = ButtonDefaults.buttonColors(containerColor = NeonEmerald),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy Bet",
                            tint = SlateDark,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Copiar Palpite",
                            color = SlateDark,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(CardDark)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Aposta Encerrada",
                            color = TextGray,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

// ==========================================
// MY BETS TAB (USER SLIPS)
// ==========================================
@Composable
fun MyBetsTab(
    userBets: List<UserBet>,
    onShareClick: (UserBet) -> Unit
) {
    val totalInvested = userBets.sumOf { it.amount }
    val pendingBetsCount = userBets.count { it.status == "PENDING" }
    val wonBets = userBets.filter { it.status == "WON" }
    val totalWon = wonBets.sumOf { it.potentialWin }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Performance Stats Overview
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Suas Estatísticas de Palpites",
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = TextWhite
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Total Invested
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = CardDark),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Total Aplicado", fontSize = 10.sp, color = TextGray)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "R$ ${String.format("%.2f", totalInvested)}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextWhite
                            )
                        }
                    }

                    // Total Returns
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = CardDark),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Retorno ganho", fontSize = 10.sp, color = TextGray)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "R$ ${String.format("%.2f", totalWon)}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = NeonEmerald
                            )
                        }
                    }

                    // Pendings
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = CardDark),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Pendentes", fontSize = 10.sp, color = TextGray)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "$pendingBetsCount slips",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = GoldAccent
                            )
                        }
                    }
                }
            }
        }

        // List Header
        item {
            Text(
                text = "Seus Bilhetes de Palpite Ativos",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = TextWhite,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // Slips list
        if (userBets.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ConfirmationNumber,
                        contentDescription = "Sem palpites",
                        tint = TextGray,
                        modifier = Modifier.size(64.dp)
                    )
                    Text(
                        text = "Ainda não palpitou",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextWhite,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "Vá para o Feed principal, selecione um tema e faça suas previsões!",
                        fontSize = 14.sp,
                        color = TextGray,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 24.dp)
                    )
                }
            }
        } else {
            items(userBets) { userBet ->
                UserBetCard(userBet = userBet, onShareClick = onShareClick)
            }
        }
    }
}

// ==========================================
// USER BET CARD WITH SHARE ACTION
// ==========================================
@Composable
fun UserBetCard(
    userBet: UserBet,
    onShareClick: (UserBet) -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = userBet.betTitle,
                    color = TextWhite,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    modifier = Modifier.weight(1f)
                )

                // Status Badge
                val (statusText, statusBg, statusColor) = when (userBet.status) {
                    "PENDING" -> Triple("Pendente", GoldAccent.copy(alpha = 0.15f), GoldAccent)
                    "WON" -> Triple("Ganhou", NeonEmerald.copy(alpha = 0.15f), NeonEmerald)
                    else -> Triple("Perdeu", Color.Red.copy(alpha = 0.15f), Color.Red)
                }

                Box(
                    modifier = Modifier
                        .padding(start = 8.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(statusBg)
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = statusText,
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Divider(color = SlateDark, thickness = 1.dp)

            // Bet details summary
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Escolha", fontSize = 11.sp, color = TextGray)
                    Text(
                        text = "${userBet.chosenOptionText} @${String.format("%.2f", userBet.odds)}",
                        color = TextWhite,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Apostado", fontSize = 11.sp, color = TextGray)
                    Text(
                        text = "R$ ${String.format("%.2f", userBet.amount)}",
                        color = TextWhite,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text("Retorno", fontSize = 11.sp, color = TextGray)
                    Text(
                        text = "R$ ${String.format("%.2f", userBet.potentialWin)}",
                        color = if (userBet.status == "WON") NeonEmerald else TextWhite,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }

            Divider(color = SlateDark, thickness = 0.5.dp)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Interactive share button (social aspect)
                IconButton(
                    onClick = { onShareClick(userBet) },
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(SlateDark)
                        .height(32.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        modifier = Modifier.padding(horizontal = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Compartilhar",
                            tint = NeonEmerald,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "Compartilhar",
                            color = NeonEmerald,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                val dateString = sdf.format(Date(userBet.createdAt))
                Text(
                    text = "Apostado em: $dateString",
                    color = TextGray,
                    fontSize = 10.sp
                )
            }
        }
    }
}

// ==========================================
// WALLET TAB
// ==========================================
@Composable
fun WalletTab(
    balance: Double,
    transactions: List<WalletTransaction>,
    onDepositClick: () -> Unit,
    onWithdrawClick: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Digital Card with Brush Gradient
        item {
            Card(
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.Transparent)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(NeonEmerald, SlateDark),
                                start = androidx.compose.ui.geometry.Offset.Zero,
                                end = androidx.compose.ui.geometry.Offset.Infinite
                            )
                        )
                        .padding(24.dp)
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Carteira Virtual Segura",
                                    color = TextWhite.copy(alpha = 0.8f),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = "Saldo Disponível",
                                    color = TextWhite,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                            Icon(
                                imageVector = Icons.Default.Security,
                                contentDescription = "Seguro",
                                tint = TextWhite,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Text(
                            text = "R$ ${String.format("%.2f", balance)}",
                            color = TextWhite,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Button(
                                onClick = onDepositClick,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("deposit_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = TextWhite),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.ArrowDownward, contentDescription = "Depositar", tint = SlateDark)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Depositar", color = SlateDark, fontWeight = FontWeight.Bold)
                            }

                            Button(
                                onClick = onWithdrawClick,
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("withdraw_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = CardDark),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Icon(Icons.Default.ArrowUpward, contentDescription = "Sacar", tint = TextWhite)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Sacar Pix", color = TextWhite, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Ledger Header
        item {
            Text(
                text = "Histórico de Transações",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = TextWhite,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // Transactions list
        if (transactions.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = "Sem transações",
                        tint = TextGray,
                        modifier = Modifier.size(64.dp)
                    )
                    Text(
                        text = "Nenhuma movimentação",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextWhite,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            items(transactions) { tx ->
                TransactionRow(tx = tx)
            }
        }
    }
}

// ==========================================
// TRANSACTION ROW
// ==========================================
@Composable
fun TransactionRow(tx: WalletTransaction) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardDark),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                val (icon, tint) = when (tx.type) {
                    "DEPOSIT" -> Icons.Default.AddCircle to NeonEmerald
                    "WITHDRAWAL" -> Icons.Default.RemoveCircle to NeonOrange
                    "BET_PLACED" -> Icons.Default.Casino to TextGray
                    else -> Icons.Default.EmojiEvents to GoldAccent
                }

                Icon(
                    imageVector = icon,
                    contentDescription = tx.type,
                    tint = tint,
                    modifier = Modifier.size(28.dp)
                )

                Column {
                    Text(
                        text = tx.description,
                        color = TextWhite,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
                    val dateStr = sdf.format(Date(tx.timestamp))
                    Text(
                        text = dateStr,
                        color = TextGray,
                        fontSize = 11.sp
                    )
                }
            }

            val sign = if (tx.amount >= 0) "+" else ""
            val color = if (tx.amount >= 0) NeonEmerald else TextWhite
            Text(
                text = "$sign R$ ${String.format("%.2f", tx.amount)}",
                color = color,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}

// ==========================================
// MANAGE TAB (ADMIN RESOLVER)
// ==========================================
@Composable
fun ManageTab(
    bets: List<Bet>,
    onResolveClick: (Bet, String) -> Unit
) {
    val openBets = bets.filter { it.status == "OPEN" }
    val resolvedBets = bets.filter { it.status != "OPEN" }

    var filterType by remember { mutableStateOf("OPEN") } // "OPEN" or "RESOLVED"

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "Soberano dos Palpites ⚖️",
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = TextWhite
                )
                Text(
                    text = "Defina o desfecho das previsões de forma autônoma e imediata! Qualquer bilhete pendente de usuário será liquidado com distribuição instantânea do prêmio.",
                    fontSize = 13.sp,
                    color = TextGray
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Toggle Open vs Resolved
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(CardDark)
                        .padding(4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (filterType == "OPEN") NeonEmerald else Color.Transparent)
                            .clickable { filterType = "OPEN" }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Abertos (${openBets.size})",
                            color = if (filterType == "OPEN") SlateDark else TextWhite,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (filterType == "RESOLVED") NeonEmerald else Color.Transparent)
                            .clickable { filterType = "RESOLVED" }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Fechados (${resolvedBets.size})",
                            color = if (filterType == "RESOLVED") SlateDark else TextWhite,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }

        val targetList = if (filterType == "OPEN") openBets else resolvedBets

        if (targetList.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.DoneAll,
                        contentDescription = "Limpo",
                        tint = TextGray,
                        modifier = Modifier.size(64.dp)
                    )
                    Text(
                        text = "Sem pendências!",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextWhite
                    )
                }
            }
        } else {
            items(targetList) { bet ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardDark),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(NeonEmerald.copy(alpha = 0.15f))
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = bet.category,
                                    color = NeonEmerald,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Text(
                                text = "Por: ${bet.creatorName}",
                                fontSize = 11.sp,
                                color = TextGray
                            )
                        }

                        Text(
                            text = bet.title,
                            color = TextWhite,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )

                        if (bet.status == "OPEN") {
                            Text(
                                text = "Defina a opção vitoriosa:",
                                fontSize = 12.sp,
                                color = GoldAccent,
                                fontWeight = FontWeight.Medium
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Button(
                                    onClick = { onResolveClick(bet, "A") },
                                    colors = ButtonDefaults.buttonColors(containerColor = SlateDark),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(text = "${bet.optionA}", fontSize = 12.sp, color = NeonEmerald)
                                }

                                Button(
                                    onClick = { onResolveClick(bet, "B") },
                                    colors = ButtonDefaults.buttonColors(containerColor = SlateDark),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(text = "${bet.optionB}", fontSize = 12.sp, color = NeonEmerald)
                                }
                            }
                        } else {
                            val resolvedText = if (bet.status == "RESOLVED_A") bet.optionA else bet.optionB
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(SlateDark)
                                    .padding(12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "Resultado: Ganhou '$resolvedText'",
                                    color = LightEmerald,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// PLACE BET DIALOG
// ==========================================
@Composable
fun PlaceBetDialog(
    bet: Bet,
    option: String,
    walletBalance: Double,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    val optionText = if (option == "A") bet.optionA else bet.optionB
    val odds = if (option == "A") bet.oddsA else bet.oddsB

    var betAmountText by remember { mutableStateOf("") }
    val betAmount = betAmountText.toDoubleOrNull() ?: 0.0
    val potentialPayout = betAmount * odds

    val isAmountValid = betAmount > 0 && betAmount <= walletBalance
    val focusManager = LocalFocusManager.current

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Bilhete Seguro",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = TextWhite
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                    }
                }

                // Bet details
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(text = bet.title, color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(text = "Escolha: $optionText", color = GoldAccent, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text(text = "@${String.format("%.2f", odds)}", color = NeonEmerald, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }

                // Balance summary
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(SlateDark)
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Carteira:", color = TextGray, fontSize = 12.sp)
                    Text("R$ ${String.format("%.2f", walletBalance)}", color = TextWhite, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                }

                // Amount Text Field
                OutlinedTextField(
                    value = betAmountText,
                    onValueChange = { input ->
                        if (input.isEmpty() || input.toDoubleOrNull() != null) {
                            betAmountText = input
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("bet_amount_input"),
                    label = { Text("Valor do Palpite (R$)", color = TextGray) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite,
                        unfocusedTextColor = TextWhite,
                        focusedBorderColor = NeonEmerald,
                        unfocusedBorderColor = TextGray
                    ),
                    singleLine = true
                )

                // Quick Chips
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(10.0, 50.0, 100.0).forEach { value ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(SlateDark)
                                .clickable {
                                    betAmountText = String.format(Locale.US, "%.0f", value)
                                }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "+ R$${value.toInt()}", color = TextWhite, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(NeonOrange.copy(alpha = 0.15f))
                            .clickable {
                                betAmountText = String.format(Locale.US, "%.2f", walletBalance)
                            }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "ALL IN", color = NeonOrange, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Retorno Potencial:", color = TextGray, fontSize = 14.sp)
                    Text(
                        text = "R$ ${String.format("%.2f", potentialPayout)}",
                        color = NeonEmerald,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp
                    )
                }

                if (betAmount > walletBalance) {
                    Text(
                        text = "Saldo insuficiente para apostar esse valor!",
                        color = Color.Red,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Button(
                    onClick = {
                        if (isAmountValid) {
                            onConfirm(betAmount)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("confirm_bet_button"),
                    enabled = isAmountValid,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = NeonEmerald,
                        disabledContainerColor = TextGray.copy(alpha = 0.3f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Security, contentDescription = "Confiança", tint = SlateDark)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Confirmar Palpite Seguro (+50 XP)", color = SlateDark, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}

// ==========================================
// CREATE CUSTOM BET DIALOG
// ==========================================
@Composable
fun CreateBetDialog(
    onDismiss: () -> Unit,
    onConfirm: (title: String, desc: String, category: String, optA: String, optB: String, oddsA: Double, oddsB: Double) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Dia-a-dia") }
    var optionA by remember { mutableStateOf("Sim") }
    var optionB by remember { mutableStateOf("Não") }
    var oddsAText by remember { mutableStateOf("1.90") }
    var oddsBText by remember { mutableStateOf("1.90") }

    val categories = listOf("Tempo", "Política", "Dia-a-dia", "Esportes", "Entretenimento")
    var categoryDropdownExpanded by remember { mutableStateOf(false) }

    val isFormValid = title.isNotBlank() && desc.isNotBlank() &&
            optionA.isNotBlank() && optionB.isNotBlank() &&
            (oddsAText.toDoubleOrNull() ?: 0.0) >= 1.0 &&
            (oddsBText.toDoubleOrNull() ?: 0.0) >= 1.0

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Criar Nova Aposta",
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            color = TextWhite
                        )
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                        }
                    }
                }

                item {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("new_bet_title_input"),
                        label = { Text("Tema do palpite (Ex: Vai chover amanhã?)", color = TextGray) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextWhite,
                            unfocusedTextColor = TextWhite,
                            focusedBorderColor = NeonEmerald,
                            unfocusedBorderColor = TextGray
                        ),
                        singleLine = true
                    )
                }

                item {
                    OutlinedTextField(
                        value = desc,
                        onValueChange = { desc = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Critério claro de resolução", color = TextGray) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextWhite,
                            unfocusedTextColor = TextWhite,
                            focusedBorderColor = NeonEmerald,
                            unfocusedBorderColor = TextGray
                        )
                    )
                }

                item {
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedTextField(
                            value = category,
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { categoryDropdownExpanded = true },
                            label = { Text("Categoria", color = TextGray) },
                            trailingIcon = {
                                IconButton(onClick = { categoryDropdownExpanded = true }) {
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = "Dropdown", tint = TextWhite)
                                }
                            },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextWhite,
                                unfocusedTextColor = TextWhite,
                                focusedBorderColor = NeonEmerald,
                                unfocusedBorderColor = TextGray
                            )
                        )
                        DropdownMenu(
                            expanded = categoryDropdownExpanded,
                            onDismissRequest = { categoryDropdownExpanded = false },
                            modifier = Modifier.background(CardDark)
                        ) {
                            categories.forEach { cat ->
                                DropdownMenuItem(
                                    text = { Text(cat, color = TextWhite) },
                                    onClick = {
                                        category = cat
                                        categoryDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = optionA,
                            onValueChange = { optionA = it },
                            modifier = Modifier.weight(1.5f),
                            label = { Text("Opção A", color = TextGray) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextWhite,
                                unfocusedTextColor = TextWhite,
                                focusedBorderColor = NeonEmerald,
                                unfocusedBorderColor = TextGray
                            ),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = oddsAText,
                            onValueChange = { oddsAText = it },
                            modifier = Modifier.weight(1f),
                            label = { Text("Odds A", color = TextGray) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextWhite,
                                unfocusedTextColor = TextWhite,
                                focusedBorderColor = NeonEmerald,
                                unfocusedBorderColor = TextGray
                            ),
                            singleLine = true
                        )
                    }
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedTextField(
                            value = optionB,
                            onValueChange = { optionB = it },
                            modifier = Modifier.weight(1.5f),
                            label = { Text("Opção B", color = TextGray) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextWhite,
                                unfocusedTextColor = TextWhite,
                                focusedBorderColor = NeonEmerald,
                                unfocusedBorderColor = TextGray
                            ),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = oddsBText,
                            onValueChange = { oddsBText = it },
                            modifier = Modifier.weight(1f),
                            label = { Text("Odds B", color = TextGray) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = TextWhite,
                                unfocusedTextColor = TextWhite,
                                focusedBorderColor = NeonEmerald,
                                unfocusedBorderColor = TextGray
                            ),
                            singleLine = true
                        )
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(6.dp))
                    Button(
                        onClick = {
                            if (isFormValid) {
                                onConfirm(
                                    title,
                                    desc,
                                    category,
                                    optionA,
                                    optionB,
                                    oddsAText.toDoubleOrNull() ?: 1.90,
                                    oddsBText.toDoubleOrNull() ?: 1.90
                                )
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("submit_new_bet_button"),
                        enabled = isFormValid,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NeonEmerald,
                            disabledContainerColor = TextGray.copy(alpha = 0.3f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Publicar Aposta Online (+100 XP)", color = SlateDark, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

// ==========================================
// QUICK WALLET ACTION DIALOG
// ==========================================
@Composable
fun WalletActionDialog(
    title: String,
    description: String,
    actionLabel: String,
    actionColor: Color,
    maxAmountLimit: Double? = null,
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var amountText by remember { mutableStateOf("") }
    val amount = amountText.toDoubleOrNull() ?: 0.0
    val isAmountValid = amount > 0 && (maxAmountLimit == null || amount <= maxAmountLimit)

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = TextWhite
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                    }
                }

                Text(
                    text = description,
                    fontSize = 13.sp,
                    color = TextGray
                )

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { input ->
                        if (input.isEmpty() || input.toDoubleOrNull() != null) {
                            amountText = input
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("action_amount_input"),
                    label = { Text("Valor (R$)", color = TextGray) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite,
                        unfocusedTextColor = TextWhite,
                        focusedBorderColor = actionColor,
                        unfocusedBorderColor = TextGray
                    ),
                    singleLine = true
                )

                if (maxAmountLimit != null && amount > maxAmountLimit) {
                    Text(
                        text = "Valor excede seu saldo de R$ ${String.format("%.2f", maxAmountLimit)}!",
                        color = Color.Red,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Button(
                    onClick = {
                        if (isAmountValid) {
                            onConfirm(amount)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("confirm_action_button"),
                    enabled = isAmountValid,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = actionColor,
                        disabledContainerColor = TextGray.copy(alpha = 0.3f)
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(actionLabel, color = SlateDark, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ==========================================
// PIX REAL DEPOSIT DIALOG
// ==========================================
@Composable
fun PixDepositDialog(
    onDismiss: () -> Unit,
    onConfirm: (Double) -> Unit
) {
    var step by remember { mutableStateOf(1) }
    var amountText by remember { mutableStateOf("50.00") }
    val amount = amountText.toDoubleOrNull() ?: 0.0
    val isAmountValid = amount >= 1.0 // Mínimo R$ 1,00

    val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
    var showCopiedText by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = if (step == 1) "Depositar Saldo Seguro" else "Pagamento via Pix",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = TextWhite
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                    }
                }

                if (step == 1) {
                    // STEP 1: Enter / Choose Deposit Amount
                    Text(
                        text = "Escolha o valor que deseja depositar na sua conta PalpiteTotal via Pix.",
                        fontSize = 13.sp,
                        color = TextGray,
                        textAlign = TextAlign.Start,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = amountText,
                        onValueChange = { input ->
                            if (input.isEmpty() || input.toDoubleOrNull() != null || input == ".") {
                                amountText = input
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("deposit_amount_input"),
                        label = { Text("Valor do Depósito (R$)", color = TextGray) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextWhite,
                            unfocusedTextColor = TextWhite,
                            focusedBorderColor = NeonEmerald,
                            unfocusedBorderColor = TextGray
                        ),
                        singleLine = true
                    )

                    // Quick Select Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(10.0, 20.0, 50.0, 100.0).forEach { value ->
                            OutlinedButton(
                                onClick = { amountText = String.format(Locale.US, "%.2f", value) },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = if (amount == value) NeonEmerald else TextGray
                                ),
                                border = androidx.compose.foundation.BorderStroke(
                                    1.dp,
                                    if (amount == value) NeonEmerald else TextGray.copy(alpha = 0.5f)
                                )
                            ) {
                                Text("R$ ${value.toInt()}", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Button(
                        onClick = {
                            if (isAmountValid) {
                                step = 2
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("generate_pix_button"),
                        enabled = isAmountValid,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = NeonEmerald,
                            disabledContainerColor = TextGray.copy(alpha = 0.3f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Gerar QR Code Pix", color = SlateDark, fontWeight = FontWeight.Bold)
                    }
                } else {
                    // STEP 2: Show Pix QR Code & Copy Pix Code
                    Text(
                        text = "Escaneie o QR Code abaixo com o app do seu banco para transferir R$ ${String.format("%.2f", amount)}:",
                        fontSize = 13.sp,
                        color = TextGray,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )

                    // QR Code Frame with border
                    Box(
                        modifier = Modifier
                            .size(210.dp)
                            .border(2.dp, NeonEmerald, RoundedCornerShape(16.dp))
                            .padding(8.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        androidx.compose.foundation.Image(
                            painter = androidx.compose.ui.res.painterResource(id = R.drawable.img_pix_qrcode),
                            contentDescription = "QR Code Pix",
                            modifier = Modifier.size(190.dp)
                        )
                    }

                    // Copy Pix Code section
                    val pixKeyString = "00020101021126580014br.gov.bcb.pix0136palpitetotal-secure-pixkey-20260719020412345678901235204000053039865407" + String.format(Locale.US, "%.2f", amount) + "5802BR5912PalpiteTotal6009Sao Paulo62070503***6304"
                    
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(SlateDark)
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Pix Copia e Cola:",
                                fontSize = 11.sp,
                                color = TextGray,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (showCopiedText) "Copiado!" else "Copiar Código",
                                fontSize = 11.sp,
                                color = NeonEmerald,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable {
                                    clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(pixKeyString))
                                    showCopiedText = true
                                }
                            )
                        }
                        Text(
                            text = pixKeyString,
                            fontSize = 10.sp,
                            color = TextWhite.copy(alpha = 0.7f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = { step = 1 },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = TextGray
                            ),
                            border = androidx.compose.foundation.BorderStroke(
                                1.dp,
                                TextGray.copy(alpha = 0.5f)
                            )
                        ) {
                            Text("Voltar", fontSize = 14.sp)
                        }

                        Button(
                            onClick = {
                                onConfirm(amount)
                            },
                            modifier = Modifier
                                .weight(1f)
                                .testTag("confirm_deposit_button"),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = NeonEmerald
                            ),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Já Realizei", color = SlateDark, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// PROFILE & LEVELING HUB DIALOG (REDESIGNED)
// ==========================================
@Composable
fun BadgeCard(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    color: Color,
    isUnlocked: Boolean,
    progressText: String,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isUnlocked) SlateDark else SlateDark.copy(alpha = 0.4f)
        ),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(
            width = 1.dp,
            color = if (isUnlocked) color.copy(alpha = 0.35f) else Color.Transparent
        ),
        modifier = modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(10.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Icon container with glowing circle if unlocked, or locked grey circle
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(
                        if (isUnlocked) color.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.05f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isUnlocked) icon else Icons.Default.Lock,
                    contentDescription = title,
                    tint = if (isUnlocked) color else TextGray.copy(alpha = 0.4f),
                    modifier = Modifier.size(18.dp)
                )
            }

            Column(
                verticalArrangement = Arrangement.spacedBy(1.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = if (isUnlocked) TextWhite else TextGray
                )
                Text(
                    text = description,
                    fontSize = 10.sp,
                    color = if (isUnlocked) TextWhite.copy(alpha = 0.7f) else TextGray.copy(alpha = 0.4f),
                    maxLines = 2
                )
                if (progressText.isNotEmpty()) {
                    Text(
                        text = progressText,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isUnlocked) color else TextGray.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}

@Composable
fun ProfileDialog(
    profile: UserProfile,
    walletBalance: Double,
    allUserBets: List<UserBet>,
    allTransactions: List<WalletTransaction>,
    onDepositClick: () -> Unit,
    onWithdrawClick: () -> Unit,
    onDismiss: () -> Unit,
    onSaveInterests: (String) -> Unit,
    onReferFriend: () -> Unit
) {
    val categories = listOf("Tempo", "Política", "Dia-a-dia", "Esportes", "Entretenimento")
    var selectedInterests by remember {
        mutableStateOf(profile.interests.split(",").map { it.trim() }.toSet())
    }

    val currentLevel = profile.level
    val nextLevelXp = currentLevel * 200
    val progress = (profile.xp.toFloat() / nextLevelXp.toFloat()).coerceIn(0f, 1f)
    val cosmeticPerk = when (currentLevel) {
        1 -> "Moldura Bronze Simples"
        2 -> "Moldura Prata Polida"
        3 -> "Glow Ouro Reluzente"
        4 -> "Platina Esmeralda Cintilante"
        else -> "Efeito Mestre Neon Ultra"
    }

    // Badge Unlocks Logic
    val wonBetsCount = allUserBets.count { it.status == "WON" }
    val isPioneer = true // Founders Badge
    val isActiveBettor = allUserBets.size >= 3
    val isWinnerBettor = wonBetsCount >= 1
    val isInvestor = walletBalance >= 200.0
    val isPopular = profile.referralCount >= 1
    val isElite = currentLevel >= 3

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Security,
                                contentDescription = null,
                                tint = NeonEmerald,
                                modifier = Modifier.size(22.dp)
                            )
                            Text(
                                text = "Central de Reputação",
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                color = TextWhite
                            )
                        }
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                        }
                    }
                }

                // Profile Avatar & Level Header Card
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SlateDark),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Avatar with glowing border ring
                            val brush = getProfileFrameBrush(currentLevel)
                            Box(
                                modifier = Modifier
                                    .size(64.dp)
                                    .border(3.dp, brush, CircleShape)
                                    .clip(CircleShape)
                                    .background(CardDark),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = profile.username.take(1).uppercase(),
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.Black,
                                    color = TextWhite
                                )
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = profile.username,
                                    color = TextWhite,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(NeonEmerald)
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "Nível $currentLevel",
                                        color = SlateDark,
                                        fontWeight = FontWeight.Black,
                                        fontSize = 11.sp
                                    )
                                }
                                Text(
                                    text = cosmeticPerk,
                                    color = LightEmerald,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }
                }

                // WALLET SECTION (SALDO ATUAL DA CARTEIRA VIRTUAL + STATS)
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SlateDark),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AccountBalanceWallet,
                                        contentDescription = "Carteira",
                                        tint = NeonEmerald,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Text(
                                        text = "Carteira Virtual",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = TextWhite
                                    )
                                }
                                
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50.dp))
                                        .background(NeonEmerald.copy(alpha = 0.15f))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "Saldo Ativo",
                                        color = NeonEmerald,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            // Balance
                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = "R$ ${String.format(java.util.Locale.US, "%.2f", walletBalance)}",
                                    fontSize = 26.sp,
                                    fontWeight = FontWeight.Black,
                                    color = TextWhite
                                )
                                Text(
                                    text = "Disponível para novos palpites",
                                    color = TextGray,
                                    fontSize = 11.sp
                                )
                            }

                            // Compact stats summary row
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(CardDark.copy(alpha = 0.5f))
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = "${allUserBets.size}",
                                        fontWeight = FontWeight.Black,
                                        color = TextWhite,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        text = "Palpites",
                                        color = TextGray,
                                        fontSize = 9.sp
                                    )
                                }
                                Box(modifier = Modifier.width(1.dp).height(20.dp).background(TextGray.copy(alpha = 0.15f)))
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = "$wonBetsCount",
                                        fontWeight = FontWeight.Black,
                                        color = NeonEmerald,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        text = "Acertos",
                                        color = TextGray,
                                        fontSize = 9.sp
                                    )
                                }
                                Box(modifier = Modifier.width(1.dp).height(20.dp).background(TextGray.copy(alpha = 0.15f)))
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    val rate = if (allUserBets.isNotEmpty()) {
                                        val finished = allUserBets.count { it.status != "PENDING" }
                                        if (finished > 0) {
                                            (wonBetsCount.toFloat() / finished.toFloat() * 100).toInt()
                                        } else 0
                                    } else 0
                                    Text(
                                        text = "$rate%",
                                        fontWeight = FontWeight.Black,
                                        color = LightEmerald,
                                        fontSize = 13.sp
                                    )
                                    Text(
                                        text = "Aproveitamento",
                                        color = TextGray,
                                        fontSize = 9.sp
                                    )
                                }
                            }

                            // Quick Actions
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = onDepositClick,
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = NeonEmerald),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.ArrowDownward, contentDescription = null, tint = SlateDark, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Depositar Pix", color = SlateDark, fontWeight = FontWeight.Black, fontSize = 11.sp)
                                }

                                OutlinedButton(
                                    onClick = onWithdrawClick,
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = TextWhite),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, TextGray.copy(alpha = 0.3f)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.ArrowUpward, contentDescription = null, tint = TextWhite, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Sacar Saldo", color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }

                // XP PROGRESS BAR (SISTEMA DE PONTUAÇÃO)
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Progresso de XP",
                                color = TextGray,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${profile.xp} / ${nextLevelXp} XP",
                                color = TextWhite,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Custom progress indicator
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(12.dp)
                                .clip(RoundedCornerShape(50.dp))
                                .background(SlateDark)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .fillMaxWidth(progress)
                                    .clip(RoundedCornerShape(50.dp))
                                    .background(
                                        Brush.horizontalGradient(
                                            listOf(NeonEmerald, LightEmerald)
                                        )
                                    )
                            )
                        }
                        Text(
                            text = "💡 Ganhe +50 XP ao palpitar, +150 XP ao acertar e +300 XP indicando amigos!",
                            color = TextGray,
                            fontSize = 11.sp
                        )
                    }
                }

                // INSÍGNIAS CONQUISTADAS SECTION
                item {
                    HorizontalDivider(color = SlateDark)
                    Text(
                        text = "Insígnias de Prestígio 🏆",
                        fontWeight = FontWeight.Bold,
                        color = TextWhite,
                        fontSize = 15.sp,
                        modifier = Modifier.padding(bottom = 2.dp)
                    )
                    Text(
                        text = "Complete desafios e palpites para desbloquear conquistas exclusivas e mostrar seu poder na comunidade.",
                        color = TextGray,
                        fontSize = 12.sp
                    )
                }

                // Badges Grid Rows (2 badges per row)
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        // Row 1
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            BadgeCard(
                                title = "Pioneiro",
                                description = "Membro pioneiro fundador.",
                                icon = Icons.Default.Security,
                                color = GoldAccent,
                                isUnlocked = isPioneer,
                                progressText = "Desbloqueado",
                                modifier = Modifier.weight(1f)
                            )
                            BadgeCard(
                                title = "Ativo",
                                description = "Faça 3 ou mais palpites.",
                                icon = Icons.Default.Whatshot,
                                color = NeonOrange,
                                isUnlocked = isActiveBettor,
                                progressText = "${allUserBets.size}/3 Palpites",
                                modifier = Modifier.weight(1f)
                            )
                        }

                        // Row 2
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            BadgeCard(
                                title = "Vencedor",
                                description = "Acerte seu 1º palpite.",
                                icon = Icons.Default.EmojiEvents,
                                color = Color(0xFFFACC15),
                                isUnlocked = isWinnerBettor,
                                progressText = "$wonBetsCount/1 Acerto",
                                modifier = Modifier.weight(1f)
                            )
                            BadgeCard(
                                title = "Investidor",
                                description = "Saldo R$ 200 ou mais.",
                                icon = Icons.Default.AccountBalanceWallet,
                                color = NeonEmerald,
                                isUnlocked = isInvestor,
                                progressText = "R$ ${String.format(java.util.Locale.US, "%.0f", walletBalance)}/200",
                                modifier = Modifier.weight(1f)
                            )
                        }

                        // Row 3
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            BadgeCard(
                                title = "Popular",
                                description = "Indique 1 amigo.",
                                icon = Icons.Default.Group,
                                color = Color(0xFF60A5FA),
                                isUnlocked = isPopular,
                                progressText = "${profile.referralCount}/1 Amigo",
                                modifier = Modifier.weight(1f)
                            )
                            BadgeCard(
                                title = "Mestre Elite",
                                description = "Alcance o Nível 3.",
                                icon = Icons.Default.FlashOn,
                                color = Color(0xFFA78BFA),
                                isUnlocked = isElite,
                                progressText = "Nível $currentLevel/3",
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }

                // Stated Interests Preferences
                item {
                    HorizontalDivider(color = SlateDark)
                    Text(
                        text = "Áreas de Interesse (Filtros de Push)",
                        fontWeight = FontWeight.Bold,
                        color = TextWhite,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Selecione seus temas favoritos para receber notificações customizadas instantaneamente.",
                        color = TextGray,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        categories.forEach { category ->
                            val isChecked = selectedInterests.contains(category)
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        selectedInterests = if (isChecked) {
                                            selectedInterests - category
                                        } else {
                                            selectedInterests + category
                                        }
                                    }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        selectedInterests = if (checked) {
                                            selectedInterests + category
                                        } else {
                                            selectedInterests - category
                                        }
                                    },
                                    colors = CheckboxDefaults.colors(
                                        checkedColor = NeonEmerald,
                                        uncheckedColor = TextGray,
                                        checkmarkColor = SlateDark
                                    )
                                )
                                Text(
                                    text = category,
                                    color = TextWhite,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }
                    }

                    Button(
                        onClick = {
                            val interestString = selectedInterests.joinToString(",")
                            onSaveInterests(interestString)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SlateDark),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Salvar Preferências", color = NeonEmerald, fontWeight = FontWeight.Bold)
                    }
                }

                // Referral System Section
                item {
                    HorizontalDivider(color = SlateDark)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SlateDark),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Referência & Convites 👥",
                                color = TextWhite,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Amigos indicados:",
                                    color = TextGray,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "${profile.referralCount} amigos",
                                    color = NeonEmerald,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp
                                )
                            }

                            Button(
                                onClick = onReferFriend,
                                colors = ButtonDefaults.buttonColors(containerColor = NeonEmerald),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Indicar Amigo (+300 XP)", color = SlateDark, fontWeight = FontWeight.Black, fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// NOTIFICATIONS DIALOG (INBOX & SIMULATOR)
// ==========================================
@Composable
fun NotificationsDialog(
    notifications: List<AppNotification>,
    onDismiss: () -> Unit,
    onClearAll: () -> Unit,
    onSimulateClosing: () -> Unit,
    onSimulateTrending: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Caixa de Notificações 🔔",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = TextWhite
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                    }
                }

                // Interactive Simulator triggers for notifications!
                Card(
                    colors = CardDefaults.cardColors(containerColor = SlateDark),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Painel Simulação Push (QA)",
                            color = GoldAccent,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = onSimulateClosing,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = CardDark),
                                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Text("1. Bet Fechando", fontSize = 10.sp, color = TextWhite)
                            }

                            Button(
                                onClick = onSimulateTrending,
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = CardDark),
                                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Text("2. Bet Tendência", fontSize = 10.sp, color = TextWhite)
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Mensagens Recebidas",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextGray
                    )
                    if (notifications.isNotEmpty()) {
                        Text(
                            text = "Marcar lidas",
                            color = NeonEmerald,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { onClearAll() }
                        )
                    }
                }

                // Notifications inbox list
                if (notifications.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.NotificationsNone,
                                contentDescription = "Sem notificações",
                                tint = TextGray,
                                modifier = Modifier.size(40.dp)
                            )
                            Text(
                                text = "Sua caixa está limpa!",
                                color = TextGray,
                                fontSize = 13.sp
                            )
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 240.dp)
                    ) {
                        items(notifications) { notif ->
                            NotificationRowCard(notif = notif)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationRowCard(notif: AppNotification) {
    val (icon, color) = when (notif.type) {
        "CLOSING" -> Icons.Default.HourglassBottom to NeonOrange
        "RESULT" -> Icons.Default.EmojiEvents to GoldAccent
        "TRENDING_INTEREST" -> Icons.Default.Whatshot to NeonEmerald
        else -> Icons.Default.Stars to LightEmerald
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = SlateDark),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.Top
        ) {
            Icon(
                imageVector = icon,
                contentDescription = notif.type,
                tint = color,
                modifier = Modifier.size(22.dp)
            )

            Column(verticalArrangement = Arrangement.spacedBy(2.dp), modifier = Modifier.weight(1f)) {
                Text(
                    text = notif.title,
                    color = TextWhite,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp
                )
                Text(
                    text = notif.message,
                    color = TextGray,
                    fontSize = 11.sp
                )
            }
        }
    }
}

// ==========================================
// SHARE BET DIALOG (SOCIAL LINK PREVIEW)
// ==========================================
@Composable
fun ShareBetDialog(
    userBet: UserBet,
    onDismiss: () -> Unit,
    onShareConfirm: (String) -> Unit
) {
    var comment by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardDark),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Compartilhar Palpite",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = TextWhite
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fechar", tint = TextGray)
                    }
                }

                Text(
                    text = "Mostre aos outros usuários seu bilhete de aposta! Deixe um comentário de análise para que eles possam copiar o seu palpite.",
                    fontSize = 13.sp,
                    color = TextGray
                )

                // Slip Preview box
                Card(
                    colors = CardDefaults.cardColors(containerColor = SlateDark),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = userBet.betTitle,
                            color = TextWhite,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Escolha: ${userBet.chosenOptionText}",
                                color = GoldAccent,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Odds: @${String.format("%.2f", userBet.odds)}",
                                color = NeonEmerald,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = comment,
                    onValueChange = { comment = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Seu comentário / análise...", color = TextGray) },
                    placeholder = { Text("Ex: Essa odd tá de graça, vamos lucrar juntos!", color = TextGray) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TextWhite,
                        unfocusedTextColor = TextWhite,
                        focusedBorderColor = NeonEmerald,
                        unfocusedBorderColor = TextGray
                    )
                )

                Button(
                    onClick = { onShareConfirm(comment) },
                    colors = ButtonDefaults.buttonColors(containerColor = NeonEmerald),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Share, contentDescription = "Share", tint = SlateDark, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Compartilhar no Feed (+50 XP)", color = SlateDark, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
