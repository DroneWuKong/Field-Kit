from pathlib import Path
import json,math,re
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor,Color,white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph,Table,TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
ROOT=Path(__file__).resolve().parents[2]; TMP=ROOT/'tmp/pdfs'; OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
M=json.loads((TMP/'manifest.json').read_text());assert len(M['catalog'])==20 and not M['errors']
for n,f in [('Regular','DejaVuSans.ttf'),('Bold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(n,'/usr/share/fonts/truetype/dejavu/'+f))
pdfmetrics.registerFontFamily('Regular',normal='Regular',bold='Bold',italic='Regular',boldItalic='Bold')
INK=HexColor('#17313d'); MUTED=HexColor('#536c79'); TEAL=HexColor('#008674'); MINT=HexColor('#e9f5f1'); BORDER=HexColor('#d5e3e5'); BLUE=HexColor('#007eaa'); GOLD=HexColor('#966325')
ST={k:ParagraphStyle(k,fontName='Regular',fontSize=size,leading=leading,textColor=INK,spaceAfter=0) for k,size,leading in [('body',11,15.5),('small',9.2,12),('caption',8,11),('card',11,16),('index',9.3,12),('h',13,17)]}
ST['small'].textColor=MUTED;ST['caption'].textColor=MUTED
checks=[]
def para(c,text,x,y,w,style='body'):
 p=Paragraph(text,ST[style]);pw,ph=p.wrap(w,1000);p.drawOn(c,x,y-ph);checks.append((c.getPageNumber(),text[:40],x,y-ph,w,ph));return y-ph

def header(c,doc,title,subtitle,key):
 c.bookmarkPage(key);c.addOutlineEntry(title,key,level=0,closed=False)
 c.setFillColor(TEAL);c.rect(0,782,612,10,fill=1,stroke=0)
 c.setFont('Bold',9);c.setFillColor(TEAL);c.drawString(40,758,'Prismo Field Kit  /  '+doc);c.setFont('Regular',8);c.setFillColor(MUTED);c.drawRightString(572,758,'v0.3.1  •  01 OCT 2026')
 size=25
 while pdfmetrics.stringWidth(title,'Bold',size)>532:size-=.5
 c.setFont('Bold',size);c.setFillColor(INK);c.drawString(40,716,title)
 para(c,subtitle,40,696,532,'body')
 c.setStrokeColor(BORDER);c.line(40,37,572,37);c.setFont('Regular',8);c.setFillColor(MUTED);c.drawString(40,23,'Prismo Field Kit 0.3.1  |  '+doc);c.drawRightString(572,23,str(c.getPageNumber()))

def note(c,label,text):
 c.setFillColor(HexColor('#f1f5f5'));c.roundRect(40,56,532,78,8,fill=1,stroke=0);c.setFillColor(TEAL);c.setFont('Bold',9);c.drawString(52,121,label);y=para(c,text,52,108,508,'small');assert y>=60,('note overflow',label,y)

def annotated(c,doc,title,subtitle,shot,cards,outcome,limit,key=None,caption=None):
 header(c,doc,title,subtitle,key or shot)
 s=M['shots'][shot];x=40;top=653;w=230;h=w*s['height']/s['width'];bottom=top-h
 c.setFillColor(INK);c.roundRect(x-3,bottom-3,w+6,h+6,9,fill=1,stroke=0)
 c.drawImage(ImageReader(str(TMP/'screens'/s['file'])),x,bottom,width=w,height=h,mask='auto')
 assert len(cards)==len(s['targets']),(shot,len(cards),len(s['targets']))
 last=[]
 for i,t in enumerate(s['targets'],1):
  ex=x+t['x']*w/s['width'];ey=top-t['y']*w/s['width'];cy=ey
  for old in last:
   if abs(cy-old)<23:cy=old-24
  cy=max(bottom+8,min(top-8,cy));last.append(cy);sx=x+w+17
  # White under-stroke makes the exact arrow legible against the dark UI.
  c.setLineWidth(4.2);c.setStrokeColor(white);c.line(sx-7,cy,ex,ey)
  c.setLineWidth(1.8);c.setStrokeColor(BLUE);c.line(sx-7,cy,ex,ey)
  angle=math.atan2(ey-cy,ex-(sx-7));p=c.beginPath();p.moveTo(ex,ey);p.lineTo(ex-8*math.cos(angle-.45),ey-8*math.sin(angle-.45));p.lineTo(ex-8*math.cos(angle+.45),ey-8*math.sin(angle+.45));p.close();c.setFillColor(BLUE);c.drawPath(p,fill=1,stroke=0)
  c.setFillColor(BLUE);c.circle(sx,cy,8,fill=1,stroke=0);c.setFillColor(white);c.setFont('Bold',8.5);c.drawCentredString(sx,cy-3,str(i))
 y=650
 for i,(title_,text) in enumerate(cards,1):
  c.setFillColor(BLUE);c.circle(324,y-7,9,fill=1,stroke=0);c.setFillColor(white);c.setFont('Bold',9);c.drawCentredString(324,y-10,str(i))
  y=para(c,'<b>'+title_+'</b>',341,y+1,230,'h')-7
  y=para(c,text,316,y,256,'card')-23
 result_title,result_text=outcome
 y=para(c,'<b>'+result_title+'</b>',316,y,256,'h')-7
 y=para(c,result_text,316,y,256,'card')-15
 assert y>=145,('sidebar overflow',shot,y)
 if caption:para(c,caption,40,147,532,'caption')
 note(c,*limit);c.showPage()

from human_copy import QUICK, TOOLS as COPY, NAVIGATION, REPORT, LAST_SECTIONS, DESCRIPTIONS
ORDER = ['equipment-profiles', 'connection-doctor', 'connection-network', 'position-health', 'config-inspector', 'config-results', 'fc-matcher', 'elrs-info', 'range', 'range-result', 'rf-terrain', 'terrain-controls', 'mesh-planner', 'mesh-controls', 'fresnel', 'dipole', 'harmonics', 'vtx-config', 'unlock-vtx', 'channel-planner', 'closest-channel', 'coordinates', 'battery', 'signal-check', 'field-checklist', 'bench-export', 'saved-reports']
TOOLS = [(id,*COPY[id]) for id in ORDER]

def draw_page(c,doc,item,key):
 title,intro,shot,steps,result,note_,caption=item
 annotated(c,doc,title,intro,shot,steps,result,note_,key=key,caption=caption)

def index_page(c):
 header(c,'Tool guide','What are you trying to do?',
        'You can dip into this guide as needed. Find your task below and tap its page number.', 'index')
 page_by_id={item[0]:i+3 for i,item in enumerate(TOOLS)}
 rows=[['TOOL','PAGE','WHEN TO USE IT']]
 for id in ORDER:
  if id not in DESCRIPTIONS:continue
  name=next(t[1] for t in M['catalog'] if t[0]==id)
  rows.append([Paragraph(name,ST['index']),Paragraph(f'<link href="#tool-{id}" color="#007eaa"><b>{page_by_id[id]}</b></link>',ST['index']),Paragraph(DESCRIPTIONS[id],ST['index'])])
 assert len(rows)==21
 table=Table(rows,colWidths=[205,42,285],rowHeights=[25]+[23]*20)
 table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),INK),('TEXTCOLOR',(0,0),(-1,0),white),('FONTNAME',(0,0),(-1,0),'Bold'),('FONTSIZE',(0,0),(-1,0),8.5),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,1),(-1,-1),.35,BORDER),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#f4f8f9')])]))
 _,height=table.wrap(532,600);table.drawOn(c,40,650-height)
 note(c,'Follow the numbers','Each screenshot has numbered arrows matching the steps beside it. Use the quick-start guide for your first session; use this guide when you need a particular tool. Screenshots use example equipment and practice data.')
 c.showPage()

