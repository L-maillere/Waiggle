<#
.SYNOPSIS
Vérifie qu'une copie des sauvegardes, sur ce PC, se rouvre et contient la sauvegarde exacte du serveur.

.DESCRIPTION
L'essai du mois (docs/ops/serveur.md, « Copie hors du serveur ») : une sauvegarde qu'on n'a jamais
rouverte n'est qu'un espoir. À lancer par Louis lui-même, dans PowerShell, depuis le dossier du
dépôt, car il demande la phrase de passe de la clé de déchiffrement :
  powershell -ExecutionPolicy Bypass -File infra\offsite\verify-on-pc.ps1

Ce qu'il fait :
  1. il déchiffre la copie la plus récente avec la clé ~/.ssh/waiggle-dechiffrement (age demande
     sa phrase de passe), dans un dossier temporaire ;
  2. il l'ouvre (tar) et vérifie les deux fichiers : la base (pg_dump) et les avatars (gzip) ;
  3. il compare leurs empreintes à celles de la même sauvegarde sur le serveur (par SSH, avec le
     raccourci « waiggle »), tant qu'elle y est encore (14 jours) ;
  4. il efface le dossier temporaire, et vérifie qu'il a bien disparu : les données déchiffrées
     ne restent jamais sur le PC. Les restes d'un essai interrompu sont effacés au suivant.
