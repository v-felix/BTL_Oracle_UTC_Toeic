-- OPTIONAL MANUAL CLEANUP of the logical recovery clone only. SYSDBA required.
-- TOEIC_OWNER and its tablespace are not targeted. Dump/backup files are retained.
-- Expected: clone schema and clone tablespace absent; TOEIC_DP_DIR/backups retained.
-- No rollback: re-create and re-import the clone to recover it.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET VERIFY OFF ECHO OFF DEFINE ON
ACCEPT cleanup CHAR PROMPT 'Type DROP_TOEIC_RESTORE to delete the restored clone: '
DECLARE v_count NUMBER;
BEGIN
 IF '&cleanup'<>'DROP_TOEIC_RESTORE' THEN
  RAISE_APPLICATION_ERROR(-20990,'Restore clone cleanup cancelled');
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_users WHERE username='TOEIC_RESTORE';
 IF v_count>0 THEN EXECUTE IMMEDIATE 'DROP USER TOEIC_RESTORE CASCADE'; END IF;
 SELECT COUNT(*) INTO v_count FROM dba_segments WHERE tablespace_name='TOEIC_RESTORE_DATA';
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20996,'Other segments remain in restore tablespace'); END IF;
 SELECT COUNT(*) INTO v_count FROM dba_ts_quotas
  WHERE tablespace_name='TOEIC_RESTORE_DATA' AND username<>'TOEIC_RESTORE';
 IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20995,'Other users have quotas in restore tablespace'); END IF;
 SELECT COUNT(*) INTO v_count FROM dba_tablespaces WHERE tablespace_name='TOEIC_RESTORE_DATA';
 IF v_count>0 THEN
  EXECUTE IMMEDIATE 'DROP TABLESPACE TOEIC_RESTORE_DATA INCLUDING CONTENTS AND DATAFILES';
 END IF;
END;
/
UNDEFINE cleanup
SELECT name,open_mode FROM v$database;
