$ErrorActionPreference = 'Stop'
$docPath = (Resolve-Path "$PSScriptRoot\BuildMate_Ghana_Capstone_Report.docx").Path
$pdfPath = "$PSScriptRoot\rendered\BuildMate_Ghana_Capstone_Report.pdf"
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
