// Une file d'attente : au plus `limit` tâches en même temps, les suivantes attendent leur tour.
// Analogie : un guichet avec deux employés. Dix clients arrivent ensemble ; deux sont servis,
// huit patientent. Ici, chaque « client » est une image à traiter, qui occupe beaucoup de mémoire :
// sans file, dix envois simultanés pourraient saturer le serveur.

/** Crée une file. Usage : `const queue = createQueue(2); await queue(() => travail())`. */
export const createQueue = (limit: number) => {
  let running = 0
  // Les tâches en attente : chacune est une fonction qui la « réveille ».
  const waiting: Array<() => void> = []

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (running >= limit) {
      // Pas de place : on attend qu'une tâche en cours nous réveille.
      await new Promise<void>((wake) => waiting.push(wake))
    } else {
      running++
    }
    try {
      return await task()
    } finally {
      // Réussite ou échec, on libère la place : on la passe directement à la tâche suivante
      // (running ne change pas), ou on la rend s'il n'y a personne.
      const next = waiting.shift()
      if (next) next()
      else running--
    }
  }
}
