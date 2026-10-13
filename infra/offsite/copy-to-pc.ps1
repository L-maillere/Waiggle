<#
.SYNOPSIS
Copie sur ce PC les sauvegardes chiffrées du serveur de Waiggle.

.DESCRIPTION
Chaque nuit, le serveur chiffre sa sauvegarde et la dépose dans un dossier que le compte
« sauvegarde » peut seulement lire (infra/offsite/export.sh). Ce script, lancé chaque jour par une
tâche planifiée de Windows (installée par install-on-pc.ps1), vient chercher les copies qui
manquent sur ce PC :
  1. il liste les copies du serveur (sftp, le transfert de fichiers de SSH) ;
  2. il télécharge celles qui manquent, avec leur empreinte, et vérifie l'empreinte : une copie
     abîmée en route est jetée, et retentée le lendemain ;
  3. il garde les plus récentes (30 par défaut) et efface les autres ;
  4. il note le résultat dans journal.txt (dans le dossier des copies), et l'état dans un petit
     fichier que deploy-from-pc.sh lit pour prévenir si la dernière copie date de plus de 3 jours.

Les copies restent chiffrées sur ce PC : seule la clé de déchiffrement (avec sa phrase de passe)
peut les ouvrir. Ce script ne la touche jamais.

Écrit pour Windows PowerShell 5.1 (celui de Windows 10 et 11) et pour PowerShell 7. Enregistré en
UTF-8 avec « BOM » : sans ce marqueur, PowerShell 5.1 lirait mal les lettres accentuées.

.EXAMPLE
powershell -File copy-to-pc.ps1
#>
[CmdletBinding()]
param(
  # Le dossier des copies. Vide : « Waiggle - Sauvegardes », dans Documents.
  [string]$Destination = '',
  # Le raccourci SSH du compte « sauvegarde », écrit par install-on-pc.ps1 dans ~/.ssh/config.
  [string]$SshHost = 'waiggle-sauvegardes',
  # Le fichier de réglages SSH à utiliser. Vide : celui de l'utilisateur (~/.ssh/config).
  [string]$SshConfig = '',
  # Le fichier d'état lu par deploy-from-pc.sh. Vide : Waiggle\etat-copie.txt, dans AppData\Local.
  [string]$StateFile = '',
  # Le nombre de copies gardées sur ce PC.
  [ValidateRange(1, 1000)][int]$Keep = 30,
  # Si le serveur ne répond pas (le PC vient peut-être de démarrer, sans réseau), on réessaie.
  [ValidateRange(1, 10)][int]$Attempts = 3,
  [ValidateRange(0, 3600)][int]$RetryDelaySeconds = 300
)

# StrictMode : une variable mal orthographiée devient une erreur au lieu de valoir « rien ».
Set-StrictMode -Version 3.0
# Stop : la première erreur arrête le script (elle est alors notée au journal, plus bas).
$ErrorActionPreference = 'Stop'

