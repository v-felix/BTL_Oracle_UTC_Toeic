-- Oracle 19c; SQL*Plus: CONNECT TOEIC_OWNER@localhost:1521/orcl (password prompt).
-- Read-only examples for rubric item 3. No passwords or answer keys are selected.
WHENEVER SQLERROR EXIT SQL.SQLCODE
SET DEFINE OFF PAGESIZE 80 LINESIZE 220
SET SQLBLANKLINES ON

PROMPT Q01 - Basic filter, ordering and row limiting: published exams
SELECT exam_id,title,kind,duration_minutes
FROM toeic_exams WHERE status='PUBLISHED'
ORDER BY created_at DESC,exam_id DESC FETCH FIRST 10 ROWS ONLY;

PROMPT Q02 - String functions and CASE: vocabulary by topic
SELECT word,meaning,UPPER(topic) topic,
       CASE WHEN LENGTH(word)>10 THEN 'LONG' ELSE 'SHORT' END word_length
FROM toeic_vocabulary ORDER BY topic,word;

PROMPT Q03 - Inner join: account and application role
SELECT u.user_id,u.username,u.full_name,r.code role_code,u.active
FROM toeic_users u JOIN toeic_roles r ON r.role_id=u.role_id
ORDER BY r.code,u.username;

PROMPT Q04 - Multi-table join: exam structure without correct choices
SELECT e.title,i.position,g.part_no,q.question_id,q.difficulty,
       DBMS_LOB.SUBSTR(q.prompt,120,1) prompt_preview
FROM toeic_exams e JOIN toeic_exam_items i ON i.exam_id=e.exam_id
JOIN toeic_questions q ON q.question_id=i.question_id
JOIN toeic_groups g ON g.group_id=q.group_id
ORDER BY e.exam_id,i.position;

PROMPT Q05 - Scalar nested query: results above the overall average
SELECT a.attempt_id,u.full_name,a.listening_score+a.reading_score total_score
FROM toeic_attempts a JOIN toeic_users u ON u.user_id=a.user_id
WHERE a.status IN ('COMPLETED','EXPIRED')
  AND a.listening_score+a.reading_score >
      (SELECT AVG(listening_score+reading_score) FROM toeic_attempts
       WHERE status IN ('COMPLETED','EXPIRED'))
ORDER BY total_score DESC;

PROMPT Q06 - Correlated NOT EXISTS: published exams never attempted
SELECT e.exam_id,e.title FROM toeic_exams e
WHERE e.status='PUBLISHED'
  AND NOT EXISTS (SELECT 1 FROM toeic_attempts a WHERE a.exam_id=e.exam_id)
ORDER BY e.exam_id;

PROMPT Q07 - Nested IN: groups containing at least one hard question
SELECT group_id,part_no,title FROM toeic_groups
WHERE group_id IN (SELECT group_id FROM toeic_questions WHERE difficulty='HARD')
ORDER BY part_no,group_id;

PROMPT Q08 - GROUP BY and HAVING: exams with at least five questions
SELECT e.exam_id,e.title,COUNT(i.question_id) question_count
FROM toeic_exams e JOIN toeic_exam_items i ON i.exam_id=e.exam_id
GROUP BY e.exam_id,e.title HAVING COUNT(i.question_id)>=5
ORDER BY question_count DESC,e.exam_id;

PROMPT Q09 - Aggregate functions: result statistics by exam
SELECT e.exam_id,e.title,COUNT(a.attempt_id) finished_count,
       MIN(a.listening_score+a.reading_score) min_score,
       MAX(a.listening_score+a.reading_score) max_score,
       ROUND(AVG(a.listening_score+a.reading_score),1) avg_score,
       ROUND(STDDEV(a.listening_score+a.reading_score),1) stddev_score
FROM toeic_exams e LEFT JOIN toeic_attempts a
 ON a.exam_id=e.exam_id AND a.status IN ('COMPLETED','EXPIRED')
GROUP BY e.exam_id,e.title ORDER BY e.exam_id;

PROMPT Q10 - CTE, outer join and NVL: question count across all seven parts
WITH parts AS (SELECT LEVEL part_no FROM dual CONNECT BY LEVEL<=7)
SELECT p.part_no,COUNT(q.question_id) question_count,
       NVL(SUM(CASE WHEN q.difficulty='HARD' THEN 1 ELSE 0 END),0) hard_count
FROM parts p LEFT JOIN toeic_groups g ON g.part_no=p.part_no
LEFT JOIN toeic_questions q ON q.group_id=g.group_id AND q.active=1
GROUP BY p.part_no ORDER BY p.part_no;

PROMPT Q11 - Analytic DENSE_RANK: ranking by each learner's best result
WITH best AS (
 SELECT u.user_id,u.full_name,MAX(a.listening_score+a.reading_score) best_score
 FROM toeic_users u JOIN toeic_attempts a ON a.user_id=u.user_id
 WHERE a.status IN ('COMPLETED','EXPIRED') GROUP BY u.user_id,u.full_name
)
SELECT DENSE_RANK() OVER(ORDER BY best_score DESC) ranking,
       user_id,full_name,best_score FROM best ORDER BY ranking,user_id;

