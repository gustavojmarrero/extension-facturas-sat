# Facturas SAT a Excel, XML y PDF

Extensión de Chrome gratuita de [Reporte Ágil](https://reporteagil.com/extensiones). Trabaja en «Consulta y recuperación de comprobantes» del portal del SAT con la sesión que abre el usuario y:

- exporta a Excel la relación de facturas emitidas o recibidas de un mes o de un año;
- parte sola por día y por hora cada consulta que llega al tope de 500 resultados del portal, y deja en la hoja «Cobertura» qué quedó completo;
- descarga el XML y el PDF de cada factura en `SAT/<RFC>/Emitidas|Recibidas/<año>/<mes>/`, con el mismo nombre para los dos;
- saca la relación completa aunque el periodo pase de la cuota de 2,000 XML al día; los XML y PDF que falten se bajan al día siguiente;
- valida los XML que el usuario arrastra o elige (sueltos o una carpeta, uno o cientos) contra el servicio público de verificación del SAT: estado (vigente, cancelado o no encontrado), si se puede cancelar, estatus de cancelación y si el emisor está en la lista de EFOS, con exportación a Excel. Se abre con el ícono de la extensión o desde el panel.

No es una herramienta del SAT. Todo ocurre en el navegador: no envía facturas ni datos a Reporte Ágil ni a terceros y nunca lee la contraseña ni la e.firma. La única consulta fuera del portal es la del validador, solo cuando el usuario lo usa: por cada CFDI envía al servicio del SAT (`consultaqr.facturaelectronica.sat.gob.mx`) el UUID, el RFC del emisor y del receptor, el total y los últimos 8 caracteres del sello. [Política de privacidad](https://reporteagil.com/extensiones/facturas-sat/privacidad).

## Cómo está hecha

| Archivo | Qué hace |
|---|---|
| `src/portal.js` | IDs, columnas y métodos del portal, comprobados en una sesión real. Si el SAT cambia el portal, se actualiza aquí. |
| `src/intervalos.js` | Intervalos de consulta y cómo se parten: mes → días → mitades del día hasta un segundo. |
| `src/consulta.js` | Llena el formulario, pulsa «Buscar CFDI», espera a que el portal reemplace la tabla y la lee. |
| `src/descargas.js` | XML y PDF por el mismo camino que los botones del portal (`ValidarDescarga` y luego el archivo). |
| `src/motor.js` | Recorre el periodo, registra las facturas, descarga, guarda el avance, deja pendientes los archivos al agotarse la cuota y se detiene si se cierra la sesión. |
| `src/xml.js` | Lee del XML los datos de la relación (serie, folio, importes) y los del validador (UUID, RFC, total, sello). |
| `src/xlsx.js`, `src/relacion.js` | Excel sin dependencias: hojas Facturas, Cobertura y Resumen. |
| `src/ui.js`, `src/content.js` | Panel dentro del portal (Shadow DOM), con el enlace al validador. |
| `src/background.js` | Guarda los archivos con `chrome.downloads` y abre el validador (ícono de la extensión y enlace del panel). |
| `src/verificacion.js` | Validador: expresión impresa por versión de CFDI, consulta SOAP al servicio del SAT, reintentos con espera creciente y lectura en claro de la respuesta. |
| `src/cola.js` | Cola de consultas: dos a la vez, pausa entre una y otra, se detiene al momento. |
| `validar.html`, `src/validar.js`, `src/reporte-validacion.js` | Página del validador y su Excel (hojas Validación y Resumen). |

Permisos: `downloads`, `storage` y acceso solo a `portalcfdi.facturaelectronica.sat.gob.mx`. Nunca toca los controles de cancelación del portal. El validador usa un permiso de host opcional, `consultaqr.facturaelectronica.sat.gob.mx` (`optional_host_permissions`), que Chrome pide la primera vez que se pulsa «Validar»: así la actualización no cambia la advertencia de permisos y Chrome no desactiva la extensión a quienes ya la tienen. El ícono (`action`) no lleva popup ni pide permisos.

## Desarrollo

```
npm install
npm test            # pruebas unitarias (Node)
npm run test:e2e    # la extensión empaquetada contra un portal simulado (Playwright)
npm run zip         # paquetes/facturas-sat-<versión>.zip para la Chrome Web Store
```

`node scripts/capturas.mjs` genera las capturas de la ficha con el portal simulado y datos inventados. `e2e/arnes-real.js` permite revisar el motor en el portal real sin guardar archivos. `node scripts/consulta-sat-real.mjs <carpeta> [--esperado esperado.json]` prueba el validador contra el servicio real del SAT y solo imprime conteos (nunca RFC, UUID ni importes); en `e2e/` el servicio va simulado (`e2e/sat-falso.js`).