# Le nom d'une copie : date_heure-quotidien.tar.age. Tout autre fichier est ignoré.
$NamePattern = '^\d{4}-\d{2}-\d{2}_\d{6}-quotidien\.tar\.age$'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not $Destination) {
  $Destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Waiggle - Sauvegardes'
}
if (-not $StateFile) {
  $StateFile = Join-Path (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Waiggle') 'etat-copie.txt'
}
$Journal = Join-Path $Destination 'journal.txt'

# Le programme sftp : celui de Windows (le « Client OpenSSH »), sinon celui trouvé dans le PATH.
function Find-Sftp {
  if ($env:WINDIR) {
    $builtin = Join-Path $env:WINDIR 'System32\OpenSSH\sftp.exe'
    if (Test-Path -LiteralPath $builtin) { return $builtin }
  }
  $command = @(Get-Command sftp -CommandType Application -ErrorAction SilentlyContinue)
  if ($command.Count -gt 0) { return $command[0].Path }
  throw "sftp introuvable : installer le « Client OpenSSH » de Windows (Paramètres, Fonctionnalités facultatives)"
}

# Lance sftp avec une liste de commandes, et renvoie son code de sortie et ce qu'il a affiché.
# Le dossier de travail de sftp est celui des copies : les fichiers téléchargés y arrivent
# directement, sans écrire de chemin Windows dans ses commandes.
function Invoke-Sftp([string[]]$Commands) {
  $batch = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllLines($batch, $Commands, $Utf8NoBom)
    $arguments = @()
    if ($SshConfig) { $arguments += @('-F', $SshConfig) }
    $arguments += @('-b', $batch, $SshHost)
    foreach ($argument in $arguments) {
      if ($argument.Contains('"')) { throw "chemin inattendu (guillemet) : $argument" }
    }
    # Process plutôt que l'appel direct : Windows PowerShell 5.1 transforme en erreur tout ce qu'un
    # programme écrit sur sa sortie d'erreur, même un simple avertissement.
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $script:Sftp
    $info.Arguments = ($arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $info.WorkingDirectory = $Destination
    $info.UseShellExecute = $false
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::Start($info)
    # Les deux sorties sont lues en même temps : lues l'une après l'autre, la seconde pourrait se
    # remplir et tout bloquer.
    $output = $process.StandardOutput.ReadToEndAsync()
    $errors = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(30 * 60 * 1000)) {
      $process.Kill()
      throw 'sftp tourne depuis 30 minutes : arrêté'
    }
    $process.WaitForExit()
    return New-Object PSObject -Property @{
      ExitCode = $process.ExitCode
      Output   = $output.Result
      Errors   = $errors.Result.Trim()
    }
  } finally {
    Remove-Item -LiteralPath $batch -Force -ErrorAction SilentlyContinue
  }
}

