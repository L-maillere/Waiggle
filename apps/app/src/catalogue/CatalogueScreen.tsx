// Le catalogue : tous les composants de l'interface, dans tous leurs états, sur une seule page.
// C'est notre « maquette vivante » : quand on change un jeton (packages/brand) ou un composant
// (src/ui), on voit ici tout de suite l'effet partout, de jour comme de nuit, en français comme en
// anglais. Les captures automatiques (scripts/shots.mjs) photographient aussi cette page.
//
// Outil de développement : il n'existe pas dans l'appli publiée (voir app/catalogue.tsx). Ses textes
// d'exemple sont donc écrits ici, et non dans les traductions des membres.
import {
  type ColorName,
  type FontWeight,
  palettes,
  radii,
  type TextVariant,
  textStyles,
} from '@ruche/brand'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { AmbientLight } from '../ui/AmbientLight'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Choices } from '../ui/Choices'
import { CodeBlock } from '../ui/CodeBlock'
import { Columns } from '../ui/Columns'
import { Icon } from '../ui/Icon'
import { IconButton } from '../ui/IconButton'
import { type IconName, iconPaths } from '../ui/icons.generated'
import { LanguageSwitcher } from '../ui/LanguageSwitcher'
import { Markdown } from '../ui/Markdown'
import { Notice } from '../ui/Notice'
import { Screen } from '../ui/Screen'
import { Segmented } from '../ui/Segmented'
import { Stack } from '../ui/Stack'
import { StatusPill } from '../ui/StatusPill'
import { Surface } from '../ui/Surface'
import { Switch } from '../ui/Switch'
import { Tag } from '../ui/Tag'
import { Text } from '../ui/Text'
import { FieldGroup, TextField } from '../ui/TextField'
import type { Appearance } from '../ui/theme/appearance'
import { useTheme } from '../ui/theme/ThemeProvider'
import { Wordmark } from '../ui/Wordmark'
import { labels } from './labels'

// Des résumés flous (ThumbHash) de deux visuels de projet, pour montrer la lumière d'ambiance.
// Ils ressemblent à des clés secrètes pour l'outil qui cherche les secrets oubliés (gitleaks) :
// le commentaire « gitleaks:allow » lui indique que ce n'en sont pas.
const samples = {
  cafe: 'GIoKDYSlqIdPUXd3eEeHh9J/YIkI', // gitleaks:allow
  papillon: 'GdkFJYTHYFSbVnaPWUZndpajf7QG', // gitleaks:allow
}

export function CatalogueScreen() {
  const { i18n } = useTranslation()
  const { appearance, setAppearance } = useTheme()
  const l = labels[i18n.language === 'en' ? 'en' : 'fr']

  return (
    <Screen width="page">
      <Stack gap="md">
        <Wordmark size="large" />
        <Text variant="title2" accessibilityRole="header">
          {l.title}
        </Text>
        <Text tone="secondary">{l.intro}</Text>
      </Stack>

      <Surface variant="grouped" padding="lg" gap="md">
        <Segmented<Appearance>
          label={l.appearance}
          options={[
            { value: 'auto', label: l.auto, icon: 'circle-half' },
            { value: 'day', label: l.day, icon: 'sun' },
            { value: 'night', label: l.night, icon: 'moon' },
          ]}
          value={appearance}
          onChange={setAppearance}
        />
        <LanguageSwitcher />
      </Surface>

      <Section title={l.colors}>
        <Swatches />
      </Section>

      <Section title={l.type}>
        <TypeScale sample={l.sampleTitle} />
      </Section>

      <Section title={l.buttons}>
        <Columns
          main={
            <Stack gap="md">
              <Button label={l.publish} icon="plus" onPress={() => {}} />
              <Button label={l.secondary} variant="secondary" onPress={() => {}} />
              <Button label={l.delete} variant="danger" icon="trash" onPress={() => {}} />
              <Button label={l.confirmDelete} variant="confirm" onPress={() => {}} />
              <Button label={l.publish} disabled onPress={() => {}} />
              <Button label={l.publish} loading onPress={() => {}} />
            </Stack>
          }
          side={
            <OnLight thumbhash={samples.cafe}>
              <Stack direction="row" gap="sm" wrap>
                <IconButton icon="arrow-left" label={l.back} onPress={() => {}} />
                <IconButton icon="share-network" label={l.share} onPress={() => {}} />
                <IconButton icon="dots-three" label={l.more} onPress={() => {}} />
                <IconButton
                  icon="plus"
                  label={l.publish}
                  variant="honey"
                  size="large"
                  onPress={() => {}}
                />
              </Stack>
              <Button
                label={l.tryIt}
                variant="glass"
                icon="arrow-up-right"
                size="compact"
                onPress={() => {}}
              />
            </OnLight>
          }
        />
      </Section>

      <Section title={l.pills}>
        <Stack direction="row" gap="sm" wrap>
          <StatusPill label={l.statuses.idea} />
          <StatusPill label={l.statuses.building} />
          <StatusPill label={l.statuses.testable} strong />
          <StatusPill label={l.statuses.done} />
          <StatusPill label={l.statuses.paused} />
        </Stack>
        <Stack direction="row" gap="sm" wrap>
          <Tag label="Claude" onPress={() => {}} />
          <Tag label="Python" onPress={() => {}} />
          <Tag label="Expo" />
        </Stack>
      </Section>

      <Section title={l.fields}>
        <Fields l={l} />
      </Section>

      <Section title={l.choices}>
        <Choicesample l={l} />
      </Section>

      <Section title={l.messages}>
        <Notice message={l.errorMessage} />
        <Notice tone="info" message={l.infoMessage} />
        <Notice tone="success" message={l.successMessage} />
      </Section>

      <Section title={l.surfaces}>
        <Columns
          main={
            <OnLight thumbhash={samples.papillon}>
              <Surface variant="panel" padding="lg" gap="sm">
                <Stack direction="row" gap="sm" align="center">
                  <Avatar name="Léa Moreau" url={null} label="Léa Moreau" size={28} />
                  <Text variant="callout" weight={700}>
                    Léa Moreau
                  </Text>
                </Stack>
                <Text variant="title3">{l.sampleTitle}</Text>
                <Text variant="callout" tone="secondary">
                  {l.samplePitch}
                </Text>
              </Surface>
              <Surface variant="glass" padding="md" fill={false}>
                <Text variant="callout" weight={600}>
                  {l.glass}
                </Text>
              </Surface>
            </OnLight>
          }
          side={
            <Stack gap="md">
              <Surface padding="lg">
                <Text>{l.plain}</Text>
              </Surface>
              <Surface variant="grouped" padding="lg">
                <Text>{l.grouped}</Text>
              </Surface>
            </Stack>
          }
        />
      </Section>

      <Section title={l.avatars}>
        <Stack direction="row" gap="lg" align="center" wrap>
          <Avatar name="Léa" url={null} label="Léa" size={96} />
          <Avatar name="Max" url={null} label="Max" size={44} />
          <Avatar name="Inès" url={null} label="Inès" size={28} />
        </Stack>
      </Section>

      <Section title={l.text}>
        <Surface padding="xl">
          <Markdown text={l.markdown} onLinkPress={() => {}} />
        </Surface>
        <CodeBlock>{l.prompt}</CodeBlock>
      </Section>

      <Section title={l.icons}>
        <Icons />
      </Section>
    </Screen>
  )
}

