# 一键推送到 GitHub + Gitee
# 用法: .\scripts\push-all.ps1
# 前置: 已 git remote add origin <github> 和 git remote add gitee <gitee>
param(
  [string]$Branch = "main"
)
$ErrorActionPreference = "Stop"

function Need-Remote($name, $example) {
  $have = git remote get-url $name 2>$null
  if (-not $have) {
    Write-Host "[WARN] 未配置远程 '$name'。请先执行:" -ForegroundColor Yellow
    Write-Host "  git remote add $name $example" -ForegroundColor Cyan
    return $false
  }
  Write-Host "[OK] 远程 $name -> $have"
  return $true
}

Write-Host "==> 校验工作区干净"
$st = git status --short
if ($st) { Write-Host "[FAIL] 有未提交改动:`n$st"; exit 1 }

$okG = Need-Remote "origin" "git@github.com:<you>/zero-trust-starter.git"
$okE = Need-Remote "gitee"  "git@gitee.com:<you>/zero-trust-starter.git"
if (-not ($okG -or $okE)) { exit 1 }

if ($okG) { Write-Host "==> 推送 origin/$Branch"; git push -u origin $Branch }
if ($okE) { Write-Host "==> 推送 gitee/$Branch";  git push -u gitee  $Branch }

Write-Host "==> 完成。记得去仓库页填简介/标签/README 链接，并录 demo GIF"
