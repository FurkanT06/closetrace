import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: text("id").notNull(), ownerId: text("owner_id").notNull(), data: text("data").notNull(),
  version: integer("version").notNull().default(1), mutationKey: text("mutation_key").notNull(),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({ columns: [t.ownerId, t.id] }), index("cases_owner_updated").on(t.ownerId, t.updatedAt)]);

export const files = sqliteTable("files", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), caseId: text("case_id").notNull(),
  category: text("category").notNull(), name: text("name").notNull(), mime: text("mime").notNull(),
  size: integer("size").notNull(), objectKey: text("object_key").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("files_owner_case").on(t.ownerId, t.caseId)]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), caseId: text("case_id").notNull(),
  actor: text("actor").notNull(), title: text("title").notNull(), detail: text("detail").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("events_owner_created").on(t.ownerId, t.createdAt)]);
