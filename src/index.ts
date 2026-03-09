/* =========================================================
   SOLID Refactor — Order Management System (TypeScript)
   ========================================================= */

/** --------- Domain types & contracts --------- */

type OrderId = number;
type Money = number;
type OrderType = string;

/**
 * Contrato mínimo que el resto del sistema necesita para operar con un pedido.
 */
export interface OrderView {
  readonly id: OrderId;
  readonly customerName: string;
  readonly amount: Money;
  readonly type: OrderType;
}

/**
 * Order inmutable (value-like).
 * - Evita fallas por sustitución (LSP) al no exponer setters.
 * - Para modificar datos se crea una nueva instancia (withX()).
 */
export class Order implements OrderView {
  public readonly id: OrderId;
  public readonly customerName: string;
  public readonly amount: Money;
  public readonly type: OrderType;

  constructor(params: { id: OrderId; customerName: string; amount: Money; type: OrderType }) {
    if (!Number.isInteger(params.id) || params.id <= 0) {
      throw new Error(`Order.id inválido: ${params.id}`);
    }
    if (!params.customerName || params.customerName.trim().length === 0) {
      throw new Error("Order.customerName requerido");
    }
    if (typeof params.amount !== "number" || Number.isNaN(params.amount) || params.amount < 0) {
      throw new Error(`Order.amount inválido: ${params.amount}`);
    }
    if (!params.type || params.type.trim().length === 0) {
      throw new Error("Order.type requerido");
    }

    this.id = params.id;
    this.customerName = params.customerName;
    this.amount = params.amount;
    this.type = params.type;
  }

  public withCustomerName(customerName: string): Order {
    return new Order({ id: this.id, customerName, amount: this.amount, type: this.type });
  }

  public withAmount(amount: Money): Order {
    return new Order({ id: this.id, customerName: this.customerName, amount, type: this.type });
  }

  public withType(type: OrderType): Order {
    return new Order({ id: this.id, customerName: this.customerName, amount: this.amount, type });
  }
}

/** --------- Cross-cutting concerns --------- */

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export class ConsoleLogger implements Logger {
  public info(message: string): void {
    console.log(message);
  }
  public error(message: string): void {
    console.error(message);
  }
}

/** --------- ISP: small interfaces --------- */

export interface OrderWriter {
  save(order: OrderView): void;
  update(order: OrderView): void;
  delete(orderId: OrderId): void;
}

export interface OrderReporter {
  generateReport(): string;
}

export interface NotificationService {
  sendOrderConfirmation(order: OrderView): void;
}

/** --------- OCP: processing strategy per type --------- */

export class UnsupportedOrderTypeError extends Error {
  constructor(type: string, supported: string[]) {
    super(`Tipo de pedido desconocido: "${type}". Soportados: ${supported.join(", ")}`);
  }
}

export interface OrderProcessor {
  /** Tipo soportado por este processor. Agregar tipos nuevos = agregar clase nueva. */
  readonly type: OrderType;
  process(order: OrderView): void;
}

export class RegularOrderProcessor implements OrderProcessor {
  public readonly type: OrderType = "regular";
  constructor(private readonly logger: Logger) {}
  public process(order: OrderView): void {
    this.logger.info("Procesando pedido regular...");
    // lógica de negocio específica del tipo
    this.logger.info(`OK regular: orderId=${order.id}`);
  }
}

export class ExpressOrderProcessor implements OrderProcessor {
  public readonly type: OrderType = "express";
  constructor(private readonly logger: Logger) {}
  public process(order: OrderView): void {
    this.logger.info("Procesando pedido express...");
    // lógica de negocio específica del tipo
    this.logger.info(`OK express: orderId=${order.id}`);
  }
}

/**
 * Ejemplo de extensión OCP:
 * Agregar este processor NO requiere modificar OrderService.
 */
export class InternationalOrderProcessor implements OrderProcessor {
  public readonly type: OrderType = "international";
  constructor(private readonly logger: Logger) {}
  public process(order: OrderView): void {
    this.logger.info("Procesando pedido international...");
    // lógica de negocio (aduana, impuestos, etc.)
    this.logger.info(`OK international: orderId=${order.id}`);
  }
}

/**
 * Registry para resolver processor por type.
 * - Centraliza el registro de procesadores.
 * - Permite extender tipos sin modificar OrderService (OCP).
 */
export class OrderProcessorRegistry {
  private readonly processors = new Map<OrderType, OrderProcessor>();

  constructor(processors: OrderProcessor[]) {
    processors.forEach((p) => this.register(p));
  }

  public register(processor: OrderProcessor): void {
    if (this.processors.has(processor.type)) {
      throw new Error(`Processor duplicado para type="${processor.type}"`);
    }
    this.processors.set(processor.type, processor);
  }

  public get(type: OrderType): OrderProcessor {
    const processor = this.processors.get(type);
    if (!processor) {
      throw new UnsupportedOrderTypeError(type, this.supportedTypes());
    }
    return processor;
  }

  public supportedTypes(): OrderType[] {
    return Array.from(this.processors.keys());
  }
}

/** --------- DIP: infrastructure abstractions --------- */

export interface DBConnection {
  connect(): void;
  execute(sql: string, params?: unknown[]): void;
}

