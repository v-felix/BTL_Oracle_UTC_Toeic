"""Rebuild the Oracle TOEIC coursework report with the bundled Python runtime.

Run from the project root. Evidence is read from docs/verification.json when present.
The script never connects to Oracle and never runs administration commands.
"""
from __future__ import annotations
import hashlib
import json
import math
import re
import textwrap
from datetime import datetime, timezone, timedelta
from pathlib import Path
from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/Bao_cao_BTL_Oracle_TOEIC.docx'
TMP = ROOT / 'tmp/report'
TMP.mkdir(parents=True, exist_ok=True)
SCHEMA = (ROOT / 'database/01_schema.sql').read_text('utf-8')
CONTENT = json.loads((ROOT / 'server/SeedData/content.json').read_text('utf-8'))
SOURCE_PATH = ROOT / 'docs/report-source.json'
EXISTING = json.loads(SOURCE_PATH.read_text('utf-8')) if SOURCE_PATH.exists() else {}
META = EXISTING.get('metadata', {'school':'TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI',
    'faculty':'', 'class':'', 'group':'', 'lecturer':'', 'academicYear':'2026–2027',
    'members':[{'name':'','studentId':'','task':'','contribution':''} for _ in range(5)]})
EVIDENCE_PATH = ROOT / 'docs/verification.json'
EVIDENCE = json.loads(EVIDENCE_PATH.read_text('utf-8')) if EVIDENCE_PATH.exists() else {}
BACKUP_PATH=ROOT/'docs/backup-verification.json'
BACKUP=json.loads(BACKUP_PATH.read_text('utf-8-sig')) if BACKUP_PATH.exists() else EVIDENCE.get('backup',{})
API_RESULTS=EVIDENCE.get('apiTests',{})
ADMIN_RESULTS=EVIDENCE.get('administration',{})
CASE_RESULTS={x['name']:x.get('passed') is True for x in API_RESULTS.get('results',[])}
UI_SOURCES=['docs/screenshots/exam-mobile.png','docs/screenshots/result-mobile.png']
UI_VERIFIED=all((ROOT/p).is_file() for p in UI_SOURCES) and any('Đã kiểm tra giao diện' in s for s in EVIDENCE.get('summary',[]))
def local_time(value,include_date=True):
    dt=datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(timezone(timedelta(hours=7)))
    return dt.strftime('%H:%M:%S %d/%m/%Y' if include_date else '%H:%M:%S')
def passed(*names):return bool(names) and all(CASE_RESULTS.get(name,False) for name in names)

def split_sql(text):
    result, start, level, quoted = [], 0, 0, False
    for i,c in enumerate(text):
        if c == "'": quoted = not quoted
        if not quoted:
            level += (c == '(') - (c == ')')
            if c == ',' and level == 0:
                result.append(text[start:i].strip()); start=i+1
    result.append(text[start:].strip())
    return result

DESCRIPTIONS = {
 'role_id':'Mã vai trò ứng dụng', 'code':'Mã vai trò duy nhất', 'name':'Tên hiển thị',
 'user_id':'Mã người dùng', 'username':'Tên đăng nhập duy nhất', 'email':'Email duy nhất',
 'password_hash':'Chuỗi băm mật khẩu có salt và tham số', 'full_name':'Họ tên hiển thị',
 'target_score':'Mục tiêu điểm từ 10 đến 990', 'active':'1 là hoạt động, 0 là vô hiệu hóa',
 'created_at':'Thời điểm tạo theo UTC', 'group_id':'Mã nhóm nghe hoặc đọc',
 'part_no':'Phần thi từ 1 đến 7', 'title':'Tiêu đề nội dung', 'passage':'Văn bản dùng chung của nhóm',
 'audio_url':'Đường dẫn audio', 'image_url':'Đường dẫn hình ảnh', 'question_id':'Mã câu hỏi gốc',
 'prompt':'Nội dung câu hỏi', 'explanation':'Giải thích hoặc transcript khi chữa bài',
 'correct_choice':'Khóa đáp án đúng A B C D', 'difficulty':'EASY MEDIUM hoặc HARD',
 'choice_id':'Mã phương án lựa chọn', 'choice_key':'Nhãn A B C D trong câu hỏi',
 'choice_text':'Nội dung phương án', 'exam_id':'Mã đề thi', 'slug':'Mã đường dẫn duy nhất',
 'description':'Mô tả đề thi', 'duration_minutes':'Thời lượng tính bằng phút',
 'kind':'FULL_TEST MINI_TEST hoặc PRACTICE', 'status':'Trạng thái theo vòng đời đối tượng',
 'position':'Thứ tự câu trong đề hoặc lượt thi', 'attempt_id':'Mã lượt thi',
 'started_at':'Thời điểm bắt đầu UTC', 'expires_at':'Hạn nộp do máy chủ tính',
 'submitted_at':'Thời điểm nộp hiệu lực UTC', 'listening_score':'Điểm nghe tham khảo',
 'reading_score':'Điểm đọc tham khảo', 'correct_count':'Tổng số câu trả lời đúng',
 'total_count':'Tổng câu của lượt thi', 'elapsed_seconds':'Thời gian làm bài tính bằng giây',
 'choices_json':'Ảnh chụp các phương án dưới dạng JSON', 'selected_choice':'Phương án học viên đã chọn hoặc NULL',
 'marked':'Cờ đánh dấu để xem lại', 'is_correct':'Kết quả so sánh đáp án sau nộp',
 'lesson_id':'Mã bài học', 'summary':'Tóm tắt bài học', 'content':'Nội dung bài học tiếng Việt',
 'word_id':'Mã từ vựng', 'word':'Từ hoặc cụm từ tiếng Anh duy nhất',
 'pronunciation':'Phiên âm hỗ trợ phát âm', 'meaning':'Nghĩa tiếng Việt',
 'example':'Câu ví dụ tiếng Anh', 'topic':'Chủ đề từ vựng', 'saved_at':'Thời điểm lưu từ UTC',
 'audit_id':'Mã sự kiện nhật ký', 'actor':'Định danh người thực hiện từ ClientId',
 'action':'Loại thao tác', 'entity':'Loại đối tượng được thao tác', 'entity_id':'Mã đối tượng liên quan',
 'detail':'Mô tả bổ sung của sự kiện', 'section':'LISTENING hoặc READING',
 'raw_score':'Số đúng chuẩn hóa về thang 0 đến 100', 'scaled_score':'Điểm tham khảo từ 5 đến 495'}
TABLE_PURPOSES = {
 'toeic_roles':'Danh mục 5 vai trò nghiệp vụ. Mỗi người dùng có đúng một vai trò hiện hành.',
 'toeic_users':'Tài khoản website; không phải tài khoản đăng nhập Oracle. Mật khẩu lưu dạng hash.',
 'toeic_groups':'Dùng chung passage audio và ảnh cho một nhóm câu hỏi, giữ nguyên ngữ cảnh nghe đọc.',
 'toeic_questions':'Ngân hàng câu hỏi; nội dung dài dùng CLOB. Câu đang thuộc đề công khai cần được bảo vệ khi sửa.',
 'toeic_choices':'Các lựa chọn của câu hỏi. Part 2 có ba lựa chọn; các Part khác có bốn.',
 'toeic_exams':'Danh mục đề và vòng đời DRAFT PUBLISHED ARCHIVED. Đề đã có lịch sử được lưu trữ thay vì xóa.',
 'toeic_exam_items':'Bảng liên kết nhiều nhiều giữa đề và câu hỏi, đồng thời xác định thứ tự câu.',
 'toeic_attempts':'Lượt làm bài của một học viên trên một đề, có thời hạn và kết quả riêng.',
 'toeic_answers':'Mỗi dòng là một câu trong một lượt thi; đồng thời chứa bản chụp nội dung để bảo toàn lịch sử.',
 'toeic_lessons':'Bài học tự luyện theo Part, gồm tóm tắt và nội dung đầy đủ.',
 'toeic_vocabulary':'Ngân hàng từ vựng công sở có nghĩa ví dụ và chủ đề.',
 'toeic_saved_words':'Liên kết nhiều nhiều giữa học viên và từ đã lưu, không cho lưu trùng.',
 'toeic_audit':'Nhật ký nghiệp vụ từ trigger và package. Không dùng FK để giữ sự kiện của đối tượng đã xóa.',
 'toeic_score_scale':'Bảng quy đổi tham khảo; tách dữ liệu thang điểm khỏi thuật toán chấm.'}
