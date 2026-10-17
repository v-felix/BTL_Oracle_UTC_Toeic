-- READ ONLY. Run: sqlplus / as sysdba -> @database/admin/00_inspect.sql
-- Requires SYSDBA or SELECT_CATALOG_ROLE plus access to V$ views.
-- Expected: ORCL / OPEN / READ WRITE / NOARCHIVELOG on the inspected machine.
-- Restore state: none. This file does not change Oracle configuration.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF PAGESIZE 100 LINESIZE 240
COLUMN name FORMAT A100
COLUMN file_name FORMAT A110
COLUMN directory_path FORMAT A110
SELECT instance_name,host_name,status,logins FROM v$instance;
SELECT name,dbid,cdb,open_mode,log_mode,current_scn FROM v$database;
SELECT name,value FROM v$parameter
 WHERE name IN ('spfile','control_files','db_create_file_dest','db_recovery_file_dest');
SELECT tablespace_name,status,contents,extent_management,segment_space_management
 FROM dba_tablespaces ORDER BY tablespace_name;
SELECT tablespace_name,file_id,file_name,ROUND(bytes/1024/1024,2) size_mb,
 autoextensible,ROUND(maxbytes/1024/1024,2) max_mb FROM dba_data_files
 ORDER BY tablespace_name,file_id;
SELECT directory_name,directory_path FROM dba_directories
 WHERE directory_name IN ('DATA_PUMP_DIR','TOEIC_DP_DIR');
SELECT username,account_status,default_tablespace,profile FROM dba_users
 WHERE username IN ('TOEIC_OWNER','TOEIC_APP','TOEIC_RESTORE','TOEIC_DEMO');
SELECT grantee,granted_role,default_role FROM dba_role_privs
 WHERE grantee IN ('TOEIC_OWNER','TOEIC_APP','TOEIC_DEMO');
SELECT grantee,privilege FROM dba_sys_privs
 WHERE grantee IN ('TOEIC_OWNER','TOEIC_APP','TOEIC_RUNTIME') ORDER BY grantee,privilege;
SELECT grantee,owner,table_name,privilege FROM dba_tab_privs
 WHERE grantee='TOEIC_RUNTIME' ORDER BY owner,table_name,privilege;
