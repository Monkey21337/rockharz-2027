'use strict';
/* ROCKHARZ 2027 – Companion. Keine automatische Navigation zu Streamingseiten. */
const KEY='rockharz2027_favorites_v1';
const LEGACY_KEY='rockharz2027_favorites_v1';
const STATUSES=['must','maybe','skip','new'];
const $=id=>document.getElementById(id);
let ratings={},page='lineup',filter='all',view='grid',activeBand=null,previousFocus=null,playRequest=0;
const photoCache=new Map();
const previewCache=new Map();
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))ratings=saved;}catch(e){console.warn('Speicher nicht lesbar',e)}
const status=id=>STATUSES.includes(ratings[id])?ratings[id]:'new';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const searchLink=(platform,query)=>platform==='youtube'?'https://www.youtube.com/results?search_query='+encodeURIComponent(query):platform==='spotify'?'https://open.spotify.com/search/'+encodeURIComponent(query):'https://music.amazon.de/search/'+encodeURIComponent(query);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(ratings))}catch(e){alert('Speichern fehlgeschlagen. Bitte deine Auswahl exportieren.')}}
function setRating(id,value){if(!BANDS.some(b=>b.id===id)||!STATUSES.includes(value))return;ratings[id]=status(id)===value?'new':value;persist();render();if(activeBand?.id===id)renderModalRating()}
function ratingHTML(b){const s=status(b.id);return `<div class="rating-buttons"><button data-rate="must" data-id="${safe(b.id)}" class="${s==='must'?'active':''}" aria-label="${safe(b.name)}: Muss ich sehen" aria-pressed="${s==='must'}" title="Muss ich sehen">★</button><button data-rate="maybe" data-id="${safe(b.id)}" class="${s==='maybe'?'active':''}" aria-label="${safe(b.name)}: Vielleicht" aria-pressed="${s==='maybe'}" title="Vielleicht">◉</button><button data-rate="skip" data-id="${safe(b.id)}" class="${s==='skip'?'active':''}" aria-label="${safe(b.name)}: Eher nicht" aria-pressed="${s==='skip'}" title="Eher nicht">×</button></div>`}
function card(b){const time=b.day&&b.start?`${b.day} · ${b.start}`:'Auftrittszeit noch offen';return `<article class="band-card" data-status="${status(b.id)}"><div class="band-art" data-photo-id="${safe(b.id)}"><div class="band-photo-shade"></div><div class="band-name">${safe(b.name)}</div></div><div class="band-body"><h3>${safe(b.name)}</h3><div class="band-meta">${safe(time)}</div><button class="listen" data-open="${safe(b.id)}">▶ BAND ENTDECKEN</button>${ratingHTML(b)}</div></article>`}
function sortBands(items){const dir=$('sort').value==='za'?-1:1;return [...items].sort((a,b)=>dir*a.name.localeCompare(b.name,'de'))}
function cards(target,items){target.className='band-grid'+(view==='list'?' list-view':'');target.innerHTML=items.length?items.map(card).join(''):'<div class="empty">Hier sind aktuell keine Bands. 🤘</div>';loadBandPhotos(target)}
function render(){const counts={all:BANDS.length,must:0,maybe:0,skip:0,new:0};BANDS.forEach(b=>counts[status(b.id)]++);for(const k of Object.keys(counts)){const el=$('c-'+k);if(el)el.textContent=counts[k]}$('s-total').textContent=counts.all;$('s-must').textContent=counts.must;$('s-new').textContent=counts.new;const rated=counts.all-counts.new,pct=counts.all?Math.round(rated/counts.all*100):0;$('progress-label').textContent=pct+'%';$('progress-fill').style.width=pct+'%';$('progress-detail').textContent=`${rated} von ${counts.all} bewertet`;$('lineup-subtitle').textContent=`${counts.all} Bands · ${counts.new} noch zu entdecken`;
const q=$('search').value.trim().toLocaleLowerCase('de');cards($('band-grid'),sortBands(BANDS.filter(b=>b.name.toLocaleLowerCase('de').includes(q)&&(filter==='all'||status(b.id)===filter))));cards($('mine-grid'),sortBands(BANDS.filter(b=>['must','maybe'].includes(status(b.id)))));cards($('discover-grid'),sortBands(BANDS.filter(b=>status(b.id)==='new')));renderSchedule()}
function navigate(next){page=next;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!=='page-'+next));document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===next));window.scrollTo({top:0,behavior:'smooth'})}
function renderModalRating(){if(activeBand)$('modal-rating').innerHTML=ratingHTML(activeBand)}
// Bandbilder: Wikipedia-Seitenbilder, direkt von Wikimedia; wenn keines verfügbar ist, bleibt die gestaltete Karte.
const WIKI_TITLES={"Accept":"Accept (band)","Alestorm":"Alestorm","All for Metal":"All for Metal","Amon Amarth":"Amon Amarth","Arch Enemy":"Arch Enemy","Bruce Dickinson":"Bruce Dickinson","Coppelius":"Coppelius","D'Artagnan":"dArtagnan (band)","Dust Bolt":"Dust Bolt","Eisbrecher":"Eisbrecher (band)","Emil Bulls":"Emil Bulls","Equilibrium":"Equilibrium (band)","Grave Digger":"Grave Digger (band)","Gutalax":"Gutalax","GWAR":"Gwar","Håndgemeng":"Håndgemeng","H-Blockx":"H-Blockx","Korpiklaani":"Korpiklaani","Lord of the Lost":"Lord of the Lost","Marduk":"Marduk (band)","Metal Church":"Metal Church","Nestor":"Nestor (band)","SKÁLD":"Skáld","Storm Seeker":"Storm Seeker","Tankard":"Tankard (band)","The Sisters of Mercy":"The Sisters of Mercy","Turbobier":"Turbobier"};
async function findBandPhoto(band){
  if(photoCache.has(band.id))return photoCache.get(band.id);
  const title=WIKI_TITLES[band.name];
  if(!title){photoCache.set(band.id,null);return null}
  try{
    const url='https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',titles:title,prop:'pageimages',pithumbsize:'640',format:'json',origin:'*',redirects:'1'});
    const response=await fetch(url,{mode:'cors'});
    if(!response.ok)throw Error('Bildabfrage fehlgeschlagen');
    const data=await response.json();
    const page=Object.values(data.query?.pages||{})[0];
    const image=page?.thumbnail?.source||null;
    photoCache.set(band.id,image);return image;
  }catch(e){photoCache.set(band.id,null);return null}
}
function loadBandPhotos(target){
  for(const art of target.querySelectorAll('[data-photo-id]')){
    const band=BANDS.find(b=>b.id===art.dataset.photoId);
    if(!band)continue;
    findBandPhoto(band).then(src=>{
      if(!src||!art.isConnected)return;
      const img=document.createElement('img');img.className='band-photo';img.src=src;img.alt='Presse- oder Konzertbild: '+band.name;img.loading='lazy';img.referrerPolicy='no-referrer';
      img.onerror=()=>img.remove();art.prepend(img);
    });
  }
}
function showPlaceholder(message,song=null){
  const area=$('video-area');area.replaceChildren();
  const box=document.createElement('div');box.className='video-placeholder';
  const icon=document.createElement('div');icon.className='music-icon';icon.textContent='♫';box.append(icon);
  if(song){const heading=document.createElement('h3');heading.textContent=song.title;box.append(heading)}
  const p=document.createElement('p');p.textContent=message;box.append(p);
  if(song){const a=document.createElement('a');a.href=searchLink('youtube',activeBand.name+' '+song.title+' official studio audio');a.target='_blank';a.rel='noopener noreferrer';a.textContent='Studiofassung auf YouTube suchen ↗';box.append(a)}
  area.append(box);
}
function openBand(id){
  const band=BANDS.find(b=>b.id===id);if(!band)return;
  ++playRequest;previousFocus=document.activeElement;activeBand=band;
  $('modal-title').textContent=band.name;$('modal-description').textContent=band.description;renderModalRating();
  const photoHolder=$('modal-band-photo');photoHolder.querySelectorAll('img').forEach(el=>el.remove());
  findBandPhoto(band).then(src=>{if(!src||activeBand!==band||!photoHolder.isConnected)return;const img=document.createElement('img');img.src=src;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();photoHolder.prepend(img);});
  const songs=band.songs.length?band.songs:[{title:'Musik entdecken'}];
  $('song-list').innerHTML=songs.map((song,i)=>`<button class="song" data-song="${i}"><span class="number">0${i+1}</span><span class="song-title">${safe(song.title)}</span><small>♫ Studio-Hörprobe</small></button>`).join('');
  $('stream-links').innerHTML=[['spotify','Spotify'],['youtube','YouTube'],['amazon','Amazon Music']].map(([platform,label])=>`<a href="${safe(searchLink(platform,band.name))}" target="_blank" rel="noopener noreferrer">${safe(label)} ↗</a>`).join('');
  showPlaceholder('Song auswählen: Wir suchen eine offizielle Studio-Hörprobe. Die Wiedergabe bleibt auf dieser Seite.');
  $('modal').classList.remove('hidden');document.body.classList.add('modal-open');$('modal').querySelector('.modal-close').focus();
}
function normalizeSong(s){return String(s).toLocaleLowerCase('en').replace(/\([^)]*\)/g,'').replace(/[^a-z0-9äöüß]+/g,' ').trim()}
async function getStudioPreview(band,song){
  const key=band.name+'|'+song.title;
  if(previewCache.has(key))return previewCache.get(key);
  const query=band.name+' '+song.title;
  const url='https://itunes.apple.com/search?'+new URLSearchParams({term:query,entity:'song',limit:'35',country:'DE',media:'music'});
  try{
    const response=await fetch(url);
    if(!response.ok)throw Error('Musikkatalog nicht erreichbar');
    const data=await response.json();
    const bandName=normalizeSong(band.name),title=normalizeSong(song.title);
    const results=(data.results||[]).filter(t=>t.previewUrl&&normalizeSong(t.trackName)===title&&normalizeSong(t.artistName)===bandName);
    const studio=results.find(t=>!/(live|concert|karaoke|tribute|cover|instrumental)/i.test((t.collectionName||'')+' '+(t.trackName||'')))||null;
    previewCache.set(key,studio);return studio;
  }catch(e){console.warn('Hörprobe konnte nicht geladen werden',e);return null}
}
function playSong(index){
  if(!activeBand)return;
  const band=activeBand,song=band.songs[index];if(!song)return;
  const request=++playRequest;
  document.querySelectorAll('.song').forEach((el,i)=>el.classList.toggle('active',i===index));
  showPlaceholder('Studioaufnahme wird im Musikkatalog gesucht …',song);
  getStudioPreview(band,song).then(track=>{
    if(request!==playRequest||activeBand!==band)return;
    if(!track){showPlaceholder('Für diesen Titel wurde leider keine passende Studio-Hörprobe gefunden. Kein automatischer Wechsel zu YouTube.',song);return}
    const area=$('video-area');area.replaceChildren();
    const wrap=document.createElement('div');wrap.className='studio-preview';
    if(track.artworkUrl100){const art=document.createElement('img');art.src=track.artworkUrl100.replace('100x100bb','600x600bb');art.alt='Albumcover';art.className='studio-cover';wrap.append(art);wrap.style.setProperty('--cover-url',`url("${art.src}")`)}
    const tag=document.createElement('div');tag.className='preview-kicker';tag.textContent='♫ STUDIO · OFFIZIELLE HÖRPROBE';wrap.append(tag);
    const h=document.createElement('h3');h.textContent=track.trackName;wrap.append(h);
    const album=document.createElement('p');album.textContent=track.artistName+' · '+(track.collectionName||'Studioaufnahme');wrap.append(album);
    const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=track.previewUrl;audio.setAttribute('aria-label','Hörprobe von '+track.trackName);wrap.append(audio);
    const info=document.createElement('small');info.textContent='Studio-Hörprobe · ca. 30 Sekunden · Quelle: Apple Music';wrap.append(info);
    const links=document.createElement('div');links.className='preview-links';
    const store=document.createElement('a');store.href=track.trackViewUrl||'https://music.apple.com/de/';store.target='_blank';store.rel='noopener noreferrer';store.textContent='Quelle / Album im Store ↗';links.append(store);
    const yt=document.createElement('a');yt.href=searchLink('youtube',band.name+' '+song.title+' official studio audio');yt.target='_blank';yt.rel='noopener noreferrer';yt.textContent='▶ Studiofassung auf YouTube finden ↗';links.append(yt);wrap.append(links);
    area.append(wrap);
  });
}
function closeModal(){++playRequest;$('modal').classList.add('hidden');document.body.classList.remove('modal-open');$('video-area').replaceChildren();activeBand=null;if(previousFocus&&document.contains(previousFocus))previousFocus.focus();previousFocus=null}
function renderSchedule(){const entries=BANDS.filter(b=>b.day&&b.start).sort((a,b)=>(a.day+'T'+a.start).localeCompare(b.day+'T'+b.start));$('schedule').innerHTML=entries.length?entries.map(b=>`<div class="schedule-row"><time>${safe(b.day)} ${safe(b.start)}</time><strong>${safe(b.name)}</strong><span>${safe(b.stage||'Bühne offen')}</span><span>${status(b.id)==='must'?'★':status(b.id)==='maybe'?'◉':''}</span></div>`).join(''):'<div class="empty">☠ RUNNING ORDER NOCH NICHT VERFÜGBAR<p>Sobald offizielle Spielzeiten veröffentlicht sind, können wir sie ergänzen. Deine Favoriten bleiben gespeichert.</p></div>'}
document.addEventListener('click',e=>{const rate=e.target.closest('[data-rate]');if(rate){setRating(rate.dataset.id,rate.dataset.rate);return}const open=e.target.closest('[data-open]');if(open){openBand(open.dataset.open);return}const song=e.target.closest('[data-song]');if(song){playSong(Number(song.dataset.song));return}if(e.target.closest('[data-close]')){closeModal();return}const nav=e.target.closest('[data-page]');if(nav){navigate(nav.dataset.page);return}const filt=e.target.closest('[data-filter]');if(filt){filter=filt.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===filter));navigate('lineup');render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').classList.contains('hidden'))closeModal()});
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);$('view-grid').onclick=()=>{view='grid';$('view-grid').classList.add('active');$('view-list').classList.remove('active');render()};$('view-list').onclick=()=>{view='list';$('view-list').classList.add('active');$('view-grid').classList.remove('active');render()};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(ratings,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rockharz-2027-meine-bands.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültiges Format');const ids=new Set(BANDS.map(b=>b.id));for(const [id,s] of Object.entries(data))if(ids.has(id)&&STATUSES.includes(s))ratings[id]=s;persist();render();alert('Deine Bandauswahl wurde importiert.')}catch(error){console.warn(error);alert('Die Datei konnte nicht importiert werden.')}e.target.value=''};
render();
