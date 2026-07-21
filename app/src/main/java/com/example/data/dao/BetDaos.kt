package com.example.data.dao

import androidx.room.*
import com.example.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface BetDao {
    @Query("SELECT * FROM bets ORDER BY createdAt DESC")
    fun getAllBetsFlow(): Flow<List<Bet>>

    @Query("SELECT * FROM bets WHERE id = :id")
    suspend fun getBetById(id: Int): Bet?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBet(bet: Bet): Long

    @Update
    suspend fun updateBet(bet: Bet)

    @Delete
    suspend fun deleteBet(bet: Bet)
}

@Dao
interface UserBetDao {
    @Query("SELECT * FROM user_bets ORDER BY createdAt DESC")
    fun getAllUserBetsFlow(): Flow<List<UserBet>>

    @Query("SELECT * FROM user_bets WHERE betId = :betId")
    suspend fun getUserBetsByBetId(betId: Int): List<UserBet>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUserBet(userBet: UserBet): Long

    @Update
    suspend fun updateUserBet(userBet: UserBet)
}

@Dao
interface WalletTransactionDao {
    @Query("SELECT * FROM wallet_transactions ORDER BY timestamp DESC")
    fun getAllTransactionsFlow(): Flow<List<WalletTransaction>>

    @Query("SELECT SUM(amount) FROM wallet_transactions")
    fun getWalletBalanceFlow(): Flow<Double?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: WalletTransaction): Long
}

@Dao
interface UserProfileDao {
    @Query("SELECT * FROM user_profiles WHERE id = 1")
    fun getProfileFlow(): Flow<UserProfile?>

    @Query("SELECT * FROM user_profiles WHERE id = 1")
    suspend fun getProfile(): UserProfile?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProfile(profile: UserProfile)

    @Update
    suspend fun updateProfile(profile: UserProfile)
}

@Dao
interface CommunityPostDao {
    @Query("SELECT * FROM community_posts ORDER BY timestamp DESC")
    fun getAllPostsFlow(): Flow<List<CommunityPost>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPost(post: CommunityPost): Long

    @Update
    suspend fun updatePost(post: CommunityPost)
}

@Dao
interface AppNotificationDao {
    @Query("SELECT * FROM notifications ORDER BY timestamp DESC")
    fun getAllNotificationsFlow(): Flow<List<AppNotification>>

    @Query("SELECT COUNT(*) FROM notifications WHERE isRead = 0")
    fun getUnreadCountFlow(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotification(notification: AppNotification): Long

    @Update
    suspend fun updateNotification(notification: AppNotification)

    @Query("UPDATE notifications SET isRead = 1")
    suspend fun markAllAsRead()
}

