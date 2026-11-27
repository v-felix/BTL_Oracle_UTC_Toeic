param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $localDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $localDir 'nuget') -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Invoke-OracleSql([string]$sql, [bool]$sys = $true) {
 $psi = New-Object Diagnostics.ProcessStartInfo
 $psi.FileName = 'sqlplus.exe'; $psi.Arguments = '-S -L /nolog'; $psi.UseShellExecute = $false
 $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
 $psi.StandardOutputEncoding = $utf8; $psi.StandardErrorEncoding = $utf8; $psi.EnvironmentVariables['NLS_LANG'] = '.AL32UTF8'
 $process = New-Object Diagnostics.Process; $process.StartInfo = $psi; [void]$process.Start()
 $connection = if ($sys) { "connect / as sysdba`nalter session set container=FREEPDB1;" } else { 'connect TOEIC_OWNER/"' + $secrets.ownerPassword + '"@localhost:1521/FREEPDB1' }
 $process.StandardInput.WriteLine("set echo off verify off feedback off heading off pagesize 0 linesize 300 trimspool on`nwhenever oserror exit failure`nwhenever sqlerror exit sql.sqlcode rollback`n$connection`n$sql`nexit")
 $process.StandardInput.Close(); $outTask = $process.StandardOutput.ReadToEndAsync(); $errTask = $process.StandardError.ReadToEndAsync()
 $process.WaitForExit(); $output = $outTask.Result + $errTask.Result
 if ($secrets) { $output = $output.Replace($secrets.ownerPassword,'[redacted]').Replace($secrets.appPassword,'[redacted]') }
 if ($process.ExitCode -ne 0 -or $output -match 'ORA-\d+|SP2-\d+') { throw "Oracle command failed: $output" }
 return $output.Trim()
}
$secretsFile = Join-Path $localDir 'secrets.json'
if (Test-Path -LiteralPath $secretsFile) { $secrets = Get-Content -LiteralPath $secretsFile -Raw | ConvertFrom-Json }
else {
 $existing = Invoke-OracleSql "select count(*) from dba_users where username in ('TOEIC_OWNER','TOEIC_APP');"
 if ([int]$existing -gt 0) { throw 'TOEIC schema already exists but this checkout has no local credentials. No existing account was modified.' }
 $secrets = [pscustomobject]@{ ownerPassword=('T!'+[Guid]::NewGuid().ToString('N').Substring(0,22)+'9a'); appPassword=('T!'+[Guid]::NewGuid().ToString('N').Substring(0,22)+'9a') }
 [IO.File]::WriteAllText($secretsFile,($secrets | ConvertTo-Json),$utf8)
}
if ($secrets.ownerPassword.Length -gt 30) {
 $existing = Invoke-OracleSql "select count(*) from dba_users where username in ('TOEIC_OWNER','TOEIC_APP');"
 if ([int]$existing -ne 0) { throw 'Legacy local password length requires manual account review.' }
 $secrets.ownerPassword='T!'+[Guid]::NewGuid().ToString('N').Substring(0,22)+'9a'
 $secrets.appPassword='T!'+[Guid]::NewGuid().ToString('N').Substring(0,22)+'9a'
 [IO.File]::WriteAllText($secretsFile,($secrets | ConvertTo-Json),$utf8)
}
$baseFile = Invoke-OracleSql 'select min(name) from v$datafile;'
$dataFolder = [IO.Path]::GetDirectoryName($baseFile.Trim())
$dataFile = (Join-Path $dataFolder 'toeic_data01.dbf').Replace("'","''")
$bootstrap = @"
declare v_count number;
begin
 select count(*) into v_count from dba_tablespaces where tablespace_name='TOEIC_DATA';
 if v_count=0 then execute immediate 'create tablespace TOEIC_DATA datafile ''$dataFile'' size 64M autoextend on next 16M maxsize 512M'; end if;
 select count(*) into v_count from dba_users where username='TOEIC_OWNER';
 if v_count=0 then execute immediate 'create user TOEIC_OWNER identified by "$( $secrets.ownerPassword )" default tablespace TOEIC_DATA temporary tablespace TEMP quota 256M on TOEIC_DATA'; end if;
 select count(*) into v_count from dba_users where username='TOEIC_APP';
 if v_count=0 then execute immediate 'create user TOEIC_APP identified by "$( $secrets.appPassword )" default tablespace TOEIC_DATA temporary tablespace TEMP'; end if;
 select count(*) into v_count from dba_roles where role='TOEIC_RUNTIME';
 if v_count=0 then execute immediate 'create role TOEIC_RUNTIME'; end if;
