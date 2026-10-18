# Ficha en la Chrome Web Store

Textos para el panel de desarrollador (editor «Reporte Ágil», info@reporteagil.com). Las capturas y el mosaico salen de `node scripts/capturas.mjs` en `tienda/capturas/`.

## Ficha

- **Nombre** (del manifiesto, 61 de 75 caracteres): Facturas SAT a Excel, XML y PDF + validar CFDI — Reporte Ágil. Desde 1.1.0 lleva «validar CFDI» para salir en esas búsquedas de la tienda; hasta 1.0.1 era «Facturas SAT a Excel, XML y PDF — Reporte Ágil».
- **Resumen** (del manifiesto, 126 de 132): Relación de tus facturas del SAT en Excel, sin el tope de 500, con XML y PDF en carpetas. Valida el estado y EFOS de tus CFDI.
- **Categoría:** Productividad › Herramientas
- **Idioma:** Español (Latinoamérica)
- **Sitio web:** https://reporteagil.com/extensiones
- **Asistencia:** info@reporteagil.com

### Descripción

Descarga la relación de tus facturas emitidas y recibidas del portal del SAT en un Excel, sin el tope de 500, y baja el XML y el PDF de cada una ordenados en carpetas. Además, valida ante el SAT el estado de los XML que ya tienes, uno o cientos a la vez. Gratis y sin salir de tu navegador.

Cómo funciona
1. Entra como siempre al portal de facturas del SAT («Consulta y recuperación de comprobantes») con tu contraseña o tu e.firma.
2. Abre «Consultar Facturas Emitidas» o «Consultar Facturas Recibidas». Aparece el panel de la extensión.
3. Elige el año y el mes, o el año completo, y marca lo que quieres: relación en Excel, XML y PDF.

Lo que hace
• Sin el tope de 500: el portal solo muestra 500 facturas por consulta. Cuando una consulta llega al tope, la extensión la parte sola por día y por hora, y junta todo sin repetir.
• Cobertura comprobada: el Excel trae una hoja «Cobertura» con cada consulta y si quedó completa. Si en un mismo segundo hay más de 500 facturas, lo marca para que pidas la metadata de ese segundo en el portal.
• Relación en Excel: folio fiscal (UUID), fechas, RFC y nombre del emisor y del receptor, efecto, estado, estatus de cancelación y total. Con el XML agrega serie, folio, moneda, subtotal, descuento, impuestos trasladados y retenidos, método y forma de pago y uso del CFDI.
• XML y PDF en carpetas: SAT/<RFC>/Emitidas o Recibidas/<año>/<mes>/, con nombres como 2026-09-01_<RFC de la contraparte>_<serie-folio>_<UUID>, iguales para el XML y el PDF.
• Excel completo aunque pases de la cuota: el SAT solo deja bajar 2,000 XML al día. La relación en Excel sale con todas las facturas del periodo; los XML que falten (y sus PDF) se bajan al día siguiente con «Continuar descargas» y el Excel se completa con sus datos.
• Puedes pausar y continuar. Si se cierra la sesión, vuelves a entrar y sigues sin perder lo avanzado.

Validar CFDI ante el SAT
• Pulsa el ícono de la extensión (o el enlace del panel) y arrastra tus XML o una carpeta completa: facturas recibidas, emitidas, de 3.2, 3.3 o 4.0.
• Para cada CFDI consulta el servicio público de verificación del SAT, sin captcha y sin teclear: estado (vigente, cancelado o no encontrado), si se puede cancelar, estatus de la cancelación y si el emisor está en la lista de EFOS (empresas que facturan operaciones simuladas).
• Muestra los valores tal como los devuelve el SAT y una explicación en claro, y los exporta a Excel con la fecha y hora de cada consulta.
• Consulta de dos en dos y con pausas; puedes detener y seguir después. Los repetidos se consultan una sola vez.

