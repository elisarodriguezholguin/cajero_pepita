import * as readline from "readline";

// ===== ENUM =====
enum TipoTransaccion {
  RETIRO = "RETIRO",
  DEPOSITO = "DEPOSITO",
  CONSULTA = "CONSULTA"
}

// ===== TIPADO =====
interface Transaccion {
  tipo: TipoTransaccion;
  monto: number;
  fecha: Date;
}

interface Factura {
  id: string;
  monto: number;
  tipo: TipoTransaccion;
  estado: "PENDIENTE" | "APROBADO" | "RECHAZADO";
  fecha: Date;
}

type Resultado<T> =
  | { ok: true; valor: T }
  | { ok: false; error: string };

type Listener = (data: any) => void;

// ===== CLOSURE + MEMOIZACIÓN =====
function memoize(fn: Function) {
  const cache = new Map<string, any>();
  return (...args: any[]) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  };
}

// ===== DESACOPLAMIENTO POR EVENTOS =====
class EventBus {
  private static eventos: Map<string, Listener[]> = new Map();

  static on(evento: string, listener: Listener): void {
    if (!this.eventos.has(evento)) {
      this.eventos.set(evento, []);
    }
    this.eventos.get(evento)!.push(listener);
  }

  static emit(evento: string, data: any): void {
    const listeners = this.eventos.get(evento) ?? [];
    listeners.forEach(listener => listener(data));
  }
}

// ===== CARGA EXTREMA (AOP) =====
class CargaExtrema {
  private static operacionesActivas: number = 0;
  private static readonly MAX_OPERACIONES: number = 5;

  static puedeOperar(): boolean {
    return this.operacionesActivas < this.MAX_OPERACIONES;
  }

  static iniciarOperacion(): boolean {
    if (!this.puedeOperar()) {
      console.log(`Sistema bajo carga extrema: máximo ${this.MAX_OPERACIONES} operaciones simultáneas.`);
      return false;
    }
    this.operacionesActivas++;
    console.log(`[CargaExtrema] Operación iniciada. Activas: ${this.operacionesActivas}`);
    return true;
  }

  static finalizarOperacion(): void {
    if (this.operacionesActivas > 0) this.operacionesActivas--;
    console.log(`[CargaExtrema] Operación finalizada. Activas: ${this.operacionesActivas}`);
  }

  static estado(): string {
    return `Operaciones activas: ${this.operacionesActivas}/${this.MAX_OPERACIONES}`;
  }
}

// ===== REGLAS DE NEGOCIO + CÁLCULO Y FALLA (POO + Funcional + ROP) =====
class ProcesadorPago {

  static crearFactura(monto: number, tipo: TipoTransaccion): Resultado<Factura> {
    if (monto <= 0)
      return { ok: false, error: "El monto debe ser mayor a cero" };
    if (monto % 10 !== 0)
      return { ok: false, error: "El monto debe ser múltiplo de 10" };
    if (monto > 5000)
      return { ok: false, error: "Monto máximo por operación es $5000" };

    const factura: Factura = {
      id: `FAC-${Date.now()}`,
      monto,
      tipo,
      estado: "PENDIENTE",
      fecha: new Date(),
    };

    console.log(`[Reglas de Negocio] Factura creada: ${factura.id} - Estado: ${factura.estado}`);
    return { ok: true, valor: factura };
  }

  static procesarFactura(factura: Factura, saldoActual: number): Resultado<Factura> {
    if (!CargaExtrema.iniciarOperacion()) {
      return { ok: false, error: "Sistema bajo carga extrema, intente más tarde" };
    }

    // Función pura: sin efectos secundarios
    const esValido = (f: Factura, saldo: number): boolean =>
      f.tipo === TipoTransaccion.DEPOSITO || saldo >= f.monto;

    if (!esValido(factura, saldoActual)) {
      CargaExtrema.finalizarOperacion();
      return { ok: false, error: "Fondos insuficientes para procesar la factura" };
    }

    const facturaAprobada: Factura = { ...factura, estado: "APROBADO" };
    console.log(`[Cálculo] Factura aprobada: ${facturaAprobada.id}`);

    EventBus.emit("PagoCompletado", {
      id: facturaAprobada.id,
      monto: facturaAprobada.monto,
      tipo: facturaAprobada.tipo,
      fecha: facturaAprobada.fecha,
    });

    CargaExtrema.finalizarOperacion();
    return { ok: true, valor: facturaAprobada };
  }
}

// ===== CAJERO (ENCAPSULAMIENTO + SCOPE + MEMOIZACIÓN) =====
const DENOMINACIONES: number[] = [100, 50, 20, 10];

class Cajero {
  private saldo: number;
  private historial: Transaccion[] = [];

  constructor(saldoInicial: number) {
    this.saldo = saldoInicial;
    EventBus.on("PagoCompletado", (data) => {
      console.log(`[Evento] PagoCompletado recibido → ${data.tipo} de $${data.monto}`);
    });
  }

