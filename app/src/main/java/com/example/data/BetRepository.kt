package com.example.data

import com.example.data.dao.*
import com.example.data.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class BetRepository(
    private val betDao: BetDao,
    private val userBetDao: UserBetDao,
    private val walletTransactionDao: WalletTransactionDao,
    private val userProfileDao: UserProfileDao,
    private val communityPostDao: CommunityPostDao,
    private val appNotificationDao: AppNotificationDao
) {
    val allBets: Flow<List<Bet>> = betDao.getAllBetsFlow()
    val allUserBets: Flow<List<UserBet>> = userBetDao.getAllUserBetsFlow()
    val allTransactions: Flow<List<WalletTransaction>> = walletTransactionDao.getAllTransactionsFlow()
    val walletBalance: Flow<Double> = walletTransactionDao.getWalletBalanceFlow().map { it ?: 0.0 }
    
    val userProfile: Flow<UserProfile?> = userProfileDao.getProfileFlow()
    val allPosts: Flow<List<CommunityPost>> = communityPostDao.getAllPostsFlow()
    val allNotifications: Flow<List<AppNotification>> = appNotificationDao.getAllNotificationsFlow()
    val unreadNotificationsCount: Flow<Int> = appNotificationDao.getUnreadCountFlow()

    suspend fun getBetById(id: Int): Bet? = betDao.getBetById(id)

    suspend fun insertBet(bet: Bet): Long = betDao.insertBet(bet)

    suspend fun updateBet(bet: Bet) = betDao.updateBet(bet)

    suspend fun deleteBet(bet: Bet) = betDao.deleteBet(bet)

    suspend fun insertUserBet(userBet: UserBet): Long = userBetDao.insertUserBet(userBet)

    suspend fun updateUserBet(userBet: UserBet) = userBetDao.updateUserBet(userBet)

    suspend fun insertTransaction(transaction: WalletTransaction): Long = walletTransactionDao.insertTransaction(transaction)

    suspend fun getProfile(): UserProfile? = userProfileDao.getProfile()

    suspend fun insertProfile(profile: UserProfile) = userProfileDao.insertProfile(profile)

    suspend fun updateProfile(profile: UserProfile) = userProfileDao.updateProfile(profile)

    suspend fun insertPost(post: CommunityPost): Long = communityPostDao.insertPost(post)

    suspend fun updatePost(post: CommunityPost) = communityPostDao.updatePost(post)

    suspend fun insertNotification(notification: AppNotification): Long = appNotificationDao.insertNotification(notification)

    suspend fun updateNotification(notification: AppNotification) = appNotificationDao.updateNotification(notification)

    suspend fun markAllNotificationsAsRead() = appNotificationDao.markAllAsRead()
}

