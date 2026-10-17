param()
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$utf8=New-Object Text.UTF8Encoding($false)
$networkDir=Join-Path $projectRoot '.local/oracle-net'
New-Item -ItemType Directory -Path $networkDir -Force|Out-Null
[IO.File]::WriteAllText((Join-Path $networkDir 'tnsnames.ora'),'TOEIC_LOCAL=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=127.0.0.1)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=orcl)))',$utf8)
$secretsPath=Join-Path $projectRoot '.local/secrets.json'
if(-not(Test-Path -LiteralPath $secretsPath)){throw 'Run npm run setup first.'}
$secrets=Get-Content -LiteralPath $secretsPath -Raw|ConvertFrom-Json
if(-not $secrets.PSObject.Properties['backupPassword']){$secrets|Add-Member -NotePropertyName backupPassword -NotePropertyValue ('T!'+[Guid]::NewGuid().ToString('N').Substring(0,22)+'9a');[IO.File]::WriteAllText($secretsPath,($secrets|ConvertTo-Json),$utf8)}
function Invoke-LocalProcess([string]$exe,[string]$arguments,[string]$inputText){
 $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=$exe;$psi.Arguments=$arguments;$psi.UseShellExecute=$false;$psi.RedirectStandardInput=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.StandardOutputEncoding=$utf8;$psi.StandardErrorEncoding=$utf8;$psi.EnvironmentVariables['NLS_LANG']='.AL32UTF8';$psi.EnvironmentVariables['TNS_ADMIN']=$networkDir
 $process=New-Object Diagnostics.Process;$process.StartInfo=$psi;[void]$process.Start();$process.StandardInput.WriteLine($inputText);$process.StandardInput.Close();$out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync();$process.WaitForExit();$text=($out.Result+$err.Result).Replace($secrets.backupPassword,'[redacted]')
 if($process.ExitCode -ne 0){throw "$exe failed (exit $($process.ExitCode)): $text"};return $text
}
function Sql([string]$text){$out=Invoke-LocalProcess 'sqlplus.exe' '-S -L /nolog' ("set echo off verify off feedback off heading off pagesize 0 linesize 300`nwhenever sqlerror exit sql.sqlcode rollback`nconnect / as sysdba`n"+$text+"`nexit");if($out -match 'ORA-\d+|SP2-\d+'){throw $out};return $out.Trim()}
$folder=Join-Path $projectRoot '.local/oracle-backup/datapump';New-Item -ItemType Directory -Path $folder -Force|Out-Null
$baseFile=Sql 'select name from v$datafile where file#=1;';$restoreFile=(Join-Path ([IO.Path]::GetDirectoryName($baseFile)) 'toeic_restore01.dbf').Replace("'","''");$safeFolder=$folder.Replace("'","''")
$prepare=@"
declare n number; v_path varchar2(4000);
begin
 select count(*) into n from dba_users where username='TOEIC_BACKUP';
 if n=0 then execute immediate 'create user TOEIC_BACKUP identified by "$( $secrets.backupPassword )" default tablespace USERS temporary tablespace TEMP'; end if;
 select count(*) into n from dba_directories where directory_name='TOEIC_DP_DIR';
 if n=0 then execute immediate 'create directory TOEIC_DP_DIR as ''$safeFolder''';
 else select directory_path into v_path from dba_directories where directory_name='TOEIC_DP_DIR';if upper(v_path)<>upper('$safeFolder') then raise_application_error(-20991,'Directory name already points elsewhere');end if;end if;
 select count(*) into n from dba_tablespaces where tablespace_name='TOEIC_RESTORE_DATA';
 if n=0 then execute immediate 'create tablespace TOEIC_RESTORE_DATA datafile ''$restoreFile'' size 32M autoextend on next 16M maxsize 512M';end if;
 select count(*) into n from dba_users where username='TOEIC_RESTORE';
 if n=0 then execute immediate 'create user TOEIC_RESTORE no authentication default tablespace TOEIC_RESTORE_DATA temporary tablespace TEMP quota 256M on TOEIC_RESTORE_DATA';end if;
 select count(*) into n from dba_tables where owner='TOEIC_RESTORE';
 if n>0 then raise_application_error(-20992,'Restore schema already has data. Preserved existing clone; choose a new schema or clean it manually.');end if;
