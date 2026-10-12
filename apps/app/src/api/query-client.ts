// Le cache des données venues de l'API, partagé par toute l'appli (bibliothèque React Query).
// Analogie : un tableau d'affichage. Un écran qui a besoin du profil regarde d'abord le tableau ;
// si l'information y est, il l'affiche tout de suite, sinon il va la chercher et l'épingle.
// Les autres écrans en profitent sans refaire la requête.
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Une donnée lue il y a moins d'une minute est considérée comme fraîche : pas de nouvelle requête.
      staleTime: 60_000,
    },
  },
})
