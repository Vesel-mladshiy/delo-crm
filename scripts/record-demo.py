"""Record a real local CRM session, ~79 seconds, and encode a shareable MP4."""
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse
import imageio_ffmpeg
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("CRM_TEST_URL", "http://127.0.0.1:5173").rstrip("/")
assert urlparse(BASE).hostname in ("127.0.0.1", "localhost"), "Record against a local preview"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs"
OUTPUT.mkdir(exist_ok=True)
SHOTS = ROOT / "docs" / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chromium")
    context = browser.new_context(viewport={"width": 1440, "height": 960}, locale="ru-RU", timezone_id="Europe/Moscow", record_video_dir=str(OUTPUT / "raw-video"), record_video_size={"width": 1440, "height": 960})
    page = context.new_page()
    # Overlay is injected only by this recording script; it is not part of the product.
    page.add_init_script("""document.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div'); cursor.id = 'demo-cursor';
      Object.assign(cursor.style, {position:'fixed',width:'18px',height:'18px',border:'2px solid #26765c',borderRadius:'50%',background:'#26765c22',pointerEvents:'none',zIndex:'9999',transition:'left .12s,top .12s',left:'-50px',top:'-50px'});
      document.body.appendChild(cursor); document.addEventListener('mousemove',e=>{cursor.style.left=(e.clientX-9)+'px';cursor.style.top=(e.clientY-9)+'px'});
      const caption=document.createElement('div');caption.id='demo-caption';Object.assign(caption.style,{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',background:'#173e32ed',border:'1px solid #8bb59c55',borderRadius:'12px',padding:'14px 24px',color:'#f6faf5',fontFamily:'Segoe UI, sans-serif',fontSize:'15px',fontWeight:'500',zIndex:'9998',boxShadow:'0 6px 30px #173e3222',pointerEvents:'none',whiteSpace:'nowrap'});caption.textContent='';caption.style.display='none';document.body.appendChild(caption);
    });""")
    start = time.monotonic()

    def hold(until):
        remaining = until - (time.monotonic() - start)
        if remaining > 0:
            page.wait_for_timeout(remaining * 1000)

    def caption(text):
        page.evaluate("text => { const c=document.getElementById('demo-caption'); c.textContent=text; c.style.display='block'; }", text)

    def click(locator):
        box = locator.bounding_box()
        if box:
            page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2, steps=15)
        locator.click()

    page.goto(BASE)
    expect(page.get_by_role('button', name='Попробовать демо')).to_be_visible(timeout=60000)
    caption('Дело CRM · клиенты, сделки и результат')
    hold(5)
    click(page.get_by_role('button', name='Попробовать демо'))
    expect(page.get_by_role('heading', name='Всё под контролем.')).to_be_visible()
    caption('Весь бизнес на одном экране. Данные сохраняются в SQL-базе.')
    hold(17)
    menu = page.get_by_role('navigation')
    click(menu.get_by_role('button', name='Клиенты', exact=True))
    caption('Клиенты · контакты, заметки и связанные сделки')
    page.wait_for_timeout(1500)
    page.get_by_role('textbox', name='Поиск клиентов').press_sequentially('Лес и форма', delay=90)
    page.wait_for_timeout(1200)
    click(page.get_by_role('button', name='Студия «Лес и форма»', exact=True))
    page.wait_for_timeout(1000)
    # Clean portfolio screenshot, without the recording overlay.
    page.evaluate("document.getElementById('demo-caption').style.display='none'")
    page.screenshot(path=str(SHOTS / '08-client-card.png'))
    caption('История отношений с клиентом — всегда под рукой')
    hold(29)
    click(page.get_by_role('button', name='Закрыть', exact=True))
    click(menu.get_by_role('button', name='Сделки'))
    click(page.get_by_role('button', name='Новая сделка', exact=True))
    caption('Новая сделка · понятные поля и следующий шаг')
    page.locator('input[name="title"]').press_sequentially('Лендинг новой коллекции мебели', delay=45)
    client = next(c for c in context.request.get(BASE + '/api/crm/bootstrap').json()['clients'] if c['company'] == 'Студия «Лес и форма»')
    page.locator('select[name="clientId"]').select_option(client['id'])
    page.locator('input[name="amount"]').press_sequentially('175000', delay=90)
    page.locator('textarea[name="nextStep"]').press_sequentially('Отправить концепцию и обсудить сроки', delay=35)
    hold(43)
    click(page.get_by_role('button', name='Создать сделку', exact=True))
    expect(page.get_by_role('dialog')).to_have_count(0)
    caption('Воронка продаж · перемещайте сделку между этапами')
    card = page.locator('.deal-card').filter(has_text='Лендинг новой коллекции мебели')
    destination = page.locator('.kanban-column').filter(has=page.locator('.kanban-stage', has_text='Первый контакт'))
    page.wait_for_timeout(1500)
    # Aim at the visible column header so Playwright does not scroll to the
    # center of a tall column while starting a native drag.
    card.drag_to(destination.locator('.kanban-column-heading'))
    expect(destination.get_by_role('heading', name='Лендинг новой коллекции мебели')).to_be_visible()
    hold(53)
    click(card)
    page.locator('select[name="status"]').select_option('won')
    click(page.get_by_role('button', name='Сохранить изменения'))
    expect(page.get_by_role('dialog')).to_have_count(0)
    caption('Успешная сделка сразу учитывается в выручке')
    hold(59)
    click(menu.get_by_role('button', name='Задачи', exact=True))
    caption('Следующий шаг не потеряется. Выполненное остаётся в истории.')
    page.wait_for_timeout(1500)
    click(page.get_by_role('checkbox').first)
    hold(67)
    click(menu.get_by_role('button', name='Аналитика', exact=True))
    caption('Понятная аналитика · выручка, конверсия, источники и план')
    page.wait_for_timeout(2500)
    page.evaluate('window.scrollTo({top:250,behavior:"smooth"})')
    hold(74)
    page.evaluate('window.scrollTo({top:0,behavior:"smooth"})')
    caption('Дело CRM · каждому посетителю — своя демоверсия')
    hold(79)
    video = page.video
    context.request.delete(BASE + '/api/session', headers={'Content-Type':'application/json','Origin':BASE})
    context.close()
    raw = Path(video.path())
    browser.close()

target = OUTPUT / 'delo-crm-demo.mp4'
result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-i', str(raw), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(target)], capture_output=True, text=True)
if result.returncode:
    raise RuntimeError(result.stderr[-2000:])
duration = time.monotonic() - start
print(f'Recorded actual browser session to {target}. Capture ~79 seconds, including encoding {duration:.1f}s.')
