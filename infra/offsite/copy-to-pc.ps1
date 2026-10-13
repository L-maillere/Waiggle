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
     abîmée en route est jetée, et retentée au passage suivant ;
  3. il efface les copies arrivées sur ce PC il y a plus de 30 jours, sauf une par mois, gardée un
     an ;
  4. il note le résultat dans journal.txt (dans le dossier des copies), et l'état dans un petit
     fichier que deploy-from-pc.sh lit pour prévenir si la dernière copie date de plus de 3 jours.

Le serveur n'est pas cru sur parole : s'il était piraté, il ne doit pas pouvoir faire effacer les
copies déjà sur ce PC, ni remplir son disque. D'où :
  - les noms de fichiers du serveur sont vérifiés, et leur date doit être récente (un nom daté du
    futur passerait devant toutes les vraies copies) ;
  - ce qui est effacé dépend de la date d'ARRIVÉE sur ce PC, que le PC fixe lui-même, jamais des
    noms donnés par le serveur ;
  - 5 téléchargements et 2 effacements au plus par passage, une taille maximale par copie, et un
    minimum d'espace libre sur le disque.

Les copies restent chiffrées sur ce PC : seule la clé de déchiffrement (avec sa phrase de passe)
peut les ouvrir. Ce script ne la touche jamais.

Écrit pour Windows PowerShell 5.1 (celui de Windows 10 et 11) et pour PowerShell 7. Enregistré en
UTF-8 avec « BOM » : sans ce marqueur, PowerShell 5.1 lirait mal les lettres accentuées.

.EXAMPLE
powershell -File copy-to-pc.ps1 -SshConfig "$env:LOCALAPPDATA\Waiggle\ssh_config"
#>
[CmdletBinding()]
param(
  # Le dossier des copies. Vide : « Waiggle - Sauvegardes », dans Documents.
  [string]$Destination = '',
  # Le raccourci SSH du compte « sauvegarde ».
  [string]$SshHost = 'waiggle-sauvegardes',
  # Le fichier de réglages SSH (celui qu'écrit install-on-pc.ps1). Vide : celui de l'utilisateur.
  [string]$SshConfig = '',
  # Le fichier d'état lu par deploy-from-pc.sh. Vide : Waiggle\etat-copie.txt, dans AppData\Local.
  [string]$StateFile = '',
  # Combien de jours une copie reste sur ce PC (en plus : une par mois, gardée un an).
  [ValidateRange(1, 3650)][int]$KeepDays = 30,
  # Les limites qui protègent ce PC d'un serveur piraté (voir plus haut).
  [ValidateRange(1, 100)][int]$MaxNewPerRun = 5,
  [ValidateRange(1, 100)][int]$MaxDeletionsPerRun = 2,
  [ValidateRange(1, [long]::MaxValue)][long]$MaxBytes = 2GB,
  [ValidateRange(0, [long]::MaxValue)][long]$MinFreeBytes = 5GB,
  # Si le serveur ne répond pas (le PC vient peut-être de démarrer, sans réseau), on réessaie.
  [ValidateRange(1, 10)][int]$Attempts = 3,
  [ValidateRange(0, 3600)][int]$RetryDelaySeconds = 300
)

# StrictMode : une variable mal orthographiée devient une erreur au lieu de valoir « rien ».
Set-StrictMode -Version 3.0
# Stop : la première erreur arrête le script (elle est alors notée au journal, plus bas).
$ErrorActionPreference = 'Stop'

