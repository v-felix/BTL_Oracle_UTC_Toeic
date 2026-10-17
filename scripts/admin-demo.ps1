param()
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$utf8 = New-Object Text.UTF8Encoding($false)
$startedAt = [DateTime]::UtcNow.ToString('o')
$runName = Get-Date -Format 'yyyyMMdd_HHmmss'
$logDirectory = Join-Path $projectRoot '.local/oracle-admin'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logPath = Join-Path $logDirectory "sandbox_$runName.log"
$demoPassword = 'T' + [Guid]::NewGuid().ToString('N').Substring(0,22) + '9a'

function Invoke-DemoSql([string]$Sql, [string]$Connection = 'connect / as sysdba', [switch]$AllowExpectedDenial) {
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = 'sqlplus.exe'; $psi.Arguments = '-S -L /nolog'; $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true; $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = $utf8; $psi.StandardErrorEncoding = $utf8
    $psi.EnvironmentVariables['NLS_LANG'] = 'AMERICAN_AMERICA.AL32UTF8'
    $process = New-Object Diagnostics.Process; $process.StartInfo = $psi
    [void]$process.Start()
    $process.StandardInput.WriteLine("set echo off verify off pagesize 100 linesize 240 trimspool on`nwhenever oserror exit failure`nwhenever sqlerror exit sql.sqlcode rollback`n$Connection`n$Sql`nexit")
    $process.StandardInput.Close()
    $outTask = $process.StandardOutput.ReadToEndAsync(); $errTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $output = ($outTask.Result + $errTask.Result).Replace($demoPassword, '[redacted]')
    [IO.File]::AppendAllText($logPath, $output + "`r`n", $utf8)
    if ($AllowExpectedDenial) {
        if ($output -notmatch 'ORA-00942' -or $output -match 'ORA-(?!00942)\d{5}|SP2-\d+') { throw 'Expected SELECT denial was not observed. Inspect the local log.' }
    } elseif ($process.ExitCode -ne 0 -or $output -match 'ORA-\d+|SP2-\d+') {
        throw "Oracle sandbox step failed. Inspect $logPath."
    }
    return $output
}

# Refuse existing objects before acquiring ownership of any disposable sandbox.
$preflight = @'
SET HEADING OFF
DECLARE n NUMBER;
BEGIN
 SELECT (SELECT COUNT(*) FROM dba_tablespaces WHERE tablespace_name='TOEIC_ADMIN_DEMO')
      + (SELECT COUNT(*) FROM dba_users WHERE username='TOEIC_DEMO')
      + (SELECT COUNT(*) FROM dba_roles WHERE role='TOEIC_DEMO_READER')
      + (SELECT COUNT(*) FROM dba_profiles WHERE profile='TOEIC_DEMO_PROFILE') INTO n FROM dual;
 IF n<>0 THEN RAISE_APPLICATION_ERROR(-20997,'Existing sandbox must be reviewed; nothing changed'); END IF;
 SELECT COUNT(*) INTO n FROM dba_tables WHERE owner='TOEIC_OWNER';
 IF n<>14 THEN RAISE_APPLICATION_ERROR(-20998,'Expected 14 source tables'); END IF;
