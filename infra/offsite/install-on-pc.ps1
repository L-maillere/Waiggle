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
  2. le raccourci SSH « waiggle-sauvegardes » dans ~/.ssh/config, vers la même adresse que
     « waiggle », mais avec le compte « sauvegarde » et cette clé ;
  3. le script de copie, recopié HORS du dépôt (dans AppData\Local\Waiggle) : la tâche planifiée
     lance toujours ce qui a été installé, jamais une version du dépôt en cours de relecture ;
  4. le dossier des copies (« Waiggle - Sauvegardes », dans Documents) ;
  5. la tâche planifiée « Waiggle - copie des sauvegardes », chaque jour à 12 h 30 et 20 h 30. Si le
     PC était éteint à l'heure prévue, elle tourne dès qu'il est allumé.
Il affiche enfin les clés publiques à ajouter au dépôt (infra/offsite/).

Pour mettre à jour le script de copie après une modification du dépôt : relancer l'installateur.
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

foreach ($path in @($Config, $Key, $Destination)) {
  if ($path.Contains('"')) { throw "chemin inattendu (guillemet) : $path" }
}
$Ssh = Find-OpenSsh 'ssh'
$Keygen = Find-OpenSsh 'ssh-keygen'

Write-Step "L'adresse du serveur, lue dans le raccourci « $AdminHost »"
if (-not (Test-Path -LiteralPath $Config)) {
  throw "$Config introuvable : crée d'abord le raccourci « $AdminHost » (docs/ops/serveur.md)"
}
# ssh -G affiche les réglages qui s'appliqueraient au raccourci, sans se connecter.
$resolved = (Invoke-Program $Ssh ('-F "{0}" -G {1}' -f $Config, $AdminHost)) -split "`r?`n"
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
  Invoke-Program $Keygen ('-q -t ed25519 -N "" -C "telechargement des sauvegardes Waiggle" -f "{0}"' -f $Key) | Out-Null
  Write-Output 'créée'
}

Write-Step "Le raccourci « $BackupHost », dans $Config"
if (Select-String -LiteralPath $Config -Pattern "^\s*Host\s+$BackupHost\s*$" -Quiet) {
  Write-Output 'existe déjà'
} else {
  $lines = @(
    '',
    "# Ajouté par infra/offsite/install-on-pc.ps1 : la copie quotidienne des sauvegardes chiffrées.",
    "Host $BackupHost",
    "  HostName $hostName"
  )
  if ($port -and $port -ne '22') { $lines += "  Port $port" }
  $lines += @(
    '  User sauvegarde',
    ('  IdentityFile "{0}"' -f $Key.Replace('\', '/')),
    '  IdentitiesOnly yes',
    '  BatchMode yes',
    '  ConnectTimeout 30'
  )
  # Si le fichier ne finit pas par un retour à la ligne, on en ajoute un avant le bloc.
  $bytes = [IO.File]::ReadAllBytes($Config)
  $prefix = ''
  if ($bytes.Length -gt 0 -and $bytes[$bytes.Length - 1] -ne 10) { $prefix = [Environment]::NewLine }
  $text = $prefix + (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
  [IO.File]::AppendAllText($Config, $text, $Utf8NoBom)
  Write-Output 'ajouté'
}

Write-Step "Le script de copie, installé dans $InstallDir"
if (-not (Test-Path -LiteralPath $InstallDir)) { New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null }
$installed = Join-Path $InstallDir 'copy-to-pc.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'copy-to-pc.ps1') -Destination $installed -Force
Write-Output 'ok'

Write-Step "Le dossier des copies : $Destination"
if (-not (Test-Path -LiteralPath $Destination)) { New-Item -ItemType Directory -Path $Destination -Force | Out-Null }
Write-Output 'ok'

if (-not $NoScheduledTask) {
  Write-Step "La tâche planifiée « $TaskName »"
  $argument = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -SshConfig "{1}" -Destination "{2}"' -f $installed, $Config, $Destination
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
