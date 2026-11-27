# Tải ảnh minh hoạ (Unsplash) về web/public/images để web hiển thị ảnh cả khi không có mạng.
# Chạy: powershell -ExecutionPolicy Bypass -File scripts/download-images.ps1
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dir = Join-Path $root 'web/public/images'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$photos = [ordered]@{
  'hero' = 'photo-1514513452089-17f8a9771ee8'
  'auth' = 'photo-1536925155833-43e9c2b2f499'
  'exams' = 'photo-1606326608606-aa0b62935f2b'
  'learning' = 'photo-1513475382585-d06e58bcb0e0'
  'vocabulary' = 'photo-1457369804613-52c61a468e7d'
  'history' = 'photo-1454165804606-c3d57bc86b40'
  'exam-full' = 'photo-1534644107580-3a4dbd494a95'
  'exam-mini' = 'photo-1501504905252-473c47e087f8'
  'exam-practice' = 'photo-1462642109801-4ac2971a3a51'
  'exam-listening' = 'photo-1505740420928-5e560c06d30e'
  'exam-reading' = 'photo-1544716278-ca5e3f4abd8c'
  'exam-grammar' = 'photo-1550592704-6c76defa9985'
  'part-1' = 'photo-1495707902641-75cac588d2e9'
  'part-2' = 'photo-1507537362848-9c7e70b7b5c1'
  'part-3' = 'photo-1517048676732-d65bc937f952'
  'part-4' = 'photo-1554446422-d05db23719d2'
  'part-5' = 'photo-1483546416237-76fd26bbcdd1'
  'part-6' = 'photo-1486312338219-ce68d2c6f44d'
  'part-7' = 'photo-1504711434969-e33886168f5c'
}
$ProgressPreference = 'SilentlyContinue'
foreach ($name in $photos.Keys) {
  $out = Join-Path $dir ($name + '.jpg')
  if (Test-Path $out) { Write-Output "Đã có: $name"; continue }
  $url = 'https://images.unsplash.com/' + $photos[$name] + '?auto=format&fit=crop&w=1600&q=72&fm=jpg'
  try { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing; Write-Output "Đã tải: $name" }
  catch { Write-Warning "Không tải được $name : $($_.Exception.Message)" }
}
Write-Output 'Xong. Ảnh nằm trong web/public/images.'
