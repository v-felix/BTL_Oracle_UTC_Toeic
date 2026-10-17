$ErrorActionPreference='Stop'
$publishDirectory=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.local/publish'))
if(-not(Test-Path -LiteralPath (Join-Path $publishDirectory 'Toeic.Api.dll'))){throw 'Run npm run release first.'}
Set-Location -LiteralPath $publishDirectory
$env:ASPNETCORE_ENVIRONMENT='Production'
& dotnet Toeic.Api.dll --urls http://127.0.0.1:5080
