const KEY="plamo-log-v1",GENRES=["カープラモ","飛行機","船","バイク","戦車","その他ミリタリー","ガンプラ","美少女","その他ロボット","その他"],android=/Android/i.test(navigator.userAgent);
let db=JSON.parse(localStorage.getItem(KEY)||'{"kits":[]}'),tab="home",selectedYear=Math.min(2030,Math.max(2024,new Date().getFullYear())),timer,directoryHandle=null,cloudFileHandle=null,savedDirectoryHandle=null,writeChain=Promise.resolve();
const $=s=>document.querySelector(s),money=v=>v===""||v==null?"未登録":Number(v).toLocaleString("ja-JP")+"円",esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SCALE_OPTIONS=["1/6","1/12","1/24","1/32","1/35","1/48","1/72","1/100","1/144","1/350","1/700","ノンスケール"];
function scaleField(value,placeholder){return `<div class="scale-picker"><input name="scale" placeholder="${placeholder}" value="${esc(value||"")}"><button type="button" class="btn scale-toggle" data-scale-toggle aria-expanded="false">候補 ▼</button><div class="scale-menu" data-scale-menu hidden>${SCALE_OPTIONS.map(v=>`<button type="button" class="scale-option" data-scale-choice="${v}">${v}</button>`).join("")}</div></div>`}
function wireScalePicker(root){root.addEventListener("click",e=>{const toggle=e.target.closest("[data-scale-toggle]");if(toggle){const menu=toggle.parentElement.querySelector("[data-scale-menu]"),open=menu.hidden;root.querySelectorAll("[data-scale-menu]").forEach(m=>m.hidden=true);root.querySelectorAll("[data-scale-toggle]").forEach(b=>b.setAttribute("aria-expanded","false"));menu.hidden=!open;toggle.setAttribute("aria-expanded",String(open));return;}const choice=e.target.closest("[data-scale-choice]");if(choice){const picker=choice.closest(".scale-picker"),input=picker.querySelector('input[name="scale"]');input.value=choice.dataset.scaleChoice;input.dispatchEvent(new Event("input",{bubbles:true}));picker.querySelector("[data-scale-menu]").hidden=true;picker.querySelector("[data-scale-toggle]").setAttribute("aria-expanded","false");return;}if(!e.target.closest(".scale-picker")){root.querySelectorAll("[data-scale-menu]").forEach(m=>m.hidden=true);root.querySelectorAll("[data-scale-toggle]").forEach(b=>b.setAttribute("aria-expanded","false"));}})}
const saveLocal=()=>localStorage.setItem(KEY,JSON.stringify(db)),status=(s)=>$("#sync").textContent=s,ro=()=>android;
const metaTime=x=>{const v=x?._plamoMeta?.updatedAt;const n=v?Date.parse(v):NaN;return Number.isFinite(n)?n:null};
const dataOnly=x=>{const y=JSON.parse(JSON.stringify(x||{kits:[]}));delete y._plamoMeta;return y};
const sameData=(a,b)=>JSON.stringify(dataOnly(a))===JSON.stringify(dataOnly(b));
const stamp=n=>n?new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(n)):"記録なし（旧データ）";
function markUpdated(){db._plamoMeta={...(db._plamoMeta||{}),updatedAt:new Date().toISOString()}}
function state(k){return k.disposed?"廃棄済み":k.complete?"完成":k.start?"製作中":"積みプラ"}
function validData(x){return x&&Array.isArray(x.kits)}
function openSettingsDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open("plamo-log-settings",1);r.onupgradeneeded=()=>r.result.createObjectStore("settings");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function setting(key,value,write=false){const d=await openSettingsDb();return new Promise((resolve,reject)=>{const t=d.transaction("settings",write?"readwrite":"readonly"),s=t.objectStore("settings");if(write){s.put(value,key);t.oncomplete=()=>resolve()}else{const r=s.get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}t.onerror=()=>reject(t.error)})}
async function readCloud(handle){const f=await handle.getFile(),txt=await f.text();if(!txt.trim())return {kits:[]};const x=JSON.parse(txt);if(!validData(x))throw Error("JSONの形式がPLAMO LOG用ではありません");return x}
async function writeCloud(){
  if(!cloudFileHandle)return false;
  writeChain=writeChain.catch(()=>{}).then(async()=>{
    status("OneDriveへ保存中…");
    const snapshot=JSON.stringify(db);
    const w=await cloudFileHandle.createWritable();
    await w.write(snapshot);
    await w.close();
    status("PC内・OneDrive両方に保存済み");
    return true;
  }).catch(e=>{
    status("OneDrive保存失敗（PC内には保存済み）");
    console.error(e);
    return false;
  });
  return writeChain;
}
function schedule(){
  markUpdated();
  saveLocal();
  if(directoryHandle){status("PC内・OneDrive保存待ち…");clearTimeout(timer);timer=setTimeout(()=>{writeCloud()},900)}
  else status("PC内保存済み（OneDrive未接続）");
}
function chooseConflict(local,cloud,localTime,cloudTime){
  return new Promise(resolve=>{
    const modal=$("#modal");
    modal.innerHTML=`<div class="modal" style="z-index:20"><div class="dialog" style="width:min(560px,96vw)"><h3>保存データが異なります</h3><p>どちらのデータを使用するか選んでください。選択した内容をPC内とOneDriveの両方に保存します。</p><section class="panel" style="margin:10px 0"><b>OneDriveのJSON</b><p class="muted">最終更新：${stamp(cloudTime)}</p><p>登録キット数：${cloud.kits.length}</p><button class="btn primary" id="use-cloud" style="width:100%">OneDriveのJSONを使用する</button></section><section class="panel" style="margin:10px 0"><b>PC内のデータ</b><p class="muted">最終更新：${stamp(localTime)}</p><p>登録キット数：${local.kits.length}</p><button class="btn primary" id="use-local" style="width:100%">PC内のデータを使用する</button></section><p class="muted">日時はアプリ内の最終保存日時を優先し、記録がない場合はJSONファイルの更新日時を表示します。</p></div></div>`;
    const finish=value=>{modal.innerHTML="";resolve(value)};
    $("#use-cloud").onclick=()=>finish("cloud");
    $("#use-local").onclick=()=>finish("local");
  });
}
async function activateFolder(dir,askChoice=false){
  const perm=await dir.queryPermission({mode:"readwrite"});
  if(perm!=="granted")throw new Error("フォルダへの読み書き許可がありません");
  const fh=await dir.getFileHandle("PLAMO_LOG_DATA.json",{create:true});
  const file=await fh.getFile();
  let cloud={kits:[]};
  if(file.size>0)cloud=await readCloud(fh);
  const local=JSON.parse(localStorage.getItem(KEY)||'{"kits":[]}');
  const localTime=metaTime(local);
  const cloudTime=metaTime(cloud)??(file.size>0?file.lastModified:null);
  directoryHandle=dir;cloudFileHandle=fh;
  if(file.size===0){
    db=local;
  }else if(sameData(local,cloud)){
    db=local;
    const newest=Math.max(localTime||0,cloudTime||0);
    if(newest)db._plamoMeta={...(db._plamoMeta||{}),updatedAt:new Date(newest).toISOString()};
  }else if(localTime!==null&&cloudTime!==null&&localTime!==cloudTime){
    db=localTime>cloudTime?local:cloud;
  }else{
    const choice=await chooseConflict(local,cloud,localTime,cloudTime);
    db=choice==="cloud"?cloud:local;
  }
  markUpdated();
  saveLocal();
  const saved=await writeCloud();
  if(!saved)throw new Error("OneDriveへの保存に失敗しました。PC内のデータは保存されています。");
  await setting("directoryHandle",dir,true);
  savedDirectoryHandle=dir;
  $("#connect").textContent="OneDrive接続済み";
  status("PC内・OneDrive両方に保存済み");
  render();
}
async function connect(){
  if(android){$("#cloudFile").click();return}
  if(!window.showDirectoryPicker){alert("このブラウザではフォルダへの直接保存に対応していません。最新のChromeまたはEdgeで開いてください。");return}
  // 保存済みハンドルがある場合、ユーザーのクリック直後に権限要求を開始する。
  // IndexedDB読込などを先にawaitすると、ブラウザのユーザー操作許可が失われるため行わない。
  if(savedDirectoryHandle){
    try{
      const permissionPromise=savedDirectoryHandle.requestPermission({mode:"readwrite"});
      const permission=await permissionPromise;
      if(permission==="granted"){
        await activateFolder(savedDirectoryHandle,false);
        return;
      }
      status("OneDriveの読み書き許可が必要です");
      alert("保存先フォルダは記憶されていますが、読み書き許可が得られませんでした。ブラウザの許可画面で許可してください。フォルダの選び直しは不要です。");
      return;
    }catch(e){
      status("OneDriveの再接続に失敗しました");
      alert("保存済みフォルダへの再接続に失敗しました。\n"+e.message+"\nフォルダを選び直す場合は「別のOneDriveフォルダを選択」を使ってください。");
      return;
    }
  }
  await chooseFolder();
}
async function chooseFolder(){
  if(android){$("#cloudFile").click();return}
  if(!window.showDirectoryPicker){alert("このブラウザではフォルダへの直接保存に対応していません。");return}
  try{
    const dir=await window.showDirectoryPicker({id:"plamo-log-data",mode:"readwrite"});
    const permission=await dir.requestPermission({mode:"readwrite"});
    if(permission!=="granted")throw new Error("フォルダへの読み書きが許可されませんでした");
    savedDirectoryHandle=dir;
    await activateFolder(dir,true);
  }catch(e){
    if(e.name!=="AbortError")alert("OneDriveフォルダを選択できませんでした。\n"+e.message);
  }
}
async function restoreFolder(){
  if(android)return;
  try{
    const h=await setting("directoryHandle");
    if(!h){status("OneDrive未接続（起動時に選択してください）");return}
    savedDirectoryHandle=h;
    const p=await h.queryPermission({mode:"readwrite"});
    status(p==="granted"?"OneDrive接続準備完了":"OneDriveは許可操作が必要です");
    $("#connect").textContent=p==="granted"?"OneDrive再接続":"OneDrive再接続（許可）";
  }catch(e){status("OneDrive未接続");console.warn(e)}
}
async function startCloudMode(){
  $("#startupNote").textContent="OneDriveに接続しています…";
  try{
    if(savedDirectoryHandle) await connect(); else await chooseFolder();
    if(directoryHandle){$("#startup").classList.add("hidden");$("#startupNote").textContent="";}
    else $("#startupNote").textContent="接続できませんでした。もう一度試すか、PC内モードを選んでください。";
  }catch(e){$("#startupNote").textContent="接続できませんでした："+e.message}
}
function startLocalMode(){
  directoryHandle=null;cloudFileHandle=null;
  db=JSON.parse(localStorage.getItem(KEY)||'{"kits":[]}');
  status("PC内保存モード（OneDrive未接続）");$("#connect").textContent="OneDrive未接続";
  $("#startup").classList.add("hidden");render();
}
$("#cloudFile").onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const x=JSON.parse(await f.text());if(!validData(x))throw Error("PLAMO LOGのJSONではありません");db=x;saveLocal();render();status("OneDriveファイル読込済み（閲覧専用）")}catch(err){alert("JSONを読み込めませんでした。\n"+err.message)}finally{e.target.value=""}};
function card(k){return `<article class="item ${k.disposed?"disposed":k.start&&!k.complete?"working":""}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(k.name)}</b><span class="tag">${state(k)}</span></div><div class="item-details"><div>ジャンル：${esc(k.genre||"未登録")}</div><div>スケール：${esc(k.scale||"未登録")}</div><div>メーカー：${esc(k.maker||"未登録")}</div><div>購入日：${esc(k.purchase||"未登録")}</div><div>購入金額：${esc(money(k.purchaseAmount))}</div><div>購入店：${esc(k.place||"未登録")}</div></div><button class="btn" data-detail="${k.id}">詳細・日記</button></article>`}
function stashGroups(kits){
  if(!kits.length)return '<p class="muted">積みプラはありません。</p>';
  const years=[...new Set(kits.map(k=>k.purchase&&/^\d{4}/.test(k.purchase)?Number(k.purchase.slice(0,4)):null))].sort((a,b)=>{if(a===null)return 1;if(b===null)return -1;return a-b});
  return years.map(year=>{
    const rows=kits.filter(k=>(k.purchase&&/^\d{4}/.test(k.purchase)?Number(k.purchase.slice(0,4)):null)===year)
      .sort((a,b)=>(a.purchase||"").localeCompare(b.purchase||"")||a.name.localeCompare(b.name,"ja"));
    return `<section class="stash-year"><h3>${year===null?"購入年未登録":`${year}年購入`}</h3><div class="cards">${rows.map(card).join("")}</div></section>`;
  }).join("");
}
const YEARS=Array.from({length:7},(_,i)=>2024+i);
function yearButtons(){return `<div class="year-buttons">${YEARS.map(y=>`<button class="btn ${selectedYear===y?"primary":""}" data-year="${y}">${y}年</button>`).join("")}</div>`}
function yearHistory(a,query=""){
  const q=query.trim().toLocaleLowerCase("ja");
  if(q){
    const matches=a.filter(k=>[k.name,k.maker,k.genre,k.scale,k.place,k.purchase,k.start,k.complete].join(" ").toLocaleLowerCase("ja").includes(q)).sort((x,y)=>(y.start||y.purchase||"").localeCompare(x.start||x.purchase||""));
    const groups=YEARS.slice().reverse().map(y=>{const rows=matches.filter(k=>Number((k.start||k.purchase||"").slice(0,4))===y);return rows.length?`<h3>${y}年</h3><div class="cards">${rows.map(card).join("")}</div>`:""}).join("");
    const undated=matches.filter(k=>!Number((k.start||k.purchase||"").slice(0,4))||!YEARS.includes(Number((k.start||k.purchase||"").slice(0,4))));
    return `<p class="muted">全年度を対象に検索しています。キット名・メーカー・ジャンル・スケール・購入店・日付で検索できます。</p>${groups}${undated.length?`<h3>年度未分類・対象外</h3><div class="cards">${undated.map(card).join("")}</div>`:""}${matches.length?"":'<p class="muted">該当するキットはありません。</p>'}`;
  }
  const kits=a.filter(k=>k.start&&Number(k.start.slice(0,4))===selectedYear).sort((x,y)=>x.start.localeCompare(y.start));
  return `<p class="muted">製作開始日を基準に、その年に製作を開始したキットを表示します。検索欄に入力すると全年度から検索できます。</p><div class="cards">${kits.map(card).join("")||`<p class="muted">${selectedYear}年に製作を開始したキットはありません。</p>`}</div>`;
}
function genreYearStats(a){const currentYear=new Date().getFullYear();return YEARS.map(year=>{const rows=GENRES.map(g=>{const group=a.filter(k=>!k.disposed&&(k.genre||"その他")===g);const purchased=group.filter(k=>k.purchase&&Number(k.purchase.slice(0,4))===year);const completed=group.filter(k=>k.complete&&Number(k.complete.slice(0,4))===year);const active=year===currentYear?group.filter(k=>k.start&&Number(k.start.slice(0,4))<=currentYear&&!k.complete):[];if(!purchased.length&&!active.length&&!completed.length)return "";const names=list=>list.map(k=>esc(k.name)).join("、")||"なし";return `<section class="panel" style="margin:8px 0"><b>${esc(g)}</b><div class="year-stat-grid"><div><strong>購入 ${purchased.length}</strong><small>${names(purchased)}</small></div><div><strong>製作中 ${active.length}</strong><small>${names(active)}</small></div><div><strong>完成 ${completed.length}</strong><small>${names(completed)}</small></div></div></section>`}).filter(Boolean);const eligible=a.filter(k=>!k.disposed);const purchases=eligible.filter(k=>k.purchase&&Number(k.purchase.slice(0,4))===year).length,active=year===currentYear?eligible.filter(k=>k.start&&Number(k.start.slice(0,4))<=currentYear&&!k.complete).length:0,completed=eligible.filter(k=>k.complete&&Number(k.complete.slice(0,4))===year).length;return `<section class="panel" style="margin:12px 0"><h3>${year}年</h3><p>購入 ${purchases}件　製作中 ${active}件　完成 ${completed}件</p>${rows.join("")||'<p class="muted">この年度の該当データはありません。</p>'}</section>`}).join("")}
function render(){let a=db.kits,eligible=a.filter(k=>!k.disposed);$("#total").textContent=eligible.filter(k=>!k.start).length;$("#active").textContent=eligible.filter(k=>k.start&&!k.complete).length;$("#done").textContent=eligible.filter(k=>k.complete).length;$("#add").classList.toggle("hidden",ro());$("#mode").textContent=ro()?"Android閲覧モード：この端末から編集できません。":directoryHandle?"PC編集モード：PC内とOneDriveへ自動保存されます。":"PC編集モード：変更はPC内に自動保存されます。OneDrive未接続です。";document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));let v=$("#view");if(tab==="home"){ $("#heading").textContent="製作中";const active=eligible.filter(k=>k.start&&!k.complete).sort((x,y)=>x.start.localeCompare(y.start));v.innerHTML=`<div class="cards">${active.map(card).join("")||'<p class="muted">製作中のキットはありません。</p>'}</div>`}else if(tab==="stash"){ $("#heading").textContent="積みプラ";v.innerHTML=`<p class="muted">購入年ごとにまとめて表示しています。製作開始日を登録すると自動的に「製作中」へ移動します。</p>${stashGroups(eligible.filter(k=>!k.start))}`}else if(tab==="years"){ $("#heading").textContent="年度別履歴";v.innerHTML=yearButtons()+`<input id="year-search" placeholder="全年度から検索（キット名・メーカー・ジャンルなど）"><div id="year-results">${yearHistory(a)}</div>`;$("#year-search").oninput=()=>{$("#year-results").innerHTML=yearHistory(a,$("#year-search").value)}}else{$("#heading").textContent="ジャンル集計";v.innerHTML=genreYearStats(a)}}
function openForm(k){if(ro())return;let fresh=!k;k=k||{id:crypto.randomUUID(),genre:GENRES[0],paints:[],diary:[],photos:[]};$("#modal").innerHTML=`<div class="modal"><div class="dialog"><div style="display:flex;justify-content:space-between"><h3>${fresh?"キット登録":"キット編集"}</h3><div style="display:flex;gap:8px;align-items:center"><button type="submit" form="form" class="btn primary">保存</button><button id="close" class="btn">閉じる</button></div></div><form id="form"><label>キット名 *</label><input name="name" required value="${esc(k.name)}"><div class="grid2"><div><label>メーカー</label><input name="maker" placeholder="例：バンダイ、タミヤ、ハセガワ" value="${esc(k.maker||'')}"></div><div><label>購入金額（税込・円）</label><input type="number" name="purchaseAmount" min="0" step="1" inputmode="numeric" placeholder="例：5280" value="${esc(k.purchaseAmount??'')}"></div></div><label>ジャンル</label><select name="genre">${GENRES.map(g=>`<option ${k.genre===g?"selected":""}>${g}</option>`)}</select><label>スケール</label>${scaleField(k.scale,"例：1/144、1/100、1/72、ノンスケール")}<div class="grid2"><div><label>購入日</label><input type="date" name="purchase" value="${k.purchase||""}"></div><div><label>購入店</label><input name="place" placeholder="例：模型店、家電量販店、Amazonなど" value="${esc(k.place||"")}"></div></div><div class="grid2">${[["start","製作開始日"],["paint","塗装開始日"],["complete","完成日"]].map(([n,l])=>`<div><label>${l}</label><input type="date" name="${n}" value="${k[n]||""}"></div>`).join("")}</div><button class="btn primary">保存</button></form></div></div>`;wireScalePicker($("#form"));$("#close").onclick=()=>$("#modal").innerHTML="";$("#form").onsubmit=e=>{e.preventDefault();let o=Object.fromEntries(new FormData(e.target));if((o.paint||o.complete)&&!o.start)return alert("塗装開始日・完成日には製作開始日が必要です");if(o.complete&&o.complete<o.start)return alert("完成日を確認してください");Object.assign(k,o);if(fresh)db.kits.push(k);schedule();$("#modal").innerHTML="";render()}}


