package com.example.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.data.dao.*
import com.example.data.model.*

@Database(
    entities = [
        Bet::class,
        UserBet::class,
        WalletTransaction::class,
        UserProfile::class,
        CommunityPost::class,
        AppNotification::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun betDao(): BetDao
    abstract fun userBetDao(): UserBetDao
    abstract fun walletTransactionDao(): WalletTransactionDao
    abstract fun userProfileDao(): UserProfileDao
    abstract fun communityPostDao(): CommunityPostDao
    abstract fun appNotificationDao(): AppNotificationDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "palpite_total_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
