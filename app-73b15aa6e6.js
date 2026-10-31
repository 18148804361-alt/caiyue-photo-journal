const $=s=>document.querySelector(s);
const chapters=window.CHAPTERS;
const original=window.PHOTOS;const byId=new Map(original.map(p=>[p.id,p]));
const allPhotos=[];const pageRecords=[];const pageForPhoto=new Map();let sheets=[],activePage=0,currentPhoto=0,lastFocus=null,contactTheme='全部',touchX=null,observed=new Map();
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined&&text!==null)e.textContent=text;if(cls)e.className=cls;return e}
function imageButton(p){const b=el('button',null,'photo-slot');b.type='button';b.setAttribute('aria-label',`查看作品：${p.title}`);const img=el('img');img.src=p.thumb;img.srcset=`${p.thumb} 840w, ${p.src} 2200w`;img.sizes='(max-width:600px) 90vw, 80vw';img.width=p.width;img.height=p.height;img.alt=p.title;img.loading='lazy';img.decoding='async';b.append(img);b.onclick=()=>openPhoto(p.id);return b}
function folioPaper(photo,side,chapter,number){
 const paper=el('div',null,`folio-paper folio-${side}`);
 if(photo&&photo.width/photo.height<.9)paper.classList.add('has-portrait');
 if(photo){paper.append(imageButton(photo));const imprint=el('div',null,'folio-imprint');imprint.append(el('span',photo.title),el('span',String(number).padStart(3,'0')));paper.append(imprint)}
 else{const title=el('div',null,'folio-editorial');title.append(el('small','CAIYUE LUO / PHOTOGRAPHS'),el('h3',chapter.name),el('em',chapter.en),el('p',chapter.note));paper.append(title)}
 return paper;
}
function createFolio(chapter,batch,first=false){
 const scene=el('div',null,'folio-scene balanced-spread'),book=el('div',null,'folio-book');
 first=batch.length===1;
 book.append(el('div',null,'folio-board'),el('div',null,'folio-edge edge-left'),el('div',null,'folio-edge edge-right'));
 book.append(folioPaper(first?null:batch[0],'left',chapter,allPhotos.indexOf(batch[0])+1));
 book.append(folioPaper(first?batch[0]:batch[1]||null,'right',chapter,allPhotos.indexOf(first?batch[0]:batch[1])+1));
 book.append(el('div',null,'folio-gutter'));scene.append(book);return scene;
}
chapters.forEach((chapter,chapterIndex)=>{
 const ordered=chapter.spreads.flatMap(spread=>spread.photos.map(id=>byId.get(id)));chapter.photos=ordered;allPhotos.push(...ordered);
 chapter.spreads.forEach((spread,spreadIndex)=>{
  const first=spreadIndex===0,batch=spread.photos.map(id=>byId.get(id));
  const page=el('section',null,'sheet black photo-page physical-spread');page.dataset.surface='black';page.id=first?`chapter-${chapter.id}`:`${chapter.id}-${spreadIndex+1}`;page.setAttribute('aria-label',`${chapter.name}，书本跨页 ${spreadIndex+1}`);page.dataset.pairing=spread.match;
  const heading=el('h2',chapter.name,'page-heading');heading.append(el('em',chapter.en));page.append(heading);
  const stage=el('div',null,'spread-stage');stage.append(createFolio(chapter,batch));page.append(stage);
  const caption=el('div',null,'page-caption');caption.append(el('p',batch.map(p=>p.title).join(' / ')),el('p',`Photography. Caiyue Luo ~ ${String(chapterIndex+1).padStart(2,'0')}.${String(spreadIndex+1).padStart(2,'0')}`));page.append(caption);
  batch.forEach(p=>pageForPhoto.set(p.id,page.id));$('#photographic-pages').append(page);pageRecords.push({id:page.id,photos:batch.map(p=>p.id),theme:chapter.name});
 });
 const a=el('a');a.href=`#chapter-${chapter.id}`;a.append(el('span',String(chapterIndex+1).padStart(2,'0')),el('span',chapter.name),el('em',chapter.en),el('small',`${ordered.length} ↗`));a.onclick=()=>closeDialog($('#index-dialog'));$('#index-list').append(a);
});
// The physical book sits immediately after the white introduction.
const objectBook=createFolio(chapters[0],[byId.get('091')||chapters[0].photos[0]],true);objectBook.classList.add('object-folio');
const jacket=el('div',null,'binding-cover');
const jacketFront=el('div',null,'jacket-face jacket-front');jacketFront.append(el('small','A PERSONAL PHOTOGRAPHIC ARCHIVE'),el('strong','光停在这一页'),el('em','Where the Light Lingers'),el('span',`${original.length} images / ${chapters.length} chapters`));
const jacketBack=el('div',null,'jacket-face jacket-back');const jacketTitle=el('div',null,'folio-editorial');jacketTitle.append(el('small','CAIYUE LUO / PHOTOGRAPHS'),el('h3',chapters[0].name),el('em',chapters[0].en),el('p',chapters[0].note));jacketBack.append(jacketTitle);jacket.append(jacketFront,jacketBack);objectBook.querySelector('.folio-book').append(jacket);$('#object-stage').append(objectBook);
sheets=[...document.querySelectorAll('.sheet')];
function updateActive(index){activePage=index;document.body.dataset.surface=sheets[index].dataset.surface;$('#page-counter').textContent=`${String(index+1).padStart(2,'0')} / ${sheets.length}`;$('#previous-page').disabled=index===0;$('#next-page').disabled=index===sheets.length-1}
// Animate content inside each sheet, keeping its layout and observer geometry fixed.
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let pageAnimation=0,paintFrame=0,settleTimer=0,pointerDown=false,folioTurn=null,folioOverlay=null;
let openingAnimations=[],openingPlayed=false,openingRun=0;
const nearbySheets=new Set(),entrances=new WeakMap();
const easePage=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function stopPageAnimation(){cancelAnimationFrame(pageAnimation);pageAnimation=0;clearTimeout(settleTimer);if(folioTurn){folioTurn.cancel();folioTurn=null}folioOverlay?.remove();folioOverlay=null;document.body.classList.remove('is-paging','is-turning')}
function paintPageMotion(){
 paintFrame=0;if(reduced())return;
 const viewport=innerHeight;
 for(const page of nearbySheets){
  if(page.classList.contains('physical-spread')||page.id==='book-object'){page.style.setProperty('--page-scale','1');page.style.setProperty('--page-shift','0px');page.style.setProperty('--page-opacity','1');page.style.setProperty('--text-shift','0px');page.style.setProperty('--text-opacity','1');continue}
  const rect=page.getBoundingClientRect();
  const distance=Math.max(-1,Math.min(1,rect.top/viewport));
  const amount=Math.abs(distance),fade=Math.min(1,amount*1.3);
  page.style.setProperty('--page-scale',String(1-amount*.045));
  page.style.setProperty('--page-shift',`${-distance*viewport*.075}px`);
  page.style.setProperty('--page-opacity',String(1-fade*.45));
  page.style.setProperty('--text-shift',`${distance*22}px`);
  page.style.setProperty('--text-opacity',String(Math.max(0,1-amount*1.8)));
 }
}
function schedulePaint(){if(!paintFrame)paintFrame=requestAnimationFrame(paintPageMotion)}
function revealPage(index,direction=1){
 if(reduced())return;
 const page=sheets[index];
 for(const animation of entrances.get(page)||[])animation.cancel();
 const animations=[];
 // A quiet stagger at chapter jumps: image first, corner information second.
 const targets=[page.querySelector('.spread-stage')||page.querySelector('.intro-copy,.cover-bottom,.colophon-copy,.end-bottom'),...page.querySelectorAll('.page-heading,.chapter-number,.page-caption')].filter(Boolean);
 targets.forEach((target,i)=>{
  if(!target.animate)return;
  const animation=target.animate([{opacity:0,translate:`0 ${direction*(i===0?28:14)}px`},{opacity:1,translate:'0 0'}],{duration:i===0?720:520,delay:i===0?0:130+i*30,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'});
  animations.push(animation);
 });entrances.set(page,animations);
}
function goPage(index,{settling=false}={}){
 const clamped=Math.max(0,Math.min(sheets.length-1,index));
 const from=scrollY,to=sheets[clamped].getBoundingClientRect().top+scrollY;
 const distance=to-from,direction=distance>=0?1:-1;
 const source=sheets[activePage];
 stopPageAnimation();
 if(!settling&&!reduced()&&source.id==='book-object'&&sheets[clamped].classList.contains('physical-spread')){riffleToPage(source,sheets[clamped],clamped);return}
 if(!settling&&!reduced()&&source!==sheets[clamped]&&source.classList.contains('physical-spread')&&sheets[clamped].classList.contains('physical-spread')){turnPhysicalPage(source,sheets[clamped],clamped,direction);return}
 if(reduced()||Math.abs(distance)<2){window.scrollTo({top:to,behavior:'instant'});updateActive(clamped);schedulePaint();return}
 if(Math.abs(distance)>innerHeight*1.6){window.scrollTo({top:to,behavior:'instant'});updateActive(clamped);schedulePaint();revealPage(clamped,direction);return}
 const duration=settling?Math.min(460,Math.max(260,Math.abs(distance)*.7)):820;
 const start=performance.now();document.body.classList.add('is-paging');
 function frame(now){
  const progress=Math.min(1,(now-start)/duration);
  window.scrollTo({top:from+distance*easePage(progress),behavior:'instant'});paintPageMotion();
  if(progress<1)pageAnimation=requestAnimationFrame(frame);
  else{pageAnimation=0;document.body.classList.remove('is-paging');updateActive(clamped);schedulePaint()}
 }pageAnimation=requestAnimationFrame(frame);
}
function settlePage(){
 if(reduced()||folioTurn||pageAnimation||pointerDown||document.querySelector('dialog[open]')||window.getSelection()?.isCollapsed===false)return;
 let nearest=0,best=Infinity;
 sheets.forEach((page,i)=>{const d=Math.abs(page.getBoundingClientRect().top);if(d<best){nearest=i;best=d}});
 // Short windows retain free scrolling so no page content becomes inaccessible.
 if(sheets[nearest].offsetHeight>innerHeight+4||best<2)return;
 goPage(nearest,{settling:true});
}
window.addEventListener('scroll',()=>{schedulePaint();clearTimeout(settleTimer);if(!pageAnimation&&!folioTurn&&!reduced())settleTimer=setTimeout(settlePage,180)},{passive:true});
window.addEventListener('wheel',()=>{if(!folioTurn)stopPageAnimation()},{passive:true});
window.addEventListener('touchstart',stopPageAnimation,{passive:true});
window.addEventListener('pointerdown',()=>{pointerDown=true},{passive:true});
function releasePointer(){pointerDown=false;clearTimeout(settleTimer);if(!pageAnimation&&!folioTurn&&!reduced())settleTimer=setTimeout(settlePage,180)}
window.addEventListener('pointerup',releasePointer,{passive:true});
window.addEventListener('pointercancel',releasePointer,{passive:true});
window.addEventListener('blur',()=>{pointerDown=false;stopPageAnimation()});
window.addEventListener('resize',()=>{const index=activePage;stopPageAnimation();requestAnimationFrame(()=>{sheets[index].scrollIntoView({behavior:'instant',block:'start'});updateActive(index);schedulePaint()})},{passive:true});
motionPreference.addEventListener('change',()=>{stopPageAnimation();for(const a of openingAnimations)a.cancel();for(const page of sheets){for(const animation of entrances.get(page)||[])animation.cancel();page.removeAttribute('style')}schedulePaint()});
const proximityObserver=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)nearbySheets.add(e.target);else{nearbySheets.delete(e.target);e.target.removeAttribute('style')}}schedulePaint()},{rootMargin:'100% 0px',threshold:0});
const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.target.id==='book-object'&&e.intersectionRatio>.95&&!openingPlayed){openingPlayed=true;playOpening()}observed.set(e.target,e.intersectionRatio)}let best=0,index=activePage;for(const [target,ratio] of observed){if(ratio>best){best=ratio;index=sheets.indexOf(target)}}if(best>.4)updateActive(index)},{threshold:[0,.25,.5,.65,.8,.95,1]});sheets.forEach(s=>{observer.observe(s);proximityObserver.observe(s)});updateActive(0);
$('#previous-page').onclick=()=>goPage(activePage-1);$('#next-page').onclick=()=>goPage(activePage+1);
function openDialog(dialog){stopPageAnimation();lastFocus=document.activeElement;dialog.showModal();document.body.style.overflow='hidden'}
function closeDialog(dialog){dialog.close()}
for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',()=>{if(!document.querySelector('dialog[open]')){document.body.style.overflow='';lastFocus?.focus({preventScroll:true})}});
$('#open-index').onclick=()=>openDialog($('#index-dialog'));$('#close-index').onclick=()=>closeDialog($('#index-dialog'));document.querySelectorAll('[data-close-index]').forEach(a=>a.onclick=()=>closeDialog($('#index-dialog')));
function renderContact(){const list=contactTheme==='全部'?allPhotos:allPhotos.filter(p=>p.theme===contactTheme);$('#contact-filters').replaceChildren();['全部',...chapters.map(c=>c.name)].forEach(name=>{const b=el('button',`${name} (${name==='全部'?allPhotos.length:allPhotos.filter(p=>p.theme===name).length})`);b.type='button';b.setAttribute('aria-pressed',String(name===contactTheme));b.onclick=()=>{contactTheme=name;renderContact()};$('#contact-filters').append(b)});$('#contact-grid').replaceChildren();list.forEach(p=>{const b=el('button');b.type='button';b.setAttribute('aria-label',`查看作品：${p.title}`);const im=el('img');im.src=p.thumb;im.alt=p.title;im.width=p.width;im.height=p.height;im.loading='lazy';b.append(im,el('span',p.title));b.onclick=()=>openPhoto(p.id);$('#contact-grid').append(b)})}
$('#open-contact').onclick=()=>{closeDialog($('#index-dialog'));renderContact();openDialog($('#contact-dialog'))};$('#close-contact').onclick=()=>closeDialog($('#contact-dialog'));
function openPhoto(id){currentPhoto=allPhotos.findIndex(p=>p.id===id);showPhoto();openDialog($('#lightbox'))}
function showPhoto(){const p=allPhotos[currentPhoto];$('#large-photo').src=p.src;$('#large-photo').alt=p.title;$('#viewer-theme').textContent=`${p.theme} / ${chapters.find(c=>c.name===p.theme).en}`;$('#viewer-title').textContent=p.title;$('#viewer-file').textContent=`${p.filename}${p.date?' · '+p.date:''}`;$('#photo-counter').textContent=`${currentPhoto+1} / ${allPhotos.length}`;new Image().src=allPhotos[(currentPhoto+1)%allPhotos.length].src}
function stepPhoto(n){currentPhoto=(currentPhoto+n+allPhotos.length)%allPhotos.length;showPhoto()}
$('#close-viewer').onclick=()=>closeDialog($('#lightbox'));$('#prev-photo').onclick=()=>stepPhoto(-1);$('#next-photo').onclick=()=>stepPhoto(1);
document.addEventListener('keydown',e=>{if($('#lightbox').open){if(e.key==='ArrowLeft'){e.preventDefault();stepPhoto(-1)}if(e.key==='ArrowRight'){e.preventDefault();stepPhoto(1)}return}if(document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;if(['ArrowDown','ArrowRight','PageDown'].includes(e.key)){e.preventDefault();goPage(activePage+1)}if(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();goPage(activePage-1)}if(e.key==='Home'){e.preventDefault();goPage(0)}if(e.key==='End'){e.preventDefault();goPage(sheets.length-1)}});
$('#large-photo').addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX},{passive:true});$('#large-photo').addEventListener('touchend',e=>{if(touchX===null)return;const delta=e.changedTouches[0].clientX-touchX;if(Math.abs(delta)>60)stepPhoto(delta<0?1:-1);touchX=null},{passive:true});
function navigateHash(){const id=location.hash.slice(1);if(!id)return;const index=sheets.findIndex(s=>s.id===id);if(index>=0){stopPageAnimation();const direction=index>=activePage?1:-1;updateActive(index);sheets[index].scrollIntoView({behavior:'instant',block:'start'});schedulePaint();revealPage(index,direction)}}
window.addEventListener('hashchange',navigateHash);requestAnimationFrame(navigateHash);
window.addEventListener('pageshow',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow=''});


