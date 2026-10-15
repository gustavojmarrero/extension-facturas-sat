// Intervalos de consulta y cómo se parten cuando el portal corta en 500 resultados.
//
// Un intervalo es { anio, mes, dia, desde, hasta }: dia 0 es el mes completo; si no, desde y
// hasta son segundos del día (0 a 86399). Recibidas solo acepta un mes o un día con horas,
// así que se parte primero en días y luego a la mitad del rango de horas, hasta un segundo.

export const ULTIMO_SEGUNDO = 86399;

export function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

function esFuturo(anio, mes, dia, hoy) {
  const fecha = new Date(anio, mes - 1, dia);
  const tope = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return fecha > tope;
}

// Un intervalo por mes pedido, sin los meses que todavía no empiezan.
export function intervalosIniciales(anio, meses, hoy = new Date()) {
  return meses
    .filter((mes) => !esFuturo(anio, mes, 1, hoy))
    .map((mes) => ({ anio, mes, dia: 0, desde: 0, hasta: ULTIMO_SEGUNDO }));
}

// Las partes de un intervalo que llegó al tope, o null si ya es un solo segundo.
export function partir(iv, hoy = new Date()) {
  if (iv.dia === 0) {
    const partes = [];
    for (let dia = 1; dia <= diasDelMes(iv.anio, iv.mes); dia++) {
      if (esFuturo(iv.anio, iv.mes, dia, hoy)) break;
      partes.push({ anio: iv.anio, mes: iv.mes, dia, desde: 0, hasta: ULTIMO_SEGUNDO });
    }
    return partes;
  }
  if (iv.desde >= iv.hasta) return null;
  const mitad = Math.floor((iv.desde + iv.hasta) / 2);
  return [
    { ...iv, hasta: mitad },
    { ...iv, desde: mitad + 1 },
  ];
}

export function hms(segundos) {
  return { h: Math.floor(segundos / 3600), m: Math.floor((segundos % 3600) / 60), s: segundos % 60 };
}

const dos = (n) => String(n).padStart(2, '0');

function hora(segundos) {
  const { h, m, s } = hms(segundos);
  return `${dos(h)}:${dos(m)}:${dos(s)}`;
}

// Último día que se puede consultar del mes: el último del mes, u hoy si es el mes en curso.
export function ultimoDiaConsultable(anio, mes, hoy = new Date()) {
  const ultimo = diasDelMes(anio, mes);
  if (anio === hoy.getFullYear() && mes === hoy.getMonth() + 1) return Math.min(ultimo, hoy.getDate());
  return ultimo;
}

// «2026-09», «2026-09-14» o «2026-09-14 00:00:00–11:59:59».
export function etiqueta(iv) {
  const mes = `${iv.anio}-${dos(iv.mes)}`;
  if (iv.dia === 0) return mes;
  const dia = `${mes}-${dos(iv.dia)}`;
  if (iv.desde === 0 && iv.hasta === ULTIMO_SEGUNDO) return dia;
  return `${dia} ${hora(iv.desde)}–${hora(iv.hasta)}`;
}
