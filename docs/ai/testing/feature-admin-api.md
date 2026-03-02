---
phase: testing
title: Admin API & Prisma Schema Testing Strategy
description: Verify data normalization and role-based access control for administrative tasks
---

# Admin API & Prisma Schema Testing Strategy

## 🧪 Unit Tests Scenarios
### AdminService
- [x] **Happy Path**: Successfully create a `MockTest` with nested `Sections` and `Questions` via Prisma. ([admin.service.spec.ts](file:///Users/macbook/Data/Projects/ielts/api-server/src/admin/admin.service.spec.ts))
- [x] **Data Integrity**: Confirm `Json` content for `Questions` is correctly serialized/deserialized. ([admin.service.spec.ts](file:///Users/macbook/Data/Projects/ielts/api-server/src/admin/admin.service.spec.ts))
- [x] **List Retrieval**: Fetch all tests with their nested sections included. ([admin.service.spec.ts](file:///Users/macbook/Data/Projects/ielts/api-server/src/admin/admin.service.spec.ts))

### RolesGuard & Decorator
- [x] **Access Granted**: Allow `ADMIN` role users to pass. ([roles.guard.spec.ts](file:///Users/macbook/Data/Projects/ielts/api-server/src/auth/roles.guard.spec.ts))
- [x] **Access Denied**: Block `STUDENT` or `TEACHER` roles from Admin endpoints with `ForbiddenException`. ([roles.guard.spec.ts](file:///Users/macbook/Data/Projects/ielts/api-server/src/auth/roles.guard.spec.ts))
- [x] **Unauthenticated**: Block requests with missing or invalid Firebase user context. ([roles.guard.spec.ts](file:///Users/macbook/Data/Projects/ielts/api-server/src/auth/roles.guard.spec.ts))

## 🏗️ Integration/E2E Tests
### Admin Seeding Flow
- [ ] Authenticate with Firebase -> Verify DB User is `ADMIN` -> Call `POST /admin/seed` -> Verify records in PostgreSQL.

## 📦 Mocks & Fixtures
- **PrismaClient**: Use `jest-mock-extended` or similar to mock `prisma.mockTest`.
- **FirebaseService**: Reuse existing mocks for token verification.

---
*Created by Antigravity on 2026-03-02*
