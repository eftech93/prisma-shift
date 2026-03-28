# Quick Start

Get up and running with Prisma Shift in 5 minutes.

## 1. Initialize

```bash
npx prisma-shift init --config
```

This creates:
- `prisma/data-migrations/` directory
- `prisma-shift.config.ts` configuration file

## 2. Create Your First Migration

```bash
npx prisma-shift create "add_default_preferences"
```

## 3. Write Migration Logic

Edit the generated file:

```typescript
async up({ prisma, log }: MigrationContext) {
  await prisma.user.updateMany({
    where: { preferences: null },
    data: { preferences: { theme: "light" } }
  });
  log("Updated users with default preferences");
}
```

## 4. Run Migrations

```bash
# With schema migrations
npx prisma-shift run --with-schema

# Or data only
npx prisma-shift run
```

## 5. Check Status

```bash
npx prisma-shift status
```

---

## Next Steps

- Explore the [example project](../example/README.md)
- Learn about [writing migrations](writing-migrations.md)
- Read the [CLI documentation](cli.md)