  public consultarSaldo(): number {
    return this.saldo;
  }

  public retirar(monto: number): string {
    const facturaResult = ProcesadorPago.crearFactura(monto, TipoTransaccion.RETIRO);
    if (!facturaResult.ok) return facturaResult.error;

    const procesoResult = ProcesadorPago.procesarFactura(facturaResult.valor, this.saldo);
    if (!procesoResult.ok) return procesoResult.error;

    const billetesADispensar = this.calcularBilletes(monto) as number[];
    const detalle = billetesADispensar
      .map((billete: number) => `Entregando billete de $${billete}`)
      .join("\n");

    this.saldo -= monto;
    this.registrarTransaccion(TipoTransaccion.RETIRO, monto);
    return `${detalle}\nRetiro exitoso. Saldo actual: $${this.saldo}`;
  }

  public depositar(monto: number): string {
    const facturaResult = ProcesadorPago.crearFactura(monto, TipoTransaccion.DEPOSITO);
    if (!facturaResult.ok) return facturaResult.error;

    const procesoResult = ProcesadorPago.procesarFactura(facturaResult.valor, this.saldo);
    if (!procesoResult.ok) return procesoResult.error;

    this.saldo += monto;
    this.registrarTransaccion(TipoTransaccion.DEPOSITO, monto);
    return `Depósito exitoso. Saldo actual: $${this.saldo}`;
  }

  // ===== SCOPE + MEMOIZACIÓN =====
  private calcularBilletes = memoize((monto: number): number[] => {
    let restante = monto; // variable LOCAL (scope)
    return DENOMINACIONES.flatMap(denom => {
      const cantidad = Math.floor(restante / denom);
      restante %= denom;
      return Array(cantidad).fill(denom);
    });
  });

  private registrarTransaccion(tipo: TipoTransaccion, monto: number): void {
    this.historial.push({ tipo, monto, fecha: new Date() });
  }

  public deshacerUltimaOperacion(): string {
    if (this.historial.length === 0) return "No hay transacciones para deshacer";
    const ultima = this.historial.pop() as Transaccion;
    if (ultima.tipo === TipoTransaccion.RETIRO) this.saldo += ultima.monto;
    if (ultima.tipo === TipoTransaccion.DEPOSITO) this.saldo -= ultima.monto;
    return `Se revirtió: ${ultima.tipo} de $${ultima.monto}. Saldo actual: $${this.saldo}`;
  }

  public verHistorial(): Transaccion[] {
    return [...this.historial];
  }
}

// ===== MENÚ INTERACTIVO =====
const cajero = new Cajero(1000);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// ===== PROMISE + ASYNC/AWAIT =====
const preguntar = (texto: string): Promise<string> =>
  new Promise(resolve => rl.question(texto, resolve));

const opciones: Record<string, () => Promise<void>> = {
  "1": async () => {
    console.log(`\n💰 Saldo disponible: $${cajero.consultarSaldo()}`);
  },
 "2": async () => {
  const input = await preguntar("📥 Monto a depositar: $");
  console.log(`\n${cajero.depositar(Number(input))}`);
},
 "3": async () => {
  const input = await preguntar("📤 Monto a retirar: $");
  console.log(`\n${cajero.retirar(Number(input))}`);
},
  "4": async () => {
    console.log(`\n${cajero.deshacerUltimaOperacion()}`);
  },
  "5": async () => {
    const historial = cajero.verHistorial();
    console.log("\n📋 Historial de transacciones:");
    console.log("─".repeat(40));
    if (historial.length === 0) {
      console.log("  No hay transacciones registradas.");
    } else {
      historial.forEach((t, index) => {
        const emoji = t.tipo === "RETIRO" ? "📤" : "📥";
        console.log(`  ${index + 1}. ${emoji} ${t.tipo} - $${t.monto} - ${t.fecha.toLocaleString()}`);
      });
    }
    console.log("─".repeat(40));
  },
  "6": async () => {
    console.log("\n👋 Gracias por usar el Cajero Pepita. ¡Hasta luego!");
    console.log("═".repeat(40));
    rl.close();
  },
};

async function iniciar(): Promise<void> {
  console.log("\n" + "═".repeat(40));
  console.log(" 7 Bienvenido al Cajero Automático");
  console.log("            PEPITA");
  console.log("═".repeat(40));
  console.log("  1. 💰  Consultar saldo");
  console.log("  2. 📥  Depositar");
  console.log("  3. 📤  Retirar");
  console.log("  4. ↩️   Deshacer última operación");
  console.log("  5. 📋  Ver historial");
  console.log("  6. ➡️  Salir");
  console.log("═".repeat(40));

  let activo = true;
  while (activo) {
  const opcion = await preguntar("\n ---- Elige una opción (1-6): ");
  const accion = opciones[opcion.trim()];
  if (accion) {
    await accion();
    if (opcion.trim() === "6") {
      activo = false;
    }
  } else {
    console.log("⚠️  Opción inválida. Elige entre 1 y 6.");
  }
}
}

iniciar();