const C=window.CONFIG, QR='qr.png', MIN_TOPUP=C.MIN_TOPUP||10;
if(!window.supabase||C.SUPABASE_URL.includes('xxxxxxxx')){document.getElementById('app').innerHTML='<div class="panel"><h2>ยังไม่ได้ตั้งค่า</h2><p class="mut">เปิดไฟล์ config.js แล้วใส่ SUPABASE_URL และ SUPABASE_ANON_KEY</p></div>'}
const sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baht=n=>'฿'+Number(n).toLocaleString('th-TH');
const dt=t=>new Date(t).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
const ERR={LOGIN:'กรุณาเข้าสู่ระบบ',SOLD:'สินค้านี้ถูกขายแล้ว',INSUFFICIENT:'ยอดเงินไม่พอ กรุณาเติมเงิน',NOCODE:'ไม่พบโค้ดนี้',EXHAUSTED:'โค้ดนี้ถูกใช้ครบแล้ว',USED:'คุณใช้โค้ดนี้ไปแล้ว',BADAMOUNT:'จำนวนเงินไม่ถูกต้อง',NOREF:'กรุณากรอกเลขอ้างอิง',TOOMANY:'มีรายการรอตรวจสอบหลายรายการแล้ว กรุณารอแอดมินตรวจสอบก่อน',FORBIDDEN:'ไม่มีสิทธิ์',NOTFOUND:'ไม่พบรายการ',BADQTY:'จำนวนไม่ถูกต้อง',BADMSG:'ข้อความต้องมี 1-1000 ตัวอักษร',NOBOX:'ไม่พบกล่องสุ่มนี้',NOPRIZE:'กล่องนี้ยังไม่มีรางวัลให้สุ่ม',TOOFAST:'ส่งข้อความเร็วเกินไป กรุณารอสักครู่',NOSTOCK:'ต้องมีรหัสไอดีอย่างน้อย 1 ไอดี','violates check constraint':'ยอดเงินจะติดลบไม่ได้','already registered':'ชื่อผู้ใช้นี้ถูกใช้แล้ว','Invalid login':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง','duplicate key':'มีข้อมูลนี้อยู่แล้ว'};
function em(e){const m=(e&&e.message)||String(e);for(const k in ERR)if(m.includes(k))return ERR[k];return 'เกิดข้อผิดพลาด: '+m}
const emailOf=u=>u.toLowerCase()+'@ffshop.app';

let S={me:null,cats:[],prods:[],A:{}};
let catSel='all',q='',adminTab='dash',amt=0,topStep=1,busy=false;
const isAdmin=()=>S.me&&S.me.role==='admin';
const go=h=>{if(location.hash==='#/'+h)render();else location.hash='#/'+h};

function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
function modal(html,onok,okText='ยืนยัน'){
  const L=document.getElementById('layer')||document.body.appendChild(Object.assign(document.createElement('div'),{id:'layer'}));
  L.innerHTML=`<div class="ov"><div class="md">${html}<div class="row" style="margin-top:16px"><button class="btn g" id="mx">ยกเลิก</button><button class="btn" id="mo">${okText}</button></div></div></div>`;
  document.getElementById('mx').onclick=()=>L.innerHTML='';
  document.getElementById('mo').onclick=async()=>{const r=await onok();if(r!==false)L.innerHTML=''};
}
async function act(fn){ // รันคำสั่งพร้อมจัดการ error
  try{return await fn()}catch(e){toast(em(e));return false}
}

/* ---------- data ---------- */
async function loadMe(){
  const {data:{session}}=await sb.auth.getSession();
  if(!session){S.me=null;return}
  const {data}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  S.me=data||null;
}
async function loadUnread(){
  if(!S.me){S.unread=0;return}
  try{const r=await sb.from('messages').select('id',{count:'exact',head:true}).eq('is_read',false).eq('sender_role',isAdmin()?'user':'admin');S.unread=r.count||0}catch(e){S.unread=0}
}
let chatTimer=null,chatUser=null,gBox=null;
setInterval(async()=>{if(document.hidden||!S.me)return;await loadUnread();nav()},15000);
async function must(p){const r=await p;if(r.error)throw r.error;return r.data}

/* ---------- router ---------- */
addEventListener('hashchange',render);
async function render(){
  const r=(location.hash||'#/').slice(2).split('/')[0];
  const app=document.getElementById('app');
  clearInterval(chatTimer);
  try{
    await loadMe();await loadUnread();
    if(['topup','orders','chat'].includes(r)&&!S.me)return go('login');
    if(r==='admin'&&!isAdmin())return go(S.me?'':'login');
    nav();
    if(r==='login'&&S.me)return go('');
    if(r===''||!['login','topup','orders','admin','chat','gacha'].includes(r)){
      const [c,p,rv]=await Promise.all([must(sb.from('categories').select('*').order('created_at')),must(sb.from('products').select('id,category_id,title,description,price,stock,is_random,product_images(url,sort)').gt('stock',0).order('created_at',{ascending:false})),must(sb.from('site_images').select('*').order('created_at',{ascending:false}).limit(24))]);
      S.cats=c;S.prods=p;S.reviews=rv;app.innerHTML=home();bindHome();
    }else if(r==='login')app.innerHTML=login('in');
    else if(r==='topup'){S.A.my=await must(sb.from('topups').select('*').eq('user_id',S.me.id).order('created_at',{ascending:false}).limit(100));app.innerHTML=topup()}
    else if(r==='orders'){S.A.orders=await must(sb.from('orders').select('*').eq('user_id',S.me.id).order('created_at',{ascending:false}));S.A.spins=await must(sb.from('gacha_spins').select('*').eq('user_id',S.me.id).order('created_at',{ascending:false}).limit(100));app.innerHTML=orders()+spinsPanel()}
    else if(r==='gacha'){S.boxes=await must(sb.from('gacha_boxes').select('*,gacha_prizes(id,name,rarity,weight,kind,credit_amount,image_url,stock)').eq('active',true).order('created_at',{ascending:false}));app.innerHTML=gachaPage()}
    else if(r==='chat'){
      S.A.msgs=await must(sb.from('messages').select('*').eq('user_id',S.me.id).order('created_at').limit(200));
      app.innerHTML=chatPage();scrollChat();
      if(S.A.msgs.some(x=>x.sender_role==='admin'&&!x.is_read)){await sb.rpc('mark_messages_read');S.unread=0;nav()}
      chatTimer=setInterval(refreshChat,8000);
    }
    else if(r==='admin'){await loadAdmin();app.innerHTML=admin();if(adminTab==='inbox'&&chatUser){scrollChat();chatTimer=setInterval(refreshChat,8000)}}
    if(r!=='chat'&&!(r==='admin'&&adminTab==='inbox'&&chatUser))scrollTo(0,0);
  }catch(e){app.innerHTML=`<div class="panel"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p class="mut">${esc(em(e))}</p><button class="btn" onclick="render()">ลองใหม่</button></div>`}
}
function nav(){
  const u=S.me,r=(location.hash||'#/').slice(2).split('/')[0];
  const a=(h,t)=>`<a href="#/${h}" class="${r===h?'on':''}">${t}</a>`;
  document.getElementById('nav').innerHTML=a('','หน้าแรก')+a('gacha','🎁 กล่องสุ่ม')+(u?
    `<a href="#/topup" class="bal">💰 ${baht(u.balance)}</a>`+a('topup','เติมเงิน')+a('orders','ไอดีของฉัน')+(u.role!=='admin'?a('chat','💬 แชท'+(S.unread?` (${S.unread})`:'')):'')+(u.role==='admin'?a('admin','หลังบ้าน'+(S.unread?` (${S.unread})`:'')):'')+`<button onclick="logout()">ออก</button>`
    :a('login','เข้าสู่ระบบ'));
}

/* ---------- customer views ---------- */
const pimgs=p=>(p.product_images||[]).slice().sort((x,y)=>(x.sort||0)-(y.sort||0));
const closeL=()=>{document.getElementById('layer').innerHTML=''};
function zoom(u){document.getElementById('layer').innerHTML=`<div class="ov" onclick="closeL()" style="z-index:70"><img src="${esc(u)}" style="max-width:100%;max-height:92vh;border-radius:12px"></div>`}
function home(){
  return `<div class="hero"><h1>🔥 ร้านขายไอดี Free Fire</h1><p>ไอดีคุณภาพ ส่งรหัสทันทีหลังชำระ · เติมเงินผ่าน TrueMoney ไม่มีค่าธรรมเนียม</p><div class="big">🎮</div></div>
  ${S.me?`<div class="panel" style="margin:0 0 14px;padding:16px 18px"><div class="row"><div><div class="mut">ยอดเงินคงเหลือของ ${esc(S.me.username)}</div><div class="price" style="font-size:30px">${baht(S.me.balance)}</div></div><a href="#/topup" class="btn">+ เติมเงิน</a></div></div>`:''}
  <input id="sq" placeholder="🔍 ค้นหาไอดี..." value="${esc(q)}" style="margin-bottom:12px">
  <div id="catbar" class="chips"></div><div id="plist"></div><div id="revbox"></div>`;
}
function drawList(){
  document.getElementById('catbar').innerHTML=`<div class="chip ${catSel==='all'?'on':''}" data-c="all">ทั้งหมด</div>`+S.cats.map(c=>`<div class="chip ${catSel===c.id?'on':''}" data-c="${c.id}">${esc(c.emoji||'')} ${esc(c.name)}</div>`).join('');
  const list=S.prods.filter(p=>(catSel==='all'||p.category_id===catSel)&&(!q||(p.title+p.description).toLowerCase().includes(q.toLowerCase())));
  document.getElementById('plist').innerHTML=list.length?`<div class="grid">${list.map(p=>{const c=S.cats.find(x=>x.id===p.category_id),im=pimgs(p);return `<div class="card" data-o="${p.id}" style="cursor:pointer"><div class="pimg">${im.length?`<img src="${esc(im[0].url)}" alt="" loading="lazy" onerror="this.remove()">`:`<span style="position:absolute">${esc(c?.emoji||'🎮')}</span>`}<span class="tag">${esc(c?.name||'')}</span><span class="stk">เหลือ ${p.stock}</span>${p.is_random?'<span class="rnd">🎲 สุ่มไอดี</span>':''}${im.length>1?`<span class="cnt">📷 ${im.length}</span>`:''}</div><div class="pb"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div class="row"><span class="price">${baht(p.price)}</span><button class="btn sm">ดู / ซื้อ</button></div></div></div>`}).join('')}</div>`:`<div class="empty">ไม่พบสินค้าในหมวดนี้</div>`;
  document.getElementById('revbox').innerHTML=(S.reviews&&S.reviews.length)?`<h2 style="margin:6px 0 10px">📸 ภาพรีวิวจากลูกค้า</h2><div class="rev">${S.reviews.map(r=>`<img src="${esc(r.url)}" alt="${esc(r.caption)}" loading="lazy" onclick="zoom('${esc(r.url)}')">`).join('')}</div>`:'';
  document.querySelectorAll('.chip').forEach(e=>e.onclick=()=>{catSel=e.dataset.c;drawList()});
  document.querySelectorAll('[data-o]').forEach(e=>e.onclick=()=>openProduct(e.dataset.o));
}
function bindHome(){const s=document.getElementById('sq');s.oninput=()=>{q=s.value;drawList()};drawList()}
let curP=null,curQty=1;
function openProduct(id){
  const p=S.prods.find(x=>x.id===id);if(!p)return;curP=p;curQty=1;
  const im=pimgs(p),c=S.cats.find(x=>x.id===p.category_id);
  document.getElementById('layer').innerHTML=`<div class="ov" onclick="if(event.target===this)closeL()"><div class="md" style="max-height:92vh;overflow:auto;max-width:460px">
  ${im.length?`<div class="gal">${im.map(i=>`<img src="${esc(i.url)}" alt="" onclick="zoom('${esc(i.url)}')">`).join('')}</div>`:`<div class="pimg" style="border-radius:14px"><span style="position:absolute">${esc(c?.emoji||'🎮')}</span></div>`}
  <h3 style="margin:12px 0 4px">${esc(p.title)}</h3><div class="mut">${esc(c?.name||'')} · เหลือ ${p.stock} ไอดี</div><p style="white-space:pre-wrap">${esc(p.description)}</p>${p.is_random?'<div class="rndnote">🎲 สินค้านี้เป็นแบบสุ่ม ระบบจะสุ่มไอดีจากสต็อกให้ ไม่สามารถเลือกเองได้</div>':''}
  <div class="row"><span class="price">${baht(p.price)} <span class="mut">/ ไอดี</span></span>
  <div class="qty"><button onclick="setQty(-1)">−</button><b id="qv">1</b><button onclick="setQty(1)">+</button></div></div>
  <div class="row" style="margin-top:8px"><span class="mut">รวมทั้งหมด</span><b id="tot" class="price">${baht(p.price)}</b></div>
  <div class="row" style="margin-top:16px"><button class="btn g" onclick="closeL()">ปิด</button><button class="btn" id="buybtn" onclick="doBuy()">${p.is_random?'🎲 สุ่มเลย':'ซื้อเลย'}</button></div></div></div>`;
}
function setQty(d){const m=Math.min(curP.stock,20);curQty=Math.max(1,Math.min(m,curQty+d));document.getElementById('qv').textContent=curQty;document.getElementById('tot').textContent=baht(curP.price*curQty)}
async function doBuy(){
  const u=S.me,p=curP,qn=curQty,total=p.price*qn;
  if(!u){closeL();toast('กรุณาเข้าสู่ระบบก่อนซื้อ');return go('login')}
  if(u.balance<total){closeL();toast('ยอดเงินไม่พอ กรุณาเติมเงิน');return go('topup')}
  const b=document.getElementById('buybtn');b.disabled=true;
  const ok=await act(()=>must(sb.rpc('buy_product',{p_id:p.id,p_qty:qn})));
  closeL();
  if(ok===false){render();return}
  toast('ซื้อสำเร็จ! ดูรหัสได้ที่ "ไอดีของฉัน"');go('orders');
}

function login(mode){
  return `<div class="panel auth"><h2>${mode==='in'?'เข้าสู่ระบบ':'สมัครสมาชิก'}</h2>
  <label>ชื่อผู้ใช้</label><input id="lu" autocomplete="username" autocapitalize="none"><label>รหัสผ่าน</label><input id="lp" type="password" autocomplete="${mode==='in'?'current-password':'new-password'}">
  ${mode==='up'?`<label>ยืนยันรหัสผ่าน</label><input id="lp2" type="password">`:''}
  <button class="btn" style="width:100%;margin-top:16px" onclick="${mode==='in'?'doLogin()':'doReg()'}">${mode==='in'?'เข้าสู่ระบบ':'สมัครสมาชิก'}</button>
  <p class="mut" style="text-align:center;margin:14px 0 0">${mode==='in'?'ยังไม่มีบัญชี? <a href="#" style="color:var(--pri)" onclick="swap(\'up\');return false">สมัครสมาชิก</a>':'มีบัญชีแล้ว? <a href="#" style="color:var(--pri)" onclick="swap(\'in\');return false">เข้าสู่ระบบ</a>'}</p></div>`;
}
const swap=m=>{document.getElementById('app').innerHTML=login(m)};
async function doLogin(){
  const n=lu.value.trim();if(!n||!lp.value)return toast('กรอกข้อมูลให้ครบ');
  const r=await sb.auth.signInWithPassword({email:emailOf(n),password:lp.value});
  if(r.error)return toast(em(r.error));
  await loadMe();toast('ยินดีต้อนรับ '+S.me.username);go(isAdmin()?'admin':'');
}
async function doReg(){
  const n=lu.value.trim();
  if(!/^[A-Za-z0-9_]{3,20}$/.test(n))return toast('ชื่อผู้ใช้: a-z 0-9 _ ความยาว 3-20 ตัว');
  if(lp.value.length<6)return toast('รหัสผ่านอย่างน้อย 6 ตัว');
  if(lp.value!==lp2.value)return toast('รหัสผ่านไม่ตรงกัน');
  const r=await sb.auth.signUp({email:emailOf(n),password:lp.value,options:{data:{username:n.toLowerCase()}}});
  if(r.error)return toast(em(r.error));
  if(!r.data.session)return toast('สมัครแล้ว แต่ระบบยังเปิดยืนยันอีเมลอยู่ (ดู README ข้อ 3)');
  toast('สมัครสำเร็จ');go('');
}
async function logout(){await sb.auth.signOut();S.me=null;toast('ออกจากระบบแล้ว');go('')}

function topup(){
  const u=S.me,mine=S.A.my;
  const step1=`<h2>💰 เติมเงินผ่าน TrueMoney</h2><p class="mut">ไม่มีค่าธรรมเนียม · เลือกจำนวนเงินที่ต้องการ</p>
  <div class="amts">${[20,50,100,200,300,500].map(a=>`<button class="${amt===a?'on':''}" onclick="setAmt(${a})">${baht(a)}</button>`).join('')}</div>
  <label>หรือกรอกจำนวนเอง (ขั้นต่ำ ${baht(MIN_TOPUP)})</label><input id="ca" type="number" min="${MIN_TOPUP}" inputmode="numeric" value="${amt||''}" oninput="amt=Math.floor(+this.value)||0">
  <button class="btn" style="width:100%;margin-top:14px" onclick="topNext()">ถัดไป – แสดง QR Code</button>`;
  const step2=`<h2>สแกนจ่าย ${baht(amt)}</h2><div class="qrbox"><img src="${QR}" alt="TrueMoney QR"></div>
  <ol class="mut" style="padding-left:20px"><li>เปิดแอป TrueMoney Wallet แล้วสแกน QR นี้</li><li><b style="color:var(--pri)">กรอกจำนวนเงิน ${baht(amt)}</b> ให้ตรงกับที่เลือก</li><li>โอนเสร็จ กรอกเลขอ้างอิง/เวลาโอนด้านล่าง แล้วกด “แจ้งโอนเงิน”</li></ol>
  <label>เลขอ้างอิงรายการ หรือ เวลาที่โอน</label><input id="ref" placeholder="เช่น 14:32 หรือเลขอ้างอิง 8 ตัวท้าย">
  <div class="row" style="margin-top:14px"><button class="btn g" onclick="topStep=1;render()">← กลับ</button><button class="btn" onclick="topSubmit()">แจ้งโอนเงิน</button></div>`;
  const pendAmt=mine.filter(t=>t.status==='pending').reduce((a,t)=>a+t.amount,0);
  const sty='style="max-width:520px;margin-left:auto;margin-right:auto"';
  return `<div class="panel" ${sty}><div class="mut">ยอดเงินคงเหลือ</div><div class="price" style="font-size:32px">${baht(u.balance)}</div>${pendAmt?`<div class="mut">รอตรวจสอบ ${baht(pendAmt)}</div>`:''}</div>
  <div class="panel" ${sty}>${topStep===1?step1:step2}</div>
  <div class="panel" ${sty}><h2>🎁 ใช้โค้ดเติมเงิน</h2><div class="row" style="gap:8px"><input id="rc" placeholder="กรอกโค้ด" style="text-transform:uppercase"><button class="btn" onclick="redeem()">ใช้โค้ด</button></div></div>
  <div class="panel"><h2>ประวัติการเงิน</h2>${mine.length?`<div class="tw"><table><tr><th>เวลา</th><th>จำนวน</th><th>รายละเอียด</th><th>สถานะ</th></tr>${mine.map(t=>`<tr><td>${dt(t.created_at)}</td><td>${baht(t.amount)}</td><td>${esc(t.ref)}</td><td><span class="st ${t.status}">${{pending:'รอตรวจสอบ',approved:'สำเร็จ',rejected:'ไม่อนุมัติ'}[t.status]}</span></td></tr>`).join('')}</table></div>`:'<div class="empty">ยังไม่มีรายการ</div>'}</div>`;
}
function setAmt(a){amt=a;render()}
function topNext(){if(amt<MIN_TOPUP)return toast('ขั้นต่ำ '+baht(MIN_TOPUP));topStep=2;render()}
async function topSubmit(){
  const r=ref.value.trim();if(!r)return toast('กรุณากรอกเลขอ้างอิงหรือเวลาโอน');
  const ok=await act(()=>must(sb.rpc('create_topup',{p_amount:amt,p_ref:r})));
  if(ok===false)return;amt=0;topStep=1;toast('แจ้งโอนแล้ว รอแอดมินตรวจสอบ');render();
}
async function redeem(){
  const c=rc.value.trim();if(!c)return toast('กรอกโค้ดก่อน');
  const v=await act(()=>must(sb.rpc('redeem_code',{p_code:c})));
  if(v===false)return;toast('รับเงิน '+baht(v)+' สำเร็จ');render();
}
function orders(){
  const mine=S.A.orders;
  return `<div class="panel"><h2>ไอดีของฉัน</h2>${mine.length?mine.map(o=>`<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="row"><b>${esc(o.title)}${o.qty>1?' ×'+o.qty:''}</b><span class="price" style="font-size:16px">${baht(o.price)}</span></div><div class="mut">${dt(o.created_at)}</div><div class="cred" id="cr${o.id}">${esc(o.credentials)}</div><button class="btn g sm" style="margin-top:8px" onclick="cp('${o.id}')">คัดลอกรหัส</button></div>`).join(''):'<div class="empty">ยังไม่มีรายการสั่งซื้อ</div>'}</div>`;
}
function cp(id){const t=document.getElementById('cr'+id).textContent;try{navigator.clipboard.writeText(t).then(()=>toast('คัดลอกแล้ว'),()=>toast('กดค้างที่ข้อความเพื่อคัดลอก'))}catch(e){toast('กดค้างที่ข้อความเพื่อคัดลอก')}}

/* ---------- admin ---------- */
async function loadAdmin(){
  const t=adminTab,A={};
  if(t==='dash')A.spins=await must(sb.from('gacha_spins').select('price,credits').limit(5000));
  if(t==='dash'){[A.topups,A.orders,A.users,A.prods]=await Promise.all([must(sb.from('topups').select('*').order('created_at',{ascending:false}).limit(1000)),must(sb.from('orders').select('id,user_id,price,created_at').limit(1000)),must(sb.from('profiles').select('*')),must(sb.from('products').select('id,stock'))])}
  else if(t==='topups')A.topups=await must(sb.from('topups').select('*').order('created_at',{ascending:false}).limit(300));
  else if(t==='cats'){[A.cats,A.prods]=await Promise.all([must(sb.from('categories').select('*').order('created_at')),must(sb.from('products').select('id,category_id,stock'))])}
  else if(t==='prods'){[A.cats,A.prods]=await Promise.all([must(sb.from('categories').select('*').order('created_at')),must(sb.from('products').select('*,product_images(id,url,path,sort)').order('created_at',{ascending:false}).limit(500))])}
  else if(t==='gacha'){
    A.boxes=await must(sb.from('gacha_boxes').select('*').order('created_at',{ascending:false}));
    A.prizes=gBox?await must(sb.from('gacha_prizes').select('*').eq('box_id',gBox).order('created_at')):[];
  }
  else if(t==='inbox'){
    A.users=await must(sb.from('profiles').select('id,username'));
    if(chatUser){await sb.rpc('mark_messages_read',{p_user:chatUser});A.msgs=await must(sb.from('messages').select('*').eq('user_id',chatUser).order('created_at').limit(300));await loadUnread()}
    else A.msgs=await must(sb.from('messages').select('*').order('created_at',{ascending:false}).limit(1000));
  }
  else if(t==='reviews')A.reviews=await must(sb.from('site_images').select('*').order('created_at',{ascending:false}));
  else if(t==='codes')A.codes=await must(sb.from('codes').select('*').order('created_at',{ascending:false}));
  else if(t==='orders'){[A.orders,A.users]=await Promise.all([must(sb.from('orders').select('*').order('created_at',{ascending:false}).limit(300)),must(sb.from('profiles').select('id,username'))])}
  else if(t==='users')A.users=await must(sb.from('profiles').select('*').order('created_at',{ascending:false}));
  if(t!=='topups'){A.pend=await must(sb.from('topups').select('id').eq('status','pending'))}else A.pend=A.topups.filter(x=>x.status==='pending');
  S.A=A;
}
function admin(){
  const tabs=[['dash','ภาพรวม'],['topups','การเติมเงิน'],['cats','หมวดหมู่'],['prods','สินค้า'],['reviews','รีวิว'],['gacha','กล่องสุ่ม'],['inbox','ข้อความ'+(S.unread?` (${S.unread})`:'')],['codes','โค้ดเงิน'],['orders','ออเดอร์'],['users','สมาชิก']];
  const pend=S.A.pend.length;
  return `<div class="tabs">${tabs.map(([k,t])=>`<button class="${adminTab===k?'on':''}" onclick="adminTab='${k}';chatUser=null;gBox=null;render()">${t}${k==='topups'&&pend?` (${pend})`:''}</button>`).join('')}</div><div class="panel" style="margin-top:0;border-top-left-radius:0">${adminBody()}</div>`;
}
function adminBody(){
  const t=adminTab,A=S.A;
  if(t==='dash'){
    const day=x=>new Date(x).toDateString(),kind=x=>x.kind||'topup',okT=A.topups.filter(x=>x.status==='approved');
    const sum=a=>a.reduce((s,x)=>s+x.amount,0),sumO=a=>a.reduce((s,x)=>s+x.price,0);
    const members=A.users.filter(u=>u.role!=='admin');
    const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-i);const k=d.toDateString();const os=A.orders.filter(o=>day(o.created_at)===k);
      return {d,top:sum(okT.filter(x=>kind(x)==='topup'&&day(x.created_at)===k)),sale:sumO(os),n:os.length}});
    const pend=A.topups.filter(x=>x.status==='pending');
    return `<h2>ภาพรวมร้าน</h2>
    <div class="stat"><div>เงินเข้าร้านวันนี้ (เติมจริง)<b>${baht(days[0].top)}</b></div><div>ยอดขายวันนี้<b>${baht(days[0].sale)}</b></div><div>เงินเข้าร้านทั้งหมด<b>${baht(sum(okT.filter(x=>kind(x)==='topup')))}</b></div><div>ยอดขายทั้งหมด<b>${baht(sumO(A.orders))}</b></div></div>
    <div class="stat" style="margin-top:10px"><div>ยอดคงเหลือรวมของสมาชิก<b>${baht(members.reduce((s,u)=>s+u.balance,0))}</b></div><div>รอตรวจสอบ<b>${baht(sum(pend))}</b><span class="mut">${pend.length} รายการ</span></div><div>แจกผ่านโค้ด<b>${baht(sum(okT.filter(x=>kind(x)==='code')))}</b></div><div>แอดมินปรับยอดสุทธิ<b>${baht(sum(okT.filter(x=>kind(x)==='admin')))}</b></div></div>
    <div class="stat" style="margin-top:10px"><div>ยอดขายกล่องสุ่ม<b>${baht(A.spins.reduce((s,x)=>s+x.price,0))}</b></div><div>จ่ายเครดิตรางวัลกล่องสุ่ม<b>${baht(A.spins.reduce((s,x)=>s+x.credits,0))}</b></div><div>จำนวนครั้งที่สุ่ม<b>${A.spins.length}</b></div></div>
    <div class="stat" style="margin-top:10px"><div>สต็อกคงเหลือ (ไอดี)<b>${A.prods.reduce((s,p)=>s+p.stock,0)}</b></div><div>สมาชิก<b>${members.length}</b></div><div>ออเดอร์<b>${A.orders.length}</b></div></div>
    <h2 style="margin-top:24px">7 วันล่าสุด</h2><div class="tw"><table><tr><th>วันที่</th><th>เงินเติมเข้า</th><th>ยอดขาย</th><th>ออเดอร์</th></tr>${days.map(x=>`<tr><td>${x.d.toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</td><td>${baht(x.top)}</td><td>${baht(x.sale)}</td><td>${x.n}</td></tr>`).join('')}</table></div>`;
  }
  if(t==='topups')return `<h2>รายการเติมเงิน</h2><p class="mut">ตรวจยอดเข้าในแอป TrueMoney ให้ตรงกับจำนวนและเวลา แล้วกดอนุมัติเพื่อเติมเครดิตให้สมาชิก</p>${A.topups.length?`<div class="tw"><table><tr><th>เวลา</th><th>ผู้ใช้</th><th>จำนวน</th><th>รายละเอียด</th><th>ประเภท</th><th>สถานะ</th><th></th></tr>${A.topups.map(x=>`<tr><td>${dt(x.created_at)}</td><td>${esc(x.username)}</td><td><b>${baht(x.amount)}</b></td><td>${esc(x.ref)}</td><td>${{topup:'โอนเงิน',code:'โค้ด',admin:'แอดมิน'}[x.kind]}</td><td><span class="st ${x.status}">${{pending:'รอตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ'}[x.status]}</span></td><td>${x.status==='pending'?`<button class="btn s sm" onclick="tAct('${x.id}',true)">อนุมัติ</button> <button class="btn r sm" onclick="tAct('${x.id}',false)">ปฏิเสธ</button>`:''}</td></tr>`).join('')}</table></div>`:'<div class="empty">ยังไม่มีรายการ</div>'}`;
  if(t==='cats')return `<h2>จัดการหมวดหมู่</h2><div class="row" style="gap:8px;align-items:stretch"><input id="ce" placeholder="อีโมจิ" style="width:80px"><input id="cn" placeholder="ชื่อหมวดหมู่ใหม่"><button class="btn" onclick="addCat()">เพิ่ม</button></div>
    <div class="tw" style="margin-top:12px"><table><tr><th>หมวดหมู่</th><th>สต็อก</th><th></th></tr>${A.cats.map(c=>`<tr><td>${esc(c.emoji||'')} ${esc(c.name)}</td><td>${A.prods.filter(p=>p.category_id===c.id&&p.stock>0).length}</td><td><button class="btn r sm" onclick="delCat('${c.id}')">ลบ</button></td></tr>`).join('')}</table></div>`;
  if(t==='prods'){
    if(!A.cats.length)return '<div class="empty">ต้องสร้างหมวดหมู่ก่อน</div>';
    return `<h2>เพิ่มสินค้า</h2><label>หมวดหมู่</label><select id="pc">${A.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <label>ชื่อสินค้า</label><input id="pt"><label>ราคาต่อ 1 ไอดี (บาท)</label><input id="pp" type="number" min="1" inputmode="numeric"><label>รายละเอียด (ลูกค้าเห็น)</label><textarea id="pd" rows="2"></textarea>
    <label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input id="prnd" type="checkbox" style="width:auto"> 🎲 สินค้าแบบสุ่มไอดี (ลูกค้าไม่ได้เลือกเอง ระบบสุ่มจากสต็อก)</label>
    <label>รูปภาพสินค้า / ภาพรีวิว (เลือกได้หลายรูป)</label><input id="pf" type="file" accept="image/*" multiple onchange="prevImgs(this)"><div id="pprev" class="thumbs"></div>
    <label>รหัสไอดี — ถ้าขายหลายไอดี ให้เว้นบรรทัดว่างคั่นระหว่างแต่ละไอดี (จำนวนที่ขายได้ = จำนวนไอดี)</label><textarea id="pr" rows="6" placeholder="อีเมล: a@x.com&#10;รหัสผ่าน: 1234&#10;&#10;อีเมล: b@x.com&#10;รหัสผ่าน: 5678" oninput="cntIds(this.value,'cnt')"></textarea><div id="cnt" class="mut"></div>
    <button class="btn" id="addbtn" style="margin-top:12px" onclick="addProd()">เพิ่มสินค้า</button>
    <h2 style="margin-top:26px">สินค้าทั้งหมด</h2><div class="tw"><table><tr><th>สินค้า</th><th>หมวด</th><th>ราคา</th><th>สต็อก</th><th>รูป</th><th>สุ่ม</th><th></th></tr>${A.prods.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc(A.cats.find(c=>c.id===p.category_id)?.name||'-')}</td><td>${baht(p.price)}</td><td>${p.stock>0?p.stock:'หมด'}</td><td>${(p.product_images||[]).length}</td><td><button class="btn g sm" onclick="toggleRnd('${p.id}',${!!p.is_random})">${p.is_random?'🎲 เปิด':'ปิด'}</button></td><td><button class="btn g sm" onclick="manageImgs('${p.id}')">รูป</button> <button class="btn g sm" onclick="addStock('${p.id}')">+สต็อก</button> <button class="btn r sm" onclick="delProd('${p.id}')">ลบ</button></td></tr>`).join('')}</table></div>`;
  }
  if(t==='gacha'){
    if(gBox){
      const bx=A.boxes.find(x=>x.id===gBox)||{name:'',price:0},ok=A.prizes.filter(p=>p.weight>0&&(p.kind!=='account'||p.stock>0)),tw=ok.reduce((s,p)=>s+p.weight,0);
      return `<div class="row"><h2 style="margin:0">🎁 ${esc(bx.name)} <span class="mut">฿${bx.price}/ครั้ง</span></h2><button class="btn g sm" onclick="gBox=null;render()">← กลับ</button></div>
      <h2 style="margin-top:18px">รางวัลในกล่อง</h2>${A.prizes.length?`<div class="tw"><table><tr><th>รางวัล</th><th>ระดับ</th><th>น้ำหนัก</th><th>โอกาส</th><th>ประเภท</th><th>สต็อก</th><th></th></tr>${A.prizes.map(p=>{const live=p.weight>0&&(p.kind!=='account'||p.stock>0);return `<tr><td>${esc(p.name)}</td><td><select style="padding:6px" onchange="setPrize('${p.id}',{rarity:this.value})">${['salt','common','rare','epic','legendary'].map(k=>`<option value="${k}" ${p.rarity===k?'selected':''}>${RAR[k].t}</option>`).join('')}</select></td><td><input type="number" min="0" value="${p.weight}" inputmode="numeric" style="width:84px;padding:6px" onchange="setPrize('${p.id}',{weight:Math.max(0,Math.floor(+this.value)||0)})"></td><td>${live&&tw?(p.weight/tw*100).toFixed(1)+'%':'<span class="mut">หมด</span>'}</td><td>${{account:'ไอดี',credit:'เครดิต ฿'+p.credit_amount,nothing:'ไม่ได้อะไร'}[p.kind]}</td><td>${p.kind==='account'?p.stock:'-'}</td><td>${p.kind==='account'?`<button class="btn g sm" onclick="prizeStock('${p.id}')">+สต็อก</button> `:''}<button class="btn r sm" onclick="delPrize('${p.id}')">ลบ</button></td></tr>`}).join('')}</table></div>`:'<div class="empty">ยังไม่มีรางวัล เพิ่มด้านล่าง</div>'}
      <h2 style="margin-top:22px">เพิ่มรางวัล</h2><label>ชื่อรางวัล</label><input id="gpn" placeholder="เช่น ไอดีแรงค์ Grandmaster / เกลือ ไม่ได้อะไร">
      <div class="row" style="gap:8px"><div style="flex:1"><label>ระดับ</label><select id="gpr"><option value="salt">🧂 เกลือ</option><option value="common" selected>ธรรมดา</option><option value="rare">หายาก</option><option value="epic">เอพิค</option><option value="legendary">ตำนาน</option></select></div>
      <div style="flex:1"><label>น้ำหนัก (ยิ่งมากยิ่งออกบ่อย)</label><input id="gpw" type="number" min="1" value="10" inputmode="numeric"></div></div>
      <p class="mut" style="margin:6px 0 0">ตัวอย่าง: เกลือ 70, ธรรมดา 20, หายาก 8, ตำนาน 2 → โอกาสออก = น้ำหนัก ÷ ผลรวมน้ำหนัก (ไม่ต้องรวมเป็น 100) แก้น้ำหนักทีหลังได้ในตารางด้านบน ใส่ 0 = ไม่ออก</p>
      <label>ประเภทรางวัล</label><select id="gpk" onchange="kindUi()"><option value="nothing">ไม่ได้อะไร (เกลือล้วน)</option><option value="credit">ได้เครดิตคืน</option><option value="account">ได้ไอดี (มีสต็อก)</option></select>
      <div id="gcrw" style="display:none"><label>เครดิตที่ได้ (บาท)</label><input id="gpc" type="number" min="1" inputmode="numeric"></div>
      <div id="gcdw" style="display:none"><label>รหัสไอดี (เว้นบรรทัดว่างคั่นแต่ละไอดี = สต็อก)</label><textarea id="gpd" rows="5" oninput="cntIds(this.value,'gcnt')"></textarea><div id="gcnt" class="mut"></div></div>
      <label>รูปรางวัล (ไม่บังคับ)</label><input id="gpi" type="file" accept="image/*">
      <button class="btn" id="gpb" style="margin-top:12px" onclick="addPrize()">เพิ่มรางวัล</button>`;
    }
    return `<h2>สร้างกล่องสุ่ม</h2><label>ชื่อกล่อง</label><input id="gn"><label>ราคาต่อการสุ่ม 1 ครั้ง (บาท)</label><input id="gp" type="number" min="1" inputmode="numeric"><label>รายละเอียด</label><textarea id="gd" rows="2"></textarea>
    <label>รูปปกกล่อง (ไม่บังคับ)</label><input id="gf" type="file" accept="image/*"><button class="btn" id="gbb" style="margin-top:12px" onclick="addBox()">สร้างกล่อง</button>
    <h2 style="margin-top:26px">กล่องทั้งหมด</h2>${A.boxes.length?`<div class="tw"><table><tr><th>กล่อง</th><th>ราคา</th><th>สถานะ</th><th></th></tr>${A.boxes.map(x=>`<tr><td>${esc(x.name)}</td><td>${baht(x.price)}</td><td>${x.active?'เปิด':'ปิด'}</td><td><button class="btn sm" onclick="gBox='${x.id}';render()">จัดการรางวัล</button> <button class="btn g sm" onclick="toggleOdds('${x.id}',${x.show_odds!==false})">โอกาส: ${x.show_odds!==false?'โชว์':'ซ่อน'}</button> <button class="btn g sm" onclick="toggleBox('${x.id}',${x.active})">${x.active?'ปิดกล่อง':'เปิดกล่อง'}</button> <button class="btn r sm" onclick="delBox('${x.id}')">ลบ</button></td></tr>`).join('')}</table></div>`:'<div class="empty">ยังไม่มีกล่อง</div>'}`;
  }
  if(t==='inbox'){
    if(chatUser){const u=A.users.find(x=>x.id===chatUser);
      return `<div class="row"><h2 style="margin:0">💬 ${esc(u?.username||'ลูกค้า')}</h2><button class="btn g sm" onclick="chatUser=null;render()">← กลับ</button></div>
      <div style="margin-top:12px">${chatBox(A.msgs,'admin')}</div>
      <div class="row" style="gap:8px;margin-top:12px;align-items:stretch"><textarea id="cm" rows="2" placeholder="พิมพ์ข้อความตอบกลับ..." style="flex:1"></textarea><button class="btn" onclick="sendMsg(true)">ส่ง</button></div>`}
    const g={};for(const m of A.msgs){const x=g[m.user_id]||(g[m.user_id]={last:m,unread:0});if(m.sender_role==='user'&&!m.is_read)x.unread++}
    const ids=Object.keys(g);
    return `<h2>ข้อความจากลูกค้า</h2>${ids.length?ids.map(id=>`<div class="conv" onclick="chatUser='${id}';render()"><div class="row"><b>${esc(A.users.find(u=>u.id===id)?.username||'-')}</b><span class="mut">${dt(g[id].last.created_at)}</span></div><div class="row"><span class="mut" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%">${g[id].last.sender_role==='admin'?'คุณ: ':''}${esc(g[id].last.body)}</span>${g[id].unread?`<span class="st rejected">${g[id].unread} ใหม่</span>`:''}</div></div>`).join(''):'<div class="empty">ยังไม่มีข้อความ</div>'}`;
  }
  if(t==='reviews')return `<h2>ภาพรีวิวจากลูกค้า</h2><p class="mut">รูปที่อัปโหลดตรงนี้จะแสดงใต้รายการสินค้าในหน้าแรก</p>
    <label>เลือกรูป (หลายรูปได้)</label><input id="rf" type="file" accept="image/*" multiple><label>คำอธิบาย (ไม่บังคับ)</label><input id="rcap">
    <button class="btn" id="rbtn" style="margin-top:12px" onclick="addReviews()">อัปโหลดรูปรีวิว</button>
    <div class="thumbs" style="margin-top:16px">${A.reviews.length?A.reviews.map(r=>`<div class="th"><img src="${esc(r.url)}" onclick="zoom('${esc(r.url)}')"><button onclick="delReview('${r.id}')">✕</button></div>`).join(''):'<div class="empty" style="width:100%">ยังไม่มีรูปรีวิว</div>'}</div>`;
  if(t==='codes')return `<h2>สร้างโค้ดเติมเงิน</h2><label>โค้ด (เว้นว่าง = สุ่มให้)</label><input id="kc" placeholder="เช่น PIPO100" style="text-transform:uppercase">
    <div class="row" style="gap:8px"><div style="flex:1"><label>จำนวนเงิน (บาท)</label><input id="ka" type="number" min="1" inputmode="numeric"></div><div style="flex:1"><label>ใช้ได้กี่คน</label><input id="km" type="number" min="1" value="1" inputmode="numeric"></div></div>
    <button class="btn" style="margin-top:12px" onclick="addCode()">สร้างโค้ด</button>
    <h2 style="margin-top:26px">โค้ดทั้งหมด</h2>${A.codes.length?`<div class="tw"><table><tr><th>โค้ด</th><th>จำนวน</th><th>ใช้แล้ว</th><th></th></tr>${A.codes.map(k=>`<tr><td><b>${esc(k.code)}</b></td><td>${baht(k.amount)}</td><td>${k.used_count}/${k.max_uses}</td><td><button class="btn r sm" onclick="delCode('${k.id}')">ลบ</button></td></tr>`).join('')}</table></div>`:'<div class="empty">ยังไม่มีโค้ด</div>'}`;
  if(t==='orders')return `<h2>ออเดอร์</h2>${A.orders.length?`<div class="tw"><table><tr><th>เวลา</th><th>ผู้ซื้อ</th><th>สินค้า</th><th>ราคา</th></tr>${A.orders.map(o=>`<tr><td>${dt(o.created_at)}</td><td>${esc(A.users.find(u=>u.id===o.user_id)?.username||'-')}</td><td>${esc(o.title)}</td><td>${baht(o.price)}</td></tr>`).join('')}</table></div>`:'<div class="empty">ยังไม่มีออเดอร์</div>'}`;
  if(t==='users')return `<h2>สมาชิก</h2><div class="tw"><table><tr><th>ชื่อผู้ใช้</th><th>สิทธิ์</th><th>ยอดเงิน</th><th>สมัครเมื่อ</th><th></th></tr>${A.users.map(u=>`<tr><td>${esc(u.username)}</td><td>${u.role}</td><td>${baht(u.balance)}</td><td>${dt(u.created_at)}</td><td><button class="btn sm" onclick="adj('${u.id}','${esc(u.username)}',${u.balance})">ปรับยอดเงิน</button></td></tr>`).join('')}</table></div>`;
}
function tAct(id,ok){
  const x=S.A.topups.find(t=>t.id===id);
  modal(`<b>${ok?'อนุมัติ':'ปฏิเสธ'}</b> ${baht(x.amount)} ของ ${esc(x.username)}?`,async()=>{
    const r=await act(()=>must(sb.rpc('admin_review_topup',{p_id:id,p_approve:ok})));
    if(r!==false)toast(ok?'เติมเงินให้สมาชิกแล้ว':'ปฏิเสธรายการแล้ว');render();
  });
}
async function addCat(){const n=cn.value.trim();if(!n)return toast('กรอกชื่อหมวดหมู่');
  const r=await act(()=>must(sb.from('categories').insert({name:n,emoji:ce.value.trim()||'🎮'})));if(r===false)return;toast('เพิ่มหมวดหมู่แล้ว');render()}
function delCat(id){
  const n=S.A.prods.filter(p=>p.category_id===id&&p.stock>0).length;
  modal(`ลบหมวดหมู่นี้?${n?`<div class="mut">สินค้าที่ยังมีสต็อก ${n} รายการในหมวดนี้จะถูกลบด้วย</div>`:''}`,async()=>{
    await act(()=>must(sb.from('categories').delete().eq('id',id)));if(catSel===id)catSel='all';render()});
}
const cntIds=(t,id)=>{const n=t.replace(/\r/g,'').split(/\n[ \t]*\n/).filter(x=>x.trim()).length;document.getElementById(id).textContent=n?`จะได้สต็อก ${n} ไอดี`:''};
function prevImgs(inp){document.getElementById('pprev').innerHTML=[...inp.files].map(f=>`<div class="th"><img src="${URL.createObjectURL(f)}"></div>`).join('')}
async function compress(file,max=1280,qlt=.82){
  const bmp=await createImageBitmap(file).catch(()=>null);if(!bmp)return file;
  const r=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
  c.width=Math.round(bmp.width*r);c.height=Math.round(bmp.height*r);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return await new Promise(res=>c.toBlob(b=>res(b||file),'image/jpeg',qlt));
}
async function uploadImg(file,folder){
  const blob=await compress(file),path=folder+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.jpg';
  const {error}=await sb.storage.from('product-images').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});
  if(error)throw error;
  return {path,url:sb.storage.from('product-images').getPublicUrl(path).data.publicUrl};
}
async function addProd(){
  const price=Math.floor(+pp.value),title=pt.value.trim(),cred=pr.value.trim(),files=[...pf.files];
  if(!title||price<1||!cred)return toast('กรอกชื่อ ราคา และรหัสไอดีให้ครบ');
  const b=document.getElementById('addbtn');b.disabled=true;
  const id=await act(()=>must(sb.rpc('admin_add_product',{p_cat:pc.value,p_title:title,p_desc:pd.value.trim(),p_price:price,p_cred:cred})));
  if(id===false){b.disabled=false;return}
  if(prnd.checked)await sb.from('products').update({is_random:true}).eq('id',id);
  let i=0;
  for(const f of files){toast(`กำลังอัปโหลดรูป ${i+1}/${files.length}...`);
    try{const u=await uploadImg(f,'products/'+id);await must(sb.from('product_images').insert({product_id:id,url:u.url,path:u.path,sort:i}));i++}
    catch(e){toast('อัปโหลดรูปไม่สำเร็จ: '+em(e))}}
  toast('เพิ่มสินค้าแล้ว');render();
}
async function manageImgs(id){
  const rows=await act(()=>must(sb.from('product_images').select('*').eq('product_id',id).order('sort')));if(rows===false)return;
  document.getElementById('layer').innerHTML=`<div class="ov"><div class="md" style="max-height:90vh;overflow:auto"><h3 style="margin:0">รูปภาพสินค้า</h3>
  <div class="thumbs">${rows.length?rows.map(r=>`<div class="th"><img src="${esc(r.url)}"><button onclick="delImg('${r.id}','${id}')">✕</button></div>`).join(''):'<div class="mut">ยังไม่มีรูป</div>'}</div>
  <label>เพิ่มรูป / ภาพรีวิว (เลือกได้หลายรูป)</label><input type="file" id="mf" accept="image/*" multiple>
  <div class="row" style="margin-top:14px"><button class="btn g" onclick="closeL();render()">ปิด</button><button class="btn" id="mub" onclick="addImgs('${id}',${rows.length})">อัปโหลด</button></div></div></div>`;
}
async function addImgs(id,start){
  const files=[...document.getElementById('mf').files];if(!files.length)return toast('เลือกรูปก่อน');
  document.getElementById('mub').disabled=true;let i=start;
  for(const f of files){toast(`กำลังอัปโหลด ${i-start+1}/${files.length}...`);
    try{const u=await uploadImg(f,'products/'+id);await must(sb.from('product_images').insert({product_id:id,url:u.url,path:u.path,sort:i}));i++}
    catch(e){toast('อัปโหลดไม่สำเร็จ: '+em(e))}}
  manageImgs(id);
}
async function delImg(imgId,pid){
  const r=await act(()=>must(sb.from('product_images').select('path').eq('id',imgId).maybeSingle()));if(r===false)return;
  const d=await act(()=>must(sb.from('product_images').delete().eq('id',imgId)));if(d===false)return;
  if(r&&r.path)await sb.storage.from('product-images').remove([r.path]);
  manageImgs(pid);
}
function addStock(id){
  modal(`<h3 style="margin:0 0 6px">เพิ่มสต็อก</h3><label>รหัสไอดี (เว้นบรรทัดว่างคั่นแต่ละไอดี)</label><textarea id="sk" rows="6" oninput="cntIds(this.value,'skc')"></textarea><div id="skc" class="mut"></div>`,async()=>{
    if(!sk.value.trim()){toast('กรอกรหัสไอดี');return false}
    const n=await act(()=>must(sb.rpc('admin_add_stock',{p_id:id,p_cred:sk.value})));
    if(n===false)return false;toast('เพิ่มสต็อก '+n+' ไอดีแล้ว');render();
  },'เพิ่ม');
}
function delProd(id){
  const p=S.A.prods.find(x=>x.id===id);
  modal(`ลบสินค้า "${esc(p.title)}" พร้อมสต็อกและรูปทั้งหมด?`,async()=>{
    const paths=(p.product_images||[]).map(i=>i.path).filter(Boolean);
    const d=await act(()=>must(sb.from('products').delete().eq('id',id)));
    if(d!==false&&paths.length)await sb.storage.from('product-images').remove(paths);
    render();
  });
}
async function addReviews(){
  const files=[...rf.files];if(!files.length)return toast('เลือกรูปก่อน');
  const cap=rcap.value.trim();document.getElementById('rbtn').disabled=true;let i=0;
  for(const f of files){toast(`กำลังอัปโหลด ${i+1}/${files.length}...`);
    try{const u=await uploadImg(f,'reviews');await must(sb.from('site_images').insert({url:u.url,path:u.path,caption:cap}));i++}
    catch(e){toast('อัปโหลดไม่สำเร็จ: '+em(e))}}
  toast('เพิ่มรูปรีวิวแล้ว');render();
}
function delReview(id){
  modal('ลบรูปรีวิวนี้?',async()=>{
    const r=await act(()=>must(sb.from('site_images').select('path').eq('id',id).maybeSingle()));
    const d=await act(()=>must(sb.from('site_images').delete().eq('id',id)));
    if(d!==false&&r&&r.path)await sb.storage.from('product-images').remove([r.path]);
    render();
  });
}
const bubbles=(m,role)=>m.length?m.map(x=>`<div class="b ${x.sender_role===role?'me':''}">${esc(x.body)}<small>${dt(x.created_at)}</small></div>`).join(''):'<div class="empty">ยังไม่มีข้อความ</div>';
const chatBox=(m,role)=>`<div class="chat" id="chatlist">${bubbles(m,role)}</div>`;
function chatPage(){return `<div class="panel" style="max-width:640px;margin-left:auto;margin-right:auto"><h2>💬 แชทกับร้าน</h2>${chatBox(S.A.msgs,'user')}
  <div class="row" style="gap:8px;margin-top:12px;align-items:stretch"><textarea id="cm" rows="2" placeholder="พิมพ์ข้อความถึงร้าน เช่น สอบถามสินค้า แจ้งปัญหา..." style="flex:1"></textarea><button class="btn" onclick="sendMsg(false)">ส่ง</button></div>
  <p class="mut" style="margin:10px 0 0">ร้านจะตอบกลับในหน้านี้ (เช็กข้อความใหม่ทุก 8 วินาที)</p></div>`}
function scrollChat(){const el=document.getElementById('chatlist');if(el)el.scrollTop=el.scrollHeight}
async function refreshChat(){
  const r=(location.hash||'#/').slice(2).split('/')[0];
  try{
    let m,role;
    if(r==='chat'&&S.me){m=await must(sb.from('messages').select('*').eq('user_id',S.me.id).order('created_at').limit(200));role='user';if(m.some(x=>x.sender_role==='admin'&&!x.is_read))await sb.rpc('mark_messages_read')}
    else if(r==='admin'&&adminTab==='inbox'&&chatUser){m=await must(sb.from('messages').select('*').eq('user_id',chatUser).order('created_at').limit(300));role='admin';await sb.rpc('mark_messages_read',{p_user:chatUser})}
    else return;
    const el=document.getElementById('chatlist');if(!el)return;
    const end=el.scrollHeight-el.scrollTop-el.clientHeight<80;el.innerHTML=bubbles(m,role);if(end)el.scrollTop=el.scrollHeight;
  }catch(e){}
}
async function sendMsg(isAdm){
  const t=cm.value.trim();if(!t)return;
  const r=isAdm?await act(()=>must(sb.rpc('admin_send_message',{p_user:chatUser,p_body:t}))):await act(()=>must(sb.rpc('send_message',{p_body:t})));
  if(r===false)return;cm.value='';await refreshChat();scrollChat();
}
async function toggleRnd(id,cur){const r=await act(()=>must(sb.from('products').update({is_random:!cur}).eq('id',id)));if(r!==false)render()}
const RAR={salt:{t:'เกลือ 🧂',c:'#6b7280'},common:{t:'ธรรมดา',c:'#16a34a'},rare:{t:'หายาก',c:'#2563eb'},epic:{t:'เอพิค',c:'#7c3aed'},legendary:{t:'ตำนาน 🌟',c:'#f59e0b'}};
const rarChip=r=>`<span class="rc" style="background:${(RAR[r]||RAR.common).c}">${(RAR[r]||RAR.common).t}</span>`;
function gachaPage(){
  return `<div class="hero" style="background:radial-gradient(circle at 85% 20%,rgba(255,255,255,.28),transparent 45%),linear-gradient(135deg,#7c3aed,#ec4899)"><h1>🎁 กล่องสุ่ม</h1><p>ลุ้นรับไอดีเทพและรางวัลพิเศษ</p><div class="big">🎲</div></div>
  ${S.boxes.length?`<div class="grid">${S.boxes.map(b=>`<div class="card" style="cursor:pointer" onclick="openBox('${b.id}')"><div class="pimg" style="background:linear-gradient(135deg,#7c3aed,#ec4899)">${b.image_url?`<img src="${esc(b.image_url)}" alt="" onerror="this.remove()">`:'<span style="position:absolute">🎁</span>'}<span class="tag">${(b.gacha_prizes||[]).length} รางวัล</span></div><div class="pb"><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p><div class="row"><span class="price">${baht(b.price)} <span class="mut">/ครั้ง</span></span><button class="btn sm">ดู / สุ่ม</button></div></div></div>`).join('')}</div>`:'<div class="empty">ยังไม่มีกล่องสุ่ม</div>'}`;
}
function openBox(id){
  const b=S.boxes.find(x=>x.id===id);if(!b)return;curBox=b;
  const ok=(b.gacha_prizes||[]).filter(p=>p.weight>0&&(p.kind!=='account'||p.stock>0)),tw=ok.reduce((s,p)=>s+p.weight,0);
  const list=ok.slice().sort((x,y)=>x.weight-y.weight);
  document.getElementById('layer').innerHTML=`<div class="ov" onclick="if(event.target===this){closeL();render()}"><div class="md" style="max-height:92vh;overflow:auto;max-width:460px" id="boxmd">
  <h3 style="margin:0 0 4px">🎁 ${esc(b.name)}</h3><p class="mut" style="white-space:pre-wrap;margin:0 0 10px">${esc(b.description)}</p>
  <b>${b.show_odds!==false?'รางวัลและโอกาสที่จะได้':'รางวัลที่มีในกล่อง'}</b>
  <div style="margin-top:6px">${list.length?list.map(p=>`<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)"><span style="display:flex;gap:8px;align-items:center">${p.image_url?`<img src="${esc(p.image_url)}" style="width:36px;height:36px;border-radius:8px;object-fit:cover">`:''}<span>${esc(p.name)}<br>${rarChip(p.rarity)}</span></span>${b.show_odds!==false?`<b>${(p.weight/tw*100).toFixed(1)}%</b>`:''}</div>`).join(''):'<div class="mut">ยังไม่มีรางวัลให้สุ่ม</div>'}</div>
  <div class="row" style="margin-top:16px"><button class="btn g" onclick="closeL();render()">ปิด</button><button class="btn" id="spinbtn" onclick="doSpin()" ${list.length?'':'disabled'}>🎲 สุ่มเลย ${baht(b.price)}</button></div></div></div>`;
}
let curBox=null;
async function doSpin(){
  const u=S.me,b=curBox;
  if(!u){closeL();toast('กรุณาเข้าสู่ระบบก่อนสุ่ม');return go('login')}
  if(u.balance<b.price){closeL();toast('ยอดเงินไม่พอ กรุณาเติมเงิน');return go('topup')}
  const md=document.getElementById('boxmd');
  md.innerHTML=`<div class="shake">🎁</div><p style="text-align:center">กำลังสุ่ม...</p>`;
  const [res]=await Promise.all([act(()=>must(sb.rpc('spin_gacha',{p_box:b.id}))),new Promise(r=>setTimeout(r,1400))]);
  if(res===false){closeL();render();return}
  const R=RAR[res.rarity]||RAR.common,salt=res.rarity==='salt'||res.kind==='nothing';
  md.innerHTML=`<div class="pop" style="text-align:center"><div style="font-size:64px">${salt?'🧂':res.rarity==='legendary'?'🌟':'🎉'}</div>
  <div style="margin:6px 0">${rarChip(res.rarity)}</div><h3 style="margin:4px 0">${esc(res.prize_name)}</h3>
  ${res.image_url?`<img src="${esc(res.image_url)}" style="max-width:100%;max-height:200px;border-radius:12px;margin:8px 0">`:''}
  ${res.kind==='credit'?`<p>ได้รับเครดิต <b class="price">${baht(res.credits)}</b> เข้ากระเป๋าแล้ว</p>`:''}
  ${res.kind==='nothing'?`<p class="mut">เสียใจด้วย รอบนี้ได้เกลือ ลองใหม่อีกครั้งนะ</p>`:''}
  ${res.kind==='account'?`<p class="mut">รหัสไอดีของคุณ (เก็บไว้ที่ "ไอดีของฉัน" ด้วย)</p><div class="cred" id="rescred" style="text-align:left">${esc(res.credentials)}</div><button class="btn g sm" style="margin-top:8px" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('rescred').textContent).then(()=>toast('คัดลอกแล้ว'))">คัดลอกรหัส</button>`:''}
  </div><div class="row" style="margin-top:16px"><button class="btn g" onclick="closeL();render()">ปิด</button><button class="btn" onclick="again()">🎲 สุ่มอีกครั้ง</button></div>`;
  await loadMe();nav();
}
async function again(){
  await render();
  openBox(curBox.id);
}
function spinsPanel(){
  const s=S.A.spins||[];if(!s.length)return '';
  return `<div class="panel"><h2>🎁 ประวัติกล่องสุ่ม</h2>${s.map(x=>`<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="row"><b>${esc(x.prize_name)}</b>${rarChip(x.rarity)}</div><div class="mut">${esc(x.box_name)} · ${baht(x.price)} · ${dt(x.created_at)}${x.kind==='credit'?` · ได้เครดิต ${baht(x.credits)}`:''}</div>${x.credentials?`<div class="cred">${esc(x.credentials)}</div>`:''}</div>`).join('')}</div>`;
}
function kindUi(){const k=document.getElementById('gpk').value;document.getElementById('gcrw').style.display=k==='credit'?'block':'none';document.getElementById('gcdw').style.display=k==='account'?'block':'none'}
async function addBox(){
  const n=gn.value.trim(),p=Math.floor(+gp.value);if(!n||p<1)return toast('กรอกชื่อและราคา');
  document.getElementById('gbb').disabled=true;let img={url:'',path:''};
  if(gf.files[0]){try{img=await uploadImg(gf.files[0],'gacha')}catch(e){toast('อัปโหลดรูปไม่สำเร็จ: '+em(e))}}
  const r=await act(()=>must(sb.from('gacha_boxes').insert({name:n,price:p,description:gd.value.trim(),image_url:img.url,image_path:img.path})));
  if(r===false){document.getElementById('gbb').disabled=false;return}toast('สร้างกล่องแล้ว');render();
}
async function setPrize(id,patch){const r=await act(()=>must(sb.from('gacha_prizes').update(patch).eq('id',id)));if(r!==false){toast('บันทึกแล้ว');render()}}
async function toggleOdds(id,cur){const r=await act(()=>must(sb.from('gacha_boxes').update({show_odds:!cur}).eq('id',id)));if(r!==false){toast(cur?'ซ่อนโอกาสจากลูกค้าแล้ว':'แสดงโอกาสให้ลูกค้าเห็นแล้ว');render()}}
async function toggleBox(id,cur){const r=await act(()=>must(sb.from('gacha_boxes').update({active:!cur}).eq('id',id)));if(r!==false)render()}
function delBox(id){
  const b=S.A.boxes.find(x=>x.id===id);
  modal(`ลบกล่อง "${esc(b.name)}" พร้อมรางวัลทั้งหมด?`,async()=>{
    const d=await act(()=>must(sb.from('gacha_boxes').delete().eq('id',id)));
    if(d!==false&&b.image_path)await sb.storage.from('product-images').remove([b.image_path]);render()});
}
async function addPrize(){
  const name=gpn.value.trim(),w=Math.floor(+gpw.value),k=gpk.value,cr=Math.floor(+gpc.value)||0,cd=gpd.value;
  if(!name||w<1)return toast('กรอกชื่อรางวัลและน้ำหนัก');
  if(k==='credit'&&cr<1)return toast('กรอกจำนวนเครดิต');
  if(k==='account'&&!cd.trim())return toast('กรอกรหัสไอดี');
  document.getElementById('gpb').disabled=true;
  const id=await act(()=>must(sb.rpc('admin_add_prize',{p_box:gBox,p_name:name,p_rarity:gpr.value,p_weight:w,p_kind:k,p_credit:cr,p_cred:cd})));
  if(id===false){document.getElementById('gpb').disabled=false;return}
  if(gpi.files[0]){try{const u=await uploadImg(gpi.files[0],'gacha');await must(sb.from('gacha_prizes').update({image_url:u.url,image_path:u.path}).eq('id',id))}catch(e){toast('อัปโหลดรูปไม่สำเร็จ: '+em(e))}}
  toast('เพิ่มรางวัลแล้ว');render();
}
function prizeStock(id){
  modal(`<h3 style="margin:0 0 6px">เพิ่มสต็อกรางวัล</h3><label>รหัสไอดี (เว้นบรรทัดว่างคั่นแต่ละไอดี)</label><textarea id="psk" rows="6" oninput="cntIds(this.value,'pskc')"></textarea><div id="pskc" class="mut"></div>`,async()=>{
    if(!psk.value.trim()){toast('กรอกรหัสไอดี');return false}
    const n=await act(()=>must(sb.rpc('admin_add_prize_stock',{p_prize:id,p_cred:psk.value})));
    if(n===false)return false;toast('เพิ่มสต็อก '+n+' ไอดีแล้ว');render();
  },'เพิ่ม');
}
function delPrize(id){
  const p=S.A.prizes.find(x=>x.id===id);
  modal(`ลบรางวัล "${esc(p.name)}"?`,async()=>{
    const d=await act(()=>must(sb.from('gacha_prizes').delete().eq('id',id)));
    if(d!==false&&p.image_path)await sb.storage.from('product-images').remove([p.image_path]);render()});
}
async function addCode(){
  let c=kc.value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');const a=Math.floor(+ka.value),m=Math.floor(+km.value)||1;
  if(!c)c='FF'+Math.random().toString(36).slice(2,8).toUpperCase();
  if(a<1)return toast('กรอกจำนวนเงิน');
  const r=await act(()=>must(sb.from('codes').insert({code:c,amount:a,max_uses:m})));if(r===false)return;toast('สร้างโค้ด '+c+' แล้ว');render();
}
function delCode(id){modal('ลบโค้ดนี้?',async()=>{await act(()=>must(sb.from('codes').delete().eq('id',id)));render()})}
function adj(id,name,bal){
  modal(`<h3 style="margin:0 0 6px">ปรับยอดเงิน ${esc(name)}</h3><div class="mut">ยอดปัจจุบัน ${baht(bal)}</div><label>จำนวน (ใส่ - เพื่อหักเงิน)</label><input id="aa" type="number" inputmode="numeric" placeholder="เช่น 100 หรือ -50">`,async()=>{
    const v=Math.trunc(+aa.value);if(!v)return false;
    const r=await act(()=>must(sb.rpc('admin_adjust_balance',{p_user:id,p_amount:v})));
    if(r===false)return false;toast('ปรับยอดแล้ว');render();
  },'บันทึก');
}
sb.auth.onAuthStateChange(()=>{});
render();
