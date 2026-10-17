$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
& npm.cmd run build
if($LASTEXITCODE -ne 0){throw 'Build failed'}
& dotnet publish server/Toeic.Api/Toeic.Api.csproj -c Release -o .local/publish --no-restore
if($LASTEXITCODE -ne 0){throw 'Publish failed'}
Write-Output 'Published application: .local/publish. Stop the dev server, then run npm run serve.'
