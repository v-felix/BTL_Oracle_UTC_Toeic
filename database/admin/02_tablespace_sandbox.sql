-- MANUAL DEMO ONLY. SYSDBA required; creates ONLY TOEIC_ADMIN_DEMO.
-- Prerequisite: create both folders and grant the Oracle Windows service write access:
-- D:\UTC\2026_2027_1\CSDL_Oracle\ORADATA\ORCL\toeic_admin_demo
-- D:\UTC\2026_2027_1\CSDL_Oracle\ORADATA\ORCL\toeic_admin_demo\moved
-- Requires free space for copy during online datafile move. NO REUSE is used.
-- Expected: 2 demo files, resized first file, AUTOEXTENSIBLE YES, online/read write.
-- Recovery: if a move fails, inspect DBA_DATA_FILES for actual path; do not move
-- files in Explorer. Keep files managed by Oracle; cleanup with 90_cleanup_sandbox.sql.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET VERIFY OFF ECHO OFF DEFINE ON LINESIZE 240 PAGESIZE 100
DEFINE demo_dir = 'D:\UTC\2026_2027_1\CSDL_Oracle\ORADATA\ORCL\toeic_admin_demo'
ACCEPT run_demo CHAR PROMPT 'Type CREATE_TOEIC_SANDBOX to create the demo tablespace: '
BEGIN
 IF '&run_demo'<>'CREATE_TOEIC_SANDBOX' THEN
  RAISE_APPLICATION_ERROR(-20990,'Manual tablespace demonstration cancelled');
 END IF;
END;
/
UNDEFINE run_demo
CREATE TABLESPACE toeic_admin_demo
 DATAFILE '&demo_dir\demo01.dbf' SIZE 20M
 AUTOEXTEND ON NEXT 1M MAXSIZE 100M
 EXTENT MANAGEMENT LOCAL SEGMENT SPACE MANAGEMENT AUTO;
ALTER TABLESPACE toeic_admin_demo ADD DATAFILE '&demo_dir\demo02.dbf'
 SIZE 10M AUTOEXTEND OFF;
ALTER DATABASE DATAFILE '&demo_dir\demo01.dbf' RESIZE 24M;
ALTER DATABASE DATAFILE '&demo_dir\demo01.dbf' AUTOEXTEND OFF;
SELECT file_name,autoextensible,bytes FROM dba_data_files WHERE tablespace_name='TOEIC_ADMIN_DEMO';
ALTER DATABASE DATAFILE '&demo_dir\demo01.dbf' AUTOEXTEND ON NEXT 1M MAXSIZE 100M;
ALTER DATABASE MOVE DATAFILE '&demo_dir\demo01.dbf' TO '&demo_dir\moved\demo01.dbf';
SELECT file_name FROM dba_data_files WHERE tablespace_name='TOEIC_ADMIN_DEMO';
-- Move back using Oracle, restoring the original demo file location.
ALTER DATABASE MOVE DATAFILE '&demo_dir\moved\demo01.dbf' TO '&demo_dir\demo01.dbf';
ALTER TABLESPACE toeic_admin_demo READ ONLY;
SELECT tablespace_name,status FROM dba_tablespaces WHERE tablespace_name='TOEIC_ADMIN_DEMO';
ALTER TABLESPACE toeic_admin_demo READ WRITE;
SELECT tablespace_name,status FROM dba_tablespaces WHERE tablespace_name='TOEIC_ADMIN_DEMO';
SELECT tablespace_name,file_name,bytes/1024/1024 size_mb,autoextensible,maxbytes/1024/1024 max_mb
 FROM dba_data_files WHERE tablespace_name='TOEIC_ADMIN_DEMO';
UNDEFINE demo_dir
