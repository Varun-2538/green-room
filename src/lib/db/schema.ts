import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const DEFAULT_AGENT_USERNAME = "edge_city_agent_qbdffu_bot";

export const guestStatus = pgEnum("guest_status", [
  "shortlisted",
  "brief_ready",
  "drafted",
  "invited",
  "opened",
  "accepted",
  "time_suggested",
  "declined",
  "recorded",
]);

export const inviteAnswer = pgEnum("invite_answer", ["accepted", "time_suggested", "declined"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const creators = pgTable("creators", {
  id: uuid("id").primaryKey().defaultRandom(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  name: text("name").notNull(),
  username: text("username"),
  photoUrl: text("photo_url"),
  showName: text("show_name"),
  showPitch: text("show_pitch"),
  agentUsername: text("agent_username").notNull().default(DEFAULT_AGENT_USERNAME),
  /** World ID nullifier as a decimal string; one human per account. */
  nullifier: numeric("nullifier", { precision: 78, scale: 0 }).unique(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const episodes = pgTable("episodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creators.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  createdAt: createdAt(),
});

export const guests = pgTable("guests", {
  id: uuid("id").primaryKey().defaultRandom(),
  episodeId: uuid("episode_id")
    .notNull()
    .references(() => episodes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  links: text("links").array().notNull().default([]),
  lookingToMeet: text("looking_to_meet"),
  creatorNote: text("creator_note"),
  status: guestStatus("status").notNull().default("shortlisted"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RecentWork = { title: string; url: string; date?: string };
export type SourcedFact = { text: string; sourceUrl: string };

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  story: text("story").notNull(),
  recentWork: jsonb("recent_work").$type<RecentWork[]>().notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  facts: jsonb("facts").$type<SourcedFact[]>().notNull(),
  sources: jsonb("sources").$type<string[]>().notNull(),
  limited: boolean("limited").notNull(),
  createdAt: createdAt(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  guestId: uuid("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creators.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 12 }).notNull().unique(),
  message: text("message").notNull(),
  angle: text("angle").notNull(),
  timeOptions: jsonb("time_options").$type<string[]>().notNull(),
  createdAt: createdAt(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  answer: inviteAnswer("answer"),
  answerNote: text("answer_note"),
  answeredAt: timestamp("answered_at", { withTimezone: true }),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creators.id, { onDelete: "cascade" }),
  guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: jsonb("content").notNull(),
  createdAt: createdAt(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type Creator = typeof creators.$inferSelect;
export type Episode = typeof episodes.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type GuestStatus = (typeof guestStatus.enumValues)[number];
export type InviteAnswer = (typeof inviteAnswer.enumValues)[number];
