# Facturas SAT a Excel, XML y PDF

Extensión de Chrome gratuita de [Reporte Ágil](https://reporteagil.com/extensiones). Trabaja en «Consulta y recuperación de comprobantes» del portal del SAT con la sesión que abre el usuario y:

- exporta a Excel la relación de facturas emitidas o recibidas de un mes o de un año;
- parte sola por día y por hora cada consulta que llega al tope de 500 resultados del portal, y deja en la hoja «Cobertura» qué quedó completo;
- descarga el XML y el PDF de cada factura en `SAT/<RFC>/Emitidas|Recibidas/<año>/<mes>/`, con el mismo nombre para los dos;
- respeta la cuota de 2,000 XML al día y continúa al día siguiente.

No es una herramienta del SAT. Todo ocurre en el navegador: no envía facturas ni datos a ningún servidor y nunca lee la contraseña ni la e.firma. [Política de privacidad](https://reporteagil.com/extensiones/facturas-sat/privacidad).

## Cómo está hecha

| Archivo | Qué hace |
|---|---|
| `src/portal.js` | IDs, columnas y métodos del portal, comprobados en una sesión real. Si el SAT cambia el portal, se actualiza aquí. |
| `src/intervalos.js` | Intervalos de consulta y cómo se parten: mes → días → mitades del día hasta un segundo. |
| `src/consulta.js` | Llena el formulario, pulsa «Buscar CFDI», espera a que el portal reemplace la tabla y la lee. |
| `src/descargas.js` | XML y PDF por el mismo camino que los botones del portal (`ValidarDescarga` y luego el archivo). |
| `src/motor.js` | Recorre el periodo, registra las facturas, descarga, guarda el avance y se detiene ante la cuota o el cierre de sesión. |
| `src/xlsx.js`, `src/relacion.js` | Excel sin dependencias: hojas Facturas, Cobertura y Resumen. |
| `src/ui.js`, `src/content.js` | Panel dentro del portal (Shadow DOM). |
| `src/background.js` | Guarda los archivos con `chrome.downloads`. |

Permisos: `downloads`, `storage` y acceso solo a `portalcfdi.facturaelectronica.sat.gob.mx`. Nunca toca los controles de cancelación del portal.

## Desarrollo

```
npm install
npm test            # pruebas unitarias (Node)
npm run test:e2e    # la extensión empaquetada contra un portal simulado (Playwright)
npm run zip         # paquetes/facturas-sat-<versión>.zip para la Chrome Web Store
```

`node scripts/capturas.mjs` genera las capturas de la ficha con el portal simulado y datos inventados. `e2e/arnes-real.js` permite revisar el motor en el portal real sin guardar archivos.