end;
/
alter user TOEIC_BACKUP account unlock;
alter user TOEIC_BACKUP default tablespace TOEIC_RESTORE_DATA quota 32M on TOEIC_RESTORE_DATA;
grant create table to TOEIC_BACKUP;
grant alter any sequence to TOEIC_BACKUP;
grant create session,DATAPUMP_EXP_FULL_DATABASE,DATAPUMP_IMP_FULL_DATABASE to TOEIC_BACKUP;
grant read,write on directory TOEIC_DP_DIR to TOEIC_BACKUP;
grant select on sys.v_`$instance to TOEIC_RESTORE;
grant select on sys.v_`$database to TOEIC_RESTORE;
grant select on sys.dba_data_files to TOEIC_RESTORE;
grant select on sys.dba_segments to TOEIC_RESTORE;
grant select on sys.user_tab_privs_made to TOEIC_RESTORE;
grant select on sys.dba_tab_privs to TOEIC_RESTORE;
"@
[void](Sql $prepare)
$stamp=Get-Date -Format 'yyyyMMdd_HHmmss';$dump="toeic_owner_$stamp.dmp";$exportLog="toeic_owner_${stamp}_export.log";$importLog="toeic_owner_${stamp}_import.log"
$exportPar=Join-Path $projectRoot '.local/export.par';$importPar=Join-Path $projectRoot '.local/import.par'
[IO.File]::WriteAllText($exportPar,"DIRECTORY=TOEIC_DP_DIR`nDUMPFILE=$dump`nLOGFILE=$exportLog`nSCHEMAS=TOEIC_OWNER`nFLASHBACK_TIME=SYSTIMESTAMP`nMETRICS=YES`nLOGTIME=ALL`n",$utf8)
[IO.File]::WriteAllText($importPar,"DIRECTORY=TOEIC_DP_DIR`nDUMPFILE=$dump`nLOGFILE=$importLog`nSCHEMAS=TOEIC_OWNER`nREMAP_SCHEMA=TOEIC_OWNER:TOEIC_RESTORE`nREMAP_TABLESPACE=TOEIC_DATA:TOEIC_RESTORE_DATA`nEXCLUDE=USER`nEXCLUDE=GRANT`nTRANSFORM=OID:N`nMETRICS=YES`nLOGTIME=ALL`n",$utf8)
$started=(Get-Date).ToUniversalTime().ToString('o')
try{
 Write-Output 'Exporting a consistent logical snapshot of TOEIC_OWNER...'
 $export=Invoke-LocalProcess 'expdp.exe' ('TOEIC_BACKUP@TOEIC_LOCAL PARFILE="'+$exportPar+'"') $secrets.backupPassword
 [IO.File]::WriteAllText((Join-Path $folder 'export-console.txt'),$export,$utf8)
 Write-Output 'Restoring into the isolated TOEIC_RESTORE schema...'
 $import=Invoke-LocalProcess 'impdp.exe' ('TOEIC_BACKUP@TOEIC_LOCAL PARFILE="'+$importPar+'"') $secrets.backupPassword
 [IO.File]::WriteAllText((Join-Path $folder 'import-console.txt'),$import,$utf8)
 $tables=@('ROLES','USERS','GROUPS','QUESTIONS','CHOICES','EXAMS','EXAM_ITEMS','ATTEMPTS','ANSWERS','LESSONS','VOCABULARY','SAVED_WORDS','AUDIT','SCORE_SCALE');$counts=@()
 foreach($name in $tables){$result=Sql "select (select count(*) from TOEIC_OWNER.TOEIC_$name)||','||(select count(*) from TOEIC_RESTORE.TOEIC_$name) from dual;";$parts=$result.Split(',');if($parts[0].Trim() -ne $parts[1].Trim()){throw "Row-count mismatch for TOEIC_$name"};$counts+=@{table="TOEIC_$name";source=[int]$parts[0];restored=[int]$parts[1]}}
 $promptMismatch=Sql 'select count(*) from TOEIC_OWNER.TOEIC_QUESTIONS s join TOEIC_RESTORE.TOEIC_QUESTIONS r on s.question_id=r.question_id where dbms_lob.compare(s.prompt,r.prompt)<>0 or s.correct_choice<>r.correct_choice;'
 if([int]$promptMismatch -ne 0){throw 'Question payload mismatch'}
 $evidence=@{startedAt=$started;completedAt=(Get-Date).ToUniversalTime().ToString('o');type='Oracle Data Pump schema export and recovery';sourceSchema='TOEIC_OWNER';restoredSchema='TOEIC_RESTORE';allCountsMatch=$true;questionPayloadMatches=$true;dumpFile=(Join-Path $folder $dump);dumpBytes=(Get-Item -LiteralPath (Join-Path $folder $dump)).Length;tables=$counts;physicalRmanExecuted=$false}
 [IO.File]::WriteAllText((Join-Path $projectRoot 'docs/backup-verification.json'),($evidence|ConvertTo-Json -Depth 6),$utf8)
 Write-Output "Backup/recovery verified: all 14 table counts and question payloads match. Dump: $dump"
}finally{[void](Sql 'revoke alter any sequence from TOEIC_BACKUP;');[void](Sql 'alter user TOEIC_BACKUP account lock;')}
