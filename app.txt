'use strict';
/* ROCKHARZ 2027 – Companion. Keine automatische Navigation zu Streamingseiten. */
const KEY='rockharz2027_favorites_v1';
const STATUSES=['must','maybe','skip','new'];
const $=id=>document.getElementById(id);
let ratings={},page='lineup',filter='all',view='grid',activeBand=null,previousFocus=null,returnFocusId=null,playRequest=0;
const photoCache=new Map();
const previewCache=new Map();
try{const saved=JSON.parse(localStorage.getItem(KEY)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))ratings=saved;}catch(e){console.warn('Speicher nicht lesbar',e)}
const status=id=>STATUSES.includes(ratings[id])?ratings[id]:'new';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const searchLink=(platform,query)=>platform==='youtube'?'https://www.youtube.com/results?search_query='+encodeURIComponent(query):platform==='spotify'?'https://open.spotify.com/search/'+encodeURIComponent(query):'https://music.amazon.de/search/'+encodeURIComponent(query);
function persist(){try{localStorage.setItem(KEY,JSON.stringify(ratings))}catch(e){alert('Speichern fehlgeschlagen. Bitte deine Auswahl exportieren.')}}
function setRating(id,value){if(!BANDS.some(b=>b.id===id)||!STATUSES.includes(value))return;ratings[id]=status(id)===value?'new':value;persist();render();if(activeBand?.id===id)renderModalRating()}
function ratingHTML(b){const s=status(b.id);return `<div class="rating-buttons"><button data-rate="must" data-id="${safe(b.id)}" class="${s==='must'?'active':''}" aria-label="${safe(b.name)}: Muss ich sehen" aria-pressed="${s==='must'}" title="Muss ich sehen">★</button><button data-rate="maybe" data-id="${safe(b.id)}" class="${s==='maybe'?'active':''}" aria-label="${safe(b.name)}: Vielleicht" aria-pressed="${s==='maybe'}" title="Vielleicht">◉</button><button data-rate="skip" data-id="${safe(b.id)}" class="${s==='skip'?'active':''}" aria-label="${safe(b.name)}: Eher nicht" aria-pressed="${s==='skip'}" title="Eher nicht">×</button></div>`}
function card(b){return `<article class="band-card" data-status="${status(b.id)}" data-card-id="${safe(b.id)}" tabindex="0" role="group" aria-label="${safe(b.name)}: Karte öffnen"><button class="band-art band-open" data-open="${safe(b.id)}" data-photo-id="${safe(b.id)}" aria-label="${safe(b.name)}: Hörproben öffnen"><div class="band-photo-shade"></div><div class="band-name">${safe(b.name)}</div><span class="card-play">▶ HÖRPROBEN</span></button><div class="band-body"><button class="band-title-open" data-open="${safe(b.id)}">${safe(b.name)}</button>${ratingHTML(b)}</div></article>`}
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
  if(song){const a=document.createElement('a');a.href=searchLink('spotify',activeBand.name+' '+song.title);a.target='_blank';a.rel='noopener noreferrer';a.textContent='♫ Song auf Spotify suchen ↗';box.append(a);const yt=document.createElement('a');yt.href=searchLink('youtube',activeBand.name+' '+song.title+' official audio');yt.target='_blank';yt.rel='noopener noreferrer';yt.textContent='▶ Auf YouTube suchen ↗';box.append(yt)}
  area.append(box);
}
function openBand(id){
  const band=BANDS.find(b=>b.id===id);if(!band)return;
  ++playRequest;previousFocus=document.activeElement;returnFocusId=previousFocus?.closest('[data-card-id]')?.dataset.cardId||null;activeBand=band;
  $('modal-title').textContent=band.name;$('modal-description').textContent=band.description;renderModalRating();
  const photoHolder=$('modal-band-photo');photoHolder.querySelectorAll('img').forEach(el=>el.remove());
  findBandPhoto(band).then(src=>{if(!src||activeBand!==band||!photoHolder.isConnected)return;const img=document.createElement('img');img.src=src;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();photoHolder.prepend(img);});
  const songs=band.songs.length?band.songs:[{title:'Musik entdecken'}];
  $('song-list').innerHTML=songs.map((song,i)=>`<button class="song" data-song="${i}" aria-pressed="false"><span class="number">${String(i+1).padStart(2,'0')}</span><span class="song-title">${safe(song.title)}</span><small>♫ Studio-Hörprobe</small></button>`).join('');
  $('stream-links').innerHTML=[['spotify','Spotify'],['youtube','YouTube'],['amazon','Amazon Music']].map(([platform,label])=>`<a href="${safe(searchLink(platform,band.name))}" target="_blank" rel="noopener noreferrer">${safe(label)} ↗</a>`).join('');
  showPlaceholder('Song auswählen: Wir suchen eine offizielle Studio-Hörprobe. Die Wiedergabe bleibt auf dieser Seite.');
  $('modal').classList.remove('hidden');$('modal').querySelector('.modal-panel').scrollTop=0;document.querySelector('.layout').inert=true;document.querySelector('.topnav').inert=true;document.querySelector('.hero').inert=true;document.body.classList.add('modal-open');$('modal').querySelector('.modal-close').focus();
}
// Find official studio recordings across catalog storefronts without mismatching artists.
const norm=s=>String(s||'').toLocaleLowerCase('de').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/ø/g,'o').replace(/ß/g,'ss').replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const compact=s=>norm(s).replace(/ /g,'');
function matchesSong(actual,wanted){
  if(compact(actual)===compact(wanted))return true;
  // Nur Versions- und Gastangaben entfernen, keine bedeutungstragenden Titelteile.
  const base=String(actual).replace(/\s*[([](?:feat\.?|featuring|(?:\d{4}\s+)?remaster(?:ed)?|radio edit|single edit|single version|album version|edit|original mix)[^\])]*[\])]/gi,'').replace(/\s*[-–]\s*(?:remaster(?:ed)?|radio edit|single version|album version)(?:\s+\d{4})?$/i,'');
  return compact(base)===compact(wanted);
}
function matchesArtist(actual,wanted){
  return compact(actual).replace(/^the/,'')===compact(wanted).replace(/^the/,'');
}
function validStudio(t,band,song){
  if(!t||!t.previewUrl||!/^https:\/\//.test(t.previewUrl))return false;
  if(!matchesArtist(t.artistName,band.name)||!matchesSong(t.trackName,song.title))return false;
  if(song.artistId&&Number(t.artistId)!==song.artistId)return false;
  return !/\b(live|concert|karaoke|tribute|cover version|instrumental version)\b/i.test((t.collectionName||'')+' '+(t.trackName||''));
}
async function fetchCatalog(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
  try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Musikkatalog nicht erreichbar');return await response.json()}
  finally{clearTimeout(timer)}
}
async function searchStore(band,song,country,artistOnly=false){
  const term=artistOnly?band.name:band.name+' '+song.title;
  const url='https://itunes.apple.com/search?'+new URLSearchParams({term,entity:'song',limit:artistOnly?'100':'75',country,media:'music'});
  const data=await fetchCatalog(url);
  return (data.results||[]).find(t=>validStudio(t,band,song))||null;
}
async function getStudioPreview(band,song){
  const key=band.id+'|'+song.title,cached=previewCache.get(key);
  if(cached&&Date.now()-cached.at<10*60*1000)return cached.track;
  // Verifizierte Katalog-IDs bevorzugen: kein gleichnamiger Interpret, keine erratenen URLs.
  if(song.trackId){
    try{
      const data=await fetchCatalog('https://itunes.apple.com/lookup?'+new URLSearchParams({id:String(song.trackId),country:'DE',entity:'song'}));
      const track=(data.results||[]).find(t=>validStudio(t,band,song));
      if(track){previewCache.set(key,{track,at:Date.now()});return track}
    }catch(e){console.warn('Direkte Hörprobe nicht erreichbar',e)}
  }
  for(const country of ['DE','US']){
    try{const track=await searchStore(band,song,country);if(track){previewCache.set(key,{track,at:Date.now()});return track}}
    catch(e){console.warn('Hörproben-Suche '+country+' fehlgeschlagen',e)}
  }
  // Fehler nicht dauerhaft speichern: der nächste Klick kann es erneut versuchen.
  return null;
}
function playSong(index){
  if(!activeBand)return;
  const band=activeBand,song=band.songs[index];if(!song)return;
  const request=++playRequest;
  document.querySelectorAll('.song').forEach((el,i)=>{el.classList.toggle('active',i===index);el.setAttribute('aria-pressed',String(i===index));el.setAttribute('aria-busy',String(i===index))});
  showPlaceholder('Studioaufnahme wird im Musikkatalog gesucht …',song);
  getStudioPreview(band,song).then(track=>{
    if(request!==playRequest||activeBand!==band)return;
    document.querySelectorAll('.song').forEach(el=>el.setAttribute('aria-busy','false'));
    if(!track){showPlaceholder('Für diesen Song ist aktuell keine passende Studio-Hörprobe verfügbar. Du kannst die offizielle Aufnahme auf YouTube suchen.',song);return}
    const area=$('video-area');area.replaceChildren();
    const wrap=document.createElement('div');wrap.className='studio-preview';
    if(track.artworkUrl100){const art=document.createElement('img');art.src=track.artworkUrl100.replace('100x100bb','600x600bb');art.alt='Albumcover';art.className='studio-cover';wrap.append(art);wrap.style.setProperty('--cover-url',`url("${art.src}")`)}
    const tag=document.createElement('div');tag.className='preview-kicker';tag.textContent='♫ STUDIO · OFFIZIELLE HÖRPROBE';wrap.append(tag);
    const h=document.createElement('h3');h.textContent=track.trackName;wrap.append(h);
    const album=document.createElement('p');album.textContent=track.artistName+' · '+(track.collectionName||'Studioaufnahme');wrap.append(album);
    const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=track.previewUrl;audio.setAttribute('aria-label','Hörprobe von '+track.trackName);audio.addEventListener('error',()=>{if(request===playRequest&&activeBand===band)showPlaceholder('Diese Hörprobe kann derzeit nicht abgespielt werden. Bitte nutze den Link zur offiziellen Aufnahme.',song)});wrap.append(audio);
    const info=document.createElement('small');info.textContent='Kurze Studio-Hörprobe · Quelle: Apple Music';wrap.append(info);
    const links=document.createElement('div');links.className='preview-links';
    const store=document.createElement('a');store.href=track.trackViewUrl||'https://music.apple.com/de/';store.target='_blank';store.rel='noopener noreferrer';store.textContent='Quelle / Album im Store ↗';links.append(store);
    const spotify=document.createElement('a');spotify.href=searchLink('spotify',band.name+' '+song.title);spotify.target='_blank';spotify.rel='noopener noreferrer';spotify.textContent='♫ Spotify ↗';links.append(spotify);const yt=document.createElement('a');yt.href=searchLink('youtube',band.name+' '+song.title+' official studio audio');yt.target='_blank';yt.rel='noopener noreferrer';yt.textContent='▶ Studiofassung auf YouTube finden ↗';links.append(yt);wrap.append(links);
    area.append(wrap);
  });
}
function closeModal(){++playRequest;$('modal').classList.add('hidden');document.querySelector('.layout').inert=false;document.querySelector('.topnav').inert=false;document.querySelector('.hero').inert=false;document.body.classList.remove('modal-open');$('video-area').replaceChildren();activeBand=null;if(previousFocus&&document.contains(previousFocus))previousFocus.focus();else if(returnFocusId)document.querySelector(`[data-card-id="${returnFocusId}"] [data-open]`)?.focus();previousFocus=null;returnFocusId=null}
function renderSchedule(){const entries=BANDS.filter(b=>b.day&&b.start).sort((a,b)=>(a.day+'T'+a.start).localeCompare(b.day+'T'+b.start));$('schedule').innerHTML=entries.length?'<p class="schedule-notice">Unbestätigte Beispielzeiten – keine offizielle Running Order. Bitte nicht für deine Festivalplanung verwenden.</p>'+entries.map(b=>`<div class="schedule-row"><time>${safe(b.day)} ${safe(b.start)}</time><strong>${safe(b.name)}</strong><span>${safe(b.stage||'Bühne offen')}</span><span>${status(b.id)==='must'?'★':status(b.id)==='maybe'?'◉':''}</span></div>`).join(''):'<div class="empty">☠ RUNNING ORDER NOCH NICHT VERFÜGBAR<p>Sobald offizielle Spielzeiten veröffentlicht sind, können wir sie ergänzen. Deine Favoriten bleiben gespeichert.</p></div>'}
document.addEventListener('click',e=>{const rate=e.target.closest('[data-rate]');if(rate){setRating(rate.dataset.id,rate.dataset.rate);return}const open=e.target.closest('[data-open]');if(open){openBand(open.dataset.open);return}const wholeCard=e.target.closest('[data-card-id]');if(wholeCard){openBand(wholeCard.dataset.cardId);return}const song=e.target.closest('[data-song]');if(song){playSong(Number(song.dataset.song));return}if(e.target.closest('[data-close]')){closeModal();return}const nav=e.target.closest('[data-page]');if(nav){navigate(nav.dataset.page);return}const filt=e.target.closest('[data-filter]');if(filt){filter=filt.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el.dataset.filter===filter));navigate('lineup');render()}});
document.addEventListener('keydown',e=>{if(e.key==='Tab'&&!$('modal').classList.contains('hidden')){const nodes=[...$('modal').querySelectorAll('button,a[href],audio[controls]')].filter(el=>el.getClientRects().length);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-card-id]')){e.preventDefault();openBand(e.target.dataset.cardId);return}if(e.key==='Escape'&&!$('modal').classList.contains('hidden'))closeModal()});
$('search').addEventListener('input',render);$('sort').addEventListener('change',render);$('view-grid').onclick=()=>{view='grid';$('view-grid').classList.add('active');$('view-list').classList.remove('active');render()};$('view-list').onclick=()=>{view='list';$('view-list').classList.add('active');$('view-grid').classList.remove('active');render()};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(ratings,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rockharz-2027-meine-bands.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Ungültiges Format');const ids=new Set(BANDS.map(b=>b.id));for(const [id,s] of Object.entries(data))if(ids.has(id)&&STATUSES.includes(s))ratings[id]=s;persist();render();alert('Deine Bandauswahl wurde importiert.')}catch(error){console.warn(error);alert('Die Datei konnte nicht importiert werden.')}e.target.value=''};
render();
