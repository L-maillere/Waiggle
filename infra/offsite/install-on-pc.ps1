<#
.SYNOPSIS
Installe sur ce PC la copie quotidienne des sauvegardes chiffrées de Waiggle.

.DESCRIPTION
À lancer une fois, depuis le dossier du dépôt, dans PowerShell (pas besoin d'être administrateur) :
  powershell -ExecutionPolicy Bypass -File infra\offsite\install-on-pc.ps1

Ce qu'il fait, et refait sans dégâts s'il est relancé :
  1. la clé de téléchargement (~/.ssh/waiggle-telechargement), créée si elle manque. Elle n'a pas
     de phrase de passe, car la copie se fait sans personne devant l'écran. Elle ne peut que lire
     des copies chiffrées : volée, elle ne donnerait rien de lisible ;
  2. un fichier de réglages SSH à part (AppData\Local\Waiggle\ssh_config), réécrit à chaque
     installation : le raccourci « waiggle-sauvegardes », vers la même adresse que « waiggle »
     (lue dans ~/.ssh/config, qui n'est pas modifié), avec le compte « sauvegarde » et cette clé.
     À part, pour qu'aucun réglage de ~/.ssh/config (un « Host * », par exemple) ne s'y mêle ;
  3. le script de copie, recopié HORS du dépôt (dans AppData\Local\Waiggle) : la tâche planifiée
     lance toujours ce qui a été installé, jamais une version du dépôt en cours de relecture ;
  4. le dossier des copies (« Waiggle - Sauvegardes », dans Documents) ;
  5. la tâche planifiée « Waiggle - copie des sauvegardes », chaque jour à 12 h 30 et 20 h 30. Si le
     PC était éteint à l'heure prévue, elle tourne dès qu'il est allumé.
Il affiche enfin les clés publiques à ajouter au dépôt (infra/offsite/).

Pour mettre à jour le script de copie après une modification du dépôt, ou l'adresse du serveur
après un changement du raccourci « waiggle » : relancer l'installateur.
#>
[CmdletBinding()]
param(
  # Le raccourci SSH du serveur, déjà dans ~/.ssh/config (docs/ops/serveur.md).
  [string]$AdminHost = 'waiggle',
  # Le dossier des clés et des réglages SSH. Vide : ~/.ssh.
  [string]$SshDir = '',
  # Où installer le script de copie. Vide : AppData\Local\Waiggle.
  [string]$InstallDir = '',
  # Le dossier des copies. Vide : « Waiggle - Sauvegardes », dans Documents.
  [string]$Destination = '',
  # Sans la tâche planifiée (pour les essais de la CI).
  [switch]$NoScheduledTask
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

$TaskName = 'Waiggle - copie des sauvegardes'
$BackupHost = 'waiggle-sauvegardes'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not $SshDir) { $SshDir = Join-Path $HOME '.ssh' }
if (-not $InstallDir) { $InstallDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Waiggle' }
if (-not $Destination) {
  $Destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Waiggle - Sauvegardes'
}
$Config = Join-Path $SshDir 'config'
$BackupConfig = Join-Path $InstallDir 'ssh_config'
$Key = Join-Path $SshDir 'waiggle-telechargement'
$DecryptionKey = Join-Path $SshDir 'waiggle-dechiffrement'

function Write-Step([string]$Message) { Write-Output ''; Write-Output "> $Message" }

# Un programme d'OpenSSH : celui de Windows (le « Client OpenSSH »), sinon celui du PATH.
function Find-OpenSsh([string]$Name) {
  if ($env:WINDIR) {
    $builtin = Join-Path $env:WINDIR "System32\OpenSSH\$Name.exe"
    if (Test-Path -LiteralPath $builtin) { return $builtin }
  }
  $command = @(Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue)
  if ($command.Count -gt 0) { return $command[0].Path }
  throw "$Name introuvable : installer le « Client OpenSSH » de Windows (Paramètres, Fonctionnalités facultatives)"
}

# Un argument entre guillemets, pour une ligne de commande Windows. Une barre oblique inverse
# juste avant le guillemet final le « protégerait » et casserait la ligne : on la double.
function ConvertTo-Argument([string]$Value) {
  if ($Value.Contains('"')) { throw "chemin inattendu (guillemet) : $Value" }
  return '"' + ($Value -replace '(\\+)$', '$1$1') + '"'
}

# Lance un programme et renvoie ce qu'il affiche ; s'arrête s'il échoue. Les arguments sont
# passés tels quels, en un seul texte : c'est la seule façon fiable de passer un argument vide
# (la phrase de passe vide de ssh-keygen) à la fois avec PowerShell 5.1 et 7.
function Invoke-Program([string]$Program, [string]$Arguments) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $Program
  $info.Arguments = $Arguments
  $info.UseShellExecute = $false
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::Start($info)
  $output = $process.StandardOutput.ReadToEndAsync()
  $errors = $process.StandardError.ReadToEndAsync()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) {
    throw "$(Split-Path -Leaf $Program) a échoué : $($errors.Result.Trim())"
  }
  return $output.Result
}

$Ssh = Find-OpenSsh 'ssh'
$Keygen = Find-OpenSsh 'ssh-keygen'

Write-Step "L'adresse du serveur, lue dans le raccourci « $AdminHost »"
if (-not (Test-Path -LiteralPath $Config)) {
  throw "$Config introuvable : crée d'abord le raccourci « $AdminHost » (docs/ops/serveur.md)"
}
# ssh -G affiche les réglages qui s'appliqueraient au raccourci, sans se connecter.
$resolved = (Invoke-Program $Ssh ('-F {0} -G {1}' -f (ConvertTo-Argument $Config), $AdminHost)) -split "`r?`n"
$hostName = (@($resolved | Where-Object { $_ -match '^hostname ' }) | Select-Object -First 1) -replace '^hostname ', ''
$port = (@($resolved | Where-Object { $_ -match '^port ' }) | Select-Object -First 1) -replace '^port ', ''
if (-not $hostName -or $hostName -eq $AdminHost) {
  throw "le raccourci « $AdminHost » n'a pas d'adresse (HostName) dans $Config"
}
Write-Output "$hostName (port $port)"

Write-Step "La clé de téléchargement : $Key"
if (Test-Path -LiteralPath $Key) {
  Write-Output 'existe déjà'
} else {
  # -N "" : sans phrase de passe ; -q : sans bavardage.
  Invoke-Program $Keygen ('-q -t ed25519 -N "" -C "telechargement des sauvegardes Waiggle" -f {0}' -f (ConvertTo-Argument $Key)) | Out-Null
  Write-Output 'créée'
}

Write-Step "Le script de copie, installé dans $InstallDir"
if (-not (Test-Path -LiteralPath $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }
$installed = Join-Path $InstallDir 'copy-to-pc.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'copy-to-pc.ps1') -Destination $installed -Force
Write-Output 'ok'

Write-Step "Le raccourci « $BackupHost », dans $BackupConfig"
# Les guillemets protègent les chemins qui contiennent une espace ; SSH lit les « / » sous Windows.
$lines = @(
  '# Écrit par infra/offsite/install-on-pc.ps1, et réécrit à chaque installation.',
  '# La copie quotidienne des sauvegardes chiffrées de Waiggle (copy-to-pc.ps1).',
  "Host $BackupHost",
  "  HostName $hostName"
)
if ($port -and $port -ne '22') { $lines += "  Port $port" }
$lines += @(
  '  User sauvegarde',
  ('  IdentityFile "{0}"' -f $Key.Replace('\', '/')),
  '  IdentitiesOnly yes',
  '  BatchMode yes',
  '  ConnectTimeout 30',
  # L'empreinte du serveur doit déjà être connue (par les connexions à « waiggle ») : une
  # empreinte inconnue est refusée, sans question.
  '  StrictHostKeyChecking yes',
  ('  UserKnownHostsFile "{0}"' -f (Join-Path $SshDir 'known_hosts').Replace('\', '/'))
)
[IO.File]::WriteAllLines($BackupConfig, $lines, $Utf8NoBom)
Write-Output 'ok'

Write-Step "Le dossier des copies : $Destination"
if (-not (Test-Path -LiteralPath $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
Write-Output 'ok'

if (-not $NoScheduledTask) {
  Write-Step "La tâche planifiée « $TaskName »"
  $argument = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File {0} -SshConfig {1} -Destination {2}' -f `
    (ConvertTo-Argument $installed), (ConvertTo-Argument $BackupConfig), (ConvertTo-Argument $Destination)
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
  $triggers = @(
    (New-ScheduledTaskTrigger -Daily -At '12:30'),
    (New-ScheduledTaskTrigger -Daily -At '20:30')
  )
  # StartWhenAvailable : une heure manquée (PC éteint) est rattrapée dès que possible.
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
  # Sous ton compte, quand tu es connecté, sans droits d'administrateur.
  $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings `
    -Principal $principal -Description 'Copie sur ce PC les sauvegardes chiffrées du serveur de Waiggle.' -Force | Out-Null
  Write-Output 'ok : chaque jour à 12 h 30 et 20 h 30 (ou dès que le PC est allumé)'
}

Write-Step 'Les clés publiques à ajouter au dépôt'
Write-Output 'Pour infra/offsite/download.pub (la clé de téléchargement) :'
Write-Output ([IO.File]::ReadAllText("$Key.pub").Trim())
if (Test-Path -LiteralPath "$DecryptionKey.pub") {
  Write-Output 'Pour infra/offsite/recipients.txt (la clé de déchiffrement) :'
  Write-Output ([IO.File]::ReadAllText("$DecryptionKey.pub").Trim())
} else {
  Write-Output "La clé de déchiffrement ($DecryptionKey) n'existe pas encore : voir docs/ops/serveur.md."
}
Write-Output ''
Write-Output "Pour essayer la copie maintenant : Start-ScheduledTask '$TaskName', puis lire journal.txt dans $Destination"
