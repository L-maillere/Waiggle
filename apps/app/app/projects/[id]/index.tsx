// Page : un projet (« /projects/<id> »). [id] dans le nom du dossier : cette partie de l'adresse
// est variable, et useLocalSearchParams la lit.
import { useLocalSearchParams } from 'expo-router'
import { firstParam } from '../../../src/navigation'
import { ProjectScreen } from '../../../src/screens/ProjectScreen'

export default function ProjectPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProjectScreen id={firstParam(id) ?? ''} />
}
