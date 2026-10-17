-- MANUAL DEMO ONLY. SYSDBA required. Stops the ENTIRE shared ORCL database.
-- Stop the website and disconnect all other tools/sessions before running.
-- SHUTDOWN NORMAL waits for all other users; TRANSACTIONAL waits for transactions.
-- Never run this file from the app installer or from unattended tests.
-- Expected final state: OPEN / READ WRITE / ALLOWED.
-- If interrupted: reconnect sqlplus / as sysdba; STARTUP (idle) or
-- ALTER DATABASE OPEN (mounted); ALTER SYSTEM DISABLE RESTRICTED SESSION.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET VERIFY OFF ECHO OFF DEFINE ON
ACCEPT run_demo CHAR PROMPT 'Type RUN_INSTANCE_DEMO to stop and restart ORCL: '
BEGIN
 IF '&run_demo'<>'RUN_INSTANCE_DEMO' THEN
  RAISE_APPLICATION_ERROR(-20990,'Manual instance demonstration cancelled');
 END IF;
END;
/
UNDEFINE run_demo
SELECT instance_name,status,logins FROM v$instance;
SELECT name,open_mode,log_mode FROM v$database;

PROMPT NOMOUNT: parameter file, memory and background processes only
SHUTDOWN IMMEDIATE
STARTUP NOMOUNT
SELECT instance_name,status FROM v$instance;
PROMPT MOUNT: control files opened; datafiles not open
ALTER DATABASE MOUNT;
SELECT name,open_mode FROM v$database;
PROMPT OPEN: datafiles and online redo logs opened
ALTER DATABASE OPEN;
SELECT name,open_mode FROM v$database;

PROMPT NORMAL: waits until every other session disconnects
SHUTDOWN NORMAL
STARTUP
PROMPT TRANSACTIONAL: waits for transactions to complete, then disconnects sessions
SHUTDOWN TRANSACTIONAL
STARTUP
PROMPT IMMEDIATE: disconnects sessions and rolls back uncommitted transactions
SHUTDOWN IMMEDIATE
STARTUP

PROMPT READ ONLY: requires mount before opening read only
SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE OPEN READ ONLY;
SELECT name,open_mode FROM v$database;
PROMPT Restore READ WRITE
SHUTDOWN IMMEDIATE
STARTUP

PROMPT RESTRICTED SESSION: new ordinary logins are refused
ALTER SYSTEM ENABLE RESTRICTED SESSION;
SELECT instance_name,status,logins FROM v$instance;
-- Existing sessions are not automatically killed by ENABLE RESTRICTED SESSION.
ALTER SYSTEM DISABLE RESTRICTED SESSION;
SELECT instance_name,status,logins FROM v$instance;
SELECT name,open_mode,log_mode FROM v$database;
-- SHUTDOWN ABORT is emergency-only. It is intentionally NOT executed here.
-- After ABORT, startup performs instance recovery. For NOARCHIVELOG backup,
-- open the DB then SHUTDOWN IMMEDIATE cleanly before STARTUP MOUNT + backup.
