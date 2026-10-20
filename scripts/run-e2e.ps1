# 端到端冒烟测试（PowerShell 版，无需 bash）
# 前置：docker compose up --build 已启动且 app 健康
param($BaseUrl = "http://localhost:3000")

function Get-Code($path, $method="GET", $body=$null) {
  try {
    $r = Invoke-WebRequest -Uri "$BaseUrl$path" -Method $method `
      -ContentType "application/json" -Body $body -UseBasicParsing -ErrorAction Stop
    return [int]$r.StatusCode
  } catch [System.Net.WebException] {
    return [int]$_.Exception.Response.StatusCode
  }
}

Write-Host "==> 健康检查"
try { $h = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing; Write-Host " [health $($h.StatusCode) ok]" } catch { Write-Host " [health FAIL]" }

Write-Host "==> 未登录 /api/dashboard (期望 401)"
$c = Get-Code "/api/dashboard"
Write-Host " [$c $(if($c -eq 401){'auth guard ok'}else{'WARN 期望401'})]"

Write-Host "==> 未登录 POST /api/chat (期望 401)"
$c = Get-Code "/api/chat" "POST" '{"messages":[]}'
Write-Host " [$c $(if($c -eq 401){'auth guard ok'}else{'WARN 期望401'})]"

Write-Host "==> 限流测试：连发 /api/health 应出现 429"
$hit = $false
for ($i=1; $i -le 200; $i++) {
  $c = Get-Code "/api/health"
  if ($c -eq 429) { Write-Host " [rate limit ok: 429 at #$i]"; $hit=$true; break }
}
if (-not $hit) { Write-Host " [WARN 未观察到 429]" }

Write-Host "==> 端到端冒烟完成"
