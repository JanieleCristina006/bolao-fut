param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,
  [Parameter(Mandatory = $true)]
  [string]$PreviewDirectory
)

$ErrorActionPreference = "Stop"

function Release-ComObject {
  param([object]$Object)
  if ($null -ne $Object -and [System.Runtime.InteropServices.Marshal]::IsComObject($Object)) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($Object)
  }
}

function Export-RangePreview {
  param(
    [object]$Worksheet,
    [string]$RangeAddress,
    [string]$OutputPath
  )

  $range = $null
  $image = $null
  try {
    $range = $Worksheet.Range($RangeAddress)
    $range.CopyPicture(1, -4147)
    Start-Sleep -Milliseconds 500
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($null -eq $image) {
      throw "O Excel não disponibilizou a imagem da faixa no clipboard."
    }
    $image.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    if ($image) {
      $image.Dispose()
    }
    Release-ComObject $range
  }
}

$excel = $null
$workbook = $null
$palpites = $null
$success = $false

try {
  Write-Output "Abrindo workbook"
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  New-Item -ItemType Directory -Force -Path $PreviewDirectory | Out-Null

  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.EnableEvents = $false
  $excel.ScreenUpdating = $false

  $workbook = $excel.Workbooks.Open($WorkbookPath)
  $palpites = $workbook.Worksheets.Item(1)

  Write-Output "Verificando Dia 11"
  $day11Exists = $false
  $dayLabels = $palpites.Range("A1:A600").Value2
  for ($row = 1; $row -le 600; $row++) {
    if ([string]$dayLabels[$row, 1] -eq "DIA 11 - 21/06") {
      $day11Exists = $true
      break
    }
  }

  if (-not $day11Exists) {
    Write-Output "Inserindo Dia 11"
    $palpites.Rows("281:308").Insert(-4121)

    $source = $palpites.Range("A309:I336")
    $destination = $palpites.Range("A281:I308")
    $source.Copy($destination)

    for ($offset = 0; $offset -lt 28; $offset++) {
      $palpites.Rows.Item(281 + $offset).RowHeight = $palpites.Rows.Item(309 + $offset).RowHeight
    }

    $palpites.Range("A281").Value2 = "DIA 11 - 21/06"
    $headerValues = New-Object 'object[,]' 1, 7
    $headerTexts = @("PARTICIPANTE", "BEL x IRA", "NZL x EGI", "ESP x ARA", "URU x CAB", "TOTAL", "CRAVADAS")
    for ($index = 0; $index -lt $headerTexts.Count; $index++) {
      $headerValues[0, $index] = $headerTexts[$index]
    }
    $palpites.Range("A282:G282").Value2 = $headerValues
    $palpites.Range("B283:E306").ClearContents()
    $palpites.Range("F283:G306").Value2 = 0
    $palpites.Range("H281:I308").ClearContents()
    $palpites.Range("A307").Value2 = "RESULTADO"
    $palpites.Range("B307:I308").ClearContents()

    Release-ComObject $destination
    Release-ComObject $source
  }

  # Padronizações necessárias para os aliases reconhecidos pelo aplicativo.
  Write-Output "Padronizando siglas"
  $palpites.Range("E114").Value2 = "IRA x NZL"
  $palpites.Range("C254").Value2 = "ALE x COM"
  $palpites.Range("D254").Value2 = "EQU x CUR"
  $palpites.Range("E254").Value2 = "TUN x JAP"

  Write-Output "Salvando workbook"
  $workbook.Save()
  $excel.CalculateFull()
  $workbook.Save()

  Write-Output "Gerando prévia Palpites"
  Export-RangePreview $palpites "A250:I340" (Join-Path $PreviewDirectory "palpites-dia10-a-dia13.png")

  Write-Output "Gerando prévia Ranking"
  $ranking = $workbook.Worksheets.Item(2)
  Export-RangePreview $ranking "A1:I30" (Join-Path $PreviewDirectory "ranking.png")
  Release-ComObject $ranking

  $pagamento = $workbook.Worksheets.Item(3)
  Export-RangePreview $pagamento "A1:D28" (Join-Path $PreviewDirectory "pagamento.png")
  Release-ComObject $pagamento

  $instrucoes = $workbook.Worksheets.Item(4)
  Export-RangePreview $instrucoes "A1:F9" (Join-Path $PreviewDirectory "instrucoes.png")
  Release-ComObject $instrucoes
  $success = $true
}
finally {
  if ($workbook) {
    $workbook.Close($success)
    Release-ComObject $workbook
  }
  if ($palpites) {
    Release-ComObject $palpites
  }
  if ($excel) {
    $excel.Quit()
    Release-ComObject $excel
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
