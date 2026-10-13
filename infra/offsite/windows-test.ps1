<#
.SYNOPSIS
Essaie les scripts du PC avec Windows PowerShell 5.1, sur une machine Windows de la CI.

.DESCRIPTION
infra/offsite-test.sh essaie la copie de bout en bout, mais avec PowerShell 7, sous Linux. Ici, on
vérifie ce qui est propre au PC de Louis : Windows PowerShell 5.1 lit les scripts (accents
compris), l'installateur crée une clé sans phrase de passe, écrit son propre fichier de réglages
SSH sans toucher à ~/.ssh/config, et planifie la tâche ; la commande exacte de la tâche lance bien
la copie, qui échoue proprement quand le serveur ne répond pas.

Usage (CI) : powershell -ExecutionPolicy Bypass -File infra\offsite\windows-test.ps1
#>
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ne 5) { throw 'à lancer avec Windows PowerShell 5.1 (powershell.exe)' }

$TaskName = 'Waiggle - copie des sauvegardes'

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw "ÉCHEC : $Message" }
  Write-Output "ok : $Message"
}

# Lance un programme avec ses arguments en un seul texte, et renvoie son code de sortie.
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
  return New-Object PSObject -Property @{ ExitCode = $process.ExitCode; Output = $output.Result; Errors = $errors.Result }
}

function Get-LastLine([string]$Path) {
  return [string](@(Get-Content -LiteralPath $Path -Encoding UTF8) | Select-Object -Last 1)
}

Write-Output '> Windows PowerShell 5.1 lit les scripts'
foreach ($file in @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1')) {
  $bytes = [IO.File]::ReadAllBytes($file.FullName)
  Assert-True ($bytes.Length -gt 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) "$($file.Name) commence par le marqueur UTF-8"
  $tokens = $null
  $errors = $null
  $null = [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)
  Assert-True (@($errors).Count -eq 0) "$($file.Name) se lit sans erreur $(@($errors) -join '; ')"
}
$copyAst = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'copy-to-pc.ps1'), [ref]$null, [ref]$null)
Assert-True ($copyAst.Extent.Text.Contains('ÉCHEC : ')) 'les lettres accentuées sont lues correctement'

$work = Join-Path ([IO.Path]::GetTempPath()) ('waiggle-essai-' + [Guid]::NewGuid().ToString('N'))
$sshDir = Join-Path $work 'ssh'
$installDir = Join-Path $work 'install'
$destination = Join-Path $work 'Waiggle - Sauvegardes'
$state = Join-Path $work 'etat-copie.txt'
New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
# Le raccourci « waiggle », vers un port fermé : la copie échouera vite, comme sans réseau.
$userConfig = Join-Path $sshDir 'config'
[IO.File]::WriteAllText($userConfig, "Host waiggle`n  HostName 127.0.0.1`n  Port 9`n  User louis`n")
$userConfigHash = (Get-FileHash -LiteralPath $userConfig).Hash

try {
  Write-Output '> Installation, deux fois de suite'
  $installer = Join-Path $PSScriptRoot 'install-on-pc.ps1'
  $installArguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -SshDir "{1}" -InstallDir "{2}" -Destination "{3}"' -f $installer, $sshDir, $installDir, $destination
  $first = Invoke-Program 'powershell.exe' $installArguments
  Assert-True ($first.ExitCode -eq 0) "installation $($first.Output) $($first.Errors)"
  $key = Join-Path $sshDir 'waiggle-telechargement'
  $keyHash = (Get-FileHash -LiteralPath $key).Hash
  $second = Invoke-Program 'powershell.exe' $installArguments
  Assert-True ($second.ExitCode -eq 0) "seconde installation $($second.Errors)"
  Assert-True ((Get-FileHash -LiteralPath $key).Hash -eq $keyHash) 'la clé de téléchargement ne change pas'
  Assert-True ((Get-FileHash -LiteralPath $userConfig).Hash -eq $userConfigHash) '~/.ssh/config n''est pas modifié'
  $backupConfig = Join-Path $installDir 'ssh_config'
  # -P "" : on demande la clé publique avec une phrase de passe vide ; cela ne marche que si la
  # clé n'en a pas (la tâche planifiée ne pourrait pas la taper).
  $keygen = Join-Path $env:WINDIR 'System32\OpenSSH\ssh-keygen.exe'
  $noPassphrase = Invoke-Program $keygen ('-y -P "" -f "{0}"' -f $key)
  Assert-True ($noPassphrase.ExitCode -eq 0) 'la clé de téléchargement n''a pas de phrase de passe'
  $resolved = (Invoke-Program (Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe') ('-F "{0}" -G waiggle-sauvegardes' -f $backupConfig)).Output
  Assert-True ($resolved -match '(?m)^user sauvegarde\r?$' -and $resolved -match '(?m)^port 9\r?$') 'le raccourci dédié reprend l''adresse de « waiggle », avec le compte sauvegarde'
  Assert-True ($resolved -match '(?m)^stricthostkeychecking true\r?$') 'une empreinte de serveur inconnue est refusée'

  Write-Output '> La tâche planifiée'
  $task = Get-ScheduledTask -TaskName $TaskName
  Assert-True (@($task.Triggers).Count -eq 2) 'deux passages par jour'
  Assert-True ($task.Settings.StartWhenAvailable) 'une heure manquée est rattrapée'
  Assert-True ($task.Principal.RunLevel -eq 'Limited') 'sans droits d''administrateur'
  $action = @($task.Actions)[0]
  Assert-True ($action.Execute -eq 'powershell.exe' -and $action.Arguments.Contains("-File `"$installDir\copy-to-pc.ps1`"")) 'la tâche lance le script installé'
  Assert-True ($action.Arguments.Contains("-SshConfig `"$backupConfig`"")) 'avec le fichier de réglages SSH dédié'

  Write-Output '> La commande exacte de la tâche, serveur injoignable'
  # Les mêmes arguments que la tâche, plus des essais rapides et un fichier d'état de l'essai.
  $run = Invoke-Program 'powershell.exe' ($action.Arguments + (' -StateFile "{0}" -Attempts 2 -RetryDelaySeconds 1 -MinFreeBytes 0' -f $state))
  Assert-True ($run.ExitCode -eq 1) 'la copie échoue (code 1)'
  $last = Get-LastLine (Join-Path $destination 'journal.txt')
  Assert-True ($last.Contains('ÉCHEC : serveur injoignable (2 essais)')) "échec noté au journal : $last"
  Assert-True ((Get-Content -LiteralPath $state) -contains 'resultat=echec') 'échec noté dans l''état lu par deploy-from-pc.sh'
} finally {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output 'Scripts du PC sous Windows PowerShell 5.1 : tout est bon.'
exit 0
