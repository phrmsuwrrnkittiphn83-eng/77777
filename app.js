const C=window.CONFIG, QR='qr.png', MIN_TOPUP=C.MIN_TOPUP||10;
if(!window.supabase||C.SUPABASE_URL.includes('xxxxxxxx')){document.getElementById('app').innerHTML='<div class="panel"><h2>ยังไม่ได้ตั้งค่า</h2><p class="mut">เปิดไฟล์ config.js แล้วใส่ SUPABASE_URL และ SUPABASE_ANON_KEY</p></div>'}
const sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY);

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const baht=n=>'฿'+Number(n).toLocaleString('th-TH');
const dt=t=>new Date(t).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'});
const ERR={LOGIN:'กรุณาเข้าสู่ระบบ',SOLD:'สินค้านี้ถูกขายแล้ว',INSUFFICIENT:'ยอดเงินไม่พอ กรุณาเติมเงิน',NOCODE:'ไม่พบโค้ดนี้',EXHAUSTED:'โค้ดนี้ถูกใช้ครบแล้ว',USED:'คุณใช้โค้ดนี้ไปแล้ว',BADAMOUNT:'จำนวนเงินไม่ถูกต้อง',NOREF:'กรุณากรอกเลขอ้างอิง',TOOMANY:'มีรายการรอตรวจสอบหลายรายการแล้ว กรุณารอแอดมินตรวจสอบก่อน',FORBIDDEN:'ไม่มีสิทธิ์',NOTFOUND:'ไม่พบรายการ','violates check constraint':'ยอดเงินจะติดลบไม่ได้','already registered':'ชื่อผู้ใช้นี้ถูกใช้แล้ว','Invalid login':'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง','duplicate key':'มีข้อมูลนี้อยู่แล้ว'};
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
async function must(p){const r=await p;if(r.error)throw r.error;return r.data}

/* ---------- router ---------- */
addEventListener('hashchange',render);
async function render(){
  const r=(location.hash||'#/').slice(2).split('/')[0];
  const app=document.getElementById('app');
  try{
    await loadMe();
    if(['topup','orders'].includes(r)&&!S.me)return go('login');
    if(r==='admin'&&!isAdmin())return go(S.me?'':'login');
    nav();
    if(r==='login'&&S.me)return go('');
    if(r===''||!['login','topup','orders','admin'].includes(r)){
      const [c,p]=await Promise.all([must(sb.from('categories').select('*').order('created_at')),must(sb.from('products').select('id,category_id,title,description,image_url,price').eq('sold',false).order('created_at',{ascending:false}))]);
      S.cats=c;S.prods=p;app.innerHTML=home();bindHome();
    }else if(r==='login')app.innerHTML=login('in');
    else if(r==='topup'){S.A.my=await must(sb.from('topups').select('*').eq('user_id',S.me.id).order('created_at',{ascending:false}).limit(100));app.innerHTML=topup()}
    else if(r==='orders'){S.A.orders=await must(sb.from('orders').select('*').eq('user_id',S.me.id).order('created_at',{ascending:false}));app.innerHTML=orders()}
    else if(r==='admin'){await loadAdmin();app.innerHTML=admin()}
    scrollTo(0,0);
  }catch(e){app.innerHTML=`<div class="panel"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p class="mut">${esc(em(e))}</p><button class="btn" onclick="render()">ลองใหม่</button></div>`}
}
function nav(){
  const u=S.me,r=(location.hash||'#/').slice(2).split('/')[0];
  const a=(h,t)=>`<a href="#/${h}" class="${r===h?'on':''}">${t}</a>`;
  document.getElementById('nav').innerHTML=a('','หน้าแรก')+(u?
    `<a href="#/topup" class="bal">💰 ${baht(u.balance)}</a>`+a('topup','เติมเงิน')+a('orders','ไอดีของฉัน')+(u.role==='admin'?a('admin','หลังบ้าน'):'')+`<button onclick="logout()">ออก</button>`
    :a('login','เข้าสู่ระบบ'));
}

