param(
  [Parameter(Mandatory = $true)]
  [string]$InspectionPath
)

$ErrorActionPreference = "Stop"

function Remove-Diacritics {
  param([string]$Text)
  $normalized = $Text.Normalize([Text.NormalizationForm]::FormD)
  $builder = [Text.StringBuilder]::new()
  foreach ($character in $normalized.ToCharArray()) {
    if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($character) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($character)
    }
  }
  return $builder.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function Normalize-TeamCode {
  param([string]$Code)
  $trimmed = $Code.Trim().ToUpperInvariant()
  $firstCodePoint = if ($trimmed.Length -gt 0) { [int][char]$trimmed[0] } else { 0 }
  if ($trimmed.Length -eq 3 -and $firstCodePoint -in @(0x00C1, 0x00C0, 0x00C2, 0x00C3, 0x00C4) -and $trimmed.Substring(1) -eq "US") {
    return "AUT"
  }

  $plain = (Remove-Diacritics $trimmed) -replace "[^A-Z]", ""
  switch ($plain) {
    "ALG" { return "AGL" }
    default { return $plain }
  }
}

function Normalize-Game {
  param([string]$Text)
  $parts = $Text -split "\s+(?:x|X|-)\s+"
  if ($parts.Count -ne 2) {
    return $null
  }
  $homeCode = Normalize-TeamCode ($parts[0])
  $awayCode = Normalize-TeamCode ($parts[1])
  if ($homeCode.Length -lt 2 -or $awayCode.Length -lt 2) {
    return $null
  }
  return "$homeCode x $awayCode"
}

$expected = @(
  "MEX x AFS", "COR x TCH", "TCH x AFS", "MEX x COR", "TCH x MEX", "AFS x COR",
  "CAN x BOS", "CAT x SUI", "SUI x BOS", "CAN x CAT", "SUI x CAN", "BOS x CAT",
  "BRA x MAR", "HAI x ESC", "ESC x MAR", "BRA x HAI", "ESC x BRA", "MAR x HAI",
  "EUA x PAR", "AUS x TUR", "EUA x AUS", "TUR x PAR", "TUR x EUA", "PAR x AUS",
  "ALE x CUR", "COM x EQU", "ALE x COM", "EQU x CUR", "EQU x ALE", "CUR x COM",
  "HOL x JAP", "SUE x TUN", "HOL x SUE", "TUN x JAP", "TUN x HOL", "JAP x SUE",
  "BEL x EGI", "IRA x NZL", "BEL x IRA", "NZL x EGI", "NZL x BEL", "EGI x IRA",
  "ESP x CAB", "ARA x URU", "ESP x ARA", "URU x CAB", "URU x ESP", "CAB x ARA",
  "FRA x SEN", "IRQ x NOR", "FRA x IRQ", "NOR x SEN", "NOR x FRA", "SEN x IRQ",
  "ARG x AGL", "AUT x JOR", "ARG x AUT", "JOR x AGL", "JOR x ARG", "AGL x AUT",
  "POR x RDC", "UZB x COL", "POR x UZB", "COL x RDC", "COL x POR", "RDC x UZB",
  "ING x CRO", "GAN x PAN", "ING x GAN", "PAN x CRO", "PAN x ING", "CRO x GAN"
)

$inspection = Get-Content -Raw -Encoding UTF8 $InspectionPath | ConvertFrom-Json
$palpites = $inspection.sheets | Select-Object -First 1
$flatCells = @($palpites.cells | ForEach-Object { $_ })

$games = @()
$dayLabels = @()
$errors = @()

foreach ($cell in $flatCells) {
  $value = [string]$cell.value
  if ($value -match "^DIA\s+\d+\s*-\s*\d{1,2}/\d{1,2}$") {
    $dayLabels += $value
  }
  if ($value -match "^[\p{L}]{2,5}\s*(?:x|X|-)\s*[\p{L}]{2,5}$") {
    $normalizedGame = Normalize-Game $value
    if ($normalizedGame) {
      $games += $normalizedGame
    }
  }
  if ($value -match "^#(?:REF!|DIV/0!|VALUE!|NAME\?|N/A)") {
    $errors += "$($cell.address): $value"
  }
}

$missing = @($expected | Where-Object { $_ -notin $games })
$unexpected = @($games | Where-Object { $_ -notin $expected })
$duplicates = @(
  $games |
    Group-Object |
    Where-Object { $_.Count -ne 1 } |
    ForEach-Object { "$($_.Name) ($($_.Count)x)" }
)

$day11Header = @(
  $flatCells |
    Where-Object { $_.address -in @("B282", "C282", "D282", "E282") } |
    Sort-Object { [int][char]$_.address[0] } |
    ForEach-Object { Normalize-Game ([string]$_.value) }
)

$day11Participants = @(
  $flatCells |
    Where-Object {
      if ($_.address -notmatch "^A(\d+)$") { return $false }
      $row = [int]$Matches[1]
      return $row -ge 283 -and $row -le 306 -and [string]$_.value
    }
)

$result = [ordered]@{
  sheets = @($inspection.sheets).Count
  sheetNames = @($inspection.sheets | ForEach-Object { $_.name })
  dayBlocks = $dayLabels.Count
  games = $games.Count
  uniqueGames = @($games | Select-Object -Unique).Count
  missingGames = $missing
  unexpectedGames = $unexpected
  duplicateGames = $duplicates
  day11Header = $day11Header
  day11Participants = $day11Participants.Count
  formulaErrors = $errors
  valid = (
    @($inspection.sheets).Count -eq 4 -and
    $dayLabels.Count -eq 17 -and
    $games.Count -eq 72 -and
    $missing.Count -eq 0 -and
    $unexpected.Count -eq 0 -and
    $duplicates.Count -eq 0 -and
    ($day11Header -join "|") -eq "BEL x IRA|NZL x EGI|ESP x ARA|URU x CAB" -and
    $day11Participants.Count -eq 24 -and
    $errors.Count -eq 0
  )
}

$result | ConvertTo-Json -Depth 6
if (-not $result.valid) {
  exit 1
}
