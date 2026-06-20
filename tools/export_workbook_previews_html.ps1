param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"

function Release-ComObject {
  param([object]$Object)
  if ($null -ne $Object -and [System.Runtime.InteropServices.Marshal]::IsComObject($Object)) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($Object)
  }
}

function Export-RangeAsHtml {
  param(
    [object]$Excel,
    [object]$SourceWorkbook,
    [int]$SheetIndex,
    [string]$RangeAddress,
    [string]$OutputPath
  )

  $sourceSheet = $null
  $sourceRange = $null
  $previewWorkbook = $null
  $previewSheet = $null
  $destination = $null

  try {
    $sourceSheet = $SourceWorkbook.Worksheets.Item($SheetIndex)
    $sourceRange = $sourceSheet.Range($RangeAddress)
    $previewWorkbook = $Excel.Workbooks.Add()
    $previewSheet = $previewWorkbook.Worksheets.Item(1)
    $previewSheet.Name = "Prévia"
    $destination = $previewSheet.Range("A1")
    $sourceRange.Copy($destination)

    for ($column = 1; $column -le $sourceRange.Columns.Count; $column++) {
      $previewSheet.Columns.Item($column).ColumnWidth = $sourceRange.Columns.Item($column).ColumnWidth
    }
    for ($row = 1; $row -le $sourceRange.Rows.Count; $row++) {
      $previewSheet.Rows.Item($row).RowHeight = $sourceRange.Rows.Item($row).RowHeight
    }

    $previewSheet.Activate()
    $previewSheet.Range("A1").Select()
    $previewWorkbook.SaveAs($OutputPath, 44)
    $previewWorkbook.Close($false)
  }
  finally {
    Release-ComObject $destination
    Release-ComObject $previewSheet
    Release-ComObject $previewWorkbook
    Release-ComObject $sourceRange
    Release-ComObject $sourceSheet
  }
}

$excel = $null
$workbook = $null

try {
  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $excel.EnableEvents = $false
  $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)

  Export-RangeAsHtml $excel $workbook 1 "A250:I340" (Join-Path $OutputDirectory "palpites.html")
  Export-RangeAsHtml $excel $workbook 2 "A1:I30" (Join-Path $OutputDirectory "ranking.html")
  Export-RangeAsHtml $excel $workbook 3 "A1:D28" (Join-Path $OutputDirectory "pagamento.html")
  Export-RangeAsHtml $excel $workbook 4 "A1:F9" (Join-Path $OutputDirectory "instrucoes.html")
}
finally {
  if ($workbook) {
    $workbook.Close($false)
    Release-ComObject $workbook
  }
  if ($excel) {
    $excel.Quit()
    Release-ComObject $excel
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