# Télécharge une copie et son empreinte sous des noms provisoires (.partiel), vérifie l'empreinte,
# puis seulement leur donne leur vrai nom. Une copie interrompue ou abîmée ne reste jamais.
function Copy-OneBackup([string]$Name) {
  $part = Join-Path $Destination "$Name.partiel"
  $shaPart = Join-Path $Destination "$Name.sha256.partiel"
  try {
    $result = Invoke-Sftp @("get $Name $Name.partiel", "get $Name.sha256 $Name.sha256.partiel")
    if ($result.ExitCode -ne 0) { throw "téléchargement de $Name interrompu : $($result.Errors)" }
    # Le fichier d'empreinte : « <64 caractères> <nom> ». On vérifie qu'il parle bien de ce fichier.
    $fields = @(([string](Get-Content -LiteralPath $shaPart -TotalCount 1)).Trim() -split '\s+')
    if ($fields.Count -ne 2 -or $fields[0] -notmatch '^[0-9a-fA-F]{64}$' -or $fields[1].TrimStart('*') -ne $Name) {
      throw "empreinte illisible pour $Name"
    }
    # -ne entre deux textes ignore les majuscules : Windows écrit l'empreinte en majuscules.
    if ((Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash -ne $fields[0]) {
      throw "copie abîmée en route : l'empreinte de $Name ne correspond pas (nouvel essai au prochain passage)"
    }
    Move-Item -LiteralPath $shaPart -Destination (Join-Path $Destination "$Name.sha256") -Force
    Move-Item -LiteralPath $part -Destination (Join-Path $Destination $Name) -Force
  } finally {
    Remove-Item -LiteralPath $part, $shaPart -Force -ErrorAction SilentlyContinue
  }
}

# Les copies présentes sur ce PC, de la plus récente à la plus ancienne (le nom commence par la date).
function Get-LocalCopy {
  return @(Get-ChildItem -LiteralPath $Destination -File |
      Where-Object { $_.Name -match $NamePattern } |
      Sort-Object Name -Descending)
}

function Write-Journal([string]$Message) {
  # Une ligne par passage : les messages de sftp sur plusieurs lignes sont mis bout à bout.
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($Message.Trim() -replace '\s*\r?\n\s*', ' / ')
  Write-Output $line
  try {
    Add-Content -LiteralPath $Journal -Value $line -Encoding UTF8
    # Le journal garde ses 1000 dernières lignes.
    $lines = @(Get-Content -LiteralPath $Journal -Encoding UTF8)
    if ($lines.Count -gt 1000) {
      Set-Content -LiteralPath $Journal -Value ($lines | Select-Object -Last 1000) -Encoding UTF8
    }
  } catch {
    Write-Warning "journal impossible à écrire : $($_.Exception.Message)"
  }
}

# L'état, lu par deploy-from-pc.sh : la plus récente copie présente, et le résultat de ce passage.
function Save-State([string]$Outcome) {
  $newest = ''
  if (Test-Path -LiteralPath $Destination) {
    $local = @(Get-LocalCopy)
    if ($local.Count -gt 0) { $newest = $local[0].Name -replace '\.tar\.age$', '' }
  }
  $folder = Split-Path -Parent $StateFile
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  $lines = @(
    "derniere=$newest",
    "resultat=$Outcome",
    "passage=$(Get-Date -Format 's')",
    "dossier=$Destination"
  )
  [IO.File]::WriteAllLines($StateFile, $lines, $Utf8NoBom)
}

try {
  if (-not (Test-Path -LiteralPath $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
  # Restes d'un passage interrompu (PC éteint pendant un téléchargement…).
  Get-ChildItem -LiteralPath $Destination -File -Filter '*.partiel' | Remove-Item -Force
  $script:Sftp = Find-Sftp

  # 1. La liste des copies du serveur, avec plusieurs essais si le serveur ne répond pas.
  $listing = $null
  $lastError = ''
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    $result = Invoke-Sftp @('ls -1')
    if ($result.ExitCode -eq 0) { $listing = $result.Output; break }
    $lastError = $result.Errors
    if ($attempt -lt $Attempts) { Start-Sleep -Seconds $RetryDelaySeconds }
  }
  if ($null -eq $listing) { throw "serveur injoignable ($Attempts essais) : $lastError" }
  $remoteFiles = @($listing -split "`r?`n" | ForEach-Object { $_.Trim() })
  # Une copie n'est prise que si son empreinte existe : le serveur l'écrit en dernier.
  $remote = @($remoteFiles |
      Where-Object { $_ -match $NamePattern -and $remoteFiles -contains "$_.sha256" } |
      Sort-Object -Descending |
      Select-Object -First $Keep)
  if ($remote.Count -eq 0) { throw 'aucune copie sur le serveur : la sauvegarde de la nuit tourne-t-elle ?' }

  # 2. Les copies qui manquent ici.
  $copied = @()
  foreach ($name in $remote) {
    if (-not (Test-Path -LiteralPath (Join-Path $Destination $name))) {
      Copy-OneBackup $name
      $copied += $name
    }
  }

  # 3. On garde les $Keep plus récentes.
  Get-LocalCopy | Select-Object -Skip $Keep | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName, "$($_.FullName).sha256" -Force -ErrorAction SilentlyContinue
  }

  $local = @(Get-LocalCopy)
  if ($copied.Count -gt 0) {
    $names = ($copied | ForEach-Object { $_ -replace '\.tar\.age$', '' }) -join ', '
    Write-Journal ("ok : {0} nouvelle(s) copie(s) ({1}), {2} sur ce PC" -f $copied.Count, $names, $local.Count)
  } else {
    Write-Journal ("ok : rien de nouveau, {0} copies sur ce PC, la plus récente : {1}" -f $local.Count, ($local[0].Name -replace '\.tar\.age$', ''))
  }
  Save-State 'ok'
  exit 0
} catch {
  Write-Journal "ÉCHEC : $($_.Exception.Message)"
  try { Save-State 'echec' } catch { Write-Warning "état impossible à écrire : $($_.Exception.Message)" }
  exit 1
}
