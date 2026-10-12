// Le logo : le nom de l'appli en minuscules, dans la police des titres. Il vient de @ruche/brand :
// si l'appli change de nom, le logo suit.
import { appName } from '@ruche/brand'
import { Text } from './Text'

type Props = { size?: 'small' | 'large' }

export function Wordmark({ size = 'small' }: Props) {
  return (
    // Les lecteurs d'écran lisent le nom tel qu'il s'écrit (« Waiggle »), pas en minuscules.
    <Text variant={size === 'large' ? 'display' : 'heading'} accessibilityLabel={appName}>
      {appName.toLowerCase()}
    </Text>
  )
}