type Labels = (typeof labels)['fr']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap="md">
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

/** Un coin de lumière d'ambiance, pour montrer le verre là où il vit : sur une image. */
function OnLight({ thumbhash, children }: { thumbhash: string; children: ReactNode }) {
  return (
    <Surface padding="none" radius="tile">
      <View style={{ minHeight: 220, overflow: 'hidden', borderRadius: radii.tile }}>
        <AmbientLight thumbhash={thumbhash} />
        <Stack padding="lg" gap="md">
          {children}
        </Stack>
      </View>
    </Surface>
  )
}

function Swatches() {
  const { colors, scheme } = useTheme()
  const names = Object.keys(palettes[scheme]) as ColorName[]
  return (
    <Stack direction="row" gap="sm" wrap>
      {names.map((name) => (
        <Stack key={name} gap="xs">
          <View
            style={{
              width: 104,
              height: 56,
              borderRadius: radii.code,
              backgroundColor: colors[name],
              borderWidth: 1,
              borderColor: colors.line,
            }}
          />
          <Text variant="caption" weight={600}>
            {name}
          </Text>
          <Text variant="caption" tone="muted">
            {colors[name]}
          </Text>
        </Stack>
      ))}
    </Stack>
  )
}

function TypeScale({ sample }: { sample: string }) {
  const variants = Object.keys(textStyles) as TextVariant[]
  return (
    <Stack gap="md">
      {variants.map((variant) => (
        <Stack key={variant} gap="xxs">
          <Text variant="caption" tone="muted">
            {`${variant}  ${textStyles[variant].size}/${textStyles[variant].lineHeight}`}
          </Text>
          <Text variant={variant}>{sample}</Text>
        </Stack>
      ))}
      <Stack direction="row" gap="lg" wrap>
        {([400, 500, 600, 700] as FontWeight[]).map((weight) => (
          <Text key={weight} weight={weight}>
            {`Funnel Sans ${weight}`}
          </Text>
        ))}
      </Stack>
    </Stack>
  )
}

function Fields({ l }: { l: Labels }) {
  const [title, setTitle] = useState(l.sampleTitle)
  const [pitch, setPitch] = useState(l.samplePitch)
  const [url, setUrl] = useState('http://192.168.1.12')
  return (
    <Columns
      main={
        <FieldGroup>
          <TextField
            label={l.titleField}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            showCount
          />
          <TextField
            label={l.pitchField}
            value={pitch}
            onChangeText={setPitch}
            maxLength={140}
            showCount
          />
          <TextField
            label={l.descriptionField}
            value=""
            onChangeText={() => {}}
            placeholder={l.placeholder}
            multiline
          />
        </FieldGroup>
      }
      side={<TextField label={l.demoField} value={url} onChangeText={setUrl} error={l.demoError} />}
    />
  )
}

function Choicesample({ l }: { l: Labels }) {
  const [status, setStatus] = useState<'idea' | 'building' | 'testable'>('testable')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [notify, setNotify] = useState(true)
  return (
    <Stack gap="lg">
      <Choices
        label={l.statusField}
        options={[
          { value: 'idea', label: l.statuses.idea },
          { value: 'building', label: l.statuses.building },
          { value: 'testable', label: l.statuses.testable },
        ]}
        value={status}
        onChange={setStatus}
      />
      <Segmented
        label={l.visibilityField}
        options={[
          { value: 'public', label: l.public, icon: 'globe-simple' },
          { value: 'private', label: l.private, icon: 'lock-simple' },
        ]}
        value={visibility}
        onChange={setVisibility}
      />
      <Switch label={l.switchLabel} hint={l.switchHint} value={notify} onValueChange={setNotify} />
    </Stack>
  )
}

function Icons() {
  const names = Object.keys(iconPaths) as IconName[]
  return (
    <Stack direction="row" gap="md" wrap>
      {names.map((name) => (
        <Stack key={name} gap="xs" align="center">
          <Icon name={name} size={24} />
          <Text variant="micro" tone="muted">
            {name}
          </Text>
        </Stack>
      ))}
    </Stack>
  )
}
