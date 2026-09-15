import { relations } from "drizzle-orm"
import {
  users,
  organizations,
  organizationMembers,
  teams,
  teamMembers,
} from "./schema"

// Only define essential relations needed for team functionality
// User relations - minimal set to avoid circular dependencies
export const usersRelations = relations(users, ({ many }) => ({
  organizationMemberships: many(organizationMembers),
  teamMemberships: many(teamMembers),
}))

// Organization Members relations
export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}))

// Organization relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  teams: many(teams),
}))

// Team relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}))

// Team Members relations
export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}))
