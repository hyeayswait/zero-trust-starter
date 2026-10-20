# 校验 .env 必填项（不输出 key 明文）
$required = @("APP_SECRET","OIDC_ISSUER","OIDC_CLIENT_ID","OIDC_CLIENT_SECRET","REDIS_URL","DATABASE_URL")
$missing = @()
if (-not (Test-Path ".env")) {
  Write-Host "[FAIL] 找不到 .env，请先 cp .env.example .env 并填写" -ForegroundColor Red
  exit 1
}
$envRaw = Get-Content ".env" | Where-Object { $_ -match "^\s*[^#].*=" }
$map = @{}
foreach ($line in $envRaw) {
  $k, $v = $line -split "=", 2
  $map[$k.Trim()] = $v.Trim()
}
foreach ($k in $required) {
  $v = $map[$k]
  if (-not $v -or $v -match "change-me|your-") {
    $missing += $k
  }
}
if ($missing.Count -gt 0) {
  Write-Host "[FAIL] 以下项未正确填写: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}
if ($map["APP_SECRET"].Length -lt 32) {
  Write-Host "[FAIL] APP_SECRET 长度必须 >= 32" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] .env 必填项已填写，APP_SECRET 长度 = $($map['APP_SECRET'].Length)" -ForegroundColor Green
