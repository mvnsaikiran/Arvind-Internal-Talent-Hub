# Security Specification: SkillUp Enterprise

## 1. Data Invariants
- A **User** profile must belong to the authenticated UID.
- A **MentorshipPost** must reference a valid user and a valid skill.
- A **Pairing** must involve two distinct users (mentor and mentee).
- **UID Fields** (ownerId, userId, mentorId, etc.) must match `request.auth.uid` during creation.
- **Timestamps** must be server-generated (`request.time`).

## 2. The "Dirty Dozen" (Attack Payloads)
1. **The Identity Spoofer**: User A attempts to update User B's profile.
2. **The Self-Mentor**: User A creates a pairing where `mentorId == menteeId`.
3. **The Ghost Field**: User A adds `isAdmin: true` to their user profile.
4. **The Shadow Post**: User A creates a post but sets `userId` to User B's UID.
5. **The Time Traveler**: User A provides a future `createdAt` date instead of `request.time`.
6. **The Eavesdropper**: User A attempts to list all `pairings` they are not part of.
7. **The Skill Saboteur**: User A attempts to delete or modify a global `Skill` entry.
8. **The Status Hijacker**: A mentee attempts to set a pairing status directly to `completed` without mentor consent (if we had a complex workflow, but here we restrict keys).
9. **The PII Scraper**: User A tries to `get` the email of every user in the platform via a broad query.
10. **The ID Poisoner**: User A tries to create a skill with a 1MB string as the ID.
11. **The Resource Exhauster**: User A puts a 1MB string in the `bio` field.
12. **The Orphan Maker**: User A creates a post for a skill that doesn't exist (verified via exists checks).

## 3. Test Runner Concept
The `firestore.rules` will be validated against these scenarios using helper functions.
