-- MANUAL PREPARATION. SYSDBA required; no existing source schema is changed.
-- Requires physical folders below with Oracle Windows service write permission.
-- TOEIC_BACKUP is a dedicated backup account, provisioned by the local installer.
-- It must not be the account used by the website.
-- Expected: TOEIC_DP_DIR directory, isolated TOEIC_RESTORE_DATA, TOEIC_RESTORE schema.
-- Recovery/cleanup: 91_cleanup_restore.sql; never drop TOEIC_OWNER for this demo.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET VERIFY OFF ECHO OFF DEFINE ON LINESIZE 220 PAGESIZE 100
DEFINE dp_dir = 'D:\UTC\2026_2027_1\CSDL_Oracle\BTL\thi_toeic-master\.local\oracle-backup\datapump'
DEFINE restore_df = 'D:\UTC\2026_2027_1\CSDL_Oracle\ORADATA\ORCL\toeic_restore01.dbf'
ACCEPT run_demo CHAR PROMPT 'Type PREPARE_TOEIC_RESTORE to prepare logical recovery: '
DECLARE v_count NUMBER; v_path VARCHAR2(4000);
BEGIN
 IF '&run_demo'<>'PREPARE_TOEIC_RESTORE' THEN
  RAISE_APPLICATION_ERROR(-20990,'Manual restore preparation cancelled');
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_users WHERE username='TOEIC_BACKUP';
 IF v_count=0 THEN
  RAISE_APPLICATION_ERROR(-20991,'Provision the dedicated TOEIC_BACKUP account first');
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_directories WHERE directory_name='TOEIC_DP_DIR';
 IF v_count=0 THEN
  EXECUTE IMMEDIATE 'CREATE DIRECTORY TOEIC_DP_DIR AS ''&dp_dir''';
 ELSE
  SELECT directory_path INTO v_path FROM dba_directories WHERE directory_name='TOEIC_DP_DIR';
  IF UPPER(v_path)<>UPPER('&dp_dir') THEN
   RAISE_APPLICATION_ERROR(-20992,'Existing TOEIC_DP_DIR has a different path; review it manually');
  END IF;
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_tablespaces WHERE tablespace_name='TOEIC_RESTORE_DATA';
 IF v_count=0 THEN
  EXECUTE IMMEDIATE 'CREATE TABLESPACE TOEIC_RESTORE_DATA DATAFILE ''&restore_df'' SIZE 32M AUTOEXTEND ON NEXT 16M MAXSIZE 512M';
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_users WHERE username='TOEIC_RESTORE';
 IF v_count=0 THEN
  EXECUTE IMMEDIATE 'CREATE USER TOEIC_RESTORE NO AUTHENTICATION DEFAULT TABLESPACE TOEIC_RESTORE_DATA TEMPORARY TABLESPACE TEMP QUOTA 512M ON TOEIC_RESTORE_DATA';
 END IF;
 SELECT COUNT(*) INTO v_count FROM dba_tables WHERE owner='TOEIC_RESTORE';
 IF v_count>0 THEN
  RAISE_APPLICATION_ERROR(-20993,'TOEIC_RESTORE already contains tables; do not import over them');
 END IF;
END;
/
GRANT READ,WRITE ON DIRECTORY toeic_dp_dir TO toeic_backup;
GRANT DATAPUMP_EXP_FULL_DATABASE,DATAPUMP_IMP_FULL_DATABASE TO toeic_backup;
GRANT CREATE SESSION TO toeic_backup;
ALTER USER toeic_backup DEFAULT TABLESPACE toeic_restore_data QUOTA 32M ON toeic_restore_data;
GRANT CREATE TABLE TO toeic_backup;
-- Oracle19c needs this extra privilege while remapping identity columns.
GRANT ALTER ANY SEQUENCE TO toeic_backup;
SELECT directory_name,directory_path FROM dba_directories WHERE directory_name='TOEIC_DP_DIR';
SELECT username,authentication_type,account_status,default_tablespace FROM dba_users
 WHERE username IN ('TOEIC_BACKUP','TOEIC_RESTORE');
SELECT tablespace_name,file_name,bytes/1024/1024 size_mb FROM dba_data_files
 WHERE tablespace_name='TOEIC_RESTORE_DATA';
UNDEFINE run_demo
UNDEFINE dp_dir
UNDEFINE restore_df
