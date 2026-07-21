package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.AppDatabase
import com.example.data.BetRepository
import com.example.data.model.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class BetViewModel(application: Application) : AndroidViewModel(application) {
    private val database = AppDatabase.getDatabase(application)
    private val repository = BetRepository(
        database.betDao(),
        database.userBetDao(),
        database.walletTransactionDao(),
        database.userProfileDao(),
        database.communityPostDao(),
        database.appNotificationDao()
    )

    val allBets: StateFlow<List<Bet>> = repository.allBets
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allUserBets: StateFlow<List<UserBet>> = repository.allUserBets
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allTransactions: StateFlow<List<WalletTransaction>> = repository.allTransactions
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val walletBalance: StateFlow<Double> = repository.walletBalance
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0.0)

    val userProfile: StateFlow<UserProfile?> = repository.userProfile
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val allPosts: StateFlow<List<CommunityPost>> = repository.allPosts
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allNotifications: StateFlow<List<AppNotification>> = repository.allNotifications
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val unreadNotificationsCount: StateFlow<Int> = repository.unreadNotificationsCount
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    private val _errorEvent = MutableSharedFlow<String>()
    val errorEvent: SharedFlow<String> = _errorEvent.asSharedFlow()

    private val _successEvent = MutableSharedFlow<String>()
    val successEvent: SharedFlow<String> = _successEvent.asSharedFlow()

    init {
        viewModelScope.launch {
            // Seed database if it is empty
            val currentBets = repository.allBets.first()
            if (currentBets.isEmpty()) {
                seedInitialData()
            }

            // Ensure profile exists
            val profile = repository.getProfile()
            if (profile == null) {
                repository.insertProfile(UserProfile(
                    username = "PalpiteiroMestre",
                    xp = 150,
                    level = 1,
                    referralCount = 0,
                    interests = "Tempo,Esportes,Política"
                ))
            }

            // Seed community posts if empty
            val posts = repository.allPosts.first()
            if (posts.isEmpty()) {
                seedInitialCommunityPosts()
            }
        }
    }

    private suspend fun seedInitialData() {
        // 1. Initial Deposit
        repository.insertTransaction(
            WalletTransaction(
                amount = 1000.00,
                description = "Bônus de Boas-Vindas Seguro",
                type = "DEPOSIT"
            )
        )

        // 2. Sample Bets
        val sampleBets = listOf(
            Bet(
                title = "Será que chove hoje em São Paulo?",
                description = "Baseado na previsão oficial do tempo de Congonhas.",
                category = "Tempo",
                oddsA = 1.80,
                oddsB = 2.10,
                isTrending = true,
                totalPool = 12450.00
            ),
            Bet(
                title = "O próximo debate eleitoral mencionará 'Moeda Única'?",
                description = "Palavra exata dita por qualquer candidato na TV aberta.",
                category = "Política",
                oddsA = 1.95,
                oddsB = 1.85,
                isTrending = true,
                totalPool = 35200.00
            ),
            Bet(
                title = "O Palmeiras ganhará o clássico paulista neste domingo?",
                description = "Partida oficial do Campeonato Brasileiro de Futebol.",
                category = "Esportes",
                oddsA = 2.15,
                oddsB = 1.75,
                isTrending = true,
                totalPool = 84000.00
            ),
            Bet(
                title = "O metrô da Linha Amarela atrasará no pico amanhã?",
                description = "Definido como interrupção reportada por mais de 5 minutos.",
                category = "Dia-a-dia",
                oddsA = 1.65,
                oddsB = 2.30,
                isTrending = true,
                totalPool = 5400.00
            ),
            Bet(
                title = "O preço do pão francês passará de R$ 22/kg na padaria central?",
                description = "Acompanhamento da tabela de preços na zona sul.",
                category = "Dia-a-dia",
                oddsA = 1.90,
                oddsB = 1.90,
                isTrending = false,
                totalPool = 1200.00
            ),
            Bet(
                title = "Quem levará o prêmio de melhor álbum no festival nacional?",
                description = "Escolha oficial do júri técnico do evento.",
                category = "Entretenimento",
                optionA = "Favorito",
                optionB = "Indie Revelação",
                oddsA = 1.40,
                oddsB = 3.10,
                isTrending = true,
                totalPool = 15800.00
            )
        )

        for (bet in sampleBets) {
            repository.insertBet(bet)
        }
    }

    private suspend fun seedInitialCommunityPosts() {
        val samplePosts = listOf(
            CommunityPost(
                username = "VidenteDasOdds",
                userLevel = 4,
                userBadge = "Especialista",
                betId = 1,
                betTitle = "Será que chove hoje em São Paulo?",
                chosenOption = "A",
                chosenOptionText = "Sim",
                odds = 1.80,
                comment = "Chovendo canivete aqui na Zona Sul! Essa odd 1.80 é dinheiro grátis, confia!",
                likes = 12
            ),
            CommunityPost(
                username = "DebatedorProfissional",
                userLevel = 3,
                userBadge = "Palpiteiro",
                betId = 2,
                betTitle = "O próximo debate eleitoral mencionará 'Moeda Única'?",
                chosenOption = "A",
                chosenOptionText = "Sim",
                odds = 1.95,
                comment = "Sempre trazem pauta econômica no segundo bloco. Vai ser citado de certeza!",
                likes = 8
            ),
            CommunityPost(
                username = "VerdaoDeCoracao",
                userLevel = 5,
                userBadge = "Mestre Supremo",
                betId = 3,
                betTitle = "O Palmeiras ganhará o clássico paulista neste domingo?",
                chosenOption = "A",
                chosenOptionText = "Sim",
                odds = 2.15,
                comment = "O retrospecto em casa é absurdo e o rival tá poupando elenco. All-in!",
                likes = 24
            )
        )
        for (post in samplePosts) {
            repository.insertPost(post)
        }
    }

    // ==========================================
    // SCORING & LEVELING ENGINE
    // ==========================================
    fun addXp(amount: Int) {
        viewModelScope.launch {
            val profile = repository.getProfile() ?: UserProfile()
            var currentXp = profile.xp + amount
            var currentLevel = profile.level
            
            // Level up threshold: Level * 200 XP
            var nextLevelThreshold = currentLevel * 200
            var leveledUp = false
            
            while (currentXp >= nextLevelThreshold) {
                currentXp -= nextLevelThreshold
                currentLevel += 1
                nextLevelThreshold = currentLevel * 200
                leveledUp = true
            }

            val updatedProfile = profile.copy(
                xp = currentXp,
                level = currentLevel
            )
            repository.updateProfile(updatedProfile)

            if (leveledUp) {
                // Determine cosmetic frame perk
                val perk = getCosmeticPerkName(currentLevel)
                _successEvent.emit("🎉 SUBIU DE NÍVEL! Nível $currentLevel atingido!")
                
                // Trigger level-up notification
                repository.insertNotification(
                    AppNotification(
                        title = "🎉 Novo Nível Alçado: Nível $currentLevel!",
                        message = "Parabéns! Você alcançou o nível $currentLevel e desbloqueou a moldura cosmética '$perk'. Continue palpitando!",
                        type = "LEVEL_UP"
                    )
                )
            }
        }
    }

    fun getCosmeticPerkName(level: Int): String {
        return when (level) {
            1 -> "Bronze"
            2 -> "Prata"
            3 -> "Ouro"
            4 -> "Platina (Efeito Brilho)"
            else -> "Mestre Neon"
        }
    }

    // ==========================================
    // WALLET OPERATIONS
    // ==========================================
    fun depositFunds(amount: Double) {
        if (amount <= 0) return
        viewModelScope.launch {
            repository.insertTransaction(
                WalletTransaction(
                    amount = amount,
                    description = "Depósito via Pix Seguro",
                    type = "DEPOSIT"
                )
            )
            _successEvent.emit("R$ ${String.format("%.2f", amount)} depositados com sucesso!")
        }
    }

    fun withdrawFunds(amount: Double) {
        if (amount <= 0) return
        viewModelScope.launch {
            val balance = repository.walletBalance.first()
            if (balance < amount) {
                _errorEvent.emit("Saldo insuficiente na carteira para este saque!")
                return@launch
            }
            repository.insertTransaction(
                WalletTransaction(
                    amount = -amount,
                    description = "Saque Rápido via Pix Realizado",
                    type = "WITHDRAWAL"
                )
            )
            _successEvent.emit("R$ ${String.format("%.2f", amount)} sacados com sucesso!")
        }
    }

    // ==========================================
    // BETTING PLACEMENT
    // ==========================================
    fun placeBet(bet: Bet, chosenOption: String, amount: Double) {
        if (amount <= 0) {
            viewModelScope.launch { _errorEvent.emit("O valor da aposta deve ser maior que zero!") }
            return
        }
        viewModelScope.launch {
            val balance = repository.walletBalance.first()
            if (balance < amount) {
                _errorEvent.emit("Saldo insuficiente para realizar esta aposta!")
                return@launch
            }

            val optionText = if (chosenOption == "A") bet.optionA else bet.optionB
            val odds = if (chosenOption == "A") bet.oddsA else bet.oddsB
            val potentialWin = amount * odds

            // 1. Debit wallet
            repository.insertTransaction(
                WalletTransaction(
                    amount = -amount,
                    description = "Aposta em: ${bet.title} ($optionText)",
                    type = "BET_PLACED"
                )
            )

            // 2. Insert UserBet
            repository.insertUserBet(
                UserBet(
                    betId = bet.id,
                    betTitle = bet.title,
                    chosenOption = chosenOption,
                    chosenOptionText = optionText,
                    amount = amount,
                    odds = odds,
                    potentialWin = potentialWin,
                    status = "PENDING"
                )
            )

            // 3. Update total pool in Bet
            repository.updateBet(
                bet.copy(totalPool = bet.totalPool + amount)
            )

            _successEvent.emit("Palpite de R$ ${String.format("%.2f", amount)} confirmado!")
            
            // Reward +50 XP for placing a bet
            addXp(50)
        }
    }

    fun createCustomBet(
        title: String,
        description: String,
        category: String,
        optionA: String,
        optionB: String,
        oddsA: Double,
        oddsB: Double
    ) {
        if (title.isBlank() || description.isBlank() || optionA.isBlank() || optionB.isBlank()) {
            viewModelScope.launch { _errorEvent.emit("Todos os campos básicos devem ser preenchidos!") }
            return
        }
        viewModelScope.launch {
            val newId = repository.insertBet(
                Bet(
                    title = title,
                    description = description,
                    category = category,
                    optionA = optionA,
                    optionB = optionB,
                    oddsA = oddsA,
                    oddsB = oddsB,
                    creatorName = "Você",
                    totalPool = 0.0
                )
            )
            _successEvent.emit("Aposta criada com sucesso! Já está no feed.")
            
            // Reward +100 XP for creating a custom community bet
            addXp(100)
            
            // Check if any users have listed interest in this category to trigger simulated matching alert
            simulateTrendingNewBetAlert(title, category)
        }
    }

    // ==========================================
    // RESOLVE BETS
    // ==========================================
    fun resolveBet(bet: Bet, winningOption: String) {
        viewModelScope.launch {
            // 1. Update bet status
            val resolvedStatus = if (winningOption == "A") "RESOLVED_A" else "RESOLVED_B"
            val updatedBet = bet.copy(status = resolvedStatus)
            repository.updateBet(updatedBet)

            // 2. Resolve pending user bets for this betId
            val userBets = repository.allUserBets.first()
            val pendingBetsForThis = userBets.filter { it.betId == bet.id && it.status == "PENDING" }

            for (userBet in pendingBetsForThis) {
                val won = userBet.chosenOption == winningOption
                if (won) {
                    // User won!
                    userBet.status = "WON"
                    repository.updateUserBet(userBet)

                    // Credit user's wallet
                    repository.insertTransaction(
                        WalletTransaction(
                            amount = userBet.potentialWin,
                            description = "Prêmio ganho: ${bet.title}",
                            type = "BET_WON"
                        )
                    )
                    
                    // Reward +150 XP for winning a bet
                    addXp(150)
                } else {
                    // User lost
                    userBet.status = "LOST"
                    repository.updateUserBet(userBet)
                }
                
                // Simulate and persist results notification
                simulateResultNotification(userBet, won)
            }
            val winningText = if (winningOption == "A") bet.optionA else bet.optionB
            _successEvent.emit("Aposta resolvida como '$winningText'. Saldos atualizados!")
        }
    }

    // ==========================================
    // SOCIAL FEATURES
    // ==========================================
    fun shareBetToCommunity(userBet: UserBet, comment: String) {
        viewModelScope.launch {
            val profile = repository.getProfile() ?: UserProfile()
            
            val post = CommunityPost(
                username = profile.username,
                userLevel = profile.level,
                userBadge = getCosmeticPerkName(profile.level),
                betId = userBet.betId,
                betTitle = userBet.betTitle,
                chosenOption = userBet.chosenOption,
                chosenOptionText = userBet.chosenOptionText,
                odds = userBet.odds,
                comment = comment.ifBlank { "Deixei meu palpite aqui, quem vem comigo?" }
            )
            repository.insertPost(post)
            _successEvent.emit("Palpite compartilhado no feed da comunidade!")
            
            // Reward +50 XP for sharing social content
            addXp(50)
        }
    }

    fun likePost(post: CommunityPost) {
        viewModelScope.launch {
            val updated = post.copy(likes = post.likes + 1)
            repository.updatePost(updated)
        }
    }

    fun referFriend() {
        viewModelScope.launch {
            val profile = repository.getProfile() ?: UserProfile()
            val updated = profile.copy(referralCount = profile.referralCount + 1)
            repository.updateProfile(updated)
            
            _successEvent.emit("Link de indicação compartilhado! Ganhou +300 XP por referir novo usuário.")
            
            // Reward +300 XP for referral
            addXp(300)
        }
    }

    fun updateInterests(interestsString: String) {
        viewModelScope.launch {
            val profile = repository.getProfile() ?: UserProfile()
            val updated = profile.copy(interests = interestsString)
            repository.updateProfile(updated)
            _successEvent.emit("Áreas de interesse atualizadas para notificações personalizadas!")
        }
    }

    fun clearNotifications() {
        viewModelScope.launch {
            repository.markAllNotificationsAsRead()
        }
    }

    // ==========================================
    // PUSH NOTIFICATION SIMULATIONS
    // ==========================================
    fun simulateClosingBetsNotification() {
        viewModelScope.launch {
            // Find a pending user bet or grab a random open bet
            val userBets = repository.allUserBets.first()
            val pendingBet = userBets.firstOrNull { it.status == "PENDING" }
            val title = pendingBet?.betTitle ?: "Será que chove hoje em São Paulo?"
            
            val notification = AppNotification(
                title = "⏳ Aposta fechando em breve!",
                message = "Os palpites para '$title' se encerram em 15 minutos! Acompanhe ao vivo.",
                type = "CLOSING"
            )
            repository.insertNotification(notification)
            _successEvent.emit("🔔 [Push] Aposta prestes a fechar!")
        }
    }

    fun simulateTrendingNewBetAlert(betTitle: String, category: String) {
        viewModelScope.launch {
            val profile = repository.getProfile() ?: UserProfile()
            val userInterests = profile.interests.split(",").map { it.trim().lowercase() }
            
            if (userInterests.contains(category.lowercase())) {
                val notification = AppNotification(
                    title = "🔥 Nova Tendência em $category!",
                    message = "Um palpite super quente acaba de ser criado: '$betTitle'. Venha participar!",
                    type = "TRENDING_INTEREST"
                )
                repository.insertNotification(notification)
            }
        }
    }

    fun simulateTrendingInterestNotification() {
        viewModelScope.launch {
            val profile = repository.getProfile() ?: UserProfile()
            val interests = profile.interests.split(",").map { it.trim() }
            val selectedCategory = interests.firstOrNull() ?: "Esportes"
            
            val bets = repository.allBets.first()
            val matchingBet = bets.firstOrNull { it.category.equals(selectedCategory, ignoreCase = true) }
            val betTitle = matchingBet?.title ?: "O Palmeiras ganhará o clássico paulista neste domingo?"

            val notification = AppNotification(
                title = "🔥 Sugestão de Tendência: $selectedCategory",
                message = "Com base nas suas áreas preferidas, dê seu palpite em: '$betTitle'.",
                type = "TRENDING_INTEREST"
            )
            repository.insertNotification(notification)
            _successEvent.emit("🔔 [Push] Recomendação de palpite relevante enviada!")
        }
    }

    private suspend fun simulateResultNotification(userBet: UserBet, won: Boolean) {
        val title = if (won) "🏆 Você Ganhou!" else "❌ Resultado Divulgado"
        val message = if (won) {
            "Seu palpite em '${userBet.betTitle}' foi resolvido com sucesso! R$ ${String.format("%.2f", userBet.potentialWin)} creditados em sua conta!"
        } else {
            "Infelizmente o resultado para '${userBet.betTitle}' não bateu com a sua escolha. Mais sorte no próximo palpite!"
        }

        repository.insertNotification(
            AppNotification(
                title = title,
                message = message,
                type = "RESULT"
            )
        )
    }
}