/** Simulación (en un entorno real sería un driver MySQL) */
export class FakeMySQLConnection implements DBConnection {
  constructor(private readonly logger: Logger) {}
  public connect(): void {
    this.logger.info("Conectando a MySQL...");
  }
  public execute(sql: string, params: unknown[] = []): void {
    this.logger.info(`[MySQL] ${sql} :: params=${JSON.stringify(params)}`);
  }
}

/**
 * Repositorio concreto MySQL:
 * - Implementa interfaces pequeñas (ISP).
 * - Depende de DBConnection (DIP), no crea la conexión internamente.
 */
export class MySQLOrderRepository implements OrderWriter, OrderReporter {
  constructor(private readonly db: DBConnection, private readonly logger: Logger) {
    this.db.connect();
  }

  public save(order: OrderView): void {
    this.db.execute("INSERT INTO orders(id, customerName, amount, type) VALUES (?, ?, ?, ?)", [
      order.id,
      order.customerName,
      order.amount,
      order.type,
    ]);
    this.logger.info(`Guardando orden ${order.id} en MySQL`);
  }

  public update(order: OrderView): void {
    this.db.execute("UPDATE orders SET customerName=?, amount=?, type=? WHERE id=?", [
      order.customerName,
      order.amount,
      order.type,
      order.id,
    ]);
    this.logger.info(`Actualizando orden ${order.id} en MySQL`);
  }

  public delete(orderId: OrderId): void {
    this.db.execute("DELETE FROM orders WHERE id=?", [orderId]);
    this.logger.info(`Eliminando orden ${orderId} de MySQL`);
  }

  public generateReport(): string {
    // en real: SELECT ... agregaciones
    return "Reporte desde MySQL: ...";
  }
}

/**
 * Repo alternativo para tests/dev (útil para verificar DIP sin BD real).
 */
export class InMemoryOrderRepository implements OrderWriter, OrderReporter {
  private readonly store = new Map<OrderId, OrderView>();
  constructor(private readonly logger: Logger) {}

  public save(order: OrderView): void {
    this.store.set(order.id, order);
    this.logger.info(`[InMemory] Guardando orden ${order.id}`);
  }
  public update(order: OrderView): void {
    this.store.set(order.id, order);
    this.logger.info(`[InMemory] Actualizando orden ${order.id}`);
  }
  public delete(orderId: OrderId): void {
    this.store.delete(orderId);
    this.logger.info(`[InMemory] Eliminando orden ${orderId}`);
  }
  public generateReport(): string {
    return `Reporte InMemory: totalOrders=${this.store.size}`;
  }
}

/** --------- Notification abstraction --------- */

export interface EmailClient {
  send(to: string, subject: string, body: string): void;
}

export class ConsoleEmailClient implements EmailClient {
  constructor(private readonly logger: Logger) {}
  public send(to: string, subject: string, body: string): void {
    this.logger.info(`Enviando email a ${to} :: ${subject} :: ${body}`);
  }
}

export class EmailNotificationService implements NotificationService {
  constructor(private readonly email: EmailClient) {}
  public sendOrderConfirmation(order: OrderView): void {
    // Mantiene el comportamiento observable del enunciado (se imprime “enviando email a X”)
    this.email.send(order.customerName, "Confirmación de pedido", `Tu pedido ${order.id} fue recibido.`);
  }
}

/** --------- SRP: orchestration only --------- */

/**
 * Servicio de orquestación del flujo de pedido.
 * - SRP: coordina el flujo (process -> save -> notify -> report)
 * - OCP: no tiene if/else por type
 * - DIP: depende de abstracciones inyectadas
 */
export class OrderService {
  constructor(
    private readonly processorRegistry: OrderProcessorRegistry,
    private readonly writer: OrderWriter,
    private readonly notifier: NotificationService,
    private readonly reporter: OrderReporter,
    private readonly logger: Logger
  ) {}

  public processOrder(order: OrderView): void {
    const processor = this.processorRegistry.get(order.type);

    processor.process(order);
    this.writer.save(order);
    this.notifier.sendOrderConfirmation(order);

    // “Siempre genera reporte” para mantener el comportamiento observable del código base
    this.logger.info(this.reporter.generateReport());
  }
}

/** --------- Example wiring / usage --------- */

function main(): void {
  const logger = new ConsoleLogger();

  // Procesadores (OCP): se agregan nuevas clases sin tocar OrderService
  const registry = new OrderProcessorRegistry([
    new RegularOrderProcessor(logger),
    new ExpressOrderProcessor(logger),

    // Demostración: nuevo tipo SIN tocar OrderService
    new InternationalOrderProcessor(logger),
  ]);

  // Infraestructura (DIP): el repositorio puede cambiar sin tocar OrderService
  const db = new FakeMySQLConnection(logger);
  const repo = new MySQLOrderRepository(db, logger);
  // const repo = new InMemoryOrderRepository(logger);

  const emailClient = new ConsoleEmailClient(logger);
  const notifier = new EmailNotificationService(emailClient);

  const service = new OrderService(registry, repo, notifier, repo, logger);

  // Caso base (comportamiento observable)
  const order1 = new Order({ id: 1, customerName: "Ana", amount: 100.0, type: "regular" });
  service.processOrder(order1);

  // Extensión OCP: nuevo tipo
  const order2 = new Order({ id: 2, customerName: "Luis", amount: 250.5, type: "international" });
  service.processOrder(order2);
}

main();
