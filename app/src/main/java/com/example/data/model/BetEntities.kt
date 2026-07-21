package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "bets")
data class Bet(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val title: String,
    val description: String,
    val category: String, // "Tempo", "Política", "Dia-a-dia", "Esportes", "Entretenimento"
    val creatorName: String = "Sistema",
    val optionA: String = "Sim",
    val optionB: String = "Não",
    val oddsA: Double = 1.90,
    val oddsB: Double = 1.90,
    val status: String = "OPEN", // "OPEN", "RESOLVED_A", "RESOLVED_B"
    val isTrending: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val totalPool: Double = 0.0
)

@Entity(tableName = "user_bets")
data class UserBet(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val betId: Int,
    val betTitle: String,
    val chosenOption: String, // "A" or "B"
    val chosenOptionText: String, // e.g., "Sim" or "Não"
    val amount: Double,
    val odds: Double,
    val potentialWin: Double,
    var status: String = "PENDING", // "PENDING", "WON", "LOST"
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "wallet_transactions")
data class WalletTransaction(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val amount: Double, // Positive for deposit/win, Negative for bet/withdrawal
    val description: String,
    val type: String, // "DEPOSIT", "WITHDRAWAL", "BET_PLACED", "BET_WON"
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "user_profiles")
data class UserProfile(
    @PrimaryKey val id: Int = 1,
    val username: String = "PalpiteiroMestre",
    val xp: Int = 120, // Start with some XP
    val level: Int = 1,
    val referralCount: Int = 0,
    val interests: String = "Tempo,Esportes,Política" // Comma-separated list of interests
)

@Entity(tableName = "community_posts")
data class CommunityPost(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val username: String,
    val userLevel: Int,
    val userBadge: String,
    val betId: Int,
    val betTitle: String,
    val chosenOption: String, // "A" or "B"
    val chosenOptionText: String,
    val odds: Double,
    val comment: String,
    var likes: Int = 0,
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "notifications")
data class AppNotification(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val title: String,
    val message: String,
    val type: String, // "CLOSING", "RESULT", "TRENDING_INTEREST", "LEVEL_UP"
    var isRead: Boolean = false,
    val timestamp: Long = System.currentTimeMillis()
)

