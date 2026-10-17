$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')
& npm.cmd run build
if($LASTEXITCODE -ne 0){throw 'Build failed'}
& npm.cmd test
if($LASTEXITCODE -ne 0){throw 'Integration tests failed; ensure the Oracle-backed API is running.'}
& npm.cmd audit
if($LASTEXITCODE -ne 0){throw 'npm audit reported vulnerabilities'}
$previousLanguage = $env:DOTNET_CLI_UI_LANGUAGE
try {
    $env:DOTNET_CLI_UI_LANGUAGE = 'en-US'
    $nugetAudit = & dotnet list server/Toeic.Api/Toeic.Api.csproj package --vulnerable --include-transitive | Out-String
    $nugetAuditExitCode = $LASTEXITCODE
} finally { $env:DOTNET_CLI_UI_LANGUAGE = $previousLanguage }
Write-Output $nugetAudit
if($nugetAuditExitCode -ne 0 -or $nugetAudit -notmatch 'has no vulnerable packages'){throw 'NuGet audit did not confirm that all packages are free of known vulnerabilities'}
& node scripts/record-verification.mjs
if($LASTEXITCODE -ne 0){throw 'Unable to record verification evidence'}
Write-Output 'Build, Oracle integration tests and package checks completed.'
