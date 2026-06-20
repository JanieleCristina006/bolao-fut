param(
  [Parameter(Mandatory = $true)]
  [string]$WorkbookPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$excel = $null
$workbook = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($WorkbookPath, 0, $true)

  $result = [ordered]@{
    workbook = $WorkbookPath
    sheets = @()
  }

  foreach ($sheet in $workbook.Worksheets) {
    $used = $sheet.UsedRange
    $rows = [int]$used.Rows.Count
    $cols = [int]$used.Columns.Count
    $startRow = [int]$used.Row
    $startCol = [int]$used.Column
    $values = $used.Value2
    $formulas = $used.Formula
    $cells = @()

    for ($rowOffset = 1; $rowOffset -le $rows; $rowOffset++) {
      $rowValues = @()
      for ($colOffset = 1; $colOffset -le $cols; $colOffset++) {
        if ($rows -eq 1 -and $cols -eq 1) {
          $value = $values
          $formula = $formulas
        } else {
          $value = $values[$rowOffset, $colOffset]
          $formula = $formulas[$rowOffset, $colOffset]
        }
        if ($null -ne $value -or ($formula -is [string] -and $formula.StartsWith("="))) {
          $row = $startRow + $rowOffset - 1
          $col = $startCol + $colOffset - 1
          $address = $sheet.Cells.Item($row, $col).Address($false, $false)
          $rowValues += [ordered]@{
            address = [string]$address
            value = $value
            formula = if ($formula -is [string] -and $formula.StartsWith("=")) { [string]$formula } else { $null }
          }
        }
      }
      if ($rowValues.Count -gt 0) {
        $cells += ,$rowValues
      }
    }

    $columnWidths = @()
    for ($col = $startCol; $col -lt ($startCol + $cols); $col++) {
      $column = $sheet.Columns.Item($col)
      $columnWidths += [ordered]@{
        column = $col
        width = [double]$column.ColumnWidth
      }
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($column)
    }

    $result.sheets += [ordered]@{
      name = [string]$sheet.Name
      usedRange = [string]$used.Address($false, $false)
      rows = $rows
      columns = $cols
      startRow = $startRow
      startColumn = $startCol
      cells = $cells
      columnWidths = $columnWidths
    }

    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($used)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet)
  }

  $json = $result | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))
}
finally {
  if ($workbook) {
    $workbook.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
  }
  if ($excel) {
    $excel.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
