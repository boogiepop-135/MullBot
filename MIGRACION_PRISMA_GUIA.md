# Guía de Migración MongoDB → PostgreSQL con Prisma

## Estado de la Migración

✅ **Completado:**
- Docker Compose actualizado (PostgreSQL configurado, MongoDB eliminado)
- Schema de Prisma creado con todos los modelos
- Package.json actualizado (Prisma instalado, Mongoose removido)
- Singleton de Prisma Client creado (`src/database/prisma.ts`)
- Configuración de base de datos actualizada (`src/configs/db.config.ts`)
- Variables de entorno actualizadas (`src/configs/env.config.ts`)
- Scripts de creación de admin refactorizados
- `src/bot.manager.ts` refactorizado
- `src/crm/utils/auth.util.ts` refactorizado
- Inicio de refactorización de `src/crm/api/crm.api.ts`

⚠️ **Pendiente:**
- Completar refactorización de `src/crm/api/crm.api.ts` (archivo muy grande con ~63 referencias)
- Refactorizar archivos en `src/utils/` que usan modelos
- Refactorizar `src/crm/utils/automation.util.ts`
- Refactorizar `src/crons/campaign.cron.ts`
- Eliminar archivos de modelos Mongoose antiguos en `src/crm/models/`

## Mapeo de Funciones Mongoose → Prisma

### Consultas Básicas

**Mongoose:**
```typescript
Model.findOne({ field: value })
Model.findById(id)
Model.find(query)
Model.countDocuments(query)
```

**Prisma:**
```typescript
prisma.model.findUnique({ where: { field: value } })
prisma.model.findUnique({ where: { id } })
prisma.model.findMany({ where: query })
prisma.model.count({ where: query })
```

### Creación y Actualización

**Mongoose:**
```typescript
new Model(data).save()
Model.create(data)
Model.findOneAndUpdate(query, { $set: data }, { new: true, upsert: true })
Model.findByIdAndUpdate(id, { $set: data }, { new: true })
Model.updateMany(query, { $set: data })
```

**Prisma:**
```typescript
prisma.model.create({ data })
prisma.model.create({ data })
prisma.model.upsert({ where: query, update: data, create: data })
prisma.model.update({ where: { id }, data })
prisma.model.updateMany({ where: query, data })
```

### Eliminación

**Mongoose:**
```typescript
Model.findByIdAndDelete(id)
Model.findOneAndDelete(query)
```

**Prisma:**
```typescript
prisma.model.delete({ where: { id } })
prisma.model.delete({ where: query })
```

### Consultas con Ordenamiento y Paginación

**Mongoose:**
```typescript
Model.find(query).sort({ field: -1 }).skip(skip).limit(limit)
```

**Prisma:**
```typescript
prisma.model.findMany({
  where: query,
  orderBy: { field: 'desc' },
  skip: skip,
  take: limit
})
```

### Búsqueda con Regex (Case Insensitive)

**Mongoose:**
```typescript
Model.find({ field: { $regex: search, $options: 'i' } })
```

**Prisma:**
```typescript
prisma.model.findMany({
  where: { field: { contains: search, mode: 'insensitive' } }
})
```

### Arrays y Operadores

**Mongoose:**
```typescript
Model.find({ tags: { $exists: true, $ne: [] } })
Model.find({ $or: [{ field1: value1 }, { field2: value2 }] })
Model.findOneAndUpdate(query, { $inc: { count: 1 } })
```

**Prisma:**
```typescript
prisma.model.findMany({ where: { tags: { isEmpty: false } } })
prisma.model.findMany({ where: { OR: [{ field1: value1 }, { field2: value2 }] } })
prisma.model.update({ where: query, data: { count: { increment: 1 } } })
```

### Select (Proyección)

**Mongoose:**
```typescript
Model.find().select('-password')
```

**Prisma:**
```typescript
prisma.model.findMany({
  select: { id: true, username: true, /* omit password */ }
})
```

## Cambios de Enum/Valores

Los valores de enum en Prisma están en **MAYÚSCULAS**:

- `'lead'` → `SaleStatus.LEAD`
- `'admin'` → `Role.ADMIN`
- `'draft'` → `CampaignStatus.DRAFT`
- `'payment_receipt'` → `NotificationType.PAYMENT_RECEIPT`

## IDs

- Mongoose usa `_id` (ObjectId)
- Prisma usa `id` (UUID por defecto o String)

**Conversión:**
```typescript
// Mongoose
user._id.toString()

// Prisma
user.id
```

## Relaciones

**Mongoose (con populate):**
```typescript
Model.findOne().populate('relation')
```

**Prisma (con include):**
```typescript
prisma.model.findUnique({
  where: { id },
  include: { relation: true }
})
```

## Campos JSON (Metadata)

Prisma maneja JSON de forma nativa:
```typescript
// Ambos funcionan igual
metadata: { key: 'value' }
```

## Campos Date

```typescript
// Ambos usan Date de JavaScript
new Date()
```

## Pasos Finales

1. **Completar `src/crm/api/crm.api.ts`**: Refactorizar todas las ~63 referencias restantes usando los mapeos arriba.

2. **Refactorizar otros archivos**:
   - `src/utils/payment-detection.util.ts`
   - `src/utils/appointment-detection.util.ts`
   - `src/utils/admin-info.util.ts`
   - `src/utils/bot-config.util.ts`
   - `src/utils/quick-responses.util.ts`
   - `src/utils/gemini.util.ts`
   - `src/crm/utils/automation.util.ts`
   - `src/crons/campaign.cron.ts`

3. **Eliminar modelos antiguos**:
   ```bash
   rm -rf src/crm/models/*.model.ts
   ```

4. **Generar Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

5. **Ejecutar migraciones**:
   ```bash
   npm run prisma:migrate
   ```

6. **Probar la aplicación**:
   ```bash
   npm run dev
   ```

## Notas Importantes

- Los modelos de Prisma están definidos en `prisma/schema.prisma`
- El cliente de Prisma se importa desde `src/database/prisma.ts`
- Los tipos TypeScript se generan automáticamente desde `@prisma/client`
- Las migraciones se gestionan con `prisma migrate`
- Para desarrollo local, usar `prisma migrate dev`
- Para producción, usar `prisma migrate deploy`

