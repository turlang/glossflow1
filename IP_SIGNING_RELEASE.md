# Assinatura, Release e Proveniência

Este documento complementa a camada de evidência de propriedade intelectual do projeto.

## Objetivo

O fluxo recomendado é:

1. manter commits e tags assinados;
2. criar uma tag assinada para uma versão protegida;
3. enviar a tag ao GitHub;
4. deixar `.github/workflows/ip-provenance.yml` gerar automaticamente:
   - um ZIP exato do commit marcado;
   - um arquivo SHA-256;
   - um artefato do GitHub Actions;
   - uma attestation Sigstore;
   - um GitHub Release com o ZIP e o checksum.

## Configurar assinatura SSH no Git para Windows

O GitHub aceita assinaturas de commits e tags com GPG, SSH ou S/MIME. Para uma configuração simples no Windows, use uma chave SSH de assinatura já cadastrada no GitHub.

No PowerShell, ajuste o caminho se sua chave tiver outro nome:

```powershell
git config --global gpg.format ssh
git config --global user.signingkey "$HOME/.ssh/id_ed25519.pub"
git config --global commit.gpgsign true
git config --global tag.gpgSign true
```

A chave pública correspondente deve estar cadastrada no GitHub como **Signing Key** em `Settings > SSH and GPG keys`.

## Verificar a configuração

```powershell
git config --global --get gpg.format
git config --global --get user.signingkey
git config --global --get commit.gpgsign
git config --global --get tag.gpgSign
```

## Criar a tag assinada

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git tag -s ip-provenance-2026-08-24 -m "IP provenance baseline 2026-08-24" <COMMIT_SHA>
git tag -v ip-provenance-2026-08-24
git push origin ip-provenance-2026-08-24
```

O push dispara o workflow `IP Provenance`.

## Resultado esperado

```text
glossflow1-ip-provenance-2026-08-24-<sha12>.zip
glossflow1-ip-provenance-2026-08-24-<sha12>.zip.sha256
```

Como este repositório é público, o workflow também gera uma attestation Sigstore vinculando o pacote ao repositório, workflow e commit que o produziram.

## Verificação

Compare o SHA-256 publicado:

```powershell
Get-FileHash .\glossflow1-ip-provenance-2026-08-24-<sha12>.zip -Algorithm SHA256
```

A attestation pode ser verificada com GitHub CLI quando o pacote estiver disponível:

```powershell
gh attestation verify .\glossflow1-ip-provenance-2026-08-24-<sha12>.zip --repo turlang/glossflow1
```

## Política

- Não reutilize uma tag para outro commit.
- Não force atualização de tags de evidência.
- Preserve releases, checksums e attestations associados.
- Crie nova tag para cada baseline comercial ou jurídica relevante.
- Mantenha a baseline histórica `ip-baseline-2026-08-24` intacta.

## Limite

Assinatura Git, SHA-256, releases e attestations fortalecem autenticidade, integridade e rastreabilidade técnica. Eles não substituem registro formal, contratos de cessão ou documentação exigida por autoridade competente.
