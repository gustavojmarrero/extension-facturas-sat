# Ficha en la Chrome Web Store

Textos para el panel de desarrollador (editor «Reporte Ágil», info@reporteagil.com). Las capturas y el mosaico salen de `node scripts/capturas.mjs` en `tienda/capturas/`.

## Ficha

- **Nombre** (del manifiesto): Facturas SAT a Excel, XML y PDF — Reporte Ágil
- **Resumen** (del manifiesto): Relación de tus facturas emitidas y recibidas del portal del SAT en Excel, sin el tope de 500, con XML y PDF en carpetas.
- **Categoría:** Productividad › Herramientas
- **Idioma:** Español (Latinoamérica)
- **Sitio web:** https://reporteagil.com/extensiones
- **Asistencia:** info@reporteagil.com

### Descripción

Descarga la relación de tus facturas emitidas y recibidas del portal del SAT en un Excel, sin el tope de 500, y baja el XML y el PDF de cada una ordenados en carpetas. Gratis y sin salir de tu navegador.

Cómo funciona
1. Entra como siempre al portal de facturas del SAT («Consulta y recuperación de comprobantes») con tu contraseña o tu e.firma.
2. Abre «Consultar Facturas Emitidas» o «Consultar Facturas Recibidas». Aparece el panel de la extensión.
3. Elige el año y el mes, o el año completo, y marca lo que quieres: relación en Excel, XML y PDF.

Lo que hace
• Sin el tope de 500: el portal solo muestra 500 facturas por consulta. Cuando una consulta llega al tope, la extensión la parte sola por día y por hora, y junta todo sin repetir.
• Cobertura comprobada: el Excel trae una hoja «Cobertura» con cada consulta y si quedó completa. Si en un mismo segundo hay más de 500 facturas, lo marca para que pidas la metadata de ese segundo en el portal.
• Relación en Excel: folio fiscal (UUID), fechas, RFC y nombre del emisor y del receptor, efecto, estado, estatus de cancelación y total. Con el XML agrega serie, folio, moneda, subtotal, descuento, impuestos trasladados y retenidos, método y forma de pago y uso del CFDI.
• XML y PDF en carpetas: SAT/<RFC>/Emitidas o Recibidas/<año>/<mes>/, con nombres como 2026-09-01_<RFC de la contraparte>_<serie-folio>_<UUID>, iguales para el XML y el PDF.
• Respeta la cuota del SAT: el portal permite 2,000 XML al día. Si un periodo tiene más, la extensión se detiene y al día siguiente continúa donde se quedó.
• Puedes pausar y continuar. Si se cierra la sesión, vuelves a entrar y sigues sin perder lo avanzado.

Privacidad
• Todo ocurre en tu navegador: tus facturas no se envían a Reporte Ágil ni a terceros.
• La extensión nunca ve tu contraseña, tu CIEC ni tu e.firma.
• Solo funciona en portalcfdi.facturaelectronica.sat.gob.mx.
• Política de privacidad: https://reporteagil.com/extensiones/facturas-sat/privacidad
• Código fuente: https://github.com/gustavojmarrero/extension-facturas-sat

No es una herramienta del SAT ni está avalada por él. La publica Reporte Ágil (reporteagil.com), donde también encuentras plantillas de Excel y Google Sheets para tu negocio.

## Prácticas de privacidad

- **Propósito único:** exportar a Excel la relación de facturas del portal del SAT («Consulta y recuperación de comprobantes») y descargar sus XML y PDF organizados en carpetas, con la sesión que abre el usuario.
- **downloads:** guardar en la carpeta de Descargas el Excel con la relación y los XML y PDF de cada factura, en subcarpetas por RFC, tipo, año y mes, y mostrar el Excel en la carpeta con el botón «Ver en Descargas». Además quita de la lista de descargas de Chrome los XML y PDF ya guardados, para no llenarla con miles de entradas; los archivos se quedan en el equipo.
- **storage:** guardar en el equipo el avance de la descarga en curso, para continuar si se cierra la sesión o se agota la cuota diaria del SAT, la cuenta de descargas del día y la aceptación del aviso de datos.
- **Permiso de host (portalcfdi.facturaelectronica.sat.gob.mx):** la extensión solo trabaja en el portal de facturas del SAT: muestra su panel en las páginas de consulta, llena el formulario de búsqueda con el periodo elegido, lee la tabla de resultados y descarga los XML y PDF con la sesión del usuario. No tiene acceso a ningún otro sitio.
- **Código remoto:** no. Todo el código va en el paquete.
- **Datos que maneja** (solo en el equipo, nunca se transmiten): información de identificación personal (RFC y nombres de emisores y receptores), información financiera y de pagos (las facturas) y contenido del sitio web (la tabla del portal).
- **Certificaciones:** no se venden ni transfieren datos a terceros; no se usan para fines ajenos al propósito único; no se usan para determinar solvencia ni para préstamos.
- **Política de privacidad:** https://reporteagil.com/extensiones/facturas-sat/privacidad

## Distribución

Pública, todas las regiones, gratis.

## Pasos en el panel de desarrollador

Chrome no deja que una extensión (Claude in Chrome) maneje la Chrome Web Store, y el navegador de Orca no recibe el teclado en sus formularios, así que estos pasos se hacen a mano en Chrome.

1. **Configuración:** nombre comercial «Reporte Ágil» → Guardar cambios. Abrir el correo de verificación que Google mandó a info@reporteagil.com. La cuenta ya está declarada como comerciante: antes de publicar, cambiar en el perfil de pagos de Google la dirección y el teléfono por los del negocio, porque se muestran en la ficha.
2. **Elementos → Nuevo elemento:** subir `paquetes/facturas-sat-1.0.0.zip` (`npm run zip`).
3. **Ficha de Chrome Web Store:** descripción, categoría, idioma, ícono (`iconos/128.png`), capturas 1 a 6 de `tienda/capturas/` en ese orden, mosaico promocional pequeño `tienda/capturas/mosaico-440x280.png`, sitio y asistencia (ver «Ficha» arriba).
4. **Prácticas de privacidad:** propósito único, una justificación por permiso, código remoto «No», datos manejados y las tres certificaciones (ver «Prácticas de privacidad» arriba), URL de la política.
5. **Distribución:** gratis, pública, todas las regiones.
6. **Enviar para revisión.** Al aprobarse, poner su URL en `tienda_url` de `facturas-sat` en `reporteagil/src/data/sitios.json` y desplegar.

La cuenta tiene un límite de 2 extensiones: con esta queda espacio para solo una de las dos de HAB-02.