/* ---------- customer views ---------- */
function home(){
  const list=S.prods.filter(p=>(catSel==='all'||p.category_id===catSel)&&(!q||(p.title+p.description).toLowerCase().includes(q.toLowerCase())));
  return `<div class="hero"><h1>🔥 ร้านขายไอดี Free Fire</h1><p>ไอดีคุณภาพ ส่งรหัสทันทีหลังชำระ · เติมเงินผ่าน TrueMoney ไม่มีค่าธรรมเนียม</p><div class="big">🎮</div></div>
  ${S.me?`<div class="panel" style="margin:0 0 14px;padding:16px 18px"><div class="row"><div><div class="mut">ยอดเงินคงเหลือของ ${esc(S.me.username)}</div><div class="price" style="font-size:30px">${baht(S.me.balance)}</div></div><a href="#/topup" class="btn">+ เติมเงิน</a></div></div>`:''}
  <input id="sq" placeholder="🔍 ค้นหาไอดี..." value="${esc(q)}" style="margin-bottom:12px">
  <div id="catbar" class="chips"></div><div id="plist"></div>`;
}
function drawList(){
  document.getElementById('catbar').innerHTML=`<div class="chip ${catSel==='all'?'on':''}" data-c="all">ทั้งหมด</div>`+S.cats.map(c=>`<div class="chip ${catSel===c.id?'on':''}" data-c="${c.id}">${esc(c.emoji||'')} ${esc(c.name)}</div>`).join('');
  const list=S.prods.filter(p=>(catSel==='all'||p.category_id===catSel)&&(!q||(p.title+p.description).toLowerCase().includes(q.toLowerCase())));
  document.getElementById('plist').innerHTML=list.length?`<div class="grid">${list.map(p=>{const c=S.cats.find(x=>x.id===p.category_id);return `<div class="card"><div class="pimg">${p.image_url?`<img src="${esc(p.image_url)}" alt="" onerror="this.remove()">`:''}<span style="position:absolute">${p.image_url?'':esc(c?.emoji||'🎮')}</span><span class="tag">${esc(c?.name||'')}</span></div><div class="pb"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div class="row"><span class="price">${baht(p.price)}</span><button class="btn sm" data-b="${p.id}">ซื้อเลย</button></div></div></div>`}).join('')}</div>`:`<div class="empty">ไม่พบสินค้าในหมวดนี้</div>`;
  document.querySelectorAll('.chip').forEach(e=>e.onclick=()=>{catSel=e.dataset.c;drawList()});
  document.querySelectorAll('[data-b]').forEach(e=>e.onclick=()=>buy(e.dataset.b));
}
function bindHome(){const s=document.getElementById('sq');s.oninput=()=>{q=s.value;drawList()};drawList()}
function buy(id){
  const u=S.me;if(!u){toast('กรุณาเข้าสู่ระบบก่อนซื้อ');return go('login')}
  const p=S.prods.find(x=>x.id===id);if(!p)return;
  if(u.balance<p.price){toast('ยอดเงินไม่พอ กรุณาเติมเงิน');return go('topup')}
  modal(`<h3 style="margin:0 0 6px">ยืนยันการซื้อ</h3><div>${esc(p.title)}</div><div class="price" style="margin-top:6px">${baht(p.price)}</div><div class="mut">ยอดคงเหลือหลังซื้อ ${baht(u.balance-p.price)}</div>`,async()=>{
    const ok=await act(()=>must(sb.rpc('buy_product',{p_id:id})));
    if(ok===false){render();return}
    toast('ซื้อสำเร็จ! ดูรหัสได้ที่ "ไอดีของฉัน"');go('orders');
  },'ซื้อ');
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
  return `<div class="panel"><h2>ไอดีของฉัน</h2>${mine.length?mine.map(o=>`<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="row"><b>${esc(o.title)}</b><span class="price" style="font-size:16px">${baht(o.price)}</span></div><div class="mut">${dt(o.created_at)}</div><div class="cred" id="cr${o.id}">${esc(o.credentials)}</div><button class="btn g sm" style="margin-top:8px" onclick="cp('${o.id}')">คัดลอกรหัส</button></div>`).join(''):'<div class="empty">ยังไม่มีรายการสั่งซื้อ</div>'}</div>`;
}
function cp(id){const t=document.getElementById('cr'+id).textContent;try{navigator.clipboard.writeText(t).then(()=>toast('คัดลอกแล้ว'),()=>toast('กดค้างที่ข้อความเพื่อคัดลอก'))}catch(e){toast('กดค้างที่ข้อความเพื่อคัดลอก')}}