Il demande age : winget install FiloSottile.age
#>
[CmdletBinding()]
param(
  # Le dossier des copies. Vide : « Waiggle - Sauvegardes », dans Documents.
  [string]$Destination = '',
  # La clé de déchiffrement. Vide : ~/.ssh/waiggle-dechiffrement.
  [string]$KeyFile = '',
  # Le raccourci SSH du serveur (compte d'administration).
  [string]$AdminHost = 'waiggle',
  # Le fichier de réglages SSH. Vide : celui de l'utilisateur.
  [string]$SshConfig = '',
  # La copie à vérifier (date_heure-quotidien). Vide : la plus récente.
  [string]$Name = ''
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

if (-not $Destination) {
  $Destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Waiggle - Sauvegardes'
}
if (-not $KeyFile) { $KeyFile = Join-Path (Join-Path $HOME '.ssh') 'waiggle-dechiffrement' }

function Find-Program([string]$Name, [string]$Hint) {
  if ($env:WINDIR) {
    foreach ($candidate in @("System32\OpenSSH\$Name.exe", "System32\$Name.exe")) {
      $path = Join-Path $env:WINDIR $candidate
      if (Test-Path -LiteralPath $path) { return $path }
    }
  }
  $command = @(Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue)
  if ($command.Count -gt 0) { return $command[0].Path }
  throw "$Name introuvable : $Hint"
}

# Efface un dossier et tout son contenu. [IO.Directory]::Delete ne suit jamais un lien vers un
# autre dossier (il efface le lien, pas ce vers quoi il pointe) ; Remove-Item -Recurse, dans
# Windows PowerShell 5.1, ne le garantit pas.
function Remove-Folder {
  [CmdletBinding(SupportsShouldProcess)]
  param([string]$Path)
  if ($PSCmdlet.ShouldProcess($Path)) {
    try { [IO.Directory]::Delete($Path, $true) } catch { Write-Verbose $_.Exception.Message }
  }
}

# Les premiers octets d'un fichier, pour reconnaître son format.
function Test-Magic([string]$Path, [byte[]]$Expected) {
  $stream = [IO.File]::OpenRead($Path)
  try {
    $buffer = New-Object byte[] $Expected.Length
    $read = $stream.Read($buffer, 0, $Expected.Length)
    if ($read -ne $Expected.Length) { return $false }
    for ($i = 0; $i -lt $Expected.Length; $i++) { if ($buffer[$i] -ne $Expected[$i]) { return $false } }
    return $true
  } finally { $stream.Dispose() }
}

$age = Find-Program 'age' 'winget install FiloSottile.age, puis rouvrir PowerShell'
$tar = Find-Program 'tar' 'tar est fourni avec Windows 10 et 11'
$ssh = Find-Program 'ssh' 'installer le « Client OpenSSH » de Windows'
if (-not (Test-Path -LiteralPath $KeyFile)) { throw "clé de déchiffrement introuvable : $KeyFile" }

if (-not $Name) {
  $newest = @(Get-ChildItem -LiteralPath $Destination -File -Filter '*-quotidien.tar.age' | Sort-Object Name -Descending)
  if ($newest.Count -eq 0) { throw "aucune copie dans $Destination" }
  $Name = $newest[0].Name -replace '\.tar\.age$', ''
}
if ($Name -cnotmatch '^[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}-quotidien$') { throw "nom de copie inattendu : $Name" }
$copy = Join-Path $Destination "$Name.tar.age"
Write-Output "Copie vérifiée : $copy"

# Les restes d'un essai interrompu (fenêtre fermée en cours de route) : des données en clair.
foreach ($leftover in @(Get-ChildItem -LiteralPath ([IO.Path]::GetTempPath()) -Directory -Filter 'waiggle-verification-*' -ErrorAction SilentlyContinue)) {
  Remove-Folder $leftover.FullName
}
$work = Join-Path ([IO.Path]::GetTempPath()) ('waiggle-verification-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
$failures = 0
try {
  # 1. Déchiffrer. age est lancé directement (sans capter ce qu'il écrit) pour pouvoir demander
  # la phrase de passe. age refuse un fichier abîmé ou modifié après coup. Il ne dit pas QUI l'a
  # chiffré : la clé publique est dans le dépôt, et un serveur piraté pourrait fabriquer une copie
  # piégée qui se déchiffre très bien. D'où la comparaison avec le serveur (3), et, pour restaurer
  # après un piratage, une copie antérieure au piratage.
  $archive = Join-Path $work 'sauvegarde.tar'
  & $age -d -i $KeyFile -o $archive $copy
  if ($LASTEXITCODE -ne 0) { throw 'déchiffrement impossible (phrase de passe, clé ou copie abîmée)' }
  Write-Output 'ok : déchiffrée'

  # 2. Ouvrir, et reconnaître les deux fichiers. L'archive doit contenir exactement ces deux
  # noms, deux fichiers ordinaires (tar -tv : la ligne commence par « - »), et seuls ceux-là sont
  # extraits. Un lien caché dans une copie piégée pourrait sinon pointer ailleurs sur le PC.
  $expected = @("$Name.db.dump", "$Name.media.tar.gz")
  $listing = @(& $tar -tf $archive)
  if ($LASTEXITCODE -ne 0) { throw "l'archive ne s'ouvre pas" }
  if ($listing.Count -ne 2 -or @($listing | Where-Object { $expected -cnotcontains $_ }).Count -ne 0) {
    throw "l'archive ne contient pas exactement $($expected -join ' et ')"
  }
  $details = @(& $tar -tvf $archive)
  if ($LASTEXITCODE -ne 0 -or $details.Count -ne 2 -or @($details | Where-Object { -not $_.StartsWith('-') }).Count -ne 0) {
    throw "l'archive contient autre chose que deux fichiers ordinaires (un lien ?)"
  }
  & $tar -xf $archive -C $work $expected[0] $expected[1]
  if ($LASTEXITCODE -ne 0) { throw "l'archive ne s'ouvre pas" }
  $dump = Join-Path $work $expected[0]
  $media = Join-Path $work $expected[1]
  foreach ($file in @($dump, $media)) {
    $item = Get-Item -LiteralPath $file -Force
    if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      throw "$(Split-Path -Leaf $file) n'est pas un fichier ordinaire"
    }
    # Un fichier en lecture seule résisterait à l'effacement final : on retire cet attribut.
    [IO.File]::SetAttributes($file, [IO.FileAttributes]::Normal)
  }
  # « PGDMP » : le début de tout fichier de pg_dump ; 1F 8B : celui de tout fichier gzip.
  if (-not ((Test-Path -LiteralPath $dump) -and (Test-Magic $dump ([byte[]](0x50, 0x47, 0x44, 0x4D, 0x50))))) {
    throw "la base ($Name.db.dump) manque ou n'est pas une sauvegarde PostgreSQL"
  }
  if (-not ((Test-Path -LiteralPath $media) -and (Test-Magic $media ([byte[]](0x1F, 0x8B))))) {
    throw "les avatars ($Name.media.tar.gz) manquent ou ne sont pas une archive gzip"
  }
  Write-Output 'ok : la base et les avatars sont là, au bon format'

  # 3. Comparer avec le serveur.
  $sshArguments = @()
  if ($SshConfig) { $sshArguments += @('-F', $SshConfig) }
  $sshArguments += @($AdminHost, "sha256sum /srv/ruche/backups/$Name.db.dump /srv/ruche/backups/$Name.media.tar.gz")
  $remote = @(& $ssh @sshArguments)
  if ($LASTEXITCODE -ne 0 -or $remote.Count -ne 2) {
    Write-Output "Sur le serveur, cette sauvegarde n'est plus là (gardée 14 jours) ou le serveur ne répond pas : comparaison impossible."
    Write-Output 'Le déchiffrement et le contenu sont bons ; pour comparer, vérifier une copie plus récente.'
  } else {
    foreach ($file in @($dump, $media)) {
      $local = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
      $leaf = Split-Path -Leaf $file
      $line = @($remote | Where-Object { $_ -match ([regex]::Escape($leaf) + '$') }) | Select-Object -First 1
      if ($line -and ($line -split '\s+')[0] -eq $local) {
        Write-Output "ok : $leaf identique à celui du serveur"
      } else {
        Write-Output "ÉCHEC : $leaf diffère de celui du serveur"
        $failures++
      }
    }
  }
} catch {
  Write-Output "ÉCHEC : $($_.Exception.Message)"
  $failures++
} finally {
  # 4. Rien de déchiffré ne reste sur le PC. Un fichier encore ouvert par l'antivirus ou
  # l'indexation peut résister : on réessaie, puis on le signale.
  for ($try = 1; $try -le 3 -and (Test-Path -LiteralPath $work); $try++) {
    Remove-Folder $work
    if (Test-Path -LiteralPath $work) { Start-Sleep -Seconds 2 }
  }
}
if (Test-Path -LiteralPath $work) {
  Write-Output "ATTENTION : des données déchiffrées sont restées dans $work : effacer ce dossier à la main."
  $failures++
}

if ($failures -gt 0) {
  Write-Output 'La vérification a échoué : prévenir Claude avant de toucher à quoi que ce soit.'
  exit 1
}
Write-Output 'Vérification réussie : cette copie permettrait de tout reconstruire.'
exit 0