function clonePaper(paper){
 const clone=paper.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));clone.querySelectorAll('button').forEach(b=>{b.tabIndex=-1;b.disabled=true});return clone;
}
function riffleSamples(){
 const pages=[...document.querySelectorAll('.physical-spread')];
 return Array.from({length:18},(_,i)=>pages[Math.round(i*(pages.length-1)/17)]);
}
let riffleWarmed=false;
function warmRiffle(){
 if(riffleWarmed||reduced())return;riffleWarmed=true;
 for(const page of riffleSamples())for(const photo of page.querySelectorAll('.photo-slot img')){const image=new Image();image.src=photo.getAttribute('src')}
}
function riffleToPage(source,target,index){
 // A short visual journey through the entire collection, then a clean landing.
 openingRun++;openingAnimations.forEach(a=>a.cancel());openingAnimations=[];$('#replay-book').disabled=false;
 $('#opening-status').textContent='光停在这一页 · 摄影手记';
 const sourceBook=source.querySelector('.folio-book'),targetBook=target.querySelector('.folio-book');
 const oldLeft=clonePaper(sourceBook.querySelector('.folio-left')),oldRight=clonePaper(sourceBook.querySelector('.folio-right'));
 window.scrollTo({top:target.getBoundingClientRect().top+scrollY,behavior:'instant'});updateActive(index);paintPageMotion();
 const rect=targetBook.getBoundingClientRect(),overlay=el('div',null,'folio-transition riffle-transition');overlay.setAttribute('aria-hidden','true');
 const scene=el('div',null,'turning-scene');Object.assign(scene.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 const base=targetBook.cloneNode(true);base.classList.add('turning-base');base.querySelectorAll('button').forEach(b=>{b.disabled=true;b.tabIndex=-1});
 oldLeft.classList.add('stationary-paper');base.append(oldLeft);
 const books=riffleSamples().map(page=>page.querySelector('.folio-book'));
 const journey=[sourceBook,...books,targetBook],leaves=[];
 for(let i=0;i<journey.length-1;i++){
  const leaf=el('div',null,'turning-leaf turn-forward riffle-leaf'),front=el('div',null,'leaf-face leaf-front'),back=el('div',null,'leaf-face leaf-back');
  front.append(i===0?oldRight:clonePaper(journey[i].querySelector('.folio-right')));back.append(clonePaper(journey[i+1].querySelector('.folio-left')));leaf.append(front,back);
  leaf.style.zIndex=String(100-i);base.append(leaf);leaves.push(leaf);
 }
 // Use lightweight, eagerly decoded prints during the fast sequence.
 for(const img of base.querySelectorAll('img')){img.removeAttribute('srcset');img.removeAttribute('sizes');img.loading='eager'}
 scene.append(base);overlay.append(scene);document.body.append(overlay);folioOverlay=overlay;document.body.classList.add('is-turning','is-riffling');
 const animations=leaves.map((leaf,i)=>{
  const last=i===leaves.length-1,delay=i*76+(last?140:0),duration=last?740:430;
  return leaf.animate([
   {transform:'rotateY(0deg)',zIndex:100-i,offset:0},
   {transform:'rotateY(-82deg) rotateZ(.8deg)',zIndex:100-i,offset:.46},
   {transform:'rotateY(-96deg) rotateZ(.8deg)',zIndex:10+i,offset:.54},
   {transform:'rotateY(-180deg)',zIndex:10+i,offset:1}
  ],{delay,duration,easing:last?'cubic-bezier(.2,.55,.18,1)':'cubic-bezier(.35,.05,.4,1)',fill:'both'});
 });
 const run={cancel(){animations.forEach(a=>a.cancel());document.body.classList.remove('is-riffling')}};folioTurn=run;
 Promise.all(animations.map(a=>a.finished)).then(()=>{if(folioTurn!==run)return;folioTurn=null;overlay.remove();folioOverlay=null;document.body.classList.remove('is-turning','is-riffling');schedulePaint()}).catch(()=>{});
}
function turnPhysicalPage(source,target,index,direction){
 const sourceBook=source.querySelector('.folio-book'),targetBook=target.querySelector('.folio-book');
 const oldLeft=clonePaper(sourceBook.querySelector('.folio-left')),oldRight=clonePaper(sourceBook.querySelector('.folio-right'));
 const targetTop=target.getBoundingClientRect().top+scrollY;window.scrollTo({top:targetTop,behavior:'instant'});updateActive(index);paintPageMotion();
 const rect=targetBook.getBoundingClientRect();const overlay=el('div',null,'folio-transition');overlay.setAttribute('aria-hidden','true');
 const scene=el('div',null,'turning-scene');Object.assign(scene.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
 const base=targetBook.cloneNode(true);base.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));base.querySelectorAll('button').forEach(b=>{b.disabled=true;b.tabIndex=-1});base.classList.add('turning-base');
 const fixed=direction>0?oldLeft:oldRight;fixed.classList.add('stationary-paper');base.append(fixed);
 const leaf=el('div',null,`turning-leaf ${direction>0?'turn-forward':'turn-backward'}`);
 const front=el('div',null,'leaf-face leaf-front'),back=el('div',null,'leaf-face leaf-back');
 front.append(direction>0?oldRight:oldLeft);back.append(clonePaper(targetBook.querySelector(direction>0?'.folio-left':'.folio-right')));leaf.append(front,back);base.append(leaf);scene.append(base);overlay.append(scene);document.body.append(overlay);folioOverlay=overlay;
 document.body.classList.add('is-turning');
 const angle=direction>0?-180:180;
 const animation=leaf.animate([{transform:'rotateY(0deg)'},{transform:`rotateY(${angle}deg)`}],{duration:1100,easing:'cubic-bezier(.35,.05,.2,1)',fill:'forwards'});folioTurn=animation;
 animation.finished.then(()=>{if(folioTurn===animation){folioTurn=null;overlay.remove();folioOverlay=null;document.body.classList.remove('is-turning');schedulePaint()}}).catch(()=>{});
}
function playOpening(){
 const run=++openingRun;openingAnimations.forEach(a=>a.cancel());openingAnimations=[];
 const book=$('#object-stage .folio-book'),cover=$('#object-stage .binding-cover'),left=$('#object-stage .folio-left');
 if(reduced())return;
 const timing={duration:4400,easing:'linear',fill:'none'};
 openingAnimations.push(cover.animate([
  {transform:'rotateY(-180deg)',offset:0},{transform:'rotateY(0deg)',offset:.3},{transform:'rotateY(0deg)',offset:.47},{transform:'rotateY(-180deg)',offset:1}
 ],timing));
 openingAnimations.push(book.animate([
  {transform:'translateX(0) rotateX(0deg) rotateZ(0deg)',offset:0},
  {transform:'translateX(-24%) rotateX(42deg) rotateZ(-9deg)',offset:.3},
  {transform:'translateX(-24%) rotateX(42deg) rotateZ(-9deg)',offset:.47},
  {transform:'translateX(0) rotateX(0deg) rotateZ(0deg)',offset:1}
 ],timing));
 openingAnimations.push(left.animate([{opacity:1,offset:0},{opacity:0,offset:.24},{opacity:0,offset:.52},{opacity:1,offset:.82},{opacity:1,offset:1}],timing));
 const board=book.querySelector('.folio-board');
 openingAnimations.push(board.animate([{clipPath:'inset(0 0 0 0)',offset:0},{clipPath:'inset(0 0 0 50%)',offset:.3},{clipPath:'inset(0 0 0 50%)',offset:.47},{clipPath:'inset(0 0 0 0)',offset:.88},{clipPath:'inset(0 0 0 0)',offset:1}],timing));
 for(const layer of book.querySelectorAll('.edge-left,.folio-gutter'))openingAnimations.push(layer.animate([{opacity:1,offset:0},{opacity:0,offset:.24},{opacity:0,offset:.52},{opacity:1,offset:.88},{opacity:1,offset:1}],timing));
 $('#opening-status').textContent='合上 · 停留 · 再翻开';$('#replay-book').disabled=true;
 openingAnimations[0].finished.then(()=>{if(run===openingRun){$('#opening-status').textContent='光停在这一页 · 摄影手记';$('#replay-book').disabled=false}}).catch(()=>{if(run===openingRun)$('#replay-book').disabled=false});
}
$('#replay-book').onclick=()=>{stopPageAnimation();const index=sheets.findIndex(p=>p.id==='book-object');sheets[index].scrollIntoView({behavior:'instant',block:'start'});updateActive(index);playOpening()};
// Keep the camera still while the reader turns a paper leaf on desktop.
let wheelTravel=0,wheelQuiet=0,gestureBusy=false;
window.addEventListener('wheel',e=>{
 if(e.ctrlKey||document.querySelector('dialog[open]')||!(sheets[activePage]?.classList.contains('physical-spread')||sheets[activePage]?.id==='book-object')||Math.abs(sheets[activePage].getBoundingClientRect().top)>4||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
 const next=activePage+(e.deltaY>0?1:-1);if(!sheets[next]?.classList.contains('physical-spread'))return;
 e.preventDefault();clearTimeout(wheelQuiet);wheelQuiet=setTimeout(()=>{wheelTravel=0;gestureBusy=false},240);
 if(gestureBusy||folioTurn)return;wheelTravel+=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?innerHeight:1);
 if(Math.abs(wheelTravel)>45){gestureBusy=true;goPage(next);wheelTravel=0}
},{passive:false});
let folioTouch=null;
for(const page of document.querySelectorAll('.physical-spread,#book-object')){
 page.addEventListener('touchstart',e=>{if(e.touches.length!==1){folioTouch=null;return}folioTouch={x:e.touches[0].clientX,y:e.touches[0].clientY,locked:false}},{passive:true});
 page.addEventListener('touchmove',e=>{
  if(!folioTouch||e.touches.length!==1||page.offsetHeight>innerHeight+4)return;
  const dy=e.touches[0].clientY-folioTouch.y,dx=e.touches[0].clientX-folioTouch.x;
  if(Math.abs(dy)<8||Math.abs(dx)>Math.abs(dy)||Math.abs(page.getBoundingClientRect().top)>4)return;
  if(sheets[activePage+(dy<0?1:-1)]?.classList.contains('physical-spread')){e.preventDefault();folioTouch.locked=true}
 },{passive:false});
 page.addEventListener('touchend',e=>{
  if(!folioTouch||document.querySelector('dialog[open]'))return;
  const dx=e.changedTouches[0].clientX-folioTouch.x,dy=e.changedTouches[0].clientY-folioTouch.y,locked=folioTouch.locked;folioTouch=null;
  if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.25){e.preventDefault();goPage(activePage+(dx<0?1:-1))}
  else if(locked&&Math.abs(dy)>50){e.preventDefault();goPage(activePage+(dy<0?1:-1))}
 },{passive:false});
 page.addEventListener('touchcancel',()=>{folioTouch=null},{passive:true});
}

// Return to the cover from chapter pages, the index, thumbnails, or the viewer.
document.querySelectorAll("[data-home]").forEach(link=>link.addEventListener("click",event=>{event.preventDefault();for(const dialog of document.querySelectorAll("dialog[open]"))closeDialog(dialog);goPage(0);history.replaceState(null,"", "#cover");document.querySelector(".book-tools [data-home]").focus({preventScroll:true})}));
$('#book-object .object-actions a').addEventListener('click',event=>{event.preventDefault();goPage(sheets.findIndex(page=>page.id==='chapter-north'))});
const rifflePreloader=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){warmRiffle();rifflePreloader.disconnect()}},{rootMargin:'100% 0px'});rifflePreloader.observe($('#book-object'));