/* ---------- admin ---------- */
async function loadAdmin(){
  const t=adminTab,A={};
  if(t==='dash'){[A.topups,A.orders,A.users,A.prods]=await Promise.all([must(sb.from('topups').select('*').order('created_at',{ascending:false}).limit(1000)),must(sb.from('orders').select('id,user_id,price,created_at').limit(1000)),must(sb.from('profiles').select('*')),must(sb.from('products').select('id,sold'))])}
  else if(t==='topups')A.topups=await must(sb.from('topups').select('*').order('created_at',{ascending:false}).limit(300));
  else if(t==='cats'){[A.cats,A.prods]=await Promise.all([must(sb.from('categories').select('*').order('created_at')),must(sb.from('products').select('id,category_id,sold'))])}
  else if(t==='prods'){[A.cats,A.prods]=await Promise.all([must(sb.from('categories').select('*').order('created_at')),must(sb.from('products').select('*').order('created_at',{ascending:false}).limit(500))])}
  else if(t==='codes')A.codes=await must(sb.from('codes').select('*').order('created_at',{ascending:false}));
  else if(t==='orders'){[A.orders,A.users]=await Promise.all([must(sb.from('orders').select('*').order('created_at',{ascending:false}).limit(300)),must(sb.from('profiles').select('id,username'))])}
  else if(t==='users')A.users=await must(sb.from('profiles').select('*').order('created_at',{ascending:false}));
  if(t!=='topups'){A.pend=await must(sb.from('topups').select('id').eq('status','pending'))}else A.pend=A.topups.filter(x=>x.status==='pending');
  S.A=A;
}
function admin(){
  const tabs=[['dash','ภาพรวม'],['topups','การเติมเงิน'],['cats','หมวดหมู่'],['prods','สินค้า'],['codes','โค้ดเงิน'],['orders','ออเดอร์'],['users','สมาชิก']];
  const pend=S.A.pend.length;
  return `<div class="tabs">${tabs.map(([k,t])=>`<button class="${adminTab===k?'on':''}" onclick="adminTab='${k}';render()">${t}${k==='topups'&&pend?` (${pend})`:''}</button>`).join('')}</div><div class="panel" style="margin-top:0;border-top-left-radius:0">${adminBody()}</div>`;
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
    <div class="stat" style="margin-top:10px"><div>สินค้าพร้อมขาย<b>${A.prods.filter(p=>!p.sold).length}</b></div><div>สมาชิก<b>${members.length}</b></div><div>ออเดอร์<b>${A.orders.length}</b></div></div>
    <h2 style="margin-top:24px">7 วันล่าสุด</h2><div class="tw"><table><tr><th>วันที่</th><th>เงินเติมเข้า</th><th>ยอดขาย</th><th>ออเดอร์</th></tr>${days.map(x=>`<tr><td>${x.d.toLocaleDateString('th-TH',{day:'numeric',month:'short'})}</td><td>${baht(x.top)}</td><td>${baht(x.sale)}</td><td>${x.n}</td></tr>`).join('')}</table></div>`;
  }
  if(t==='topups')return `<h2>รายการเติมเงิน</h2><p class="mut">ตรวจยอดเข้าในแอป TrueMoney ให้ตรงกับจำนวนและเวลา แล้วกดอนุมัติเพื่อเติมเครดิตให้สมาชิก</p>${A.topups.length?`<div class="tw"><table><tr><th>เวลา</th><th>ผู้ใช้</th><th>จำนวน</th><th>รายละเอียด</th><th>ประเภท</th><th>สถานะ</th><th></th></tr>${A.topups.map(x=>`<tr><td>${dt(x.created_at)}</td><td>${esc(x.username)}</td><td><b>${baht(x.amount)}</b></td><td>${esc(x.ref)}</td><td>${{topup:'โอนเงิน',code:'โค้ด',admin:'แอดมิน'}[x.kind]}</td><td><span class="st ${x.status}">${{pending:'รอตรวจสอบ',approved:'อนุมัติแล้ว',rejected:'ปฏิเสธ'}[x.status]}</span></td><td>${x.status==='pending'?`<button class="btn s sm" onclick="tAct('${x.id}',true)">อนุมัติ</button> <button class="btn r sm" onclick="tAct('${x.id}',false)">ปฏิเสธ</button>`:''}</td></tr>`).join('')}</table></div>`:'<div class="empty">ยังไม่มีรายการ</div>'}`;
  if(t==='cats')return `<h2>จัดการหมวดหมู่</h2><div class="row" style="gap:8px;align-items:stretch"><input id="ce" placeholder="อีโมจิ" style="width:80px"><input id="cn" placeholder="ชื่อหมวดหมู่ใหม่"><button class="btn" onclick="addCat()">เพิ่ม</button></div>
    <div class="tw" style="margin-top:12px"><table><tr><th>หมวดหมู่</th><th>สินค้าพร้อมขาย</th><th></th></tr>${A.cats.map(c=>`<tr><td>${esc(c.emoji||'')} ${esc(c.name)}</td><td>${A.prods.filter(p=>p.category_id===c.id&&!p.sold).length}</td><td><button class="btn r sm" onclick="delCat('${c.id}')">ลบ</button></td></tr>`).join('')}</table></div>`;
  if(t==='prods'){
    if(!A.cats.length)return '<div class="empty">ต้องสร้างหมวดหมู่ก่อน</div>';
    return `<h2>เพิ่มสินค้า</h2><label>หมวดหมู่</label><select id="pc">${A.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <label>ชื่อสินค้า</label><input id="pt"><label>ราคา (บาท)</label><input id="pp" type="number" min="1" inputmode="numeric"><label>รายละเอียด (ลูกค้าเห็น)</label><textarea id="pd" rows="2"></textarea>
    <label>ลิงก์รูปภาพ (ไม่บังคับ)</label><input id="pi" placeholder="https://..."><label>รหัสไอดี (ลูกค้าเห็นหลังซื้อเท่านั้น)</label><textarea id="pr" rows="3" placeholder="อีเมล/รหัสผ่าน/ช่องทางผูกบัญชี"></textarea>
    <button class="btn" style="margin-top:12px" onclick="addProd()">เพิ่มสินค้า</button>
    <h2 style="margin-top:26px">สินค้าทั้งหมด</h2><div class="tw"><table><tr><th>สินค้า</th><th>หมวด</th><th>ราคา</th><th>สถานะ</th><th></th></tr>${A.prods.map(p=>`<tr><td>${esc(p.title)}</td><td>${esc(A.cats.find(c=>c.id===p.category_id)?.name||'-')}</td><td>${baht(p.price)}</td><td>${p.sold?'ขายแล้ว':'พร้อมขาย'}</td><td>${p.sold?'':`<button class="btn r sm" onclick="delProd('${p.id}')">ลบ</button>`}</td></tr>`).join('')}</table></div>`;
  }
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
  const n=S.A.prods.filter(p=>p.category_id===id&&!p.sold).length;
  modal(`ลบหมวดหมู่นี้?${n?`<div class="mut">สินค้าที่ยังไม่ขาย ${n} รายการในหมวดนี้จะถูกลบด้วย</div>`:''}`,async()=>{
    await act(()=>must(sb.from('categories').delete().eq('id',id)));if(catSel===id)catSel='all';render()});
}
async function addProd(){
  const price=Math.floor(+pp.value),title=pt.value.trim(),cred=pr.value.trim();
  if(!title||price<1||!cred)return toast('กรอกชื่อ ราคา และรหัสไอดีให้ครบ');
  const r=await act(()=>must(sb.rpc('admin_add_product',{p_cat:pc.value,p_title:title,p_desc:pd.value.trim(),p_img:pi.value.trim(),p_price:price,p_cred:cred})));
  if(r===false)return;toast('เพิ่มสินค้าแล้ว');render();
}
function delProd(id){modal('ลบสินค้านี้?',async()=>{await act(()=>must(sb.from('products').delete().eq('id',id)));render()})}
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