PROMPT Q12 - Analytic LAG: score change compared with the previous result
WITH results AS (
 SELECT user_id,attempt_id,submitted_at,listening_score+reading_score total_score,
 LAG(listening_score+reading_score) OVER(PARTITION BY user_id ORDER BY submitted_at,attempt_id) previous_score
 FROM toeic_attempts WHERE status IN ('COMPLETED','EXPIRED')
)
SELECT user_id,attempt_id,submitted_at,total_score,previous_score,
       total_score-previous_score score_change
FROM results ORDER BY user_id,submitted_at,attempt_id;

PROMPT Q13 - Date functions: completed attempts per UTC calendar month
SELECT TO_CHAR(submitted_at,'YYYY-MM') month_utc,COUNT(*) attempt_count,
       ROUND(AVG(listening_score+reading_score),1) avg_score
FROM toeic_attempts WHERE status IN ('COMPLETED','EXPIRED')
GROUP BY TO_CHAR(submitted_at,'YYYY-MM') ORDER BY month_utc;

PROMPT Q14 - Conditional aggregation and NULLIF: accuracy by TOEIC part
SELECT ans.part_no,COUNT(*) total_answers,
       SUM(CASE WHEN ans.selected_choice IS NOT NULL THEN 1 ELSE 0 END) answered_count,
       SUM(NVL(ans.is_correct,0)) correct_count,
       ROUND(100*SUM(NVL(ans.is_correct,0))/NULLIF(COUNT(*),0),2) correct_percent
FROM toeic_answers ans JOIN toeic_attempts a ON a.attempt_id=ans.attempt_id
WHERE a.status IN ('COMPLETED','EXPIRED')
GROUP BY ans.part_no ORDER BY ans.part_no;

PROMPT Q15 - Many-to-many join: saved vocabulary of learners
SELECT u.username,v.word,v.meaning,v.topic,s.saved_at
FROM toeic_saved_words s JOIN toeic_users u ON u.user_id=s.user_id
JOIN toeic_vocabulary v ON v.word_id=s.word_id
ORDER BY u.username,s.saved_at DESC,v.word;

PROMPT Q16 - Audit aggregation: operations by actor and entity
SELECT NVL(actor,'DATABASE_SESSION') actor,entity,action,COUNT(*) action_count,
       MAX(created_at) latest_at
FROM toeic_audit GROUP BY actor,entity,action
ORDER BY latest_at DESC;

PROMPT Q17 - UNION ALL: exact seed record counts, each must be at least five
SELECT 'TOEIC_ROLES' table_name,COUNT(*) row_count FROM toeic_roles
UNION ALL SELECT 'TOEIC_USERS',COUNT(*) FROM toeic_users
UNION ALL SELECT 'TOEIC_GROUPS',COUNT(*) FROM toeic_groups
UNION ALL SELECT 'TOEIC_QUESTIONS',COUNT(*) FROM toeic_questions
UNION ALL SELECT 'TOEIC_CHOICES',COUNT(*) FROM toeic_choices
UNION ALL SELECT 'TOEIC_EXAMS',COUNT(*) FROM toeic_exams
UNION ALL SELECT 'TOEIC_EXAM_ITEMS',COUNT(*) FROM toeic_exam_items
UNION ALL SELECT 'TOEIC_ATTEMPTS',COUNT(*) FROM toeic_attempts
UNION ALL SELECT 'TOEIC_ANSWERS',COUNT(*) FROM toeic_answers
UNION ALL SELECT 'TOEIC_LESSONS',COUNT(*) FROM toeic_lessons
UNION ALL SELECT 'TOEIC_VOCABULARY',COUNT(*) FROM toeic_vocabulary
UNION ALL SELECT 'TOEIC_SAVED_WORDS',COUNT(*) FROM toeic_saved_words
UNION ALL SELECT 'TOEIC_AUDIT',COUNT(*) FROM toeic_audit
UNION ALL SELECT 'TOEIC_SCORE_SCALE',COUNT(*) FROM toeic_score_scale
ORDER BY 1;

PROMPT Q18 - Data quality check: Part 2 has three choices, other parts four (expect zero rows)
SELECT q.question_id,g.part_no,COUNT(c.choice_key) choice_count,
       MAX(CASE WHEN c.choice_key=q.correct_choice THEN 1 ELSE 0 END) has_correct_choice
FROM toeic_questions q JOIN toeic_groups g ON g.group_id=q.group_id
LEFT JOIN toeic_choices c ON c.question_id=q.question_id
GROUP BY q.question_id,g.part_no
HAVING COUNT(c.choice_key)<>CASE WHEN g.part_no=2 THEN 3 ELSE 4 END
    OR MAX(CASE WHEN c.choice_key=q.correct_choice THEN 1 ELSE 0 END)<>1;

PROMPT Q19 - PL/SQL function in SQL: illustrative practice score conversion
SELECT section,raw_score,scaled_score,
       pkg_toeic.scaled_score(section,raw_score,100) calculated_score
FROM toeic_score_scale WHERE raw_score IN (0,25,50,75,100)
ORDER BY section,raw_score;

PROMPT Q20 - Views: progress including learners with no completed attempts
SELECT user_id,full_name,completed_count,best_score,average_score
FROM vw_toeic_user_progress ORDER BY best_score DESC,user_id;

-- Expected: 20 query blocks complete; Q18 returns no rows for valid seed data.
-- Restore state: none; this entire file is read-only.
