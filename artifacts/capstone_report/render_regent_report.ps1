$ErrorActionPreference = 'Stop'
$docPath = (Resolve-Path "$PSScriptRoot\BuildMate_Ghana_Regent_Capstone_Report.docx").Path
$renderDir = "$PSScriptRoot\regent-rendered"
$pdfPath = "$renderDir\BuildMate_Ghana_Regent_Capstone_Report_Final.pdf"
New-Item -ItemType Directory -Force -Path $renderDir | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$word.Options.ConfirmConversions = $false
try {
  $document = $word.Documents.Open($docPath, $false, $true, $false)
  $document.ExportAsFixedFormat($pdfPath, 17)
  $document.Close(0)
} finally {
  $word.Quit()
}
Get-Item -LiteralPath $pdfPath | Select-Object FullName, Length
