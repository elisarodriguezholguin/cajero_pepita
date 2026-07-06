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
  private static eventos: Map<string, Listener[]> = new Map(); //Map tipo de dato que va guardar// New map creación de un objeto Map nuevo y vacío.
//se compone un map una llave y lista de valor 
  static on(evento: string, listener: Listener): void {
    if (!this.eventos.has(evento)) this.eventos.set(evento, []);//has, existe o no lo tiene.
    this.eventos.get(evento)!.push(listener);
    //guardar en una variable el has , sobre el if hacer condicion
  }

  static emit(evento: string, data: any): void {
    const listeners = this.eventos.get(evento) ?? [];
    listeners.forEach(listener => listener(data));
  }
}

// CASO DE USO: Carga Extrema
// PARADIGMA: Reactivo
class CargaExtrema {
  private static operacionesActivas: number = 0;//El sistema reacciona a la carga actual
  //operacionesActivas representa cuántas operaciones (retiros/depósitos) están corriendo en este momento.
  private static readonly MAX_OPERACIONES: number = 5;
// Cuántas transacciones puede procesar el sistema al mismo tiempo, sin importar cuánto dinero sea
  static puedeOperar(): boolean {
    return this.operacionesActivas < this.MAX_OPERACIONES;
  }

  static iniciarOperacion(): boolean {
    if (!this.puedeOperar()) return false;
    this.operacionesActivas++;
    return true;
  }
//CargaExtrema es la clase que controla cuántas operaciones (retiros/depósitos) pueden estar procesándose
// para simular que el sistema no se sature.

  static finalizarOperacion(): void {
    if (this.operacionesActivas > 0) this.operacionesActivas--;
  }
}