# Le nom d'une copie : date_heure-quotidien.tar.age, en chiffres de 0 à 9 et en minuscules
# (-cmatch respecte les majuscules ; \d accepterait d'autres chiffres qu'Unicode connaît).
$NamePattern = '^([0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6})-quotidien\.tar\.age$'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not $Destination) {
  $Destination = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Waiggle - Sauvegardes'
}
if (-not $StateFile) {
  $StateFile = Join-Path (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Waiggle') 'etat-copie.txt'
}
$Journal = Join-Path $Destination 'journal.txt'

# Un argument entre guillemets, pour une ligne de commande Windows. Une barre oblique inverse
# juste avant le guillemet final le « protégerait » et casserait la ligne : on la double.
function ConvertTo-Argument([string]$Value) {
  if ($Value.Contains('"')) { throw "chemin inattendu (guillemet) : $Value" }
  return '"' + ($Value -replace '(\\+)$', '$1$1') + '"'
}

# La date inscrite dans le nom d'une copie, ou $null si le nom n'a pas la forme attendue.
function Get-NameDate([string]$Name) {
  if ($Name -cnotmatch $NamePattern) { return $null }
  $parsed = [datetime]::MinValue
  $ok = [datetime]::TryParseExact($Name.Substring(0, 17), 'yyyy-MM-dd_HHmmss',
    [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsed)
  if (-not $ok) { return $null }
  return $parsed
}

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
# directement, sans écrire de chemin Windows dans ses commandes. $WatchFile : un fichier en cours
# de téléchargement, arrêté s'il dépasse $Limit octets.
function Invoke-Sftp([string[]]$Commands, [string]$WatchFile = '', [long]$Limit = 0) {
  $batch = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllLines($batch, $Commands, $Utf8NoBom)
    $arguments = @()
    if ($SshConfig) { $arguments += @('-F', $SshConfig) }
    $arguments += @('-b', $batch, $SshHost)
    # Process plutôt que l'appel direct : Windows PowerShell 5.1 transforme en erreur tout ce qu'un
    # programme écrit sur sa sortie d'erreur, même un simple avertissement.
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $script:Sftp
    $info.Arguments = ($arguments | ForEach-Object { ConvertTo-Argument $_ }) -join ' '
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
    $deadline = (Get-Date).AddMinutes(30)
    # On regarde toutes les 2 secondes : fini ? trop long ? trop gros ?
    while (-not $process.WaitForExit(2000)) {
      if ((Get-Date) -gt $deadline) {
        $process.Kill()
        throw 'sftp tourne depuis 30 minutes : arrêté'
      }
      if ($WatchFile -and (Test-Path -LiteralPath $WatchFile) -and (Get-Item -LiteralPath $WatchFile).Length -gt $Limit) {
        $process.Kill()
        throw "copie trop grosse (plus de $Limit octets) : téléchargement arrêté"
      }
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
# puis seulement leur donne leur vrai nom. Une copie interrompue, trop grosse ou abîmée ne reste
# jamais. $Name a déjà été vérifié (Get-NameDate) : ni espace, ni guillemet, ni chemin.
function Copy-OneBackup([string]$Name) {
  $part = Join-Path $Destination "$Name.partiel"
  $shaPart = Join-Path $Destination "$Name.sha256.partiel"
  try {
    $drive = New-Object System.IO.DriveInfo([IO.Path]::GetPathRoot($Destination))
    if ($drive.AvailableFreeSpace -lt $MinFreeBytes) {
      throw "espace disque insuffisant ($([math]::Round($drive.AvailableFreeSpace / 1GB, 1)) Go libres) : $Name non copiée"
    }
    # L'empreinte d'abord : un fichier de quelques dizaines d'octets.
    $result = Invoke-Sftp -Commands @("get $Name.sha256 $Name.sha256.partiel") -WatchFile $shaPart -Limit 1KB
    if ($result.ExitCode -ne 0) { throw "téléchargement de l'empreinte de $Name interrompu : $($result.Errors)" }
    $result = Invoke-Sftp -Commands @("get $Name $Name.partiel") -WatchFile $part -Limit $MaxBytes
    if ($result.ExitCode -ne 0) { throw "téléchargement de $Name interrompu : $($result.Errors)" }
    if ((Get-Item -LiteralPath $part).Length -gt $MaxBytes) { throw "copie trop grosse : $Name dépasse $MaxBytes octets" }
    # Le fichier d'empreinte : « <64 caractères> <nom> ». On vérifie qu'il parle bien de ce fichier.
    $fields = @(([string](Get-Content -LiteralPath $shaPart -TotalCount 1)).Trim() -split '\s+')
    if ($fields.Count -ne 2 -or $fields[0] -cnotmatch '^[0-9a-f]{64}$' -or $fields[1].TrimStart('*') -cne $Name) {
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

# Les copies présentes sur ce PC. LastWriteTimeUtc : le moment de leur arrivée ici (sftp ne
# reprend pas la date du serveur), fixé par ce PC et non par le serveur.
function Get-LocalCopy {
  return @(Get-ChildItem -LiteralPath $Destination -File | Where-Object { $_.Name -cmatch $NamePattern })
}

# Les copies à effacer : arrivées il y a plus de $KeepDays jours, sauf la première arrivée de
# chaque mois (gardée un an). Les plus anciennes d'abord.
function Get-ExpiredCopy([object[]]$Copies) {
  $now = (Get-Date).ToUniversalTime()
  $old = @($Copies | Where-Object { $_.LastWriteTimeUtc -lt $now.AddDays(-$KeepDays) })
  $monthly = @{}
  foreach ($copy in ($old | Where-Object { $_.LastWriteTimeUtc -ge $now.AddDays(-365) } |
        Sort-Object LastWriteTimeUtc, Name)) {
    $month = $copy.LastWriteTimeUtc.ToString('yyyy-MM')
    if (-not $monthly.ContainsKey($month)) { $monthly[$month] = $copy.Name }
  }
  return @($old | Where-Object { -not $monthly.ContainsValue($_.Name) } | Sort-Object LastWriteTimeUtc, Name)
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
    $names = @(Get-LocalCopy | ForEach-Object { $_.Name } | Sort-Object -Descending)
    if ($names.Count -gt 0) { $newest = $names[0] -replace '\.tar\.age$', '' }
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
  $Destination = (Resolve-Path -LiteralPath $Destination).Path
  # Restes d'un passage interrompu (PC éteint pendant un téléchargement…).
  Get-ChildItem -LiteralPath $Destination -File -Filter '*.partiel' | Remove-Item -Force
  $script:Sftp = Find-Sftp

  # 1. La liste des copies du serveur, avec plusieurs essais si le serveur ne répond pas.
  $listing = $null
  $lastError = ''
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    $result = Invoke-Sftp -Commands @('ls -1')
    if ($result.ExitCode -eq 0) { $listing = $result.Output; break }
    $lastError = $result.Errors
    if ($attempt -lt $Attempts) { Start-Sleep -Seconds $RetryDelaySeconds }
  }
  if ($null -eq $listing) { throw "serveur injoignable ($Attempts essais) : $lastError" }
  $remoteFiles = @($listing -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -notlike 'sftp>*' })

  # 2. Le tri : une copie n'est prise que si son nom est bien formé, sa date récente (le serveur
  # en garde 14 jours) et pas dans le futur, et si son empreinte existe (le serveur l'écrit en
  # dernier). Un nom qui ressemble à une copie mais ne passe pas ces contrôles est signalé.
  $problems = @()
  $now = Get-Date
  $valid = @()
  $refused = @()
  foreach ($file in ($remoteFiles | Where-Object { $_ -like '*.tar.age' })) {
    $date = Get-NameDate $file
    if ($null -eq $date -or $date -gt $now.AddDays(1) -or $date -lt $now.AddDays(-15)) {
      $refused += $file
    } elseif ($remoteFiles -ccontains "$file.sha256") {
      $valid += $file
    }
  }
  if ($refused.Count -gt 0) {
    $shown = (@($refused | Select-Object -First 3) -join ', ')
    $problems += "$($refused.Count) nom(s) de copie refusé(s) sur le serveur (date future, trop ancienne ou nom inattendu : $shown)"
  }

  # 3. Les copies qui manquent ici, les plus récentes d'abord, 5 au plus. Une copie en échec
  # n'empêche pas les autres.
  $present = @(Get-LocalCopy | ForEach-Object { $_.Name })
  $missing = @($valid | Where-Object { $present -cnotcontains $_ } | Sort-Object -Descending)
  $copied = @()
  foreach ($name in @($missing | Select-Object -First $MaxNewPerRun)) {
    try {
      Copy-OneBackup $name
      $copied += $name -replace '\.tar\.age$', ''
    } catch {
      $problems += $_.Exception.Message
    }
  }

  # 4. Les copies arrivées depuis trop longtemps, 2 au plus par passage.
  $deleted = @()
  foreach ($copy in @(Get-ExpiredCopy (Get-LocalCopy) | Select-Object -First $MaxDeletionsPerRun)) {
    Remove-Item -LiteralPath $copy.FullName, "$($copy.FullName).sha256" -Force -ErrorAction SilentlyContinue
    $deleted += $copy.Name -replace '\.tar\.age$', ''
  }

  $summary = 'rien de nouveau'
  if ($copied.Count -gt 0) { $summary = '{0} nouvelle(s) copie(s) ({1})' -f $copied.Count, ($copied -join ', ') }
  $summary += ', {0} effacée(s), {1} sur ce PC' -f $deleted.Count, @(Get-LocalCopy).Count
  if ($problems.Count -gt 0) {
    Write-Journal ("ÉCHEC : {0} ; {1}" -f ($problems -join ' ; '), $summary)
    Save-State 'echec'
    exit 1
  }
  Write-Journal "ok : $summary"
  Save-State 'ok'
  exit 0
} catch {
  Write-Journal "ÉCHEC : $($_.Exception.Message)"
  try { Save-State 'echec' } catch { Write-Warning "état impossible à écrire : $($_.Exception.Message)" }
  exit 1
}
