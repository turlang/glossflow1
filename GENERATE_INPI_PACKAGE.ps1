param(
  [string]$TargetCommit = "58ce16ed8321d913f155f7f5bf29786ca50a4af1",
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$Repository = "turlang/glossflow1"
$ProjectSlug = "glossflow1"

function Assert-Exit([string]$Message) {
  if ($LASTEXITCODE -ne 0) { throw $Message }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git não foi encontrado no PATH."
}

if (-not $OutputDir) {
  $OutputDir = Join-Path $env:USERPROFILE "Documents\INPI-Evidence\GlossFlow1"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

git cat-file -e "$TargetCommit^{commit}" 2>$null
if ($LASTEXITCODE -ne 0) {
  git fetch origin $TargetCommit
  Assert-Exit "Não foi possível buscar o commit de baseline."
}

$Short = $TargetCommit.Substring(0, 12)
$Archive = Join-Path $OutputDir "$ProjectSlug-inpi-$Short.zip"
$HashFile = "$Archive.sha256"
$FileList = Join-Path $OutputDir "$ProjectSlug-inpi-$Short-files.txt"
$Metadata = Join-Path $OutputDir "$ProjectSlug-inpi-$Short-metadata.txt"

if (Test-Path $Archive) { Remove-Item $Archive -Force }

git archive --format=zip --output "$Archive" $TargetCommit
Assert-Exit "Falha ao gerar o ZIP da baseline."

git ls-tree -r --name-only $TargetCommit | Set-Content -Encoding UTF8 $FileList
Assert-Exit "Falha ao gerar a lista de arquivos rastreados."

$Hash = Get-FileHash -Path $Archive -Algorithm SHA256
"$($Hash.Hash)  $([System.IO.Path]::GetFileName($Archive))" | Set-Content -Encoding ASCII $HashFile

@(
  "INPI SOFTWARE EVIDENCE PACKAGE"
  "Repository: $Repository"
  "Baseline commit: $TargetCommit"
  "Archive: $([System.IO.Path]::GetFileName($Archive))"
  "Algorithm: SHA-256"
  "SHA-256: $($Hash.Hash)"
  "Generated UTC: $([DateTime]::UtcNow.ToString('o'))"
  "Generated local: $([DateTime]::Now.ToString('o'))"
  ""
  "IMPORTANT: keep the ZIP exactly as generated. Any byte change invalidates this hash."
  "Do not publish this evidence package unless intentionally required."
) | Set-Content -Encoding UTF8 $Metadata

Write-Host "Pacote INPI gerado com sucesso:"
Write-Host "  ZIP:      $Archive"
Write-Host "  SHA-256:  $HashFile"
Write-Host "  Arquivos: $FileList"
Write-Host "  Metadados:$Metadata"
Write-Host ""
Write-Host "HASH PARA O E-SOFTWARE: $($Hash.Hash)"