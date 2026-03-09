# Refactoring with SOLID Principles — Order Management System (TypeScript)

## Resumen de la entrega
En esta entrega se refactorizó un sistema de gestión de pedidos originalmente acoplado y difícil de extender.  
El resultado final mantiene el comportamiento observable (procesar, persistir, notificar, reportar), pero ahora está desacoplado y extensible.

### Principios SOLID aplicados (resumen)
- **SRP**: la orquestación, persistencia, notificación, reporting y procesamiento por tipo están separados.
- **OCP**: los tipos de pedido se extienden incorporando nuevos `OrderProcessor` sin modificar `OrderService`.
- **LSP**: se evita la herencia “read-only” que rompe el contrato; el modelo `Order` es inmutable.
- **ISP**: el repositorio se divide en interfaces pequeñas (`OrderWriter`, `OrderReporter`).
- **DIP**: las dependencias se inyectan por abstracciones (interfaces) y no por detalles concretos.

## Estructura
- `src/index.ts` — implementación completa + demo de ejecución.
- `package.json` / `tsconfig.json` — configuración TS strict + scripts.
- `SUBMISSION.md` — documento de entrega (análisis de violaciones + explicación + código).

## Validación ejecutada (entorno limpio)
Los checks utilizados para confirmar entregabilidad fueron:

```bash
npm install
npm run typecheck
npm run build
npm start
```

Salida observada (extracto):
- Conexión simulada a MySQL
- Procesamiento de `regular` y `international`
- Persistencia (logs de INSERT)
- Notificación (email por consola)
- Reporte generado

