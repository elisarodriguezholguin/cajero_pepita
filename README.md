# Cajero Automático en TypeScript — cajero-pepita

Implementación de un cajero automático en un **solo archivo** aplicando los conceptos de estructuras
de datos, fundamentos de programación y arquitectura multiparadigma.

## ¿Cómo ejecutar el proyecto?

```bash
npm install
npm start               # Ejecuta el menú interactivo
```

## Estructura del proyecto
src/
└── cajero-pepita.ts    # Todo el proyecto en un solo archivo
## Conceptos aplicados y dónde encontrarlos

| Concepto | Descripción |
|---|---|
| **Enum** | `TipoTransaccion` agrupa los valores RETIRO, DEPOSITO y CONSULTA. Evita errores de tipeo en strings. |
| **Encapsulamiento** | Los atributos `saldo` e `historial` son `private`. Solo se accede mediante métodos públicos. |
| **Tipado** | Interfaz `Transaccion`, tipo `Resultado<T>` e interfaz `Factura`. Todos los parámetros y retornos están explícitamente tipados. |
| **Closure** | La variable `cache` queda atrapada dentro de la función devuelta por `memoize()`, manteniendo su estado entre llamadas. |
| **Scope** | La variable `restante` dentro de `calcularBilletes` es local a esa función. |
| **Memoización** | `calcularBilletes` está envuelta con `memoize()`: si se retira el mismo monto dos veces, la segunda vez usa el resultado en caché. |
| **Operador rest (...args)** | Permite que `memoize` reciba cualquier cantidad de argumentos, haciéndola genérica y reutilizable. |
| **Bucles** | `flatMap` + `Math.floor` calculan los billetes. `map` + `join` arman el detalle de billetes entregados. `forEach` recorre el historial. |

## Arquitectura Multiparadigma — Caso de Uso Real: Procesamiento de Pago

| Paso | Paradigma | Descripción |
|---|---|---|
| **Paso 1** | AOP (Aspectos) | `CargaExtrema` intercepta cada operación antes y después. Controla máximo 5 operaciones simultáneas. |
| **Paso 2** | AOP (Interceptor) | El cajero solo se preocupa por retirar o depositar, sin saber que hay algo vigilándolo. |
| **Paso 3** | POO (Objetos) | `ProcesadorPago` instancia una `Factura` con estado `PENDIENTE` y aplica reglas de negocio. |
| **Paso 4** | Funcional + ROP | Función pura `esValido` calcula sin efectos secundarios. `Resultado<T>` devuelve éxito o error sin excepciones. |
| **Paso 5** | Reactivo (Eventos) | `EventBus` emite `PagoCompletado` al terminar. Cualquier parte del sistema puede escucharlo sin conocer al cajero. |

## Flujo completo de un retiro
Usuario elige "Retirar $400"
↓
[Reglas de Negocio] → valida monto, crea Factura PENDIENTE
↓
[CargaExtrema]      → verifica capacidad (Activas: 1)
↓
[Cálculo]           → aprueba Factura, cambia estado a APROBADO
↓
[Evento]            → emite "PagoCompletado", notifica al sistema
↓
[CargaExtrema]      → libera la operación (Activas: 0)
↓
Cajero entrega billetes y muestra saldo actualizado
## Funcionalidades del menú

1. Consultar saldo
2. Depositar dinero (pasa por flujo completo de procesamiento de pago)
3. Retirar dinero (pasa por flujo completo de procesamiento de pago)
4. Deshacer la última operación
5. Ver historial completo de transacciones
6. Salir

## Tecnologías usadas

- TypeScript
- Node.js
- ts-node
- readline (menú interactivo por consola)

## Autor

Elisa Rodriguez