function bindPhotoInteractions(img,src,onEdit){
  let timer=null;
  img.style.cursor="zoom-in";
  img.onclick=e=>{if(e.target.closest("button"))return;clearTimeout(timer);timer=setTimeout(()=>showPhotoViewer(src,onEdit),240)};
  img.ondblclick=e=>{e.preventDefault();e.stopPropagation();clearTimeout(timer);if(onEdit)onEdit()};
}
function showPhotoViewer(src,onEdit){
  const layer=document.createElement("div");layer.className="modal";layer.style.cssText="z-index:9999;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:48px 12px 16px";
  layer.innerHTML=`<button type="button" class="btn" data-view-close style="position:absolute;right:14px;top:12px;z-index:2">閉じる</button><p style="position:absolute;top:14px;left:14px;color:white;margin:0">ホイール：拡大・縮小　ドラッグ：写真を移動　${onEdit?"ダブルクリック：編集":""}</p><img data-view-image src="${src}" style="max-width:94vw;max-height:88vh;object-fit:contain;transform:scale(1);transform-origin:center;transition:transform .08s;cursor:grab;touch-action:none;user-select:none">`;
  document.body.appendChild(layer);const image=layer.querySelector("[data-view-image]");let zoom=1,panX=0,panY=0,drag=null;
  const update=()=>{image.style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`};
  const close=()=>layer.remove();layer.querySelector("[data-view-close]").onclick=close;layer.onclick=e=>{if(e.target===layer)close()};
  layer.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.25,Math.min(6,zoom*(e.deltaY<0?1.15:1/1.15)));update();},{passive:false});
  image.addEventListener("pointerdown",e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,px:panX,py:panY};image.setPointerCapture(e.pointerId);image.style.cursor="grabbing";e.preventDefault()});
  image.addEventListener("pointermove",e=>{if(!drag)return;panX=drag.px+(e.clientX-drag.x);panY=drag.py+(e.clientY-drag.y);update()});
  const endPan=()=>{drag=null;image.style.cursor="grab"};image.addEventListener("pointerup",endPan);image.addEventListener("pointercancel",endPan);
  image.ondblclick=e=>{e.preventDefault();if(onEdit){close();onEdit()}};
  layer.onkeydown=e=>{if(e.key==="Escape")close()};layer.tabIndex=0;layer.focus();
}

async function compressImage(file){
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=data});
  const max=1800,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,w,h);
  let transparent=false;
  if(file.type==="image/png"){const px=ctx.getImageData(0,0,w,h).data;for(let i=3;i<px.length;i+=4){if(px[i]<255){transparent=true;break}}}
  return transparent?canvas.toDataURL("image/png"):canvas.toDataURL("image/jpeg",.82);
}
const paintTypes={
 "ファレホ":["モデルカラー","ゲームカラー","モデルエアー","ゲームエアー","メカカラー","ピグメント","ウォッシュ","メタリック","トゥルーメタルメタリック","その他"],
 "クレオス":["ラッカー","水性ホビーカラー","アクリジョン"],
 "タミヤ":["アクリル塗料","エナメル塗料","ラッカー塗料","その他"],
 "ガイアノーツ":["ガイアカラー","Ex-シリーズ","その他"]
};
function detail(k){
  k.paints=k.paints||[];k.diary=k.diary||[];k.photos=k.photos||[];
  const paintRows=k.paints.map((p,i)=>`<section class="panel paint-row" style="margin:8px 0"><b class="paint-area">${esc(p.area||"パーツ未登録")}</b><div class="paint-info muted">下地：${esc(p.basecoat||"未登録")} / メーカー：${esc(p.maker||"未登録")} / 種類：${esc(p.type||"未登録")}${p.maker==="ファレホ"?` / 色番号：${esc(p.code||"未登録")}`:""} / 色名：${esc(p.name||"未登録")}</div><div class="paint-actions">${ro()?"":`<button class="btn" data-paint-edit="${i}">編集</button> <button class="btn" data-paint-del="${i}">削除</button>`}</div></section>`).join("");
  const diaryRows=k.diary.map((d,i)=>`<section class="panel" style="margin:8px 0"><b>${esc(d.date||"日付未選択")}</b><p style="white-space:pre-wrap">${esc(d.text||"")}</p>${(d.photos||[]).length?`<div class="photoGrid">${d.photos.map((item,j)=>{const src=typeof item==="string"?item:(item.marked||item.original);return `<img class="photo diary-photo" data-diary-photo="${i}-${j}" title="クリックで閲覧、ダブルクリックで注釈編集" src="${src}" style="cursor:zoom-in">`}).join("")}</div><p class="muted">写真をダブルクリックすると注釈を編集できます。</p>`:""}${ro()?"":`<button class="btn" data-diary-edit="${i}">編集</button> <button class="btn" data-diary-del="${i}">削除</button>`}</section>`).join("");
  const allPhotos=k.photos.map((p,i)=>`<div><img class="photo" data-kit-photo="${i}" src="${p.marked||p.original}" title="クリックで閲覧、ダブルクリックで注釈編集"><p class="muted">${esc(p.note||"")}</p><button class="btn" data-original="${i}">保存画像表示</button>${ro()?"":` <button class="btn" data-photo-del="${i}">写真を削除</button>`}</div>`).join("");
  const basicInfo=ro()?`<div class="panel" style="margin:8px 0"><h3>基本情報</h3><p>キット名：${esc(k.name||"未登録")}<br>メーカー：${esc(k.maker||"未登録")}<br>ジャンル：${esc(k.genre||"未登録")}<br>スケール：${esc(k.scale||"未登録")}<br>購入日：${esc(k.purchase||"未登録")}<br>購入店：${esc(k.place||"未登録")}<br>購入金額：${esc(money(k.purchaseAmount))}<br>製作開始日：${esc(k.start||"未登録")}<br>塗装開始日：${esc(k.paint||"未登録")}<br>完成日：${esc(k.complete||"未登録")}</p></div>`:`<section class="panel" style="margin:8px 0"><h3>基本情報（ここで直接編集できます）</h3><form id="basic-info-form"><label>キット名 *</label><input name="name" required value="${esc(k.name||"")}"><div class="grid2"><div><label>メーカー</label><input name="maker" placeholder="例：バンダイ、タミヤ、ハセガワ" value="${esc(k.maker||'')}"></div><div><label>購入金額（税込・円）</label><input type="number" name="purchaseAmount" min="0" step="1" inputmode="numeric" placeholder="例：5280" value="${esc(k.purchaseAmount??'')}"></div></div><div class="grid2"><div><label>ジャンル</label><select name="genre">${GENRES.map(g=>`<option ${k.genre===g?"selected":""}>${g}</option>`).join("")}</select></div><div><label>スケール</label>${scaleField(k.scale,"例：1/144、1/100、ノンスケール")}</div></div><div class="grid2"><div><label>購入日</label><input type="date" name="purchase" value="${k.purchase||""}"></div><div><label>購入店</label><input name="place" placeholder="例：模型店、家電量販店、Amazonなど" value="${esc(k.place||"")}"></div></div><div class="grid2">${[["start","製作開始日"],["paint","塗装開始日"],["complete","完成日"]].map(([n,l])=>`<div><label>${l}</label><input type="date" name="${n}" value="${k[n]||""}"></div>`).join("")}</div><p class="muted">入力内容は自動保存されます。</p></form></section>`;
  $("#modal").innerHTML=`<div class="modal"><div class="dialog">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h2>${esc(k.name)}</h2><p class="muted">${esc(k.genre)} / ${esc(k.scale||"スケール未登録")} / ${state(k)}</p></div><div style="display:flex;gap:8px;flex-shrink:0">${ro()?"":'<button id="delete-kit" class="btn danger">キット削除</button>'}<button id="close" class="btn">閉じる</button></div></div>
    ${basicInfo}
    ${k.complete&&String(k.summary||"").trim()?`<section class="summary-section"><h2>製作総評</h2><textarea id="summary" ${ro()?"readonly":""}>${esc(k.summary||"")}</textarea></section>`:""}
    <h3>使用塗料</h3>${paintRows||'<p class="muted">使用塗料はまだ登録されていません。</p>'}${ro()?"":'<button id="paint" class="btn">塗料追加</button>'}
    <h3>日付別作業日記</h3>${diaryRows||'<p class="muted">日記はまだ登録されていません。</p>'}${ro()?"":'<button id="diary" class="btn">日記追加</button>'}
    ${!(k.complete&&String(k.summary||"").trim())?`<section class="summary-section"><h2>製作総評</h2><textarea id="summary" ${ro()?"readonly":""}>${esc(k.summary||"")}</textarea></section>`:""}
    <h3>写真</h3><p class="muted">写真はシングルクリックで閲覧（ホイールで拡大・縮小）、ダブルクリックで注釈編集できます。</p><div class="photoGrid">${allPhotos}</div>${ro()?"":'<label>写真追加（JPEG / PNG・追加時に自動圧縮）<input id="photos" type="file" accept="image/jpeg,image/png" multiple></label>'}
    <section class="panel" style="margin:18px 0;border-color:${k.disposed?"#dc2626":"#dce2ea"}"><h3 style="margin-top:0">廃棄済み</h3>${ro()?`<p>${k.disposed?"☑ 廃棄済み":"□ 未廃棄"}</p><p style="white-space:pre-wrap">${esc(k.disposalNote||"")}</p>`:`<div class="grid2" style="grid-template-columns:auto 1fr;align-items:start;gap:12px"><label style="display:flex;align-items:center;gap:8px;font-size:15px;color:#202733"><input id="disposed" type="checkbox" style="width:auto;margin:4px" ${k.disposed?"checked":""}> 廃棄済み</label><div><label for="disposal-note">廃棄日・廃棄理由など</label><textarea id="disposal-note" rows="3" placeholder="例：2026年11月、破損のため廃棄">${esc(k.disposalNote||"")}</textarea></div></div>`}</section>
  </div></div>`;
  $("#close").onclick=()=>{$("#modal").innerHTML="";render()};
  if(!ro())$("#delete-kit").onclick=()=>{if(!confirm(`「${k.name}」を削除しますか？\nキット情報・日記・写真・注釈もすべて削除されます。この操作は取り消せません。`))return;db.kits=db.kits.filter(x=>x.id!==k.id);schedule();$("#modal").innerHTML="";render()};
  if(!ro()){
    $("#summary").oninput=()=>{k.summary=$("#summary").value;schedule()};
    const basicForm=$("#basic-info-form");
    wireScalePicker(basicForm);
    const saveBasicInfo=e=>{
      const values=Object.fromEntries(new FormData(basicForm));
      if((values.paint||values.complete)&&!values.start){if(["start","paint","complete"].includes(e.target.name)){e.target.setCustomValidity?.("塗装開始日・完成日には製作開始日が必要です");return}}
      if(values.complete&&values.start&&values.complete<values.start){if(["start","complete"].includes(e.target.name)){e.target.setCustomValidity?.("完成日は製作開始日以降にしてください");return}}
      e.target.setCustomValidity?.("");
      Object.assign(k,values);schedule();
      const heading=$("#modal h2");if(heading)heading.textContent=k.name||"キット詳細";
    };
    basicForm.addEventListener("input",saveBasicInfo);basicForm.addEventListener("change",saveBasicInfo);
    $("#disposed").onchange=e=>{k.disposed=e.target.checked;schedule();e.target.closest(".panel").style.borderColor=k.disposed?"#dc2626":"#dce2ea"};
    $("#disposal-note").oninput=e=>{k.disposalNote=e.target.value;schedule()};
    const openPaint=(idx=null)=>{
      const p=idx===null?{area:"",maker:"ファレホ",type:"",name:"",code:"",basecoat:""}:{...k.paints[idx]};
      $("#modal").insertAdjacentHTML("beforeend",`<div class="modal" style="z-index:2;padding:2vh 2vw"><div class="dialog" style="width:min(1100px,96vw);max-height:96vh"><div style="display:flex;justify-content:space-between"><h3>使用塗料 ${idx===null?"追加":"編集"}</h3><div style="display:flex;gap:8px;align-items:center"><button type="submit" form="paint-form" class="btn primary">保存</button><button id="paint-close" class="btn">閉じる</button></div></div><form id="paint-form">
      <label>場所・パーツ（どの部分に塗ったか／任意）</label><input name="area" placeholder="例：本体、頭部、右腕、コックピット" value="${esc(p.area||"")}">
      <label>下地（任意）</label><input name="basecoat" placeholder="例：サーフェイサー、黒下地など" value="${esc(p.basecoat||"")}">
      <label>メーカー</label><select name="maker">${Object.keys(paintTypes).map(m=>`<option ${p.maker===m?"selected":""}>${m}</option>`).join("")}</select>
      <label>種類（候補から選択／直接入力・任意）</label><input name="type" list="paint-type-options" placeholder="候補から選択、または直接入力" value="${esc(p.type||"")}"><datalist id="paint-type-options">${(paintTypes[p.maker]||[]).map(t=>`<option value="${esc(t)}"></option>`).join("")}</datalist>
      <div id="paint-code-wrap"><label>色番号（ファレホのみ・任意）</label><input name="code" value="${esc(p.code||"")}" placeholder="例：70.862"></div>
      <label>塗料名・色名（任意）</label><input name="name" placeholder="例：ジャーマングレー" value="${esc(p.name||"")}">
      <button class="btn primary">保存</button></form></div></div>`);
      const form=$("#paint-form"),maker=form.elements.maker;
      const updateCode=()=>{$("#paint-code-wrap").style.display=maker.value==="ファレホ"?"block":"none";form.querySelector("#paint-type-options").innerHTML=(paintTypes[maker.value]||[]).map(t=>`<option value="${esc(t)}"></option>`).join("")};
      maker.onchange=updateCode;updateCode();
      $("#paint-close").onclick=()=>detail(k);
      form.onsubmit=e=>{e.preventDefault();const o=Object.fromEntries(new FormData(form));if(o.maker!=="ファレホ")o.code="";if(idx===null)k.paints.push(o);else k.paints[idx]=o;schedule();detail(k)};
    };
    $("#paint").onclick=()=>openPaint();
    document.querySelectorAll("[data-paint-edit]").forEach(b=>b.onclick=()=>openPaint(+b.dataset.paintEdit));
    document.querySelectorAll("[data-paint-del]").forEach(b=>b.onclick=()=>{if(confirm("この塗料記録を削除しますか？")){k.paints.splice(+b.dataset.paintDel,1);schedule();detail(k)}});
    const openDiary=async idx=>{
      const d=idx===undefined?{date:new Date().toISOString().slice(0,10),text:"",photos:[]}:{...k.diary[idx],photos:[...(k.diary[idx].photos||[])]};
      $("#modal").insertAdjacentHTML("beforeend",`<div class="modal" style="z-index:2;padding:2vh 2vw"><div class="dialog" style="width:min(1100px,96vw);max-height:96vh"><div style="display:flex;justify-content:space-between"><h3>作業日記 ${idx===undefined?"追加":"編集"}</h3><div style="display:flex;gap:8px;align-items:center"><button type="submit" form="diary-form" class="btn primary">保存</button><button id="diary-close" class="btn">閉じる</button></div></div><form id="diary-form"><label>作業日</label><input type="date" name="date" required value="${esc(d.date||"")}"><label>作業内容</label><textarea name="text" rows="7" required placeholder="作業内容、気づいたこと、反省点など">${esc(d.text||"")}</textarea><label>日記に添付する写真（JPEG / PNG・自動圧縮）</label><input type="file" id="diary-photos" accept="image/jpeg,image/png" multiple><div id="diary-photo-preview" class="photoGrid"></div><button class="btn primary">保存</button></form></div></div>`);
      const form=$("#diary-form"),preview=$("#diary-photo-preview");
      const draw=()=>preview.innerHTML=d.photos.map((item,i)=>{const src=typeof item==="string"?item:(item.marked||item.original);return `<div class="diary-photo-card"><img class="photo" data-diary-preview="${i}" src="${src}" title="クリックで閲覧、ダブルクリックで注釈編集"><button type="button" class="btn" data-annotate-diary-photo="${i}">写真に注釈を付ける</button><button type="button" class="btn" data-remove-diary-photo="${i}">写真を削除</button></div>`}).join("");
      draw();$("#diary-close").onclick=()=>detail(k);
      $("#diary-photos").onchange=async e=>{for(const f of e.target.files){if(!/^image\/(jpeg|png)$/.test(f.type))continue;d.photos.push(await compressImage(f))}draw();bindPreviewPhotos();e.target.value=""};
      const annotateDiaryPhoto=i=>{const item=d.photos[i],original=typeof item==="string"?item:item.original,current=typeof item==="string"?item:(item.marked||item.original);openAnnotation(current,marked=>{d.photos[i]={original,marked};draw();bindPreviewPhotos()})};
      const bindPreviewPhotos=()=>preview.querySelectorAll("[data-diary-preview]").forEach(img=>{const i=+img.dataset.diaryPreview,item=d.photos[i],src=typeof item==="string"?item:(item.marked||item.original);bindPhotoInteractions(img,src,()=>annotateDiaryPhoto(i))});bindPreviewPhotos();
      preview.onclick=e=>{const a=e.target.closest("[data-annotate-diary-photo]");if(a){annotateDiaryPhoto(+a.dataset.annotateDiaryPhoto);return}const b=e.target.closest("[data-remove-diary-photo]");if(b){if(confirm("この日記写真を削除しますか？")){d.photos.splice(+b.dataset.removeDiaryPhoto,1);draw();bindPreviewPhotos()}}};

      form.onsubmit=e=>{e.preventDefault();const o=Object.fromEntries(new FormData(form));const saved={date:o.date,text:o.text,photos:d.photos};if(idx===undefined)k.diary.push(saved);else k.diary[idx]=saved;k.diary.sort((a,b)=>a.date.localeCompare(b.date));schedule();detail(k)};
    };
    $("#diary").onclick=()=>openDiary();
    document.querySelectorAll("[data-diary-edit]").forEach(b=>b.onclick=()=>openDiary(+b.dataset.diaryEdit));
    document.querySelectorAll("[data-diary-del]").forEach(b=>b.onclick=()=>{if(confirm("この日記を削除しますか？")){k.diary.splice(+b.dataset.diaryDel,1);schedule();detail(k)}});
    $("#photos").onchange=async e=>{for(const f of e.target.files){if(!/^image\/(jpeg|png)$/.test(f.type))continue;const original=await compressImage(f);k.photos.push({original,marked:null,note:f.name})}schedule();detail(k)};
  }
  document.querySelectorAll("[data-photo-del]").forEach(b=>b.onclick=()=>{const i=+b.dataset.photoDel;if(confirm("この写真を削除しますか？\nこの操作は取り消せません。")){k.photos.splice(i,1);schedule();detail(k)}});
  document.querySelectorAll("[data-diary-photo]").forEach(img=>{const [di,pi]=img.dataset.diaryPhoto.split("-").map(Number),item=k.diary[di].photos[pi],src=typeof item==="string"?item:(item.marked||item.original);bindPhotoInteractions(img,src,ro()?null:()=>{const original=typeof item==="string"?item:item.original;openAnnotation(src,marked=>{k.diary[di].photos[pi]={original,marked};schedule();detail(k)})})});
  document.querySelectorAll("[data-kit-photo]").forEach(img=>{const i=+img.dataset.kitPhoto,p=k.photos[i],src=p.marked||p.original;bindPhotoInteractions(img,src,ro()?null:()=>openAnnotation(src,marked=>{p.marked=marked;schedule();detail(k)}))});
  function openAnnotation(src,onSave){
    // 編集枠は拡大前の標準サイズに戻す。テキスト入力はキャンバス上に重ねて行う。
    const layer=document.createElement("div");layer.className="modal";layer.style.zIndex="3";
    layer.innerHTML=`<div class="dialog"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>写真の注釈編集</h3><div style="display:flex;gap:8px;align-items:center"><button type="button" class="btn primary" id="anno-save-top">注釈版を保存</button><button id="anno-close" class="btn">閉じる</button></div></div><p class="muted">丸・矢印・フリーハンド・テキストを追加できます。注釈（テキスト以外も含む）はドラッグで移動できます。「消去」を選んで注釈をクリックすると、その注釈だけ消せます。元写真は変更されません。</p><div class="row"><label>描画色<select id="anno-color" style="width:auto;min-width:100px"><option value="#e53935">赤</option><option value="#f5c400">黄</option><option value="#1976d2">青</option><option value="#2e9d50">緑</option></select></label><button type="button" class="btn" data-tool="circle">丸</button><button type="button" class="btn" data-tool="arrow">矢印</button><button type="button" class="btn" data-tool="free">フリーハンド</button><button type="button" class="btn" data-tool="text">テキスト</button><button type="button" class="btn" data-tool="erase">消去</button><button type="button" class="btn" id="anno-undo">1つ戻す</button><button type="button" class="btn" id="anno-reset">注釈をクリア</button></div><div id="anno-stage" style="position:relative;width:100%;line-height:0"><canvas id="anno-canvas" style="width:100%;height:auto;display:block;touch-action:none;border:1px solid #ccd"></canvas><textarea id="anno-text-input" aria-label="注釈テキスト" style="display:none;position:absolute;z-index:2;resize:none;overflow:hidden;box-sizing:border-box;background:white;color:#111;border:2px solid #e53935;border-radius:2px;padding:6px;font:16px/1.35 sans-serif;outline:none;white-space:pre-wrap;overflow-wrap:anywhere"></textarea></div><p class="muted">テキストは入力中にEnterで改行できます。入力枠の外をダブルクリックすると確定します。確定後は枠をドラッグして移動できます。</p><button type="button" class="btn primary" id="anno-save">注釈版を保存</button></div>`;
    $("#modal").appendChild(layer);
    const canvas=layer.querySelector("#anno-canvas"),ctx=canvas.getContext("2d"),img=new Image(),stage=layer.querySelector("#anno-stage"),input=layer.querySelector("#anno-text-input");
    let tool="circle",color="#e53935",start=null,drawing=false,base=null,marks=[],activeText=null,dragText=null,dragOffset=null,dragMark=null,lastDragPoint=null,currentMark=null;
    img.onload=()=>{const scale=Math.min(1,1100/img.width);canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);base=document.createElement("canvas");base.width=canvas.width;base.height=canvas.height;base.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);redraw()};img.src=src;
    const viewScale=()=>canvas.getBoundingClientRect().width/canvas.width;
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}};
    function textLayout(m){ctx.save();ctx.font=`${m.fontSize||22}px sans-serif`;const maxW=m.w||Math.min(300,canvas.width*.38),pad=9,lines=[];String(m.text||"").split("\n").forEach(par=>{if(!par){lines.push("");return}let line="";for(const ch of par){if(line&&ctx.measureText(line+ch).width>maxW-pad*2){lines.push(line);line=ch}else line+=ch}lines.push(line)});ctx.restore();return{lines,w:maxW,h:Math.max(44,lines.length*(m.fontSize||22)*1.35+pad*2)}}
    function drawMark(m){ctx.save();ctx.strokeStyle=m.color||"#e53935";ctx.fillStyle=m.color||"#e53935";ctx.lineWidth=Math.max(3,canvas.width/260);ctx.lineCap="round";ctx.lineJoin="round";
      if(m.tool==="circle"){const x=(m.x1+m.x2)/2,y=(m.y1+m.y2)/2,rx=Math.abs(m.x2-m.x1)/2,ry=Math.abs(m.y2-m.y1)/2;ctx.beginPath();ctx.ellipse(x,y,Math.max(rx,5),Math.max(ry,5),0,0,Math.PI*2);ctx.stroke()}
      else if(m.tool==="arrow"){const a=Math.atan2(m.y2-m.y1,m.x2-m.x1),head=canvas.width/35;ctx.beginPath();ctx.moveTo(m.x1,m.y1);ctx.lineTo(m.x2,m.y2);ctx.stroke();ctx.beginPath();ctx.moveTo(m.x2,m.y2);ctx.lineTo(m.x2-head*Math.cos(a-.45),m.y2-head*Math.sin(a-.45));ctx.lineTo(m.x2-head*Math.cos(a+.45),m.y2-head*Math.sin(a+.45));ctx.closePath();ctx.fill()}
      else if(m.tool==="free"){ctx.beginPath();m.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()}
      else if(m.tool==="text"){const z=textLayout(m);m.h=z.h;ctx.fillStyle="#fff";ctx.fillRect(m.x,m.y,z.w,z.h);ctx.strokeStyle=m.color||color;ctx.lineWidth=Math.max(2,canvas.width/500);ctx.strokeRect(m.x,m.y,z.w,z.h);ctx.fillStyle="#111";ctx.font=`${m.fontSize||22}px sans-serif`;ctx.textBaseline="top";z.lines.forEach((line,i)=>ctx.fillText(line,m.x+9,m.y+9+i*(m.fontSize||22)*1.35));}
      ctx.restore()}
    const redraw=()=>{if(!base)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);marks.forEach(m=>drawMark(m))};
    function closeInput(commit=true){if(!activeText)return;if(commit){activeText.text=input.value;activeText=null;input.style.display="none";redraw()}else{const ix=marks.indexOf(activeText);if(ix>=0)marks.splice(ix,1);activeText=null;input.style.display="none";redraw()}}
    function showInput(m){activeText=m;const z=viewScale();input.style.display="block";input.style.left=(m.x*z)+"px";input.style.top=(m.y*z)+"px";input.style.width=(m.w*z)+"px";input.style.height=(Math.max(44,m.h||55)*z)+"px";input.style.borderColor=m.color||color;input.value=m.text||"";input.focus();}
    input.addEventListener("input",()=>{if(!activeText)return;activeText.text=input.value;const z=textLayout(activeText);activeText.h=z.h;input.style.height=(z.h*viewScale())+"px";});
    function hitText(p){for(let i=marks.length-1;i>=0;i--){const m=marks[i];if(m.tool==="text"){const z=textLayout(m);if(p.x>=m.x&&p.x<=m.x+z.w&&p.y>=m.y&&p.y<=m.y+z.h)return m}}return null}
    const segDist=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)};
    function hitMark(p,m){const tol=Math.max(12,canvas.width/90);if(m.tool==="text"){const z=textLayout(m);return p.x>=m.x-tol&&p.x<=m.x+z.w+tol&&p.y>=m.y-tol&&p.y<=m.y+z.h+tol}if(m.tool==="circle"){const cx=(m.x1+m.x2)/2,cy=(m.y1+m.y2)/2,rx=Math.max(Math.abs(m.x2-m.x1)/2,5),ry=Math.max(Math.abs(m.y2-m.y1)/2,5),v=Math.sqrt(((p.x-cx)/rx)**2+((p.y-cy)/ry)**2);return Math.abs(v-1)*Math.min(rx,ry)<=tol}if(m.tool==="arrow")return segDist(p,{x:m.x1,y:m.y1},{x:m.x2,y:m.y2})<=tol||Math.hypot(p.x-m.x2,p.y-m.y2)<=tol*2;if(m.tool==="free"){for(let i=1;i<m.points.length;i++)if(segDist(p,m.points[i-1],m.points[i])<=tol)return true;return m.points.length===1&&Math.hypot(p.x-m.points[0].x,p.y-m.points[0].y)<=tol}return false}
    function eraseAt(p){for(let i=marks.length-1;i>=0;i--){if(hitMark(p,marks[i])){marks.splice(i,1);redraw();return true}}return false}
    function findMovableMark(p){for(let i=marks.length-1;i>=0;i--){const m=marks[i];if(m.tool!=="text"&&hitMark(p,m))return m}return null}
    function moveMark(m,dx,dy){if(m.tool==="free"){m.points.forEach(p=>{p.x+=dx;p.y+=dy})}else{m.x1+=dx;m.y1+=dy;m.x2+=dx;m.y2+=dy}}
    layer.querySelectorAll("[data-tool]").forEach(x=>x.onclick=()=>{if(activeText)closeInput(true);tool=x.dataset.tool});
    layer.querySelector("#anno-color").onchange=e=>{color=e.target.value};
    canvas.onpointerdown=e=>{if(!base||activeText)return;e.preventDefault();const p=pos(e);canvas.setPointerCapture(e.pointerId);if(tool==="erase"){eraseAt(p);return}if(tool==="text"){const found=hitText(p);if(found){dragText=found;dragOffset={x:p.x-found.x,y:p.y-found.y};drawing=true;return}const m={tool:"text",color,x:p.x,y:p.y,w:Math.min(300,canvas.width*.38),h:55,fontSize:Math.max(16,canvas.width/55),text:""};marks.push(m);redraw();showInput(m);return}const foundMark=findMovableMark(p);if(foundMark){dragMark=foundMark;lastDragPoint=p;drawing=true;return}start=p;currentMark=null;drawing=true};
    canvas.onpointermove=e=>{if(!drawing)return;const p=pos(e);if(dragMark){moveMark(dragMark,p.x-lastDragPoint.x,p.y-lastDragPoint.y);lastDragPoint=p;redraw();return}if(dragText){dragText.x=Math.max(0,Math.min(canvas.width-textLayout(dragText).w,p.x-dragOffset.x));dragText.y=Math.max(0,Math.min(canvas.height-35,p.y-dragOffset.y));redraw();return}if(!currentMark){if(Math.hypot(p.x-start.x,p.y-start.y)<4)return;currentMark=tool==="free"?{tool,color,points:[start,p]}:{tool,color,x1:start.x,y1:start.y,x2:p.x,y2:p.y};marks.push(currentMark)}else if(tool==="free")currentMark.points.push(p);else{currentMark.x2=p.x;currentMark.y2=p.y}redraw()};
    canvas.onpointerup=()=>{drawing=false;dragText=null;dragMark=null;lastDragPoint=null;currentMark=null};canvas.onpointercancel=()=>{drawing=false;dragText=null;dragMark=null;lastDragPoint=null;currentMark=null};
    canvas.ondblclick=e=>{if(activeText){e.preventDefault();closeInput(true);return}const p=pos(e),m=hitText(p);if(m){showInput(m);e.preventDefault()}};
    layer.querySelector("#anno-undo").onclick=()=>{if(activeText)closeInput(false);else marks.pop();redraw()};
    layer.querySelector("#anno-reset").onclick=()=>{if(confirm("描いた注釈をすべて消しますか？")){activeText=null;input.style.display="none";marks=[];redraw()}};
    layer.querySelector("#anno-close").onclick=()=>{if(activeText)closeInput(true);layer.remove()};
    const saveAnnotation=()=>{if(!base)return;if(activeText)closeInput(true);const out=document.createElement("canvas");out.width=canvas.width;out.height=canvas.height;out.getContext("2d").drawImage(canvas,0,0);onSave(out.toDataURL("image/png"));layer.remove()};layer.querySelector("#anno-save").onclick=saveAnnotation;layer.querySelector("#anno-save-top").onclick=saveAnnotation;
    // 入力枠の外側ダブルクリックで確定。入力枠内のEnterは通常どおり改行。
    layer.addEventListener("dblclick",e=>{if(activeText&&e.target!==input&&e.target!==canvas)closeInput(true)});
  }
  document.querySelectorAll("[data-original]").forEach(b=>b.onclick=()=>{let w=window.open();if(w)w.document.write(`<img src="${k.photos[+b.dataset.original].original}" style="max-width:100%">`)});
}

$("#connect").onclick=connect;$("#chooseFolder").onclick=chooseFolder;$("#add").onclick=()=>openForm();document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});document.addEventListener("click",e=>{const y=e.target.closest("[data-year]");if(y){selectedYear=Number(y.dataset.year);render()}});document.addEventListener("pointerdown",e=>{const m=e.target.closest?.(".modal");if(m)m.dataset.backdropStart=String(e.target===m)},{capture:true});document.addEventListener("click",e=>{if(e.target.classList?.contains("modal")){if(e.target.dataset.backdropStart!=="true")return;if(e.target.parentElement?.id==="modal")$("#modal").innerHTML="";else e.target.remove();return}let b=e.target.closest("[data-detail]");if(b){let k=db.kits.find(x=>x.id===b.dataset.detail);if(k)detail(k)}});$("#backup").onclick=()=>{let a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(db)],{type:"application/json"}));a.href=u;a.download="plamo-log-backup.json";a.click();URL.revokeObjectURL(u)};$("#restore").onchange=async e=>{try{let x=JSON.parse(await e.target.files[0].text());if(!Array.isArray(x.kits))throw 0;if(confirm("現在の記録を置き換えますか？")){db=x;schedule();render()}}catch{alert("JSONを読み込めません")}};if("serviceWorker"in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js");render();if(android){$("#startup").classList.add("hidden");$("#connect").textContent="OneDrive JSON読込";status("閲覧専用：JSON未読込")}else{ $("#startup").classList.remove("hidden"); $("#startCloud").onclick=startCloudMode; $("#startLocal").onclick=startLocalMode; restoreFolder(); }
