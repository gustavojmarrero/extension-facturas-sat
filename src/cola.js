// Cola de consultas: `concurrencia` a la vez y, en cada carril, una pausa entre una y la siguiente,
// para no cargar el servicio del SAT (no publica límites). Con la señal abortada deja de tomar
// elementos y corta la pausa en curso.

// Espera `ms` o hasta que se aborte la señal, lo que pase primero.
export function esperar(ms, senal) {
  return new Promise((resolver) => {
    if (!ms || senal?.aborted) return resolver();
    const fin = () => {
      clearTimeout(reloj);
      senal?.removeEventListener('abort', fin);
      resolver();
    };
    const reloj = setTimeout(fin, ms);
    senal?.addEventListener('abort', fin);
  });
}

// `trabajar(elemento, indice)` atiende sus propios errores; la cola solo reparte.
export async function correrCola(elementos, trabajar, { concurrencia = 2, pausa = 0, senal, esperar: dormir = esperar } = {}) {
  let siguiente = 0;
  const carril = async () => {
    while (!senal?.aborted && siguiente < elementos.length) {
      const i = siguiente++;
      await trabajar(elementos[i], i);
      if (pausa && siguiente < elementos.length) await dormir(pausa, senal);
    }
  };
  const carriles = Math.max(0, Math.min(concurrencia, elementos.length));
  await Promise.all(Array.from({ length: carriles }, carril));
}
