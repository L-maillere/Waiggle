// La carte immersive d'un projet, celle du fil : la couverture en plein cadre et, en bas, un panneau
// de verre avec l'auteur, le titre, le pitch, le bouton « Tester » et le statut.
// Elle ne connaît pas l'API : on lui donne des textes déjà prêts, ce qui permet de l'utiliser aussi
// comme aperçu pendant qu'on écrit un projet.
import { space } from '@ruche/brand'
import { View } from 'react-native'
import { Avatar } from './Avatar'
import { Button } from './Button'
import { ProjectCover } from './ProjectCover'
import { StatusPill } from './StatusPill'
import { Surface } from './Surface'
import { Text } from './Text'

type Props = {
  title: string
  pitch: string
  author: { name: string; avatarUrl: string | null }
  /** Quand (« à l'instant », « il y a 3 jours »). */
  when: string
  status: { label: string; strong: boolean }
  /** Le bouton « Tester », s'il y a une démo. */
  tryIt?: { label: string; onPress: () => void }
  height?: number
}

export function ProjectCard({ title, pitch, author, when, status, tryIt, height = 476 }: Props) {
  return (
    <ProjectCover height={height}>
      <View style={{ position: 'absolute', left: space.sm, right: space.sm, bottom: space.sm }}>
        <Surface variant="panel" padding="lg" gap="sm">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Avatar name={author.name} url={author.avatarUrl} label={author.name} size={28} />
            <View style={{ flex: 1 }}>
              <Text variant="callout" weight={700} numberOfLines={1}>
                {author.name}
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              {when}
            </Text>
          </View>
          <Text variant="title3" numberOfLines={2}>
            {title}
          </Text>
          <Text variant="callout" tone="secondary" numberOfLines={2}>
            {pitch}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}
          >
            {tryIt ? (
              <Button
                label={tryIt.label}
                icon="arrow-up-right"
                size="compact"
                onPress={tryIt.onPress}
              />
            ) : null}
            <StatusPill label={status.label} strong={status.strong} />
          </View>
        </Surface>
      </View>
    </ProjectCover>
  )
}