// CASO DE USO: Autorizacion
// PARADIGMA: AOP
//Guardia de seguridad del cajero,  revisa que el monto sea válido antes de un deposito o retiro ,
//si algo falla corta la operacion.
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
// PARADIGMA: POO Programación Orientada a Objetos
class ProcesadorPago {
//CrearFactura aplica las reglas de negocio específicas del cajero antes de construir una factura.
  static crearFactura(monto: number, tipo: TipoTransaccion): Resultado<Factura> {
    //si el monto NO es múltiplo exacto de 10 
    // (o sea, si al dividirlo entre 10 sobra algo), rechaza la operación.
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
  // PARADIGMA: Funcional + ROP "Railway Oriented Programming"
  static procesarFactura(factura: Factura, saldoActual: number): Resultado<Factura> {
    const esValido = (f: Factura, saldo: number): boolean =>
      f.tipo === TipoTransaccion.DEPOSITO || saldo >= f.monto;

    if (!esValido(factura, saldoActual))
      return { estado: "fallido", error: "Fondos insuficientes" };
//no modifican nada externo, solo calcula y devuelve un resultado nuevo
    const facturaAprobada: Factura = {
//Desempaquetamos spread.
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
//Unico metodo publico que se permite leer desde fuera para consulta de saldo.
  public consultarSaldo(): number {
    return this.saldo;
  }
//Autorización-AOP, pregunta si el monto es válido y si el sistema no está saturado.
  public retirar(monto: number): string {
    const auth = Autorizacion.verificar(monto);
    if (auth.estado === "fallido") return auth.error;

    const facturaResult = ProcesadorPago.crearFactura(monto, TipoTransaccion.RETIRO);
    if (facturaResult.estado === "fallido") return facturaResult.error;

    CargaExtrema.iniciarOperacion();
    const procesoResult = ProcesadorPago.procesarFactura(facturaResult.valor, this.saldo);
    CargaExtrema.finalizarOperacion();
    if (procesoResult.estado === "fallido") return procesoResult.error;

    const billetesADispensar = this.calcularBilletes(monto) as number[];//Determina un billet objeto ,compuesto por monto, y tipo moneda y valor
    const detalle = billetesADispensar
      .map((billete: number) => `  $${billete}`)
      .join(" | ");
//Resta el monto del saldo
    this.saldo -= monto;
    return `${detalle}\n  Retiro exitoso. Saldo actual: $${this.saldo}`;
  }
//
  public depositar(monto: number): string {
    const auth = Autorizacion.verificar(monto);
    if (auth.estado === "fallido") return auth.error;
//Antes de pocesar el deposito,  verifica si la operacion esta permitida, con Autoriacion verificar.
    const facturaResult = ProcesadorPago.crearFactura(monto, TipoTransaccion.DEPOSITO);
    if (facturaResult.estado === "fallido") return facturaResult.error;
//Aqui la carga extrema, controla que el sistema no se sature mientras se está procesando la operación.
    CargaExtrema.iniciarOperacion();
    const procesoResult = ProcesadorPago.procesarFactura(facturaResult.valor, this.saldo);
    CargaExtrema.finalizarOperacion();
    if (procesoResult.estado === "fallido") return procesoResult.error;

    this.saldo += monto;
    return `  Deposito exitoso. Saldo actual: $${this.saldo}`;
  }
  
//--------------------------------------------------------------
  // SCOPE + MEMOIZACIÓN
  //Encapsulamiento (POO)
  private calcularBilletes = memoize((monto: number): number[] => { 
    let restante = monto;
    //
    return DENOMINACIONES.flatMap(denom => {
//flatMap recorre cada elemento del arreglo DENOMINACIONES, funcion escoge valores que existe y los aplana, programacion orientada a objetos los reocge
      const cantidad = Math.floor(restante / denom);
      restante %= denom;
      return Array(cantidad).fill(denom);
      //Aquí ya sabemos cuántos billetes entregar, mientras que fill llena todas las posiciones.
    });
  });

  private registrarTransaccion(tipo: TipoTransaccion, monto: number): void {
    this.historial.push({ tipo, monto, fecha: new Date() });//push agrega un nuevo elemento al final del arreglo historial.
  }
//Se ejecuta cuando EventBus emite el evento "PagoCompletado"

  public deshacerUltimaOperacion(): string {
    if (this.historial.length === 0) return "No hay transacciones para deshacer";
    const ultima = this.historial.pop() as Transaccion;// praxticr tipado
    if (ultima.tipo === TipoTransaccion.RETIRO) this.saldo += ultima.monto;
    if (ultima.tipo === TipoTransaccion.DEPOSITO) this.saldo -= ultima.monto;
    return `  Se revirtio: ${ultima.tipo} de $${ultima.monto}. Saldo: $${this.saldo}`;
  }

  public verHistorial(): Transaccion[] {
    return [...this.historial]; //toma todos los elementos del arreglo y los coloca dentro de un nuevo arreglo.
  }
}

// MENU INTERACTIVO
//La interfaz de consola, es el código que permite que el usuario 
// interactúe con el programa para las opciones que se ven en la terminal.
const cajero = new Cajero(5000);

const rl = readline.createInterface({
  input: process.stdin, // Entrada estandard lo que el usuario escribe en la terminal
  output: process.stdout,// salida estandard muestra resultados en la terminal
});

const preguntar = (texto: string): Promise<string> =>
  new Promise(resolve => rl.question(texto, resolve));//rl readline interfaz de la lectura y escritura de la terminal.
//El programa tiene que esperar al usuario escriba algo antes de continuar, por eso se usa Promise.
const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));

async function mostrarPasos(pasos: string[]): Promise<void> {
  for (const paso of pasos) {
    await pausa(500);
    console.log(paso);//
  }
}
//Arreglo de cadenas  texto que representan los pasos de una transaccion.
const PASOS_TRANSACCION = [
  "  ▶ Verificando carga del sistema...    [Reactivo] ",
  "  ▶ Autorizando operacion...            [AOP]",
  "  ▶ Creando factura...                  [POO]  ",
  "  ▶ Calculando...                       [Funcional + ROP]",
  "  ▶ Notificando sistema...              [Eventos] ",
];
//Esperar 500 milisegundos entre cada paso, para simular que el sistema está procesando la operación.

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
//Investigar matriz diagnostica en la diapistiva es aparte de este codigo
// Punto de entrada del sistema.
// Controla el flujo del menú interactivo usando programación asíncrona
// para esperar input del usuario sin bloquear el hilo principal.
async function iniciar(): Promise<void> {// investigar los tres tipos de async callback, etc?
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
  while (activo) {//Crea un loop infinito controlado )hace que“repita el menú hasta que el usuario decida salir”)
    const opcion = await preguntar("\n---- Elige una opcion (1-6): ");
    const accion = opciones[opcion.trim()];
    if (accion) {
      await accion();
      if (opcion.trim() === "6") activo = false;//Controla la vida del programa
    } else {
      console.log("  Opcion invalida. Elige entre 1 y 6.");

      //fallback del sistema,evita inputs raros,mejora UX, protege el flujo
    }
  }
}

iniciar();