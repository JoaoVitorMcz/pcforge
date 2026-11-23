<#
Script para gerar certificados TLS de desenvolvimento usando mkcert.
Uso: execute na raiz do repositório com PowerShell (Admin se necessário).
Requisitos: mkcert instalado (https://github.com/FiloSottile/mkcert)

This script creates `certs/pcforge.local.crt` and `certs/pcforge.local.key`.
#>

param()

Set-StrictMode -Version Latest

$certDir = Join-Path -Path $PSScriptRoot -ChildPath "..\certs"
$certDir = Resolve-Path -Path $certDir -ErrorAction SilentlyContinue | ForEach-Object { $_.Path } 
if (-not $certDir) {
  $certDir = Join-Path -Path $PSScriptRoot -ChildPath "..\certs"
  New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

Write-Host "Certificados serão gerados em: $certDir"

function Exec-Mkcert {
  Write-Host "Verificando mkcert..."
  $mkcert = Get-Command mkcert -ErrorAction SilentlyContinue
  if (-not $mkcert) {
    Write-Host "mkcert não encontrado no PATH." -ForegroundColor Yellow
    return $false
  }

  Write-Host "Instalando CA local (mkcert -install)..."
  mkcert -install

  $crt = Join-Path $certDir "pcforge.local.crt"
  $key = Join-Path $certDir "pcforge.local.key"

  Write-Host "Gerando certificados para: localhost, 127.0.0.1, pcforge.local"
  mkcert -cert-file $crt -key-file $key localhost 127.0.0.1 pcforge.local

  if (Test-Path $crt -and Test-Path $key) {
    Write-Host "Certificados gerados com sucesso:" -ForegroundColor Green
    Write-Host "  $crt"
    Write-Host "  $key"
    return $true
  }

  Write-Host "Falha ao gerar certificados com mkcert." -ForegroundColor Red
  return $false
}

function Exec-DockerOpenSslFallback {
  Write-Host "mkcert não encontrado. Tentando fallback com Docker + OpenSSL..."
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $docker) {
    Write-Host "Docker não encontrado no PATH. Instale Docker Desktop e tente novamente." -ForegroundColor Yellow
    return $false
  }

  $crt = Join-Path $certDir "pcforge.local.crt"
  $key = Join-Path $certDir "pcforge.local.key"

  $dockerArgs = @(
    'run',
    '--rm',
    '-v', "$($certDir):/certs",
    '-w', '/certs',
    'alpine',
    'sh',
    '-c',
    "apk add --no-cache openssl >/dev/null 2>&1 && openssl req -x509 -nodes -newkey rsa:2048 -keyout /certs/pcforge.local.key -out /certs/pcforge.local.crt -days 365 -subj '/CN=pcforge.local' -addext 'subjectAltName=DNS:localhost,DNS:pcforge.local,IP:127.0.0.1'"
  )

  & docker @dockerArgs

  if ($LASTEXITCODE -ne 0) {
    Write-Host "O comando Docker/OpenSSL falhou com código $LASTEXITCODE." -ForegroundColor Red
    return $false
  }

  if (-not (Test-Path $crt) -or -not (Test-Path $key)) {
    Write-Host "Os arquivos de certificado não foram encontrados após a execução." -ForegroundColor Red
    return $false
  }

  Write-Host "Certificados gerados com sucesso usando Docker/OpenSSL:" -ForegroundColor Green
  Write-Host "  $crt"
  Write-Host "  $key"
  return $true
}

if (Exec-Mkcert) {
  exit 0
}
elseif (Exec-DockerOpenSslFallback) {
  Write-Host "Aviso: o certificado gerado via Docker/OpenSSL não é confiável pelo navegador. Para remover o aviso de site não seguro, instale mkcert e execute o script novamente." -ForegroundColor Yellow
  exit 0
}
else {
  Write-Host "mkcert e fallback Docker/OpenSSL não funcionaram. Instale mkcert ou Docker para gerar os certificados." -ForegroundColor Red
  Write-Host "Para remover o aviso de site não seguro, instale mkcert e execute: mkcert -install" -ForegroundColor Yellow
  Write-Host "Se preferir instalar mkcert no Windows, use: choco install mkcert -y" -ForegroundColor Yellow
  exit 1
}
