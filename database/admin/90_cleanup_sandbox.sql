-- MANUAL CLEANUP ONLY. SYSDBA required; source/runtime schemas are never targeted.
-- Requires exclusive use of the named demo user. DROP deletes demo rows/files.
-- Expected: TOEIC_DEMO/role/profile/tablespace absent; ORCL remains READ WRITE.
-- No rollback: recreate 02 and 04 scripts if demo data is needed again.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET VERIFY OFF ECHO OFF DEFINE ON
ACCEPT cleanup CHAR PROMPT 'Type DROP_TOEIC_SANDBOX to delete only the admin demo: '
DECLARE v_count NUMBER;
BEGIN
 IF '&cleanup'<>'DROP_TOEIC_SANDBOX' THEN
  RAISE_APPLICATION_ERROR(-20990,'Sandbox cleanup cancelled');
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_users WHERE username='TOEIC_DEMO';
 IF v_count>0 THEN EXECUTE IMMEDIATE 'DROP USER TOEIC_DEMO CASCADE'; END IF;
 SELECT COUNT(*) INTO v_count FROM dba_roles WHERE role='TOEIC_DEMO_READER';
 IF v_count>0 THEN EXECUTE IMMEDIATE 'DROP ROLE TOEIC_DEMO_READER'; END IF;
 SELECT COUNT(*) INTO v_count FROM dba_profiles WHERE profile='TOEIC_DEMO_PROFILE';
 IF v_count>0 THEN EXECUTE IMMEDIATE 'DROP PROFILE TOEIC_DEMO_PROFILE'; END IF;
 SELECT COUNT(*) INTO v_count FROM dba_ts_quotas
  WHERE tablespace_name='TOEIC_ADMIN_DEMO' AND username<>'TOEIC_DEMO';
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20995,'Other users have quotas on demo tablespace'); END IF;
 SELECT COUNT(*) INTO v_count FROM dba_segments
  WHERE tablespace_name='TOEIC_ADMIN_DEMO';
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20996,'Demo tablespace still contains segments; inspect before dropping'); END IF;
 SELECT COUNT(*) INTO v_count FROM dba_tablespaces WHERE tablespace_name='TOEIC_ADMIN_DEMO';
 IF v_count>0 THEN
  EXECUTE IMMEDIATE 'DROP TABLESPACE TOEIC_ADMIN_DEMO INCLUDING CONTENTS AND DATAFILES';
 END IF;
END;
/
UNDEFINE cleanup
SELECT tablespace_name,status FROM dba_tablespaces WHERE tablespace_name='TOEIC_ADMIN_DEMO';
SELECT name,open_mode FROM v$database;