end;
/
grant create session,create table,create view,create procedure,create trigger,create sequence to TOEIC_OWNER;
grant create session,TOEIC_RUNTIME to TOEIC_APP;
grant select on sys.v_`$instance to TOEIC_OWNER with grant option;
grant select on sys.v_`$database to TOEIC_OWNER with grant option;
grant select on sys.dba_data_files to TOEIC_OWNER with grant option;
grant select on sys.dba_segments to TOEIC_OWNER with grant option;
grant select on sys.user_tab_privs_made to TOEIC_OWNER with grant option;
grant select on sys.dba_tab_privs to TOEIC_OWNER with grant option;
"@
[void](Invoke-OracleSql $bootstrap)
$installed = Invoke-OracleSql "select count(*) from user_tables where table_name='TOEIC_USERS';" $false
if ([int]$installed -eq 0) {
 Write-Output 'Creating Oracle tables, constraints, indexes, views and audit triggers...'
 [void](Invoke-OracleSql (Get-Content -LiteralPath 'database/01_schema.sql' -Raw) $false)
}
[void](Invoke-OracleSql (Get-Content -LiteralPath 'database/02_packages.sql' -Raw) $false)
$tables = @('ROLES','USERS','GROUPS','QUESTIONS','CHOICES','EXAMS','EXAM_ITEMS','ATTEMPTS','ANSWERS','LESSONS','VOCABULARY','SAVED_WORDS','AUDIT','SCORE_SCALE')
$union = ($tables | ForEach-Object { "select 'TOEIC_$_' table_name,count(*) row_count from toeic_$_" }) -join "`nunion all`n"
$views = @"
create or replace view vw_toeic_instance as select i.instance_name,i.status instance_status,i.version,d.name database_name,d.open_mode,d.log_mode from sys.v_`$instance i cross join sys.v_`$database d;
create or replace view vw_toeic_datafiles as select tablespace_name,file_name,round(bytes/1024/1024,2) size_mb,autoextensible,round(maxbytes/1024/1024,2) max_mb from sys.dba_data_files where tablespace_name='TOEIC_DATA';
create or replace view vw_toeic_segments as select segment_name,segment_type,round(bytes/1024/1024,3) size_mb,extents from sys.dba_segments where owner='TOEIC_OWNER';
create or replace view vw_toeic_table_counts as $union;
create or replace view vw_toeic_privileges as select grantee,table_name,privilege from sys.dba_tab_privs where owner='TOEIC_OWNER' and grantee='TOEIC_RUNTIME';
"@
[void](Invoke-OracleSql $views $false)
foreach ($table in $tables) { [void](Invoke-OracleSql "grant select,insert,update,delete on toeic_$table to TOEIC_RUNTIME;" $false) }
foreach ($view in @('VW_TOEIC_EXAM_SUMMARY','VW_TOEIC_USER_PROGRESS','VW_TOEIC_INSTANCE','VW_TOEIC_DATAFILES','VW_TOEIC_SEGMENTS','VW_TOEIC_TABLE_COUNTS','VW_TOEIC_PRIVILEGES')) { [void](Invoke-OracleSql "grant select on $view to TOEIC_RUNTIME;" $false) }
[void](Invoke-OracleSql 'grant execute on pkg_toeic to TOEIC_RUNTIME;' $false)
$compileErrors = Invoke-OracleSql "select count(*) from user_errors;" $false
if ([int]$compileErrors -ne 0) { throw 'Oracle objects have compilation errors. Inspect USER_ERRORS before proceeding.' }
$config = @{ConnectionStrings=@{Oracle=('User Id=TOEIC_APP;Password='+$secrets.appPassword+';Data Source=localhost:1521/FREEPDB1;Pooling=true;Min Pool Size=1;Max Pool Size=20;')}}
[IO.File]::WriteAllText((Join-Path $projectRoot 'server/Toeic.Api/appsettings.Local.json'),($config | ConvertTo-Json -Depth 4),$utf8)
if (-not $SkipInstall) { & npm.cmd install --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm install failed' } }
& dotnet restore server/Toeic.Api/Toeic.Api.csproj
if ($LASTEXITCODE -ne 0) { throw 'dotnet restore failed' }
$previousConnection = $env:ConnectionStrings__Oracle
try {
 $env:ConnectionStrings__Oracle = 'User Id=TOEIC_OWNER;Password='+$secrets.ownerPassword+';Data Source=localhost:1521/FREEPDB1;Pooling=false;'
 & dotnet run --project server/Toeic.Api --no-launch-profile -- --seed
 if ($LASTEXITCODE -ne 0) { throw 'Seed failed' }
} finally { $env:ConnectionStrings__Oracle = $previousConnection }
[void](Invoke-OracleSql "begin dbms_stats.gather_schema_stats('TOEIC_OWNER'); end;`n/")
Write-Output 'Oracle ready. Run npm run dev. Demo login: admin / Admin@2026 or student / Student@2026.'
