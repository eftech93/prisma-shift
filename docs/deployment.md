# Deployment Guide

## Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

# Run migrations on startup
CMD npx prisma-shift run --with-schema --wait && npm start
```

## Kubernetes

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migrations
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: myapp:latest
        command: ["npx", "prisma-shift", "run", "--with-schema", "--wait"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
      restartPolicy: OnFailure
```

## Multi-Instance Deployments

Use the `--wait` flag:

```bash
npx prisma-shift run --with-schema --wait
```

## CI/CD

### GitHub Actions

```yaml
- name: Run Migrations
  run: npx prisma-shift run --with-schema
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### GitLab CI

```yaml
migrate:
  script:
    - npx prisma-shift run --with-schema
```
