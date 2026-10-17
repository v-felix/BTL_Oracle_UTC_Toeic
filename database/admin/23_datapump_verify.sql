-- READ ONLY. Run as SYSDBA after successful import while source writes remain paused.
-- Expected: 14 cloned tables, exact count match, valid package/views/triggers.
-- The count comparison is meaningful only if source has not changed since export.
-- No password hash or full answer content is printed. Restore state: none.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF SERVEROUTPUT ON LINESIZE 220 PAGESIZE 100
DECLARE v_source NUMBER; v_clone NUMBER; v_tables NUMBER:=0; v_mismatches NUMBER:=0;
BEGIN
 FOR r IN (SELECT table_name FROM dba_tables WHERE owner='TOEIC_OWNER'
           AND table_name LIKE 'TOEIC\_%' ESCAPE '\' ORDER BY table_name) LOOP
  EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM TOEIC_OWNER.'||DBMS_ASSERT.SIMPLE_SQL_NAME(r.table_name) INTO v_source;
  EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM TOEIC_RESTORE.'||DBMS_ASSERT.SIMPLE_SQL_NAME(r.table_name) INTO v_clone;
  v_tables:=v_tables+1;
  DBMS_OUTPUT.PUT_LINE(RPAD(r.table_name,28)||' source='||v_source||' clone='||v_clone||
    CASE WHEN v_source=v_clone THEN ' MATCH' ELSE ' DIFFERENT' END);
  IF v_source<>v_clone THEN v_mismatches:=v_mismatches+1; END IF;
 END LOOP;
 DBMS_OUTPUT.PUT_LINE('Compared tables: '||v_tables||'; mismatches: '||v_mismatches);
 IF v_tables<14 OR v_mismatches>0 THEN
  RAISE_APPLICATION_ERROR(-20994,'Logical restore verification failed; inspect logs/source changes');
 END IF;
END;
/
SELECT object_name,object_type,status FROM dba_objects WHERE owner='TOEIC_RESTORE'
 AND object_type IN ('PACKAGE','PACKAGE BODY','VIEW','TRIGGER') ORDER BY object_type,object_name;
SELECT name,type,line,position,text FROM dba_errors WHERE owner='TOEIC_RESTORE' ORDER BY name,sequence;
-- Metadata inspection: any source schema references must be reviewed before using
-- the cloned schema independently (Data Pump cannot rewrite every embedded reference).
SELECT name,type,line,text FROM dba_source WHERE owner='TOEIC_RESTORE'
 AND INSTR(UPPER(text),'TOEIC_OWNER.')>0 ORDER BY name,type,line;
SELECT owner,table_name,tablespace_name FROM dba_tables WHERE owner='TOEIC_RESTORE' ORDER BY table_name;
