import * as readline from "readline";

// ENUM
enum TipoTransaccion {
  RETIRO = "RETIRO",
  DEPOSITO = "DEPOSITO",
  CONSULTA = "CONSULTA"
}

// NUEVO ENUM: estados posibles de una factura
enum EstadoFactura {
  PENDIENTE = "PENDIENTE",
  APROBADO = "APROBADO",
  RECHAZADO = "RECHAZADO"
}

// TIPADO
interface Transaccion {
  tipo: TipoTransaccion;
  monto: number;
  fecha: Date;
}

// NUEVO: representa cada cambio de estado con su fecha
interface CambioEstado {
  estado: EstadoFactura;
  fecha: Date;
}

interface Factura {
  id: string;
  monto: number;
  tipo: TipoTransaccion;
  estado: CambioEstado[]; 
  fecha: Date;
}

type Resultado<T> =
  | { estado: "exitoso"; valor: T }
  | { estado: "fallido"; error: string };
//Listener  que recibe un parámetro 
// llamado data puedes ser tipo any, o cualquier cosa) y no retorna nada "void"
type Listener = (data: any) => void;

// CLOSURE + MEMOIZACIÓN
//Para llamar cualquie funcion que quiera memorizar.
function memoize(fn: Function) {
  const cache = new Map<string, any>();
  //memoize al nos saber cuantos argumeetos recibirá esa función retornada, ya quees geenrica.
  // el args es la funcion interna de memoize que construye  y retorna.
  // aqui ...args ,recoge datos esta un arreglo esperando cualque cantidad de argumentos 
  return (...args: any[]) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));// aqui es desempaquetando argumentos que ya estan
    return cache.get(key);
  };
}

// CASO DE USO: Desacoplamiento
// PARADIGMA: Eventos
class EventBus {
  private static eventos: Map<string, Listener[]> = new Map();

  static on(evento: string, listener: Listener): void {
    if (!this.eventos.has(evento)) this.eventos.set(evento, []);
    this.eventos.get(evento)!.push(listener);
  }

  static emit(evento: string, data: any): void {
    const listeners = this.eventos.get(evento) ?? [];
    listeners.forEach(listener => listener(data));
  }
}

// CASO DE USO: Carga Extrema
// PARADIGMA: Reactivo
class CargaExtrema {
  private static operacionesActivas: number = 0;
  private static readonly MAX_OPERACIONES: number = 5;

  static puedeOperar(): boolean {
    return this.operacionesActivas < this.MAX_OPERACIONES;
  }

  static iniciarOperacion(): boolean {
    if (!this.puedeOperar()) return false;
    this.operacionesActivas++;
    return true;
  }

  static finalizarOperacion(): void {
    if (this.operacionesActivas > 0) this.operacionesActivas--;
  }
}

// CASO DE USO: Autorizacion
// PARADIGMA: AOP
class Autorizacion {
  static verificar(monto: number): Resultado<boolean> {
    if (monto <= 0)
      return { estado: "fallido", error: "El monto debe ser mayor a cero" };
    if (!CargaExtrema.puedeOperar())
      return { estado: "fallido", error: "Sistema bajo carga extrema" };
    return { estado: "exitoso", valor: true };
  }
}

// CASO DE USO: Reglas de Negocio
// PARADIGMA: POO
class ProcesadorPago {

  static crearFactura(monto: number, tipo: TipoTransaccion): Resultado<Factura> {
    if (monto % 10 !== 0)
      return { estado: "fallido", error: "El monto debe ser multiplo de 10" };
    if (monto > 5000)
      return { estado: "fallido", error: "Monto maximo por operacion es $5000" };

    const factura: Factura = {
      id: `FAC-${Date.now()}`,
      monto, tipo,
      estado: [{ estado: EstadoFactura.PENDIENTE, fecha: new Date() }],
      fecha: new Date(),
    };
    return { estado: "exitoso", valor: factura };
  }

  // CASO DE USO: Calculo y Falla
  // PARADIGMA: Funcional + ROP
  static procesarFactura(factura: Factura, saldoActual: number): Resultado<Factura> {
    const esValido = (f: Factura, saldo: number): boolean =>
      f.tipo === TipoTransaccion.DEPOSITO || saldo >= f.monto;

    if (!esValido(factura, saldoActual))
      return { estado: "fallido", error: "Fondos insuficientes" };

    const facturaAprobada: Factura = {
      ...factura,
      estado: [...factura.estado, { estado: EstadoFactura.APROBADO, fecha: new Date() }],
    };

    EventBus.emit("PagoCompletado", {
      monto: facturaAprobada.monto,
      tipo: facturaAprobada.tipo,
    });

    return { estado: "exitoso", valor: facturaAprobada };
  }
}

// CAJERO: Encapsulamiento + Scope + Memoizacion
const DENOMINACIONES: number[] = [100, 50, 20, 10];

class Cajero {
  private saldo: number;
  private historial: Transaccion[] = [];

  constructor(saldoInicial: number) {
    this.saldo = saldoInicial;
    EventBus.on("PagoCompletado", (data) => {
      this.registrarTransaccion(data.tipo, data.monto);
    });
  }

  public consultarSaldo(): number {
    return this.saldo;
  }

