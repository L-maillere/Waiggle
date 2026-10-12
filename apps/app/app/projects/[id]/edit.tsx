// Page : modifier un projet (« /projects/<id>/edit »).
import { useLocalSearchParams } from 'expo-router'
import { firstParam } from '../../../src/navigation'
import { ProjectFormScreen } from '../../../src/screens/ProjectFormScreen'

export default function EditProjectPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProjectFormScreen id={firstParam(id) ?? ''} />
}

// Si la page plante (contenu piégé, bug…), un écran de secours s'affiche à sa place.
export { RouteErrorBoundary as ErrorBoundary } from '../../../src/ui/RouteErrorBoundary'
