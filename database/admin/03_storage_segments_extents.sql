-- READ ONLY. SYSDBA or SELECT_CATALOG_ROLE required.
-- Prerequisite: TOEIC_OWNER schema installed; optional sandbox from 04_users_roles.sql.
-- Expected: tables/indexes/LOB segments and >=1 extent per allocated segment.
-- Oracle deferred segment creation can leave an empty table without a segment.
-- Restore state: none.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF PAGESIZE 100 LINESIZE 240
SELECT owner,segment_name,segment_type,tablespace_name,bytes/1024 size_kb,blocks,extents
 FROM dba_segments WHERE owner IN ('TOEIC_OWNER','TOEIC_DEMO')
 ORDER BY owner,segment_type,segment_name;
SELECT owner,segment_name,segment_type,extent_id,file_id,block_id,blocks,bytes/1024 size_kb
 FROM dba_extents WHERE owner IN ('TOEIC_OWNER','TOEIC_DEMO')
 ORDER BY owner,segment_name,extent_id;
SELECT tablespace_name,COUNT(*) free_extents,ROUND(SUM(bytes)/1024/1024,2) free_mb,
 ROUND(MAX(bytes)/1024/1024,2) largest_free_extent_mb
 FROM dba_free_space
 WHERE tablespace_name IN ('TOEIC_DATA','TOEIC_ADMIN_DEMO','TOEIC_RESTORE_DATA')
 GROUP BY tablespace_name ORDER BY tablespace_name;
SELECT table_name,num_rows,blocks,last_analyzed FROM dba_tables
 WHERE owner='TOEIC_OWNER' ORDER BY table_name;
-- NUM_ROWS is optimizer statistics; run Q17 in 10_queries.sql for exact COUNT(*).