END;
/
SELECT 'TOEIC_DATA_FOLDER='||SUBSTR(name,1,INSTR(name,'\',-1)-1) FROM v$datafile WHERE file#=1;
SELECT name,open_mode,log_mode FROM v$database;
'@
$before = Invoke-DemoSql $preflight
if ($before -notmatch 'TOEIC_DATA_FOLDER=([^\r\n]+)') { throw 'Cannot resolve Oracle datafile folder.' }
$oracleDataRoot = [IO.Path]::GetFullPath($matches[1].Trim())
$demoDirectory = [IO.Path]::GetFullPath((Join-Path $oracleDataRoot 'toeic_admin_demo'))
if (-not $demoDirectory.StartsWith($oracleDataRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Sandbox directory is outside the Oracle data directory.' }
New-Item -ItemType Directory -Path (Join-Path $demoDirectory 'moved') -Force | Out-Null
if ((Get-ChildItem -LiteralPath $demoDirectory -Recurse -Filter '*.dbf').Count -gt 0) { throw 'Existing sandbox files were found; no Oracle objects were created.' }
$ownsSandbox = $true
$checks = [ordered]@{ tablespace = $false; userRoleProfile = $false; permittedSelect = $false; deniedPrivateSelect = $false; segmentsExtents = $false; cleanup = $false; sourceIntact = $false }
try {
    $tablespaceScript = Get-Content 'database/admin/02_tablespace_sandbox.sql' -Raw
    $safeDirectory = $demoDirectory.Replace("'", "''")
    $tablespaceScript = $tablespaceScript -replace '(?m)^DEFINE demo_dir = .*$', "DEFINE demo_dir = '$safeDirectory'"
    # These confirmations apply only to the fresh sandbox verified above.
    $tablespaceScript = $tablespaceScript.Replace("ACCEPT run_demo CHAR PROMPT 'Type CREATE_TOEIC_SANDBOX to create the demo tablespace: '", "DEFINE run_demo = 'CREATE_TOEIC_SANDBOX'")
    [void](Invoke-DemoSql $tablespaceScript); $checks.tablespace = $true
    $userScript = Get-Content 'database/admin/04_users_roles.sql' -Raw
    $userScript = $userScript.Replace("ACCEPT run_demo CHAR PROMPT 'Type CREATE_TOEIC_DEMO_USER to create the demo user/role/profile: '", "DEFINE run_demo = 'CREATE_TOEIC_DEMO_USER'")
    $userScript = $userScript.Replace("ACCEPT demo_password CHAR PROMPT 'New TOEIC_DEMO password (letters/digits/_/# only, at least 12 chars): ' HIDE", "DEFINE demo_password = '$demoPassword'")
    [void](Invoke-DemoSql $userScript); $checks.userRoleProfile = $true
    $demoConnection = 'connect TOEIC_DEMO/"' + $demoPassword + '"@localhost:1521/orcl'
    $permitted = Invoke-DemoSql "SELECT 'PERMITTED_ROWS='||COUNT(*) FROM TOEIC_OWNER.VW_TOEIC_EXAM_SUMMARY;" $demoConnection
    if ($permitted -notmatch 'PERMITTED_ROWS=\d+') { throw 'Role SELECT check did not return a count.' }
    $checks.permittedSelect = $true
    [void](Invoke-DemoSql 'SELECT * FROM TOEIC_OWNER.TOEIC_USERS;' $demoConnection -AllowExpectedDenial)
    $checks.deniedPrivateSelect = $true
    [void](Invoke-DemoSql (Get-Content 'database/admin/03_storage_segments_extents.sql' -Raw)); $checks.segmentsExtents = $true
} finally {
    if ($ownsSandbox) {
        $cleanupScript = (Get-Content 'database/admin/90_cleanup_sandbox.sql' -Raw).Replace("ACCEPT cleanup CHAR PROMPT 'Type DROP_TOEIC_SANDBOX to delete only the admin demo: '", "DEFINE cleanup = 'DROP_TOEIC_SANDBOX'")
        [void](Invoke-DemoSql $cleanupScript)
        $checks.cleanup = $true
    }
}
$after = Invoke-DemoSql @'
DECLARE n NUMBER;
BEGIN
 SELECT COUNT(*) INTO n FROM dba_tables WHERE owner='TOEIC_OWNER';
 IF n<>14 THEN RAISE_APPLICATION_ERROR(-20998,'Source table count changed'); END IF;
 SELECT COUNT(*) INTO n FROM dba_objects WHERE owner='TOEIC_OWNER' AND status='INVALID';
 IF n<>0 THEN RAISE_APPLICATION_ERROR(-20998,'Invalid source objects'); END IF;
 SELECT COUNT(*) INTO n FROM v$database WHERE open_mode='READ WRITE';
 IF n<>1 THEN RAISE_APPLICATION_ERROR(-20998,'Expected READ WRITE'); END IF;
 SELECT COUNT(*) INTO n FROM dba_tablespaces WHERE tablespace_name='TOEIC_ADMIN_DEMO';
 IF n<>0 THEN RAISE_APPLICATION_ERROR(-20998,'Sandbox tablespace remains'); END IF;
END;
/
SELECT name,open_mode,log_mode FROM v$database;
'@
$checks.sourceIntact = $true
$evidence = [ordered]@{
    startedAt = $startedAt; completedAt = [DateTime]::UtcNow.ToString('o'); passed = $true
    scope = 'Isolated TOEIC_ADMIN_DEMO tablespace and TOEIC_DEMO user only; no instance shutdown or physical recovery.'
    operations = @('create/add/resize datafile', 'disable/enable autoextend', 'online datafile move and move back', 'sandbox tablespace read only/read write', 'create/revoke/grant role', 'create user/profile/quota; lock/unlock', 'permitted view SELECT and expected ORA-00942 for private table', 'segment/extent inspection', 'drop own demo user/role/profile/tablespace and datafiles')
    checks = $checks; logFile = $logPath; sourceTables = 14; sourceInvalidObjects = 0; finalOpenMode = 'READ WRITE'
    instanceModeChangesExecuted = $false; physicalRmanExecuted = $false
}
[IO.File]::WriteAllText((Join-Path $projectRoot 'docs/admin-verification.json'), ($evidence | ConvertTo-Json -Depth 6), $utf8)
Write-Output "Oracle administration sandbox verified and cleaned. Evidence: docs/admin-verification.json. Log: $logPath"
