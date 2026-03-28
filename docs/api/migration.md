# DataMigration Interface

```typescript
interface DataMigration {
  // Required
  id: string;
  name: string;
  createdAt: number;
  up: (context: MigrationContext) => Promise<void>;
  
  // Optional
  down?: (context: MigrationContext) => Promise<void>;
  condition?: (context: Pick<MigrationContext, "prisma" | "log">) => Promise<boolean>;
  requiresSchema?: string[];
  requiresData?: string[];
  timeout?: number;
  disableTransaction?: boolean;
}
```

## Required Fields

### id

Unique identifier. Format: `YYYYMMDDhhmmss_description`

```typescript
id: "20240324120000_add_user_preferences"
```

### name

Human-readable name.

```typescript
name: "add_user_preferences"
```

### createdAt

Unix timestamp (milliseconds).

```typescript
createdAt: Date.now()
```

### up

Migration function.

```typescript
async up({ prisma, log }: MigrationContext) {
  // Migration logic
}
```

## Optional Fields

### down

Rollback function.

```typescript
async down({ prisma, log }: MigrationContext) {
  // Rollback logic
}
```

### condition

Runtime condition check.

```typescript
condition: async ({ prisma }) => {
  const config = await prisma.config.findFirst();
  return config?.featureEnabled === true;
}
```

### requiresSchema

Schema migration dependencies.

```typescript
requiresSchema: ["20240324000002_add_table"]
```

### requiresData

Data migration dependencies.

```typescript
requiresData: ["20240324010001_seed_data"]
```

### timeout

Custom timeout in milliseconds.

```typescript
timeout: 300000  // 5 minutes
```

### disableTransaction

Run outside transaction.

```typescript
disableTransaction: true
```