CONSTRAINT_SUMMARIES = {
 'toeic_roles':'code UNIQUE. role_id dùng IDENTITY bắt đầu 1000.',
 'toeic_users':'role_id tham chiếu ROLES. username và email UNIQUE; target_score từ 10 đến 990, mặc định 650; active thuộc 0 hoặc 1, mặc định 1. created_at mặc định UTC hiện tại.',
 'toeic_groups':'part_no từ 1 đến 7. group_id dùng IDENTITY bắt đầu 1000.',
 'toeic_questions':'group_id tham chiếu GROUPS; correct_choice thuộc A B C D. difficulty thuộc EASY MEDIUM HARD, mặc định MEDIUM; active mặc định 1. created_at mặc định UTC.',
 'toeic_choices':'question_id tham chiếu QUESTIONS, ON DELETE CASCADE. UNIQUE(question_id,choice_key); choice_key thuộc A B C D.',
 'toeic_exams':'slug UNIQUE. duration_minutes từ 1 đến 240; kind thuộc FULL_TEST MINI_TEST PRACTICE. status thuộc DRAFT PUBLISHED ARCHIVED, mặc định DRAFT. created_at mặc định UTC.',
 'toeic_exam_items':'FK exam_id đến EXAMS có ON DELETE CASCADE; FK question_id đến QUESTIONS. PK(exam_id,question_id), UNIQUE(exam_id,position); position lớn hơn 0.',
 'toeic_attempts':'FK user_id đến USERS và exam_id đến EXAMS. status thuộc IN_PROGRESS COMPLETED EXPIRED, mặc định IN_PROGRESS. started_at mặc định UTC; mỗi điểm nghe đọc từ 0 đến 495 khi có giá trị.',
 'toeic_answers':'FK attempt_id đến ATTEMPTS có ON DELETE CASCADE; FK question_id đến QUESTIONS. PK(attempt_id,question_id), UNIQUE(attempt_id,position). part_no từ 1 đến 7; choices_json IS JSON; selected_choice thuộc A B C D hoặc NULL; marked thuộc 0 hoặc 1, mặc định 0.',
 'toeic_lessons':'part_no từ 1 đến 7 khi có giá trị. duration_minutes lớn hơn 0, mặc định 10. lesson_id dùng IDENTITY.',
 'toeic_vocabulary':'word UNIQUE. word_id dùng IDENTITY bắt đầu 1000.',
 'toeic_saved_words':'PK(user_id,word_id). Hai FK đến USERS và VOCABULARY đều ON DELETE CASCADE. saved_at mặc định UTC hiện tại.',
 'toeic_audit':'audit_id dùng IDENTITY. created_at mặc định UTC hiện tại. Không FK theo chủ đích lưu lịch sử sự kiện.',
 'toeic_score_scale':'PK(section,raw_score). section thuộc LISTENING READING; raw_score từ 0 đến 100; scaled_score từ 5 đến 495.'}

TABLES=[]
for name, body in re.findall(r'CREATE TABLE (\w+) \((.*?)\n\) TABLESPACE', SCHEMA, re.S|re.I):
    columns, constraints=[],[]
    for item in split_sql(body):
        if re.match(r'^(CONSTRAINT|PRIMARY|UNIQUE|CHECK)\b',item,re.I):
            constraints.append(re.sub(r'\s+',' ',item)); continue
        m=re.match(r'(\w+)\s+(NUMBER(?:\([^)]*\))?|VARCHAR2\([^)]*\)|CHAR\([^)]*\)|TIMESTAMP|CLOB)(.*)',item,re.S|re.I)
        if not m: raise ValueError((name,item))
        field,typ,rest=m.groups()
        columns.append({'name':field,'type':typ,'declaration':re.sub(r'\s+',' ',rest.strip()),'meaning':DESCRIPTIONS.get(field,field)})
    TABLES.append({'name':name,'purpose':TABLE_PURPOSES[name],'columns':columns,'constraints':constraints})
assert len(TABLES)==14
BY_TABLE={t['name']:t for t in TABLES}
QUERY_TEXT=(ROOT/'database/10_queries.sql').read_text('utf-8')
QUERIES=[]
for match in re.finditer(r'^PROMPT (Q\d+) - ([^\n]+)\n(.*?)(?=^PROMPT |\Z)',QUERY_TEXT,re.M|re.S):
    code=re.sub(r'\n-- Expected:.*','',match.group(3),flags=re.S).strip()
    QUERIES.append({'id':match.group(1),'description':match.group(2).strip(),'sql':code})
assert len(QUERIES)>=15

doc=Document()
section=doc.sections[0]
for s in [section]:
    s.page_width=Cm(21);s.page_height=Cm(29.7)
    s.top_margin=Cm(2);s.bottom_margin=Cm(2);s.left_margin=Cm(3);s.right_margin=Cm(2)
    s.header_distance=Cm(.8);s.footer_distance=Cm(.8)
for style in doc.styles:
    if style.type not in (1,2):continue
    style.font.name='Times New Roman';style.font.color.rgb=RGBColor(0,0,0)
    fonts=style.element.get_or_add_rPr().get_or_add_rFonts()
    for key in ['asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme']:
        fonts.attrib.pop(qn('w:'+key),None)
    for key in ['ascii','hAnsi','eastAsia','cs']:fonts.set(qn('w:'+key),'Times New Roman')
    # Remove the template's decorative rule below Word's Title style.
    for border in list(style.element.findall('.//'+qn('w:pBdr'))):border.getparent().remove(border)
normal=doc.styles['Normal'];normal.font.size=Pt(13)
normal.paragraph_format.line_spacing=1.15
normal.paragraph_format.space_after=Pt(6)
normal.paragraph_format.widow_control=True
for name,size in [('Title',18),('Subtitle',15),('Heading 1',15),('Heading 2',13),('Heading 3',13),('Caption',12)]:
    doc.styles[name].font.size=Pt(size)
    doc.styles[name].paragraph_format.space_before=Pt(8)
    doc.styles[name].paragraph_format.space_after=Pt(6)
doc.styles['Title'].paragraph_format.space_after=Pt(14)
doc.core_properties.title='Báo cáo bài tập lớn Oracle hệ thống học và thi TOEIC'
doc.core_properties.subject='Đề số 21 năm học 2026–2027'
doc.core_properties.author=''
doc.core_properties.keywords='Oracle 19c TOEIC UTC BTL'

PAGES=[]
def para(text='',bold=False,align=None,size=None):
    p=doc.add_paragraph();p.alignment=align if align is not None else WD_ALIGN_PARAGRAPH.JUSTIFY
    r=p.add_run(text);r.bold=bold
    if size:r.font.size=Pt(size)
    return p
def heading(text,level=1): return doc.add_heading(text,level)
def table(headers,rows,widths=None,font=12,compact=False):
    t=doc.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    if widths:
        for c,w in zip(t.columns,widths):c.width=Cm(w)
    for i,head in enumerate(headers):t.rows[0].cells[i].text=str(head)
    for row in rows:
        for c,v in zip(t.add_row().cells,row):c.text=str(v)
    for ri,row in enumerate(t.rows):
        for ci,c in enumerate(row.cells):
            if widths:c.width=Cm(widths[ci])
            c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr=c._tc.get_or_add_tcPr()
            margin=OxmlElement('w:tcMar')
            for edge in ['top','left','bottom','right']:
                padding='35' if compact and edge in ['top','bottom'] else '65'
                e=OxmlElement('w:'+edge);e.set(qn('w:w'),padding);e.set(qn('w:type'),'dxa');margin.append(e)
            tcpr.append(margin)
            borders=OxmlElement('w:tcBorders')
            for edge in ['top','left','bottom','right']:
                e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
            tcpr.append(borders)
            shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'DDE7EF' if ri==0 else 'FFFFFF');tcpr.append(shade)
            for p in c.paragraphs:
                p.paragraph_format.space_after=Pt(.5 if compact else 2);p.paragraph_format.space_before=Pt(.5 if compact else 2);p.paragraph_format.line_spacing=1.03
                for r in p.runs:r.font.size=Pt(font);r.bold=ri==0
    repeat=OxmlElement('w:tblHeader');t.rows[0]._tr.get_or_add_trPr().append(repeat)
    gap=doc.add_paragraph();gap.paragraph_format.line_spacing=Pt(3);gap.paragraph_format.space_after=Pt(2)
    return t
def code(text,size=10.5):
    p=doc.add_paragraph();p.paragraph_format.space_before=Pt(2);p.paragraph_format.space_after=Pt(4);p.paragraph_format.line_spacing=1
    # Wrap code conservatively without changing the SQL stored in report-source.json.
    lines=[]
    max_chars=int(420/(size*.55))
    for line in text.splitlines():
        lines.extend(textwrap.wrap(line,max_chars,subsequent_indent='  ',replace_whitespace=False,drop_whitespace=False) or [''])
    r=p.add_run('\n'.join(lines));r.font.name='Consolas';r.font.size=Pt(size)
    return p
def page(title,chapter=None):
    if PAGES:doc.add_page_break()
    PAGES.append({'page':len(PAGES)+1,'title':title,'chapter':chapter or title})
    heading(title)
def dictionary(names):
    for name in names:
        t=BY_TABLE[name];heading(name.upper().replace('_',' '),2);para(t['purpose'])
        pk=[]
        for c in t['columns']:
            if 'PRIMARY KEY' in c['declaration'].upper():pk.append(c['name'])
        for s in t['constraints']:
            m=re.search(r'PRIMARY KEY\(([^)]*)\)',s,re.I)
            if m:pk+=m.group(1).split(',')
        rows=[]
        for c in t['columns']:
            flags=[];decl=c['declaration'].upper()
            if c['name'] in pk:flags.append('PK')
            if 'REFERENCES' in decl:flags.append('FK')
            if c['name'] not in pk:flags.append('NN' if 'NOT NULL' in decl else 'NULL')
            rows.append((c['name'],c['type'],', '.join(flags),c['meaning']))
        table(['Thuộc tính','Kiểu dữ liệu','Khóa','Ý nghĩa'],rows,[3.8,4.3,1.8,6.1],11.5,True)
        para('Ràng buộc: '+CONSTRAINT_SUMMARIES[name],size=11.5)

