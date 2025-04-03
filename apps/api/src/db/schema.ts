import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  userImage: text('user_image'),
  userType: text('user_type').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (table) => {
  return {
    idxUserId: uniqueIndex('idx_users_user_id').on(table.userId),
    idxUserName: index('idx_users_user_name').on(table.userName),
  }
})
