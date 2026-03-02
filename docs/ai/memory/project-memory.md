# API Server — Project Memory

## Last Updated: 2026-03-02

---

## Completed Phases

### Phase 1: Foundation & Architecture (COMPLETED)
- 4 repos initialized: `student-web`, `teacher-web`, `admin-web` (Next.js 14), `api-server` (NestJS)
- Tailwind CSS + Shadcn UI configured on frontends
- CI/CD workflows on all 4 repos (GitHub Actions, Node.js v22)

### Phase 2: Auth & Data Models (COMPLETED)
- **Firebase Auth**: `FirebaseService`, `FirebaseAuthGuard`, `CurrentUser` decorator
- **Prisma 7 Schema**: User, TeacherProfile, MockTest, TestSection, Question, UserAttempt, Transaction, GradingRequest
- **Prisma 7 Migration**: Uses `@prisma/adapter-pg` driver adapter + `prisma.config.ts` for datasource URL
- **Admin Seeding API**: `POST /admin/seed`, `GET /admin/mock-tests` with RBAC (`RolesGuard` + `@Roles` decorator)
- **Tests**: 22 unit tests passing across 6 suites
- **PRs Merged**: #1 (foundation), #2 (auth+tests), #3 (schema+admin+CI), #4 (CI fix)

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Prisma 7 with `@prisma/adapter-pg` | Required by Prisma 7 — no more `url` in `datasource` block |
| `dotenv/config` preloaded in `main.ts` | `prisma.ts` creates `Pool` at import time, before NestJS `ConfigModule` loads |
| Normalized schema (TestSection + Question) | Better than single JSONB blob for querying, indexing, and partial updates |
| `@Global()` on `FirebaseModule` | Guards everywhere can inject `FirebaseService` without importing the module |
| CI includes `npx prisma generate` | Prisma Client types must be generated before tests can import enums |

## Known Deferred Items
- [ ] Extract `PrismaService` as NestJS injectable (replace raw singleton import)
- [ ] Create `SeedMockTestDto` with `class-validator` validation
- [ ] Add global API prefix `/api/v1`
- [ ] Switch `Float` → `Decimal` for financial fields (`creditBalance`, `amount`)
- [ ] Task 1.5: Unit/E2E tests for User & Credit Ledger

## Important Rules (Learned)
1. **Never merge PRs without explicit user permission**
2. **Always monitor CI after creating a PR** — use `gh run watch` before reporting success
3. **Always use `nvm use stable`** (Node.js v22.12.0)

---

## Next Steps
- **Task 1.5**: Write Unit/E2E Tests for User & Credit Ledger services
- **Phase 2**: Core Student Features (Milestone 3 & 4)