Privacidad
• Todo ocurre en tu navegador: tus facturas no se envían a Reporte Ágil ni a terceros.
• El validador solo envía al servicio de verificación del SAT, por cada CFDI, el folio fiscal (UUID), el RFC del emisor y del receptor, el total y los últimos 8 caracteres del sello. Lo hace únicamente cuando lo usas y con el permiso que Chrome te pide la primera vez.
• La extensión nunca ve tu contraseña, tu CIEC ni tu e.firma.
• Solo trabaja en portalcfdi.facturaelectronica.sat.gob.mx y, para el validador, en consultaqr.facturaelectronica.sat.gob.mx.
• Política de privacidad: https://reporteagil.com/extensiones/facturas-sat/privacidad
• Código fuente: https://github.com/gustavojmarrero/extension-facturas-sat

No es una herramienta del SAT ni está avalada por él. La publica Reporte Ágil (reporteagil.com), donde también encuentras plantillas de Excel y Google Sheets para tu negocio.

## Prácticas de privacidad

- **Propósito único:** trabajar con las facturas (CFDI) del SAT del usuario: exportar a Excel la relación de facturas del portal del SAT («Consulta y recuperación de comprobantes»), descargar sus XML y PDF organizados en carpetas con la sesión que abre el usuario, y validar el estado de esos XML ante el servicio público de verificación del SAT.
- **downloads:** guardar en la carpeta de Descargas el Excel con la relación y los XML y PDF de cada factura, en subcarpetas por RFC, tipo, año y mes, y mostrar el Excel en la carpeta con el botón «Ver en Descargas». Además quita de la lista de descargas de Chrome los XML y PDF ya guardados, para no llenarla con miles de entradas; los archivos se quedan en el equipo.
- **storage:** guardar en el equipo el avance de la descarga en curso, para continuar si se cierra la sesión o se agota la cuota diaria del SAT, la cuenta de descargas del día y la aceptación del aviso de datos.
- **Permiso de host (portalcfdi.facturaelectronica.sat.gob.mx):** la extensión solo trabaja en el portal de facturas del SAT: muestra su panel en las páginas de consulta, llena el formulario de búsqueda con el periodo elegido, lee la tabla de resultados y descarga los XML y PDF con la sesión del usuario.
- **Permiso de host opcional (consultaqr.facturaelectronica.sat.gob.mx):** lo pide el validador la primera vez que el usuario pulsa «Validar». Es el servicio público de verificación de CFDI del SAT; la extensión le envía la expresión impresa de cada CFDI (UUID, RFC del emisor y del receptor, total y últimos 8 caracteres del sello) y lee la respuesta (estado, cancelación y EFOS). No tiene acceso a ningún otro sitio.
- **Código remoto:** no. Todo el código va en el paquete.
- **Datos que maneja:** información de identificación personal (RFC y nombres de emisores y receptores), información financiera y de pagos (las facturas) y contenido del sitio web (la tabla del portal). Se quedan en el equipo, salvo lo que el validador envía al SAT a petición del usuario: UUID, RFC del emisor y del receptor, total y 8 caracteres del sello de cada CFDI. Nada se envía a Reporte Ágil ni a otros terceros.
- **Certificaciones:** no se venden ni transfieren datos a terceros fuera de los casos permitidos (la consulta al SAT es parte del propósito único y la pide el usuario); no se usan para fines ajenos al propósito único; no se usan para determinar solvencia ni para préstamos.
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

## Actualización a 1.1.0 (validador)

1. Antes de enviar: publicar en reporteagil.com la política de privacidad con el párrafo del validador (qué se envía al SAT).
2. **Paquete:** subir `paquetes/facturas-sat-1.1.0.zip` (`npm run zip`). Si se acepta el nombre propuesto, cambiar `name` en el manifiesto antes del zip.
3. **Ficha:** descripción nueva (arriba) y, si se quiere, una captura del validador.
4. **Prácticas de privacidad:** propósito único nuevo, justificación del permiso de host opcional y «Datos que maneja» con lo que se envía al SAT.
5. La advertencia de permisos no cambia (el host nuevo es opcional y `action` no pide permisos), así que Chrome no desactiva la extensión a quienes ya la tienen.