# Packaging pages are intentionally excluded from the content-page count.
para(META['school'],True,WD_ALIGN_PARAGRAPH.CENTER,16)
para('KHOA '+META.get('faculty',''),True,WD_ALIGN_PARAGRAPH.CENTER,14)
para('\n\n')
p=doc.add_paragraph('BÁO CÁO BÀI TẬP LỚN',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=doc.add_paragraph('CƠ SỞ DỮ LIỆU ORACLE',style='Subtitle');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
para('Đề số 21',True,WD_ALIGN_PARAGRAPH.CENTER,14)
para('HỆ THỐNG HỌC VÀ THI TOEIC\nCHO SINH VIÊN ĐẠI HỌC GIAO THÔNG VẬN TẢI',True,WD_ALIGN_PARAGRAPH.CENTER,15)
para('\n')
for label,key in [('Giảng viên hướng dẫn','lecturer'),('Lớp','class'),('Nhóm thực hiện','group')]:para(f'{label}: {META.get(key,"")}')
para('\n\nNăm học '+META['academicYear'],True,WD_ALIGN_PARAGRAPH.CENTER,13)
doc.add_page_break();heading('PHÂN CÔNG THÀNH VIÊN')
para('Thông tin thành viên, phần việc và tỷ lệ đóng góp được nhóm thống nhất và điền trước khi nộp. Bảng có tối đa năm thành viên theo yêu cầu của đề.')
table(['STT','Họ tên','Mã sinh viên','Nhiệm vụ','Đóng góp'],[(i,m['name'],m['studentId'],m['task'],m['contribution']) for i,m in enumerate(META['members'],1)],[1.3,3.8,3,5.2,2.7])
heading('Thông tin nộp và bảo vệ',2)
for text in ['Ngày thi:','Ngày nộp bản mềm:','Liên kết thư mục Drive đã chia sẻ giảng viên:','Ngày nộp một quyển bản cứng:']:
    para(text+' ')
para('Bản mềm Word cần nộp và chia sẻ cho giảng viên trước ngày thi ít nhất ba ngày. Khi bảo vệ, nhóm chuẩn bị bản cứng một quyển và các tệp script, log minh chứng kèm theo.')
doc.add_page_break();heading('MỤC LỤC')
toc_anchor=doc.add_paragraph();toc_anchor.paragraph_format.line_spacing=Pt(2);toc_anchor.paragraph_format.space_after=Pt(2)
para('Số trang trên tính từ phần nội dung. Danh mục bảng chi tiết và các mã truy vấn được đặt ngay trong chương liên quan để thuận tiện đối chiếu với mã nguồn.')
content_section=doc.add_section(WD_SECTION_START.NEW_PAGE)
content_section.footer.is_linked_to_previous=False
num=OxmlElement('w:pgNumType');num.set(qn('w:start'),'1');content_section._sectPr.append(num)
p=content_section.footer.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run();field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');r._r.addnext(field)

page('1 Giới thiệu đề tài và yêu cầu')
para('Đề tài xây dựng hệ thống học và thi TOEIC cho sinh viên Trường Đại học Giao thông Vận tải. Website hỗ trợ luyện tập theo từng kỹ năng, làm bài có thời gian, lưu kết quả và quản lý ngân hàng nội dung. Oracle Database là nơi lưu trữ dữ liệu nghiệp vụ và thực hiện các thủ tục tạo lượt thi, chụp nội dung, chấm điểm và ghi nhật ký.')
para('Dự án được phát triển từ một ứng dụng React và Express dùng MongoDB. Phương án nâng cấp giữ mô hình giao diện React, thay backend bằng ASP.NET Core và chuyển dữ liệu sang mô hình quan hệ Oracle. Cách chuyển đổi này tận dụng giao diện web, đồng thời cho phép thể hiện đầy đủ SQL, PL/SQL và các nội dung quản trị của học phần.')
heading('1 1 Ma trận yêu cầu của đề',2)
table(['Mục','Yêu cầu trọng tâm','Điểm','Thành phần đáp ứng'],[
('1','Giới thiệu đề tài, thực thể, mối quan hệ','0,5','Phần 1 đến 4; sơ đồ ERD'),('2','Bảng, PK, FK, ràng buộc; ít nhất 5 dòng mỗi bảng','1,5','01_schema.sql; Seed.cs; kiểm đếm Q17'),('3','Ít nhất 10 truy vấn cơ bản, lồng, nhóm và thống kê','1,5','20 truy vấn trong 10_queries.sql'),('4','Instance, tablespace, datafile, segment, extent, user và quyền','4,5','Bộ database/admin và màn hình Oracle'),('5','Minh họa backup và recovery database','1,0','Data Pump clone; bộ RMAN cold backup'),('6','Ứng dụng web đơn giản kết nối Oracle có CRUD','1,0','React 19; ASP.NET Core 10; ODP.NET')],[1.2,6.4,1.5,6.9],12)
para('Báo cáo đi kèm mã nguồn và script tái lập. Các kết quả kỳ vọng trong kịch bản được phân biệt với minh chứng chạy thực tế; thao tác dừng instance và phục hồi vật lý chỉ được ghi nhận khi có log của lần thực hiện.')

page('2 Phạm vi chức năng và quy tắc nghiệp vụ')
para('Người học có thể duyệt đề công khai, tìm bài học và từ vựng trước khi đăng nhập. Sau khi tạo tài khoản, học viên quản lý mục tiêu điểm, lưu từ, bắt đầu hoặc tiếp tục một lượt thi, đánh dấu câu cần xem lại và lưu lựa chọn. Khi nộp hoặc hết hạn, hệ thống khóa đáp án, chấm điểm và cho xem kết quả, giải thích cùng lịch sử học tập.')
table(['Vai trò','Phạm vi sử dụng'],[('STUDENT','Làm bài, xem lịch sử riêng, học bài, lưu từ và quản lý hồ sơ'),('TEACHER','Xem thống kê tổng hợp theo policy Reports'),('CONTENT_ADMIN','Quản lý đề, câu hỏi, nhóm, bài học, từ vựng và media; xem thống kê'),('ADMIN','Toàn bộ quản lý nội dung, tài khoản, nhật ký và thông tin Oracle'),('AUDITOR','Xem thống kê theo policy Reports; không sửa nội dung hoặc tài khoản')],[4.2,11.8],13)
heading('2 1 Quy tắc cần bảo toàn',2)
para('Một đề chứa mỗi câu hỏi nhiều nhất một lần và mỗi vị trí chỉ có một câu. Đề full test phải có đúng 200 câu theo cơ cấu 6/25/39/30/30/16/54. Khi công khai một nhóm nghe hoặc đọc, phải đưa đủ câu hỏi đang hoạt động của nhóm để người học có đủ ngữ cảnh.')
para('Mỗi học viên có nhiều lượt làm bài theo thời gian, nhưng không mở đồng thời hai lượt chưa kết thúc của cùng một đề. Thời hạn được tính từ đồng hồ Oracle; máy khách không được tự gửi điểm hoặc tự quyết định hết giờ. Việc lưu đáp án phải thuộc đúng học viên, đúng lượt thi và đúng tập lựa chọn của câu.')
para('Nội dung đề đã sử dụng được bảo toàn trong ảnh chụp của lượt thi. Sửa câu hỏi trong ngân hàng không làm thay đổi nội dung và đáp án của lịch sử. Đề đã có lượt thi được chuyển sang ARCHIVED khi xóa; các khóa ngoại ngăn xóa các bản ghi vẫn đang được tham chiếu.')

page('3 Kiến trúc ứng dụng và lựa chọn công nghệ')
table(['Tầng','Công nghệ','Trách nhiệm'],[('Giao diện','React 19 và Vite 7','Điều hướng, biểu mẫu, đồng hồ, bảng câu hỏi và thống kê'),('Dịch vụ web','ASP.NET Core 10','API, cookie, CSRF, policy phân quyền và kiểm tra đầu vào'),('Kết nối dữ liệu','ODP.NET Core 23.26.301','ODP.NET managed, bind parameter, transaction, CLOB'),('Dữ liệu','Oracle Database 19c','14 bảng, index, view, trigger và package PKG_TOEIC')],[2.6,5.4,8],13)
para('React là thư viện xây dựng giao diện, không phải cơ sở dữ liệu hay dịch vụ nghiệp vụ. Vì vậy chuyển sang Oracle không bắt buộc bỏ React. Backend ASP.NET Core cung cấp API để trình duyệt gọi; backend mới là thành phần kết nối trực tiếp tới Oracle. Không đưa connection string hay thông tin Oracle vào gói JavaScript.')
para('ASP.NET Core 10 được chọn cho backend mới; dự án không dùng .NET Framework cổ điển. Các endpoint được chia thành AuthEndpoints, LearningEndpoints và AdminEndpoints. Store.cs tập trung việc mở kết nối, bind tham số, đọc CLOB và gọi PL/SQL để tránh lặp mã truy cập dữ liệu.')
heading('3 1 Luồng một yêu cầu',2)
para('Trình duyệt gửi request cùng cookie; với thao tác thay đổi dữ liệu cần thêm X-CSRF-TOKEN. Middleware xác thực và policy kiểm tra người dùng. API mở kết nối TOEIC_APP, đặt CURRENT_SCHEMA=TOEIC_OWNER và ClientId theo người dùng ứng dụng. SQL có bind parameter hoặc lời gọi package được thực hiện trong giao dịch; sau commit, API trả JSON cho giao diện cập nhật.')
para('Khi phát hành, thư mục web/dist được phục vụ cùng origin với API để đơn giản hóa cookie và CSRF. Trong phát triển, Vite proxy API tới backend. Media của bộ đề mẫu phục vụ từ wwwroot/media, nên phần thi nghe không cần truy cập đường dẫn cloud cũ.')
para('Các trạng thái tải, dữ liệu trống và lỗi API phải được thể hiện trên giao diện. Lỗi kỹ thuật chi tiết ghi ở server cùng traceId; thông báo trả cho học viên sử dụng tiếng Việt và không chứa mật khẩu hoặc câu SQL.')

def erd_image():
    # Two diagrams share one legend; only actual schema foreign keys receive edges.
    img=Image.new('RGB',(2080,2180),'white');d=ImageDraw.Draw(img)
    f=ImageFont.truetype('C:/Windows/Fonts/times.ttf',34)
    fb=ImageFont.truetype('C:/Windows/Fonts/timesbd.ttf',39)
    boxes={}
    def box(name,x,y,keys):
        w,h=570,195;boxes[name]=(x,y,w,h)
        d.rectangle((x,y,x+w,y+h),outline='black',width=3)
        d.rectangle((x,y,x+w,y+52),fill='#E3EBF0',outline='black',width=2)
        d.text((x+14,y+5),name,font=fb,fill='black')
        for i,key in enumerate(keys):d.text((x+14,y+62+i*40),key,font=f,fill='black')
    def edge(parent,child,path):
        d.line(path,fill='#303030',width=3)
        a,b=path[0],path[1];last,prev=path[-1],path[-2]
        def unit(start,end):
            dx,dy=end[0]-start[0],end[1]-start[1];n=math.hypot(dx,dy);return dx/n,dy/n
        ux,uy=unit(a,b);px,py=-uy,ux
        cx,cy=a[0]+ux*17,a[1]+uy*17
        d.line((cx-px*14,cy-py*14,cx+px*14,cy+py*14),fill='black',width=3)
        ux,uy=unit(last,prev);px,py=-uy,ux
        stem=(last[0]+ux*30,last[1]+uy*30)
        for off in [-17,0,17]:d.line((last[0]+px*off,last[1]+py*off,*stem),fill='black',width=3)
        cx,cy=last[0]+ux*46,last[1]+uy*46
        d.ellipse((cx-9,cy-9,cx+9,cy+9),outline='black',width=3,fill='white')
    box('ROLES',20,40,['PK role_id'])
    box('USERS',710,40,['PK user_id','FK role_id'])
    box('ATTEMPTS',1400,40,['PK attempt_id','FK user_id, exam_id'])
    box('EXAMS',1400,430,['PK exam_id'])
    box('EXAM_ITEMS',710,430,['PK FK exam_id','PK FK question_id'])
    box('QUESTIONS',20,430,['PK question_id','FK group_id'])
    box('GROUPS',20,820,['PK group_id'])
    box('CHOICES',710,820,['PK choice_id','FK question_id'])
    box('ANSWERS',1400,820,['PK FK attempt_id','PK FK question_id'])
    edge('ROLES','USERS',[(590,135),(710,135)])
    edge('USERS','ATTEMPTS',[(1280,135),(1400,135)])
    edge('EXAMS','ATTEMPTS',[(1685,430),(1685,235)])
    edge('EXAMS','EXAM_ITEMS',[(1400,530),(1280,530)])
    edge('QUESTIONS','EXAM_ITEMS',[(590,530),(710,530)])
    edge('GROUPS','QUESTIONS',[(305,820),(305,625)])
    edge('QUESTIONS','CHOICES',[(590,580),(650,580),(650,920),(710,920)])
    edge('ATTEMPTS','ANSWERS',[(1970,180),(1990,180),(1990,915),(1970,915)])
    edge('QUESTIONS','ANSWERS',[(500,625),(500,740),(1350,740),(1350,920),(1400,920)])
    d.text((20,1140),'TOEIC_ là tiền tố của mọi tên bảng trong sơ đồ',font=fb,fill='black')
    box('USERS',20,1240,['PK user_id'])
    box('SAVED_WORDS',710,1240,['PK FK user_id','PK FK word_id'])
    box('VOCABULARY',1400,1240,['PK word_id'])
    edge('USERS','SAVED_WORDS',[(590,1335),(710,1335)])
    edge('VOCABULARY','SAVED_WORDS',[(1400,1335),(1280,1335)])
    box('LESSONS',20,1630,['PK lesson_id'])
    box('AUDIT',710,1630,['PK audit_id','Không FK nghiệp vụ'])
    box('SCORE_SCALE',1400,1630,['PK section, raw_score'])
    d.text((20,1930),'Ký hiệu  |  một bản ghi cha     O<  không hoặc nhiều bản ghi con',font=f,fill='black')
    d.text((20,1990),'PK  khóa chính     FK  khóa ngoại     USERS lặp để tách cụm đọc',font=f,fill='black')
    d.text((20,2050),'LESSONS AUDIT SCORE_SCALE không có khóa ngoại trong DDL',font=f,fill='black')
    path=TMP/'erd.png';img.save(path);return path
page('4 Mô hình thực thể và quan hệ')
para('Sơ đồ dùng ký pháp chân quạ. Đầu một thuộc bảng cha; đầu không hoặc nhiều thuộc bảng con. Các FK bắt buộc khiến mỗi bản ghi con tham chiếu đúng một bản ghi cha. USERS được vẽ lại ở cụm từ vựng để sơ đồ dễ đọc, vẫn là cùng một bảng.')
p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.add_run().add_picture(str(erd_image()),width=Cm(15.8))
doc.add_paragraph('Hình 1 Mô hình quan hệ theo database/01_schema.sql',style='Caption')
para('EXAM_ITEMS giải quan hệ nhiều nhiều giữa đề và câu hỏi; SAVED_WORDS giải quan hệ nhiều nhiều giữa học viên và từ vựng. ANSWERS đồng thời tham chiếu lượt thi và câu hỏi gốc, còn các trường nội dung trong bảng này là ảnh chụp có chủ đích để giữ lịch sử.',size=12)

page('5 Từ điển dữ liệu tài khoản và vai trò');para('PK là khóa chính, FK là khóa ngoại, NN là NOT NULL; NULL là cột cho phép bỏ trống. Khóa chính luôn NOT NULL.',size=11);dictionary(['toeic_roles','toeic_users'])
page('6 Từ điển dữ liệu nhóm và câu hỏi');dictionary(['toeic_groups','toeic_questions'])
page('7 Từ điển dữ liệu lựa chọn và đề thi');dictionary(['toeic_choices','toeic_exams'])
page('8 Từ điển dữ liệu cấu trúc đề và lượt thi');dictionary(['toeic_exam_items','toeic_attempts'])
page('9 Từ điển dữ liệu ảnh chụp câu trả lời');dictionary(['toeic_answers'])
para('Các FK question_id và attempt_id bảo đảm nguồn tham chiếu tồn tại. group_id ở đây là giá trị snapshot và không có FK trực tiếp. correct_choice ở snapshot không có CHECK riêng trong DDL hiện tại; giá trị được sao chép từ ngân hàng đã có CHECK. API kiểm tra selected_choice thực sự nằm trong choices_json trước khi cập nhật.')
page('10 Từ điển dữ liệu bài học và từ vựng');dictionary(['toeic_lessons','toeic_vocabulary','toeic_saved_words'])
page('11 Nhật ký thang điểm và cấu trúc truy cập');dictionary(['toeic_audit','toeic_score_scale'])
heading('11 1 Index và view',2)
para('Index trên group_id, question_id, role_id và các FK lượt thi hỗ trợ join và truy vấn theo học viên. Unique index UQ_TOEIC_OPEN_ATTEMPT dùng biểu thức CASE để chỉ giới hạn các lượt IN_PROGRESS; khi lượt đã kết thúc, học viên có thể làm lại cùng đề.')
para('View tóm tắt đề tổng hợp số câu nghe đọc. View tiến độ dùng LEFT JOIN để vẫn có học viên chưa làm bài. Các view giám sát giới hạn thông tin instance, datafile, segment và số dòng mà runtime được đọc; tài khoản web không có quyền đọc catalog toàn cục trực tiếp.')

page('12 Dữ liệu mẫu và kiểm soát chất lượng')
para('Bộ seed chuyển 103 nhóm nguồn thành 200 câu theo đủ bảy Part; giữ cả nhóm hội thoại và bài đọc. Part 2 có ba lựa chọn, các Part khác có bốn. Nội dung HTML được chuyển sang văn bản thuần, giữ xuống dòng và các ô bảng. Một nhãn sai ở câu 76 được sửa từ 0 thành C dựa trên tập lựa chọn A B D; đáp án D giữ nguyên.')
expected={'ROLES':5,'USERS':10,'GROUPS':len(CONTENT['groups']),'QUESTIONS':len(CONTENT['questions']),'CHOICES':sum(len(q['choices']) for q in CONTENT['questions']),'EXAMS':len(CONTENT['exams']),'EXAM_ITEMS':sum(len(e['questionIds']) for e in CONTENT['exams']),'ATTEMPTS':10,'ANSWERS':sum(len(CONTENT['exams'][i%len(CONTENT['exams'])]['questionIds']) for i in range(10)),'LESSONS':len(CONTENT['lessons']),'VOCABULARY':len(CONTENT['vocabulary']),'SAVED_WORDS':8,'AUDIT':'ít nhất 227','SCORE_SCALE':202}
table(['Bảng TOEIC','Số dòng dự kiến','Bảng TOEIC','Số dòng dự kiến'],[(list(expected)[i],list(expected.values())[i],list(expected)[i+7],list(expected.values())[i+7]) for i in range(7)],[4.6,3.4,4.6,3.4],12)
para('Các con số trên là dự kiến khi seed chạy trên schema mới, không thay thế kết quả COUNT(*) sau triển khai. Q17 kiểm đủ 14 bảng; mỗi bảng phải có ít nhất năm dòng. Seed kiểm tra bảng USERS để tránh tự chạy lặp vào hệ thống đang có dữ liệu, thực hiện các thao tác trong một giao dịch.')
table(['Part','1','2','3','4','5','6','7'],[('Số câu',6,25,39,30,30,16,54)],[2,2,2,2,2,2,2,2],12)
para('Có bảy đề dùng chung ngân hàng: full 200, mini 50, nghe 100, đọc 100, Part 5 gồm 30, Part 1 gồm 6 và Part 7 gồm 54 câu. Có bảy bài học tiếng Việt và 45 từ vựng. Toàn bộ 54 MP3 và 10 PNG dùng đường dẫn cục bộ /media; danh mục URL và SHA-256 lưu trong docs/content-source.md.')
para('Điểm thang 10–990 chỉ là quy đổi tham khảo cho tự học. Không sử dụng kết quả demo như chứng chỉ hoặc bảng quy đổi chính thức. Các lượt thi mẫu được Seed.cs tạo để minh họa thống kê; không phải kết quả thi của người thật.')

query_explanations={
 0:'Nhóm đầu minh họa lọc và giới hạn dòng, hàm chuỗi, CASE, INNER JOIN và truy vấn con vô hướng. Các câu truy vấn chỉ đọc, không chọn password_hash hoặc đáp án đúng. Giá trị trả về phụ thuộc dữ liệu tại thời điểm chạy.',
 1:'Nhóm thứ hai dùng NOT EXISTS, IN, GROUP BY, HAVING, hàm tổng hợp, CTE và LEFT JOIN. COUNT trên khóa bảng con giúp phân biệt không có bản ghi với một dòng rỗng do outer join. NVL chuyển tổng rỗng thành 0 khi phù hợp.',
 2:'Nhóm thứ ba sử dụng analytic DENSE_RANK và LAG, nhóm theo tháng UTC, tổng hợp có điều kiện, NULLIF tránh chia cho 0, và join nhiều nhiều. Xếp hạng dựa trên điểm tốt nhất nên một người không chiếm nhiều vị trí.',
 3:'Nhóm cuối phục vụ quản trị dữ liệu và kiểm chứng: nhóm nhật ký, UNION ALL kiểm đếm 14 bảng, phát hiện tập lựa chọn sai, gọi hàm PL/SQL và đọc view tiến độ. Q18 hợp lệ phải trả 0 dòng, với Part 2 yêu cầu 3 lựa chọn.'}
query_titles=['Lọc và sắp xếp đề công khai','Hàm chuỗi và CASE','Join người dùng và vai trò','Join cấu trúc đề thi','Truy vấn lồng so với điểm trung bình','NOT EXISTS tìm đề chưa có lượt thi','IN tìm nhóm có câu khó','GROUP BY và HAVING đề có từ năm câu','Hàm thống kê kết quả theo đề','CTE và LEFT JOIN đủ bảy Part','DENSE RANK xếp hạng điểm tốt nhất','LAG so sánh với lượt trước','Nhóm kết quả theo tháng UTC','Tính độ chính xác theo Part','Join các từ đã lưu','Thống kê nhật ký theo đối tượng','UNION ALL kiểm đếm mười bốn bảng','Kiểm tra tập lựa chọn theo từng Part','Gọi hàm PL SQL trong SQL','Đọc view tiến độ học viên']
for batch in range(4):
    page(f'{13+batch} Truy vấn SQL nhóm {batch+1}')
    para(query_explanations[batch],size=12)
    for q in QUERIES[batch*5:(batch+1)*5]:
        heading(q['id']+' '+query_titles[int(q['id'][1:])-1],2)
        code(q['sql'],10)

page('17 PL SQL tạo lượt thi và chấm điểm')
para('Package PKG_TOEIC đặt các thao tác cần nhất quán gần dữ liệu. START_ATTEMPT khóa bản ghi người dùng, kiểm tra tài khoản và đề công khai, xử lý lượt cũ đã hết hạn, rồi tạo lượt mới. Thời hạn bằng UTC hiện tại cộng số phút của đề; học viên không truyền thời hạn từ trình duyệt.')
para('Sau khi tạo lượt, package INSERT SELECT toàn bộ câu vào TOEIC_ANSWERS theo vị trí đề, kèm prompt, passage, JSON phương án, media, giải thích và đáp án đúng. Snapshot bảo đảm người học có cùng nội dung khi tải lại và kết quả cũ không đổi khi ngân hàng được biên tập về sau.')
code('BEGIN\n  pkg_toeic.start_attempt(:user_id, :exam_id, :attempt_id);\nEND;\n/\nBEGIN\n  pkg_toeic.submit_attempt(:user_id, :attempt_id);\nEND;\n/',12)
para('SUBMIT_ATTEMPT khóa lượt bằng FOR UPDATE và kiểm tra đúng user_id. Nếu trạng thái đã kết thúc thì trả về, tránh cộng điểm lần hai. Mỗi câu được so sánh selected_choice với correct_choice; bỏ trống tính sai. Kết quả được tổng hợp riêng Part 1–4 và Part 5–7 rồi tra TOEIC_SCORE_SCALE.')
para('Với bộ luyện có ít hơn 100 câu một kỹ năng, hàm SCALED_SCORE chuẩn hóa số đúng về thang 0–100 trước khi tra. Nếu không có câu của kỹ năng đó, hàm trả 0. Trạng thái EXPIRED được xác định khi thời điểm nộp không sớm hơn expires_at; submitted_at và elapsed_seconds bị chặn tại hạn nộp.')
para('Package không COMMIT bên trong. API sở hữu giao dịch và commit sau khi cả cập nhật đáp án, kết quả và nhật ký thành công. Khi exception xảy ra, dispose giao dịch hủy phần chưa commit; API trả lỗi và học viên có thể tải lại trạng thái thật từ server.')

page('18 Bảo mật và tính toàn vẹn nghiệp vụ')
para('Mật khẩu dùng PasswordHasher của ASP.NET Core với PBKDF2 và salt theo định dạng của framework. Đăng ký luôn gán STUDENT bằng truy vấn nội bộ, không nhận role từ request. Cookie phiên có HttpOnly và SameSite Strict; phiên được kiểm lại active và role trong Oracle để việc khóa hoặc đổi quyền có hiệu lực khi có yêu cầu tiếp theo.')
para('CSRF được kiểm tra cho các API thay đổi dữ liệu. Giao diện lấy request token từ /api/auth/csrf rồi gửi X-CSRF-TOKEN; cookie đơn thuần không đủ để thực hiện thao tác. Khi triển khai qua HTTPS cần cấu hình cookie Secure phù hợp. Rate limiting áp dụng cho đăng nhập, đăng ký và đổi mật khẩu.')
para('Policy Content cho ADMIN và CONTENT_ADMIN; Admin chỉ cho ADMIN; Reports cho các vai trò được xem thống kê. API của học viên truy vấn bằng cả attempt_id và user_id, tránh đọc lịch sử của người khác. API đang làm bài loại correctChoice, explanation và isCorrect khỏi JSON trước khi trả; chỉ công bố sau khi kết thúc.')
para('Store.Command dùng BindByName và OracleParameter. Đầu vào không được nối thành câu SQL; CLOB được bind cho nội dung dài. Các UNIQUE, PK, FK và CHECK là lớp kiểm soát cuối; API bổ sung quy tắc vượt quá một dòng như tập lựa chọn và cơ cấu full test.')
heading('18 1 Nhật ký và phạm vi bảo vệ',2)
para('Trigger ghi INSERT UPDATE DELETE trên đề và câu hỏi. ClientId của kết nối đưa danh tính ứng dụng vào SYS_CONTEXT. Package ghi START và SUBMIT, API ghi REGISTER và đổi tài khoản. Nhật ký cùng giao dịch với thay đổi, nên thao tác rollback không tạo sự kiện thành công giả.')
para('Nhật ký này phục vụ minh họa nghiệp vụ, chưa phải kho chứng cứ chống can thiệp: runtime hiện được cấp DML trên các bảng nghiệp vụ. Khi triển khai thực tế có thể tách quyền ghi audit qua package và lưu log sang hệ thống độc lập. Tài khoản web không có quyền DDL, DBA hoặc thao tác shutdown.')

page('19 Quản trị instance Oracle')
para('Môi trường quan sát phục vụ dự án là ORCL non CDB, Oracle 19c, kết nối localhost:1521/orcl, READ WRITE và NOARCHIVELOG. Các thông số này cần kiểm tra lại bằng 00_inspect.sql trước buổi thực hành vì trạng thái instance có thể thay đổi. Đọc thông tin không đồng nghĩa đã thực hiện chuyển chế độ.')
table(['Trạng thái','Ý nghĩa','Truy vấn minh chứng'],[('NOMOUNT','Khởi tạo instance, đọc tham số, chưa mở controlfile','V$INSTANCE.STATUS = STARTED'),('MOUNT','Mở controlfile, chưa mở datafiles để sử dụng','STATUS = MOUNTED'),('OPEN','Mở các file cần thiết, database sẵn sàng','STATUS = OPEN; OPEN_MODE = READ WRITE')],[2.6,8,5.4],12)
code('SHUTDOWN IMMEDIATE\nSTARTUP NOMOUNT\nALTER DATABASE MOUNT;\nALTER DATABASE OPEN;\nSELECT instance_name,status,logins FROM v$instance;\nSELECT name,open_mode,log_mode FROM v$database;',11)
para('SHUTDOWN NORMAL chờ người dùng ngắt kết nối. TRANSACTIONAL chờ giao dịch kết thúc rồi ngắt phiên. IMMEDIATE ngắt phiên và rollback giao dịch chưa commit. ABORT không dùng trong bài minh họa thông thường; sau sự cố cần hoàn tất instance recovery trước khi tạo cold backup nhất quán. [1]')
para('Để minh họa READ ONLY, shutdown sạch, STARTUP MOUNT rồi ALTER DATABASE OPEN READ ONLY; sau đó khởi động lại để trả READ WRITE. ALTER SYSTEM ENABLE RESTRICTED SESSION hạn chế đăng nhập mới của tài khoản không có quyền tương ứng, không tự ngắt phiên đã tồn tại. Cuối bài chạy DISABLE RESTRICTED SESSION và kiểm tra LOGINS=ALLOWED. [1]')
para('File 01_instance_modes.sql có xác nhận nhập tay vì ảnh hưởng toàn ORCL. Người thực hành dừng website và các session khác, lưu log từng trạng thái và bảo đảm trạng thái cuối OPEN READ WRITE. Báo cáo không ghi đã demo shutdown khi chưa có log chạy thật.')

page('20 Tablespace datafile segment và extent')
para('TOEIC_DATA chứa đối tượng nghiệp vụ. Các thao tác thực hành dùng TOEIC_ADMIN_DEMO riêng để không thay đổi trực tiếp cấu trúc lưu trữ của website. Kịch bản tạo hai datafile, tăng kích thước, tắt/bật autoextend, di chuyển file bằng lệnh Oracle rồi đưa về vị trí ban đầu.')
code("CREATE TABLESPACE toeic_admin_demo\n DATAFILE '<demo_dir>\\demo01.dbf' SIZE 20M\n AUTOEXTEND ON NEXT 1M MAXSIZE 100M\n EXTENT MANAGEMENT LOCAL SEGMENT SPACE MANAGEMENT AUTO;\nALTER TABLESPACE toeic_admin_demo ADD DATAFILE\n '<demo_dir>\\demo02.dbf' SIZE 10M AUTOEXTEND OFF;\nALTER DATABASE DATAFILE '<demo_dir>\\demo01.dbf' RESIZE 24M;\nALTER DATABASE MOVE DATAFILE '<demo_dir>\\demo01.dbf'\n TO '<demo_dir>\\moved\\demo01.dbf';",11)
para('Đường dẫn demo_dir được khai báo trong file 02, không phải chuỗi dùng trực tiếp trong lệnh minh họa trên. Thư mục vật lý phải tồn tại và dịch vụ Oracle có quyền ghi. RESIZE xác định kích thước tuyệt đối; AUTOEXTEND điều chỉnh cách tăng khi cần. MAXSIZE giới hạn tăng, không phải dung lượng đã dùng. Không di chuyển datafile đang mở bằng Explorer.')
para('Một tablespace gồm các datafile; một segment gồm các extent; mỗi extent gồm các block liên tiếp trong một datafile. Bảng, index và LOB có thể có segment riêng. Deferred segment creation khiến một bảng trống chưa có segment. NUM_ROWS là thống kê, cần COUNT(*) để kiểm số dòng thực tế.')
code("SELECT tablespace_name,file_name,bytes,autoextensible,maxbytes\nFROM dba_data_files WHERE tablespace_name='TOEIC_ADMIN_DEMO';\nSELECT segment_name,segment_type,bytes,extents\nFROM dba_segments WHERE owner='TOEIC_OWNER';\nSELECT segment_name,extent_id,file_id,block_id,blocks\nFROM dba_extents WHERE owner='TOEIC_OWNER'\nORDER BY segment_name,extent_id;",11)
para('File 03 truy vấn segment extent và free space. File 90 chỉ dọn các đối tượng demo đã định danh sau khi kiểm tra. Khi bảo vệ, chụp thông tin trước và sau thao tác, rồi xác nhận tablespace ở READ WRITE và datafile trở lại đường dẫn ban đầu.')
if ADMIN_RESULTS.get('passed'):
    para('Đã chạy sandbox ngày 17/10/2026: tạo thêm, resize và move datafile; tắt bật autoextend; READ ONLY rồi READ WRITE riêng tablespace. Đã dọn sandbox, ORCL vẫn READ WRITE và 14 bảng nguồn hợp lệ. Minh chứng: docs/admin-verification.json.',size=11.5)

page('21 Người dùng role privilege và profile')
para('Có hai tầng phân quyền. TOEIC_ROLES là dữ liệu vai trò website, còn Oracle user và role quy định quyền kết nối SQL. Học viên đăng nhập web không được cấp user Oracle riêng. Thay role từ STUDENT sang ADMIN trong website không trao quyền SYSDBA.')
table(['Chủ thể Oracle','Mục đích','Giới hạn'],[('TOEIC_OWNER','Tạo và sở hữu bảng view trigger package','Không dùng làm tài khoản runtime thường xuyên'),('TOEIC_APP','Kết nối từ ASP.NET Core','CREATE SESSION và TOEIC_RUNTIME, không DDL'),('TOEIC_RUNTIME','Nhóm object privileges nghiệp vụ','DML bảng, SELECT view được cấp, EXECUTE package'),('TOEIC_DEMO','Minh họa user profile quota','Chỉ đối tượng sandbox và view được cấp'),('TOEIC_BACKUP','Chạy Data Pump ở cửa sổ bảo trì','Tài khoản quản trị backup riêng, không dùng cho web')],[4.3,5.3,6.4],12)
code("CREATE PROFILE toeic_demo_profile LIMIT\n FAILED_LOGIN_ATTEMPTS 5 PASSWORD_LOCK_TIME 1/24\n PASSWORD_LIFE_TIME 90 PASSWORD_GRACE_TIME 7;\nCREATE ROLE toeic_demo_reader;\nGRANT SELECT ON toeic_owner.vw_toeic_exam_summary\n TO toeic_demo_reader;\nGRANT toeic_demo_reader TO toeic_demo;\nREVOKE toeic_demo_reader FROM toeic_demo;",11)
para('File 04 nhập mật khẩu bằng ACCEPT HIDE, tạo quota 5 MB ở tablespace demo và trình bày GRANT REVOKE LOCK UNLOCK. Profile điều khiển giới hạn mật khẩu; giới hạn tài nguyên như SESSIONS_PER_USER còn phụ thuộc RESOURCE_LIMIT. Kịch bản không tự đổi tham số toàn instance.')
if ADMIN_RESULTS.get('passed'):
    para('Đã kiểm tra DBA_USERS, DBA_SYS_PRIVS, DBA_ROLE_PRIVS, DBA_TAB_PRIVS, DBA_TS_QUOTAS và DBA_PROFILES trong sandbox. Phiên TOEIC_DEMO đọc được view, bị ORA-00942 với TOEIC_USERS. Sau REVOKE rồi GRANT lại, đặt lại DEFAULT ROLE để role hoạt động ở phiên mới. User, role và profile demo đã được dọn; log trong docs/admin-verification.json.')
else:
    para('Kiểm chứng gồm DBA_USERS, DBA_SYS_PRIVS, DBA_ROLE_PRIVS, DBA_TAB_PRIVS, DBA_TS_QUOTAS và DBA_PROFILES. Trong phiên TOEIC_DEMO, SELECT view được cấp phải thành công; SELECT bảng TOEIC_USERS chưa được cấp phải bị từ chối. Lỗi từ chối là kết quả kỳ vọng của kiểm thử quyền, không phải lỗi triển khai.')
para('Không cấp DBA, SELECT ANY TABLE hoặc UNLIMITED TABLESPACE cho tài khoản web. Secrets cấu hình cục bộ không đưa vào mã nguồn hoặc ảnh báo cáo. Các tài khoản mẫu chỉ phục vụ trình diễn; đổi mật khẩu và quản lý secrets trước khi triển khai ngoài môi trường học tập.')

page('22 Sao lưu và phục hồi logic bằng Data Pump')
para('Data Pump sao lưu và phục hồi schema hoặc đối tượng. Phương án của dự án export TOEIC_OWNER và import sang TOEIC_RESTORE để kiểm chứng mà không ghi đè dữ liệu nguồn. Phục hồi logic không thay thế backup vật lý dùng khi instance hoặc datafile hỏng. [2]')
code('expdp TOEIC_BACKUP@localhost:1521/orcl\n PARFILE=database/admin/21_datapump_export.par\nimpdp TOEIC_BACKUP@localhost:1521/orcl\n PARFILE=database/admin/22_datapump_import.par',11)
para('Các dòng lệnh trên được viết nhiều dòng để dễ đọc; khi chạy, đặt mỗi lệnh utility trên một dòng hoặc dùng cú pháp nối dòng của shell. Mật khẩu nhập tại prompt, không nằm trong parfile. File 20 chuẩn bị directory và clone trống; folder dump phải có quyền ghi cho Oracle service.')
para('TOEIC_BACKUP cần CREATE TABLE và quota 32 MB để Data Pump tạo master table của job. Lần remap các cột identity trên Oracle 19c của dự án cần cấp tạm ALTER ANY SEQUENCE. scripts/backup-demo.ps1 thu hồi quyền này và khóa tài khoản trong khối finally sau job; tài khoản web không nhận các quyền backup.',size=12)
table(['Thông số','Tác dụng'],[('SCHEMAS=TOEIC_OWNER','Chỉ định schema nguồn'),('FLASHBACK_TIME=\nSYSTIMESTAMP','Ảnh chụp logic nhất quán khi đủ undo'),('REUSE_DUMPFILES=NO','Không tự ghi đè dump cũ'),('REMAP_SCHEMA','Đổi đích sang TOEIC_RESTORE'),('REMAP_TABLESPACE','Đưa đối tượng sang TOEIC_RESTORE_DATA'),('EXCLUDE USER và GRANT','Không sao chép tài khoản/quyền nguồn vào clone')],[6,10],12)
para('Trước export, tạm dừng thao tác ghi để việc đối chiếu nguồn và clone có cùng mốc. Chạy export, đọc log, rồi import vào clone trống. File 23 so sánh số dòng, kiểm tra object INVALID và các tham chiếu schema nguồn còn sót. Data Pump không đảm bảo thay mọi chuỗi schema trong thân PL/SQL, nên phải kiểm tra riêng.')
if BACKUP.get('allCountsMatch') and BACKUP.get('questionPayloadMatches'):
    para('Kết quả thực tế '+local_time(BACKUP['startedAt'])+' đến '+local_time(BACKUP['completedAt'],False)+' giờ Việt Nam: export và import clone thành công, dump '+f"{BACKUP['dumpBytes']:,}".replace(',','.')+' byte. Cả 14 bảng khớp số dòng và nội dung câu hỏi khớp; owner và clone không có object INVALID. TOEIC_BACKUP đã được khóa, ALTER ANY SEQUENCE đã thu hồi. Minh chứng: docs/backup-verification.json và log trong .local/oracle-backup/datapump.',size=12)
else:
    para('Minh chứng phục hồi cần cả log export, log import và kiểm tra clone; một file dump tồn tại chưa đủ chứng minh đã restore. File 91 chỉ dọn schema/tablespace clone đã định danh. Giữ dump và log ở bản sao khác thiết bị để tránh mất cùng ổ với database. Nếu chưa chạy utility, mục kết quả giữ trống và trình bày đây là kịch bản.')

page('23 Backup vật lý RMAN trong NOARCHIVELOG')
para('ORCL hiện dùng NOARCHIVELOG. Kịch bản vật lý phải tạo bản backup nhất quán sau shutdown sạch, rồi mount để backup. Trong chế độ này không dùng BACKUP PLUS ARCHIVELOG như một hệ thống đang lưu archived redo. Mọi schema trên instance cùng bị gián đoạn trong cửa sổ bảo trì. [3]')
code("SHUTDOWN IMMEDIATE;\nSTARTUP MOUNT;\nRUN {\n ALLOCATE CHANNEL c1 DEVICE TYPE DISK;\n BACKUP DATABASE FORMAT '<backup_dir>\\db_%d_%T_%U.bkp'\n  TAG 'TOEIC_COLD_MANUAL';\n BACKUP SPFILE FORMAT '<backup_dir>\\spfile_%U.bkp';\n BACKUP CURRENT CONTROLFILE\n  FORMAT '<backup_dir>\\control_%U.bkp';\n RELEASE CHANNEL c1;\n}\nALTER DATABASE OPEN;",11)
para('File 30 chứa đường dẫn thật của thư mục .local/oracle-backup/rman. Kiểm tra DBID, REPORT SCHEMA, dung lượng toàn database và quyền ghi trước khi chạy. Lưu database, SPFILE và controlfile cùng mốc, kèm log và danh mục backup pieces. Nếu vừa ABORT, cần hoàn tất instance recovery rồi shutdown sạch trước khi backup.')
para('File 31 RESTORE VALIDATE kiểm tra khả năng đọc backup, không ghi đè datafile và không được báo là đã khôi phục thực tế. File 32 là template đã comment cho instance cách ly: NOMOUNT, restore controlfile phù hợp, MOUNT, restore database, RECOVER DATABASE NOREDO, OPEN RESETLOGS. Với NOARCHIVELOG, các thay đổi sau mốc cold backup không được khôi phục nếu không có dữ liệu backup bổ sung. [3]')
para('Không thực hành ghi đè toàn ORCL dùng chung để lấy ảnh minh họa. Trên instance cách ly phải kiểm tra mọi đường dẫn datafile hoặc chuẩn bị SET NEWNAME và SWITCH tương ứng. Restore không có rollback SQL; sau RESETLOGS tạo một cold backup mới. Báo cáo chỉ ghi đã backup hoặc restore vật lý khi có log thực tế của thao tác đó.')

page('24 Cài đặt và hướng dẫn vận hành website')
para('Môi trường chạy cần Node đáp ứng engines của package, .NET SDK 10, Oracle 19c và listener cho service orcl. Oracle service chạy chưa đồng nghĩa schema đã tồn tại; cần bootstrap tablespace, owner, runtime, DDL, PL/SQL và seed. scripts/setup.ps1 thực hiện thiết lập theo thứ tự, kiểm tra lỗi biên dịch object trước khi nạp dữ liệu.')
code('npm install\nnpm run setup\nnpm run dev\n\n# Kiểm tra build riêng\nnpm run build\n# Kiểm thử tự động của dự án\nnpm test',12)
para('Lệnh setup cần tài khoản Windows có thể dùng SQL*Plus OS authentication tại máy Oracle. Connection string được lưu trong appsettings.Local.json và secrets cục bộ, không đưa vào repo. Backend mở kết nối TOEIC_APP, dùng schema TOEIC_OWNER; frontend không giữ tài khoản Oracle. Khi đóng gói phát hành, thực hiện build và phục vụ web/dist theo cấu hình dự án.')
heading('24 1 Luồng học viên',2)
para('Học viên đăng ký hoặc đăng nhập, xem dashboard và chọn đề. Trang chi tiết hiển thị loại đề, số câu từng Part và thời lượng. Bấm bắt đầu tạo snapshot; chọn đáp án, đánh dấu xem lại và lưu. Tải lại trang phải tiếp tục đúng lượt còn thời gian. Nộp bài hoặc hết hạn dẫn đến kết quả, phân tích từng Part, đáp án và transcript.')
heading('24 2 Luồng quản trị',2)
para('ADMIN hoặc CONTENT_ADMIN quản lý ngân hàng câu, media, bài học, từ vựng và đề. Đề mới có thể lưu nháp; khi công khai phải thỏa quy tắc số câu và đủ nhóm. Trước khi sửa câu của đề công khai, chuyển đề về nháp. ADMIN còn quản lý tài khoản, xem audit và trang Oracle; các vai trò chỉ xem báo cáo không được dùng API chỉnh sửa.')
para('Khi API báo lỗi mạng, giữ dữ liệu đang nhập và cho thử lại; sau lưu hoặc nộp cần tải trạng thái server. Khi Oracle chưa sẵn sàng, kiểm tra /api/health và log backend thay vì thay đổi trạng thái database từ website.')

page('25 Kịch bản kiểm thử và minh chứng')
if API_RESULTS.get('passed')==23 and API_RESULTS.get('failed')==0:
    para('Kiểm thử API với Oracle thật ngày 17/10/2026, từ '+local_time(API_RESULTS['startedAt'],False)+' đến '+local_time(API_RESULTS['finishedAt'],False)+' giờ Việt Nam: 23/23 ca đạt. Bảng đối chiếu dùng docs/api-test-results.json; các thao tác giao diện được kiểm tra riêng.',size=12)
else:
    para('Kết quả thật chỉ được điền khi có log của lần thực hiện. Kết quả kỳ vọng không thay thế minh chứng kiểm thử.')
test_rows=[
('T01','Đăng ký kèm role ADMIN','Tài khoản mới vẫn STUDENT'),('T02','Mật khẩu cũ hoặc tài khoản khóa','401, không có phiên hợp lệ'),('T03','Gửi request thiếu CSRF token','400, dữ liệu không đổi'),('T04','STUDENT gọi API quản trị','403'),('T05','Trùng câu trong payload','400, không cộng lặp'),('T06','Gửi câu không thuộc lượt thi','400'),('T07','Đọc lượt của người khác','Không trả nội dung'),('T08','Tải lại lượt đang làm','Giữ lựa chọn và hạn từ server'),('T09','Nộp bài lần hai','Kết quả không tăng'),('T10','Nộp sau hạn','EXPIRED, không nhận thêm đáp án'),('T11','Sửa ngân hàng sau lượt đã kết thúc','Snapshot giữ nội dung cũ'),('T12','Part 2 và các Part còn lại','3 lựa chọn ở Part 2; 4 ở phần khác'),('T13','Xuất bản full test thiếu nhóm','400'),('T14','Đếm 14 bảng bằng Q17','Mọi bảng ít nhất 5 dòng'),('T15','Import Data Pump vào clone','Count và payload khớp, object hợp lệ')]
test_pass={
 'T01':passed('Registration ignores injected administrator roles'),
 'T02':passed('QA profile and password update affect only the authenticated account','Disabling a QA account invalidates its existing authentication cookie'),
 'T03':passed('Missing CSRF token is rejected with HTTP 400'),
 'T04':passed('Student, teacher and editor policies enforce least privilege'),
 'T05':passed('Duplicate, foreign-question and invalid-choice answer payloads are rejected'),
 'T06':passed('Duplicate, foreign-question and invalid-choice answer payloads are rejected'),
 'T07':passed('A different QA account cannot read, answer or submit another account attempt'),
 'T08':UI_VERIFIED,
 'T09':passed('Submission uses snapshot keys, caps scores, and remains idempotent'),
 'T10':passed('Oracle expiry finalizes the QA attempt and refuses late answer mutation'),
 'T11':passed('Attempt snapshots survive draft conversion and later question answer changes'),
 'T12':passed('Administrator creates and edits QA questions with correct Part 2 choices'),
 'T13':passed('Draft exam CRUD, duplicate question rejection and full-test structure validation','Draft exams stay private and cannot start; publishing requires complete groups'),
 'T14':API_RESULTS.get('oracleQueries',{}).get('allTablesAtLeastFive') is True,
 'T15':BACKUP.get('allCountsMatch') is True and BACKUP.get('questionPayloadMatches') is True}
test_status=lambda key:('Đạt UI' if key=='T08' else 'Đạt backup' if key=='T15' else 'Đạt API') if test_pass[key] else 'Chưa kiểm tra'
table(['Mã','Thao tác','Kết quả kỳ vọng','Kết quả thật'],[(a,b,c,test_status(a)) for a,b,c in test_rows],[1.1,5.2,6,3.7],11.5,True)
heading('25 1 Kết quả đối chiếu bổ sung',2)
if EVIDENCE.get('build',{}).get('passed'):
    para('Build React/Vite và ASP.NET Core đạt, 0 warning và 0 error. npm audit và NuGet audit cùng báo 0 gói có lỗ hổng tại thời điểm kiểm tra. Cả 20 SQL đã chạy; 14/14 bảng có ít nhất 5 dòng. Nguồn tổng hợp: docs/verification.json.',size=11.5)
if UI_VERIFIED:
    para('Trên giao diện di động, Photo Sprint được mở với hạn 6 phút; đổi A sang D, đánh dấu và tải lại vẫn giữ lựa chọn. Nộp bài được 1/6 câu đúng, Listening 60 và Reading 0 theo bảng quy đổi tham khảo. Ảnh minh chứng: docs/screenshots/exam-mobile.png và result-mobile.png.',size=11.5)
if EVIDENCE:
    para('Chưa thực hiện shutdown, chuyển READ ONLY hoặc backup/restore vật lý RMAN trên ORCL dùng chung. Các lệnh tương ứng vẫn là kịch bản, không được tính là kết quả đã trình diễn.',size=11.5)
else:
    para('Kết quả chạy thực tế:                         Ngày kiểm tra:                         Người thực hiện:                         Đường dẫn log:                         ',size=12)

page('26 Kết luận và tài liệu tham khảo')
para('Thiết kế sử dụng Oracle làm hệ quản trị dữ liệu trung tâm cho website TOEIC. Mô hình 14 bảng tách tài khoản, ngân hàng câu hỏi, cấu trúc đề, lượt làm bài, ảnh chụp câu trả lời, học liệu và nhật ký. Các khóa, ràng buộc và package phối hợp để hạn chế dữ liệu trùng, bảo toàn lịch sử và chấm điểm trên máy chủ.')
if EVIDENCE.get('apiTests',{}).get('passed')==23 and BACKUP.get('allCountsMatch'):
    para('Kiểm chứng thực tế đạt 23/23 ca API, chạy đủ 20 SQL và xác nhận 14/14 bảng có ít nhất năm dòng. Data Pump đã export schema và phục hồi clone, đối chiếu đủ số dòng cùng nội dung câu hỏi; build và kiểm tra thư viện đều đạt tại thời điểm ghi nhận. Phần shutdown, đổi chế độ instance và RMAN vật lý chưa thực hiện trên ORCL dùng chung, được trình bày bằng kịch bản riêng.')
else:
    para('Bộ mã nguồn có các luồng học viên và quản trị, hai mươi truy vấn SQL, kịch bản quản trị instance và lưu trữ, phân quyền tài khoản Oracle, Data Pump phục hồi clone và RMAN cold backup theo NOARCHIVELOG. Hoàn thành kịch bản và hoàn thành trình diễn là hai trạng thái khác nhau; việc bảo vệ cần bổ sung log thật cho các thao tác đã thực hiện.')
para('Các bước phát triển tiếp theo gồm bổ sung ngân hàng đề độc lập, kiểm chuẩn độ khó, tách quyền ghi audit, tăng khả năng quan sát và triển khai HTTPS với quản lý secrets. Thang điểm hiện phục vụ tự học, cần hiệu chuẩn trước khi dùng cho đánh giá chính thức.')
heading('26 1 Tài liệu của dự án',2)
para('Đề Thi Oracle UTC_CQ 2026.pdf, mục I và III; database/01_schema.sql; database/02_packages.sql; database/10_queries.sql; database/admin; docs/oracle-administration.md; docs/content-source.md; server/Toeic.Api; web. Các tệp này là nguồn trực tiếp của mô hình và hướng dẫn trong báo cáo.',size=12,align=WD_ALIGN_PARAGRAPH.LEFT)
heading('26 2 Tài liệu kỹ thuật chính thức',2)
refs=[
('[1] Oracle Database 19c Administrator Guide Starting Up and Shutting Down','https://docs.oracle.com/en/database/oracle/oracle-database/19/admin/starting-up-and-shutting-down.html'),
('[2] Oracle Database 19c Utilities Data Pump Export and Import','https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/oracle-data-pump-export-utility.html'),
('[3] Oracle Database 19c Backup and Recovery User Guide','https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/backing-up-database.html'),
('[4] Microsoft ASP.NET Core Prevent Cross Site Request Forgery','https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0')]
for name,url in refs:para(name+'\n'+url,size=11,align=WD_ALIGN_PARAGRAPH.LEFT)
para('Đối chiếu tài liệu kỹ thuật ngày 17/10/2026. Mã phiên bản thư viện của ứng dụng được xác định từ package và csproj kèm dự án, không suy ra từ phiên bản mới nhất trên Internet.',size=11)

assert len(PAGES)==26
toc_table=table(['Nội dung','Trang'],[(p['title'],p['page']) for p in PAGES],[14,2],11,True)
toc_anchor._p.addnext(toc_table._tbl)
doc.save(OUT)
manifest={'metadata':META,'plannedContentPages':len(PAGES),'packagingPages':3,
 'pages':PAGES,'dictionary':TABLES,'queries':QUERIES,'expectedSeedCounts':expected,
 'contentStats':{k:len(v) for k,v in CONTENT.items()},'evidence':EVIDENCE,'backupEvidence':BACKUP,
 'testCaseStatus':{a:test_status(a) for a,_,_ in test_rows},
 'uiEvidence':{'verified':UI_VERIFIED,'sources':UI_SOURCES,'scope':'Đăng nhập, tìm Photo Sprint, đổi A sang D, đánh dấu, tải lại, nộp 1/6 đúng; Listening 60 Reading 0 tham khảo.'},
 'sources':[],'render':{'status':'NOT_YET_RENDERED','verifiedPageCount':None,'allPagesVisuallyInspected':False}}
for path in ['database/01_schema.sql','database/02_packages.sql','database/10_queries.sql','server/SeedData/content.json','docs/oracle-administration.md','server/Toeic.Api/Toeic.Api.csproj','web/package.json','docs/verification.json','docs/api-test-results.json','docs/backup-verification.json','docs/admin-verification.json','scripts/admin-demo.ps1','scripts/backup-demo.ps1']+UI_SOURCES:
    f=ROOT/path
    if f.exists():manifest['sources'].append({'path':path,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
SOURCE_PATH.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({'output':str(OUT),'plannedContentPages':len(PAGES),'tables':len(TABLES),'queries':len(QUERIES),'bytes':OUT.stat().st_size},ensure_ascii=False))
