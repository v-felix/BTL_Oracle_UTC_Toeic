-- MANUAL DEMO ONLY. SYSDBA required; TOEIC_ADMIN_DEMO and TOEIC_OWNER must exist.
-- Creates ONLY TOEIC_DEMO / TOEIC_DEMO_READER / TOEIC_DEMO_PROFILE.
-- The password is entered hidden; ECHO and VERIFY must remain OFF.
-- Expected: least-privilege login, profile, role, object grant and quota displayed.
-- Cleanup / restore state: run 90_cleanup_sandbox.sql after the demonstration.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET ECHO OFF VERIFY OFF DEFINE ON PAGESIZE 100 LINESIZE 220
ACCEPT run_demo CHAR PROMPT 'Type CREATE_TOEIC_DEMO_USER to create the demo user/role/profile: '
BEGIN
 IF '&run_demo'<>'CREATE_TOEIC_DEMO_USER' THEN
  RAISE_APPLICATION_ERROR(-20990,'Manual user demonstration cancelled');
 END IF;
END;
/
UNDEFINE run_demo
ACCEPT demo_password CHAR PROMPT 'New TOEIC_DEMO password (letters/digits/_/# only, at least 12 chars): ' HIDE
CREATE PROFILE toeic_demo_profile LIMIT
 SESSIONS_PER_USER 3 FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24
 PASSWORD_LIFE_TIME 90 PASSWORD_GRACE_TIME 7;
CREATE ROLE toeic_demo_reader;
CREATE USER toeic_demo IDENTIFIED BY "&demo_password"
 DEFAULT TABLESPACE toeic_admin_demo TEMPORARY TABLESPACE temp
 QUOTA 5M ON toeic_admin_demo PROFILE toeic_demo_profile;
UNDEFINE demo_password
GRANT CREATE SESSION,CREATE TABLE TO toeic_demo;
GRANT SELECT ON toeic_owner.vw_toeic_exam_summary TO toeic_demo_reader;
GRANT toeic_demo_reader TO toeic_demo;
ALTER USER toeic_demo DEFAULT ROLE toeic_demo_reader;
CREATE TABLE toeic_demo.storage_demo (id NUMBER PRIMARY KEY,note VARCHAR2(100)) TABLESPACE toeic_admin_demo;
INSERT INTO toeic_demo.storage_demo SELECT LEVEL,'Sandbox row '||LEVEL FROM dual CONNECT BY LEVEL<=5;
COMMIT;
SELECT username,account_status,default_tablespace,profile FROM dba_users WHERE username='TOEIC_DEMO';
SELECT grantee,privilege FROM dba_sys_privs WHERE grantee='TOEIC_DEMO';
SELECT grantee,granted_role,default_role FROM dba_role_privs WHERE grantee='TOEIC_DEMO';
SELECT grantee,owner,table_name,privilege FROM dba_tab_privs WHERE grantee='TOEIC_DEMO_READER';
SELECT username,tablespace_name,bytes,max_bytes FROM dba_ts_quotas WHERE username='TOEIC_DEMO';
SELECT profile,resource_name,limit FROM dba_profiles WHERE profile='TOEIC_DEMO_PROFILE' ORDER BY resource_name;
-- Revoke and re-grant a ROLE to show the lifecycle without changing application users.
REVOKE toeic_demo_reader FROM toeic_demo;
GRANT toeic_demo_reader TO toeic_demo;
-- Revoking a role removes it from the explicit default-role list.
ALTER USER toeic_demo DEFAULT ROLE toeic_demo_reader;
ALTER USER toeic_demo ACCOUNT LOCK;
SELECT username,account_status FROM dba_users WHERE username='TOEIC_DEMO';
ALTER USER toeic_demo ACCOUNT UNLOCK;
-- For a separate session (password prompt): CONNECT TOEIC_DEMO@localhost:1521/orcl
-- SELECT COUNT(*) FROM TOEIC_OWNER.VW_TOEIC_EXAM_SUMMARY; -- succeeds
-- SELECT * FROM TOEIC_OWNER.TOEIC_USERS; -- ORA-00942, no table grant (expected)
-- Note: password limits apply directly; SESSIONS_PER_USER needs RESOURCE_LIMIT=TRUE.
-- This demonstration does not change global RESOURCE_LIMIT on the shared instance.