def last_page(c):
 header(c,'Tool guide','When something is not working',
        'Start with the connection and earlier notes. You do not need to change everything at once.', 'troubleshooting')
 y=651
 for title,text in LAST_SECTIONS:
  y=para(c,'<b>'+title+'</b>',40,y,532,'h')-6
  y=para(c,text,40,y,532,'small' if title=='About the screenshots' else 'body')-18
 assert y>150,('troubleshooting overflow',y)
 note(c,'Keep the right record','Connection snapshots, configuration comparisons, bench checklists, terrain plans and mesh plans each have their own export. Keep the one that answers the question you are working on.')
 c.showPage()

for filename,doc in [('Prismo-Field-Kit-Quick-Start.pdf','Quick start'),('Prismo-Field-Kit-Tool-Guide.pdf','Tool guide')]:
 c=canvas.Canvas(str(OUT/filename),pagesize=(612,792),pageCompression=1)
 c.setTitle('Prismo Field Kit 0.3.1 - '+doc);c.setAuthor('Prismo')
 c.setSubject('Illustrated instructions for Field Kit, with numbered screenshot arrows')
 if doc=='Quick start':
  for i,item in enumerate(QUICK):draw_page(c,doc,item,'quick-'+str(i))
 else:
  index_page(c);draw_page(c,doc,NAVIGATION,'navigation')
  for id,*item in TOOLS:draw_page(c,doc,item,'tool-'+id)
  draw_page(c,doc,REPORT,'export-preview');last_page(c)
 c.save();print(filename)
for page,text,x,y,w,h in checks:
 assert x>=39 and x+w<=573 and y>=40 and y+h<=755,(page,text,x,y,w,h)
(TMP/'layout-checks.json').write_text(json.dumps({'paragraphs':len(checks),'all_within_page':True,'tool_count':20,'screenshot_count':len(M['shots'])},indent=2))