  public retirar(monto: number): string {
    const auth = Autorizacion.verificar(monto);
    if (auth.estado === "fallido") return auth.error;

    const facturaResult = ProcesadorPago.crearFactura(monto, TipoTransaccion.RETIRO);
    if (facturaResult.estado === "fallido") return facturaResult.error;

    CargaExtrema.iniciarOperacion();
    const procesoResult = ProcesadorPago.procesarFactura(facturaResult.valor, this.saldo);
    CargaExtrema.finalizarOperacion();
    if (procesoResult.estado === "fallido") return procesoResult.error;

    const billetesADispensar = this.calcularBilletes(monto) as number[];
    const detalle = billetesADispensar
      .map((billete: number) => `  $${billete}`)
      .join(" |");

    this.saldo -= monto;
    return `${detalle}\n  Retiro exitoso. Saldo actual: $${this.saldo}`;
  }

  public depositar(monto: number): string {
    const auth = Autorizacion.verificar(monto);
    if (auth.estado === "fallido") return auth.error;

    const facturaResult = ProcesadorPago.crearFactura(monto, TipoTransaccion.DEPOSITO);
    if (facturaResult.estado === "fallido") return facturaResult.error;

    CargaExtrema.iniciarOperacion();
    const procesoResult = ProcesadorPago.procesarFactura(facturaResult.valor, this.saldo);
    CargaExtrema.finalizarOperacion();
    if (procesoResult.estado === "fallido") return procesoResult.error;

    this.saldo += monto;
    return `  Deposito exitoso. Saldo actual: $${this.saldo}`;
  }

  // SCOPE + MEMOIZACIÓN
  private calcularBilletes = memoize((monto: number): number[] => {
    let restante = monto;
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
    return `  Se revirtio: ${ultima.tipo} de $${ultima.monto}. Saldo: $${this.saldo}`;
  }

  public verHistorial(): Transaccion[] {
    return [...this.historial];
  }
}

// MENU INTERACTIVO
const cajero = new Cajero(5000);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const preguntar = (texto: string): Promise<string> =>
  new Promise(resolve => rl.question(texto, resolve));

const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));

async function mostrarPasos(pasos: string[]): Promise<void> {
  for (const paso of pasos) {
    await pausa(500);
    console.log(paso);
  }
}

const PASOS_TRANSACCION = [
  "  ▶ Verificando carga del sistema...    [Reactivo] ",
  "  ▶ Autorizando operacion...            [AOP]",
  "  ▶ Creando factura...                  [POO]  ",
  "  ▶ Calculando...                       [Funcional + ROP]",
  "  ▶ Notificando sistema...              [Eventos] ",
];

const opciones: Record<string, () => Promise<void>> = {
 "1": async () => {
  console.log("\nCONSULTANDO...");
  await mostrarPasos(["  Obteniendo saldo en tiempo real...    [REACTIVO]  "]);
  console.log(`\n  ▶ SALDO DISPONIBLE: $${cajero.consultarSaldo()}`);
},
  "2": async () => {
    const input = await preguntar("Monto a depositar: $");
    console.log("\nINICIANDO PROCESAMIENTO...");
    await mostrarPasos(PASOS_TRANSACCION);
    console.log(`\n${cajero.depositar(Number(input))}`);
  },

  "3": async () => {
    const input = await preguntar("Monto a retirar: $");
    console.log("\nINICIANDO PROCESAMIENTO...");
    await mostrarPasos(PASOS_TRANSACCION);
    console.log(`\n${cajero.retirar(Number(input))}`);
  },

  "4": async () => {
    console.log("\nPROCESANDO REVERSION...");
    await mostrarPasos(["  ▶ Revirtiendo ultima operacion...     [Funcional + ROP]"]);
    console.log(`\n${cajero.deshacerUltimaOperacion()}`);
  },

  "5": async () => {
    console.log("\nCARGANDO HISTORIAL...");
    await mostrarPasos([
      "  ▶ Accediendo a objetos Transaccion...    [POO] ",
      "  ▶ Recuperando registro de eventos...     [Eventos]  ",
    ]);
    const historial = cajero.verHistorial();
    console.log("\n   HISTORIAL:");
    console.log("  " + "─".repeat(38));
    if (historial.length === 0) {
      console.log("  No hay transacciones registradas.");
    } else {
      historial.forEach((t, index) => {
  console.log(`  ${index + 1}. ${t.tipo} - $${t.monto} - ${t.fecha.toLocaleString()}`);
      });
    }
    console.log("  " + "─".repeat(38));
  },

  "6": async () => {
    console.log("\n  Gracias por usar el Cajero Pepita. Hasta luego!");
    console.log("═".repeat(40));
    rl.close();
  },
};

async function iniciar(): Promise<void> {
  console.log("\n" + "═".repeat(40));
  console.log("   Bienvenido al Cajero Automatico");
  console.log("            BANCO PEPITA");
  console.log("═".repeat(40));
  console.log("  1. 💰  Consultar saldo");
  console.log("  2. 📥  Depositar");
  console.log("  3. 📤  Retirar");
  console.log("  4. ↩️   Deshacer ultima operacion");
  console.log("  5. 📋  Ver historial");
  console.log("  6. ➡️  Salir");
  console.log("═".repeat(40));

  let activo = true;
  while (activo) {
    const opcion = await preguntar("\n---- Elige una opcion (1-6): ");
    const accion = opciones[opcion.trim()];
    if (accion) {
      await accion();
      if (opcion.trim() === "6") activo = false;
    } else {
      console.log("  Opcion invalida. Elige entre 1 y 6.");
    }
  }
}

iniciar();