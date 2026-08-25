param(
  [string]$Tag = "ip-provenance-2026-08-24",
  [switch]$Push
)

$ErrorActionPreference = "Stop"
$Repository = "turlang/glossflow1"
$TargetCommit = "8728dd3a53caa5ed892957933c129fcae4985f62"

function Assert-LastExitCode([string]$Message) {
  if ($LASTEXITCODE -ne 0) { throw $Message }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "Git não foi encontrado no PATH."
}

Write-Host "Repositório: $Repository"
Write-Host "Commit de proveniência: $TargetCommit"
Write-Host "Tag: $Tag"

git fetch origin --tags
Assert-LastExitCode "Falha ao atualizar referências do GitHub."

git cat-file -e "$TargetCommit^{commit}" 2>$null
Assert-LastExitCode "O commit de proveniência não está disponível localmente. Execute git fetch origin."

$SigningKey = (git config --get user.signingkey 2>$null)
if (-not $SigningKey) {
  throw "Nenhuma chave de assinatura foi configurada. Consulte IP_SIGNING_RELEASE.md."
}

$ExistingTag = (git tag --list $Tag)
if ($ExistingTag) {
  $ExistingTarget = (git rev-list -n 1 $Tag).Trim()
  if ($ExistingTarget -ne $TargetCommit) {
    throw "A tag $Tag já existe e aponta para outro commit. Não force nem reutilize tags de evidência."
  }
  Write-Host "A tag já existe localmente e aponta para o commit correto."
} else {
  git tag -s $Tag $TargetCommit -m "IP provenance baseline 2026-08-24 - $Repository"
  Assert-LastExitCode "Não foi possível criar a tag assinada. Verifique sua chave de assinatura."
  Write-Host "Tag assinada criada."
}

Write-Host "Commit apontado pela tag: $((git rev-list -n 1 $Tag).Trim())"

if ($Push) {
  git push origin $Tag
  Assert-LastExitCode "Falha ao enviar a tag para o GitHub."
  Write-Host "Tag enviada. O workflow IP Provenance deverá iniciar no GitHub Actions."
} else {
  Write-Host "Tag ainda não enviada. Para publicar e disparar o workflow, execute:"
  Write-Host ".\CREATE_SIGNED_IP_TAG.ps1 -Push"
}
