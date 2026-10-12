# NORCOR Fueling System — Backend

API REST con **NestJS 11 + TypeScript + Prisma 7 + PostgreSQL**.

## Requisitos

- Node.js 22 o superior (`node -v`)
- PostgreSQL 15 o superior en ejecución
- npm

## 1. Instalar dependencias

Con el `package.json` incluido (equivale a un `requirements.txt`):

```bash
npm install
```

<details>
<summary>O instalar paquete por paquete (equivalente)</summary>

```bash
npm i @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 @nestjs/jwt@^11 \
  @nestjs/passport@^11 @nestjs/swagger@^11 @nestjs/config@^4 @nestjs/mapped-types@^2.1 \
  @nestjs/throttler passport passport-jwt class-validator class-transformer \
  reflect-metadata rxjs bcrypt @prisma/client@^7 @prisma/adapter-pg@^7 pg dotenv

npm i -D @nestjs/cli@^11 @nestjs/schematics@^11 @nestjs/testing@^11 prisma@^7 typescript@~5.9 \
  tsx @types/node@^22 @types/express @types/passport-jwt @types/bcrypt @types/pg \
  @types/jest @types/supertest jest ts-jest supertest eslint prettier typescript-eslint
```
</details>

## 2. Crear la base de datos

```bash
psql -U postgres -c "CREATE DATABASE norcor;"
```

## 3. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

- `DATABASE_URL`: usuario, clave y base reales.
- `JWT_SECRET`: genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- `SEED_ADMIN_PASSWORD`: mínimo 12 caracteres (se usa solo para crear el administrador inicial).

## 4. Prisma: cliente, migración y seed

```bash
npx prisma generate                              # genera src/generated/prisma
npx prisma migrate dev --name init --create-only # crea la migración sin aplicarla
```

Abre `prisma/migrations/<fecha>_init/migration.sql` y pega **al final** el contenido de
`prisma/sql/checks.sql` (restricciones CHECK que Prisma no soporta en el esquema). Luego:

```bash
npx prisma migrate dev     # aplica la migración
npx prisma db seed         # roles, permisos, administrador y TAX_RATE
```

## 5. Ejecutar

```bash
npm run start:dev
```

- API: http://localhost:3000/api/v1
- Comprobación: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/api/docs

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run start:dev` | Servidor con recarga automática |
| `npm run build` | Compila a `dist/` |
| `npx prisma studio` | Explorador visual de la base de datos |
| `npx prisma migrate dev` | Crea/aplica migraciones en desarrollo |
| `npx prisma migrate deploy` | Aplica migraciones en producción |
| `npm test` | Pruebas unitarias |

## Notas de diseño

- Prisma 7 requiere el adaptador `@prisma/adapter-pg`; la URL de conexión vive en `prisma.config.ts`, no en `schema.prisma`.
- El stock vive en `products` y nunca se modifica sin crear un registro en `inventory_movements` dentro de la misma transacción.
- `products.version` permite control optimista de concurrencia; la validación atómica de stock se hará en la fase de inventario/ventas.
- El IVA (15%) se guarda en `system_config` (`TAX_RATE`), no en el código.
