WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
SET DEFINE OFF
CREATE OR REPLACE PACKAGE pkg_toeic AS
 PROCEDURE start_attempt(p_user_id NUMBER,p_exam_id NUMBER,p_attempt_id OUT NUMBER);
 PROCEDURE submit_attempt(p_user_id NUMBER,p_attempt_id NUMBER);
 FUNCTION scaled_score(p_section VARCHAR2,p_correct NUMBER,p_total NUMBER) RETURN NUMBER;
END pkg_toeic;
/
CREATE OR REPLACE PACKAGE BODY pkg_toeic AS
 FUNCTION scaled_score(p_section VARCHAR2,p_correct NUMBER,p_total NUMBER) RETURN NUMBER IS v_score NUMBER;
 BEGIN
  IF p_total=0 THEN RETURN 0; END IF;
  SELECT scaled_score INTO v_score FROM toeic_score_scale
  WHERE section=p_section AND raw_score=LEAST(100,ROUND(p_correct*100/p_total));
  RETURN v_score;
 END;
 PROCEDURE start_attempt(p_user_id NUMBER,p_exam_id NUMBER,p_attempt_id OUT NUMBER) IS
  v_minutes NUMBER; v_status VARCHAR2(12); v_count NUMBER; v_expires TIMESTAMP;
 BEGIN
  SELECT active INTO v_count FROM toeic_users WHERE user_id=p_user_id FOR UPDATE;
  IF v_count<>1 THEN RAISE_APPLICATION_ERROR(-20001,'Account disabled'); END IF;
  BEGIN
   SELECT attempt_id,expires_at INTO p_attempt_id,v_expires FROM toeic_attempts
   WHERE user_id=p_user_id AND exam_id=p_exam_id AND status='IN_PROGRESS' FOR UPDATE;
   IF v_expires>SYS_EXTRACT_UTC(SYSTIMESTAMP) THEN RETURN; END IF;
   submit_attempt(p_user_id,p_attempt_id);
  EXCEPTION WHEN NO_DATA_FOUND THEN NULL; END;
  SELECT duration_minutes,status INTO v_minutes,v_status FROM toeic_exams WHERE exam_id=p_exam_id FOR UPDATE;
  IF v_status<>'PUBLISHED' THEN RAISE_APPLICATION_ERROR(-20002,'Exam is not published'); END IF;
  SELECT COUNT(*) INTO v_count FROM toeic_exam_items WHERE exam_id=p_exam_id;
  IF v_count=0 THEN RAISE_APPLICATION_ERROR(-20003,'Exam has no questions'); END IF;
  INSERT INTO toeic_attempts(user_id,exam_id,expires_at,total_count)
  VALUES(p_user_id,p_exam_id,SYS_EXTRACT_UTC(SYSTIMESTAMP)+NUMTODSINTERVAL(v_minutes,'MINUTE'),v_count)
  RETURNING attempt_id INTO p_attempt_id;
  INSERT INTO toeic_answers(attempt_id,question_id,position,part_no,group_id,prompt,passage,choices_json,explanation,audio_url,image_url,correct_choice)
  SELECT p_attempt_id,q.question_id,i.position,g.part_no,g.group_id,q.prompt,g.passage,
   (SELECT JSON_ARRAYAGG(JSON_OBJECT('key' VALUE c.choice_key,'text' VALUE c.choice_text) ORDER BY c.choice_key RETURNING CLOB)
    FROM toeic_choices c WHERE c.question_id=q.question_id),q.explanation,g.audio_url,g.image_url,q.correct_choice
  FROM toeic_exam_items i JOIN toeic_questions q ON q.question_id=i.question_id JOIN toeic_groups g ON g.group_id=q.group_id
  WHERE i.exam_id=p_exam_id;
  INSERT INTO toeic_audit(actor,action,entity,entity_id) VALUES(TO_CHAR(p_user_id),'START','ATTEMPT',p_attempt_id);
 END;
 PROCEDURE submit_attempt(p_user_id NUMBER,p_attempt_id NUMBER) IS
  v_status VARCHAR2(12); v_started TIMESTAMP; v_expires TIMESTAMP; v_now TIMESTAMP:=SYS_EXTRACT_UTC(SYSTIMESTAMP);
  v_l_total NUMBER; v_r_total NUMBER; v_l_correct NUMBER; v_r_correct NUMBER;
 BEGIN
  SELECT status,started_at,expires_at INTO v_status,v_started,v_expires FROM toeic_attempts
   WHERE attempt_id=p_attempt_id AND user_id=p_user_id FOR UPDATE;
  IF v_status<>'IN_PROGRESS' THEN RETURN; END IF;
  UPDATE toeic_answers SET is_correct=CASE WHEN selected_choice=correct_choice THEN 1 ELSE 0 END WHERE attempt_id=p_attempt_id;
  SELECT COUNT(CASE WHEN part_no<=4 THEN 1 END),COUNT(CASE WHEN part_no>=5 THEN 1 END),
   COUNT(CASE WHEN part_no<=4 AND is_correct=1 THEN 1 END),COUNT(CASE WHEN part_no>=5 AND is_correct=1 THEN 1 END)
   INTO v_l_total,v_r_total,v_l_correct,v_r_correct FROM toeic_answers WHERE attempt_id=p_attempt_id;
  UPDATE toeic_attempts SET status=CASE WHEN v_now>=v_expires THEN 'EXPIRED' ELSE 'COMPLETED' END,
   submitted_at=LEAST(v_now,v_expires),listening_score=scaled_score('LISTENING',v_l_correct,v_l_total),
   reading_score=scaled_score('READING',v_r_correct,v_r_total),correct_count=v_l_correct+v_r_correct,
   elapsed_seconds=GREATEST(0,ROUND((CAST(LEAST(v_now,v_expires) AS DATE)-CAST(v_started AS DATE))*86400)) WHERE attempt_id=p_attempt_id;
  INSERT INTO toeic_audit(actor,action,entity,entity_id) VALUES(TO_CHAR(p_user_id),'SUBMIT','ATTEMPT',p_attempt_id);
 END;
END pkg_toeic;
/
SHOW ERRORS
