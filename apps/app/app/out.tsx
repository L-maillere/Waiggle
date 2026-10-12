// Page : avertissement avant d'ouvrir un site extérieur (« /out?url=… »).
import { useLocalSearchParams } from 'expo-router'
import { firstParam } from '../src/navigation'
import { LeavingScreen } from '../src/screens/LeavingScreen'

export default function OutPage() {
  const { url } = useLocalSearchParams<{ url?: string }>()
  return <LeavingScreen url={firstParam(url)} />
}
