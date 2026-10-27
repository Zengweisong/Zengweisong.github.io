import { icon, escapeHtml as esc, hydrateIcons } from './icons.mjs';
import { modeLabels, secondsText, dateText, normalizeBook, normalizeShelf, normalizeStats, categoryDistribution, buildReadingMonth, buildReadingYear } from './reading-model.mjs';

const titles={overview:'阅读总览',library:'我的书架',notes:'读书笔记'};
const main=document.querySelector('#main-content'),dialog=document.querySelector('dialog');
let view=titles[location.hash.slice(1)]?location.hash.slice(1):'overview';
let mode='monthly',live=true,busy=false,loadError='';
let snapshot={dashboards:{},calendars:{}},posts=[],dashboard={stats:{},shelf:{books:[]},errors:{}};
let search='',libraryFilter='all',librarySort='recent',libraryLayout='covers',libraryLimit=48,selectedDay='';
const currentCalendarPeriod=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit'}).format(new Date(snapshot.syncedAt||Date.now())).split('-').map(Number);
let [calendarYear,calendarMonth]=currentCalendarPeriod();
let calendarView='month',calendarBusy=false,calendarError='';
const calendarCache=new Map(),categoryCache=new Map();
let categoryMode='follow',categoryBusy=false,categoryError='';
const categoryPeriod=()=>categoryMode==='follow'?mode:categoryMode;
const categoryStats=()=>normalizeStats(categoryMode==='follow'?dashboard.stats:categoryCache.get(categoryPeriod()),categoryPeriod());
const calendarKey=()=>`${calendarYear}:${calendarView==='month'?calendarMonth:'year'}`;
const number=value=>value==null?'—':esc(value);
const placeholder=text=>`<div class="empty-state">${esc(text)}</div>`;
const message=text=>`<div class="inline-message" role="status">${icon('info')}<span>${esc(text)}</span></div>`;
const sourceLabel=()=>snapshot.syncedAt?'微信读书':'读书笔记';
const shelf=()=>{const result=normalizeShelf(dashboard.shelf||{},dashboard.progress||{});for(const book of result.entries){if(!book.coverUrl)book.coverUrl=posts.find(post=>post.path===book.id)?.cover||'';}return result;};
const stats=()=>normalizeStats(dashboard.stats,mode);
const bookFor=id=>shelf().entries.find(book=>book.id===id)||stats()?.ranking.find(book=>book.id===id);
const hrefLink=(book,label='打开阅读')=>book.deepLink?`<a class="primary-button" href="${esc(book.deepLink)}" target="_blank" rel="noopener noreferrer">${icon('book')}${label}</a>`:'';
function navTo(next){if(!titles[next])return;view=next;search='';location.hash=next;render();window.scrollTo({top:0,behavior:'instant'});}

function header(eyebrow,title,subtitle,controls=''){return `<section class="page-heading"><h1>${title}</h1>${controls?`<div class="heading-controls">${controls}</div>`:''}</section>`;}
function periods(){return `<div class="segmented" aria-label="分析时间范围">${Object.entries(modeLabels).map(([key,label])=>`<button data-mode="${key}" class="${mode===key?'selected':''}" aria-pressed="${mode===key}">${label}</button>`).join('')}</div>`;}
function stat(label,value,unit,type,footer=''){return `<article class="stat"><div class="stat-top"><span>${label}</span>${icon(type)}</div><div class="stat-number">${number(value)}<small>${unit}</small></div>${footer?`<div class="stat-bottom">${footer}</div>`:''}</article>`;}
function countStat(label,value,type,footer){const parsed=typeof value==='string'?value.match(/^([\d.,]+)\s*(.*)$/):null;return stat(label,parsed?parsed[1]:value,parsed?esc(parsed[2]):'',type,footer);}
function cover(book,extra=''){
  if(book.coverUrl)return `<div class="book-cover real-cover ${extra}"><img src="${esc(book.coverUrl)}" alt="《${esc(book.title)}》封面" loading="lazy" referrerpolicy="no-referrer"></div>`;
  const colors=['blue','orange','cream','dark','teal','purple'];const color=colors[[...book.id].reduce((n,c)=>n+c.charCodeAt(0),0)%colors.length];
  return `<div class="book-cover cover-${color} ${extra}" aria-hidden="true"><span class="cover-en">${book.kind==='audio'?'AUDIOBOOK':book.kind==='articles'?'YOUR COLLECTION':'READ YOURSELF'}</span><span class="cover-title">${esc(book.title)}</span><span class="cover-author">${esc(book.author)}</span></div>`;
}
function bookCard(book){return `<button class="book-card" data-book="${esc(book.id)}" aria-label="查看《${esc(book.title)}》的阅读详情">${cover(book)}<span class="book-title">${esc(book.title)}</span><span class="book-author">${esc(book.author)}</span><span class="book-progress"><span>${book.kind==='audio'?'有声书':book.kind==='articles'?'文章收藏':book.finished?'已读完':'阅读进度'}</span><strong>${book.progress==null?'—':`${number(book.progress)}%`}</strong></span><span class="progress-track"><i style="width:${Math.min(100,Math.max(0,Number(book.progress)||0))}%"></i></span><span class="book-time">${book.seconds!=null?`累计 ${secondsText(book.seconds)}`:book.lastRead?`最近阅读 ${dateText(book.lastRead)}`:book.kind==='articles'?'仅包含收藏入口，不含文章内容':''}</span></button>`;}
function bucketLabel(stamp){const date=dateText(stamp);return mode==='annually'?date.slice(0,7):mode==='overall'?date.slice(0,4):date.slice(5);}
function chartMarkup(s){
  if(!s.buckets.length)return placeholder('当前周期尚无阅读明细。');
  const max=Math.max(60,...s.buckets.map(b=>b.seconds));const scale=Math.ceil(max/1800)*1800;
  const tickCount=Math.min(5,s.buckets.length);const indices=Array.from({length:tickCount},(_,i)=>tickCount===1?0:Math.round(i*(s.buckets.length-1)/(tickCount-1)));
  return `<div class="chart-summary"><strong>${s.average==null?'—':Math.floor(s.average/60)}<span class="chart-unit">分钟</span></strong><span>自然日均</span><div class="chart-legend"><i></i>阅读与收听</div></div><div class="chart" aria-label="${modeLabels[mode]}阅读与收听时长"><div class="grid-lines">${[scale,scale/2,0].map(v=>`<div class="grid-line"><span>${Math.round(v/60)}m</span></div>`).join('')}</div><div class="bars">${s.buckets.map(b=>`<button class="bar" style="--height:${b.seconds/scale*100}%" aria-label="${bucketLabel(b.timestamp)}，${secondsText(b.seconds)}"><span class="chart-tooltip">${bucketLabel(b.timestamp)} · ${secondsText(b.seconds)}</span></button>`).join('')}</div><div class="chart-labels">${indices.map(i=>`<span>${bucketLabel(s.buckets[i].timestamp)}</span>`).join('')}</div></div>`;
}
const categoryColors=['#567ed0','#87a4d2','#b6c8df','#85aea7','#c5b695','#ac9fc1','#92b9c8','#c6a69d'];
function categoryChart(){
  const s=categoryStats(),period=categoryPeriod();
  const distribution=categoryDistribution(s?.categories||[]),entries=distribution.entries;
  const byCount=distribution.basis==='count';
  const rangeOptions=[['follow',`跟随总览（${modeLabels[mode]}）`],...Object.entries(modeLabels)];
  const heading=`<div class="section-title category-heading"><h2>阅读分类</h2><div class="category-controls">${entries.length&&!categoryBusy&&!categoryError?`<span class="status-pill">${byCount?'按阅读本数':'按阅读时长'}</span>`:''}<label class="category-range"><select id="category-range" aria-label="分类统计时间范围">${rangeOptions.map(([value,label])=>`<option value="${value}" ${categoryMode===value?'selected':''}>${label}</option>`).join('')}</select></label></div></div>`;
  const wrap=content=>`<article class="panel category-distribution" aria-label="阅读书籍类型分布" aria-busy="${categoryBusy}">${heading}${content}</article>`;
  if(categoryBusy)return wrap(`<div class="category-state" role="status">正在读取${modeLabels[period]}的分类统计…</div>`);
  const error=categoryError||(categoryMode==='follow'&&dashboard.errors?.stats);
  if(error)return wrap(`<div class="category-state" role="status"><p>${esc(error)}</p><button class="text-button" data-action="category-retry">重新读取</button></div>`);
  if(!entries.length)return wrap(`<div class="category-state" role="status">暂无分类记录</div>`);
  let offset=0;
  const arcs=entries.map((category,index)=>{
    const gap=entries.length===1?0:Math.min(.8,category.share*.12),start=offset;offset+=category.share;
    return `<circle class="category-arc ${index===0?'selected':''}" data-category="${index}" cx="120" cy="120" r="88" pathLength="100" fill="none" stroke="${categoryColors[index%categoryColors.length]}" stroke-width="27" stroke-dasharray="${category.share-gap} ${100-category.share+gap}" stroke-dashoffset="${-start}" transform="rotate(-90 120 120)"><title>${esc(category.title)} · ${distribution.basis==='count'?`${category.value} 本`:secondsText(category.value)} · ${category.share.toFixed(1)}%</title></circle>`;
  }).join('');
  const top=entries[0];
  return wrap(`<div class="category-distribution-layout"><div class="category-pie"><svg viewBox="0 0 240 240" aria-hidden="true" focusable="false">${arcs}</svg><div class="category-pie-center" aria-live="polite" aria-atomic="true"><strong id="category-share">${top.share.toFixed(0)}<small>%</small></strong><span id="category-title">${esc(top.title)}</span><small id="category-value">${byCount?`${top.value} 本`:secondsText(top.value)}</small></div></div><div class="category-breakdown" aria-label="分类占比明细">${entries.map((category,index)=>`<button class="category-legend-row ${index===0?'selected':''}" data-category="${index}" aria-pressed="${index===0}" aria-label="${esc(category.title)}，${byCount?`${category.value} 本`:secondsText(category.value)}，占比 ${category.share.toFixed(1)}%"><i style="background:${categoryColors[index%categoryColors.length]}"></i><span class="category-name">${esc(category.title)}</span><span class="category-amount">${byCount?`${category.value} 本`:secondsText(category.value)}</span><strong>${category.share.toFixed(1)}%</strong></button>`).join('')}</div></div>`);
}
function selectCategory(index){
  const distribution=categoryDistribution(categoryStats()?.categories||[]),category=distribution.entries[index];if(!category)return;
  document.querySelector('#category-share').innerHTML=`${category.share.toFixed(0)}<small>%</small>`;
  document.querySelector('#category-title').textContent=category.title;
  document.querySelector('#category-value').textContent=distribution.basis==='count'?`${category.value} 本`:secondsText(category.value);
  document.querySelectorAll('[data-category]').forEach(element=>{const selected=Number(element.dataset.category)===index;element.classList.toggle('selected',selected);if(element.tagName==='BUTTON')element.setAttribute('aria-pressed',selected);});
}
function renderCategory(){
  const panel=document.querySelector('.category-distribution');if(!panel)return;
  const focused=document.activeElement?.id==='category-range';
  panel.outerHTML=categoryChart();
  if(focused)document.querySelector('#category-range')?.focus({preventScroll:true});
}
async function loadCategory(){categoryError='';categoryBusy=false;renderCategory();}
function preferences(s){
  const hasHours=s.slots.some(slot=>Number.isFinite(slot.seconds)&&slot.seconds>0);
  const hourMax=Math.max(1,...s.slots.map(slot=>Number.isFinite(slot.seconds)?slot.seconds:0));
  const hourPanel=hasHours?`<article class="panel reading-hours"><div class="section-title"><h2>什么时间，最适合你？</h2>${icon('moon')}</div><div class="hour-chart" aria-label="24 小时阅读偏好">${s.slots.map(slot=>`<button class="hour-bar" style="--height:${Math.max(0,Number.isFinite(slot.seconds)?slot.seconds:0)/hourMax*100}%" aria-label="${slot.hour}:00，${secondsText(slot.seconds)}"></button>`).join('')}</div><div class="hour-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div></article>`:'';
  const pie=categoryChart();
  if(!hourPanel&&!pie)return '';
  return `<section class="lower-grid preference-grid ${!hasHours||!pie?'single-preference':''}" aria-label="阅读偏好">${hourPanel}${pie}</section>`;
}
function overview(){
  if(!snapshot.syncedAt)return pendingOverview();
  const s=stats(),items=shelf();
  const recent=[...items.entries].filter(book=>book.kind==='book'&&book.lastRead).sort((a,b)=>b.lastRead-a.lastRead).slice(0,4);
  const heading=header('','每一页，<span>都算数。</span>','',periods());
  if(!s)return `${heading}${placeholder('暂无阅读记录')}`;
  const readBooks=s.summary.find(item=>item.stat==='读过')?.counts;
  const periodNotes=s.summary.find(item=>item.stat==='笔记')?.counts;
  const compare=s.compare==null?'':`<span class="${s.compare>=0?'positive':''}">${s.compare>=0?'↗':'↘'} ${Math.abs(s.compare*100).toFixed(0)}%</span><span>较上期</span>`;
  const strongest=s.categories[0];
  const insight=strongest?`<article class="insight"><div class="insight-top">${icon('sparkles')}阅读偏好</div><h3>${esc(strongest.title)}</h3><p>${secondsText(strongest.seconds)}</p>${s.timeWord?`<div class="insight-fact">${icon('moon')}<strong>${esc(s.timeWord)}</strong></div>`:''}</article>`:'';
  return `${heading}<section class="stats" aria-label="阅读统计">${stat(`${modeLabels[mode]}阅读与收听`,s.total==null?null:(s.total/3600).toFixed(1),'小时','clock',compare)}${stat('有效阅读',s.days,'天','calendar')}${countStat(`${modeLabels[mode]}读过`,readBooks||null,'book')}${countStat(`${modeLabels[mode]}笔记`,periodNotes||null,'pen')}</section>
    ${heatmap()}
    <section class="middle-grid ${insight?'':'reading-wide-chart'}"><article class="panel"><div class="section-title"><h2>阅读的节奏</h2></div>${chartMarkup(s)}</article>${insight}</section>
    <section class="shelf-section"><div class="section-title"><h2>最近翻开的书</h2><button class="text-button" data-view="library">查看书架 ${icon('chevron')}</button></div><div class="shelf-grid">${recent.length?recent.map(bookCard).join(''):placeholder('暂无最近阅读')}</div></section>
    ${preferences(s)}
    ${s.ranking.length||s.readingRate!=null?`<section class="lower-grid ${!s.ranking.length||s.readingRate==null?'reading-single-panel':''}">${s.ranking.length?`<article class="panel"><div class="section-title"><h2>阅读排行</h2></div><div class="reading-ranking">${s.ranking.slice(0,4).map((book,i)=>`<button class="ranking-item" data-book="${esc(book.id)}"><span class="ranking-number">0${i+1}</span><span><strong>${esc(book.title)}</strong><small>${esc(book.author)}</small></span><span class="ranking-duration">${secondsText(book.seconds)}</span></button>`).join('')}</div></article>`:''}${s.readingRate!=null?`<article class="panel"><div class="section-title"><h2>阅读与听书</h2>${icon('books')}</div><div class="reading-mix"><strong>${number(s.readingRate)}<small>%</small></strong><span>文字阅读</span></div><div class="progress-track mix-track"><i style="width:${Math.min(100,Math.max(0,s.readingRate))}%"></i></div><div class="mix-details"><span>阅读 ${secondsText(s.readingSeconds)}</span><span>听书 ${secondsText(s.listeningSeconds)}</span></div></article>`:''}</section>`:''}`;
}

function calendarSource(){return calendarCache.get(calendarKey());}
function calendarData(){const raw=calendarSource();return calendarView==='year'?buildReadingYear(raw,new Date(),calendarYear):buildReadingMonth({...raw,baseTime:Date.UTC(calendarYear,calendarMonth-1,15)/1000});}
function dayDescription(day){const duration=day.seconds<60?'不足 1 分钟':day.seconds<3600?`${Math.floor(day.seconds/60)} 分钟`:secondsText(day.seconds);return `${day.date} · ${day.state==='future'?'尚未到来':day.state==='unknown'?'未提供记录':day.seconds===0?'未阅读':duration}`;}
function calendarCell(day,selected,monthly=false){
  if(!day)return '<span class="calendar-padding" aria-hidden="true"></span>';
  const brief=day.seconds>0?(day.seconds<60?'<1分':day.seconds<3600?`${Math.floor(day.seconds/60)}分`:`${(day.seconds/3600).toFixed(1)}时`):'';
  return `<button class="calendar-day ${day.state} level-${day.level} ${day.date===selected?.date?'selected':''}" data-day="${day.date}" aria-label="${esc(dayDescription(day))}" aria-pressed="${day.date===selected?.date}" tabindex="${day.date===selected?.date?'0':'-1'}" title="${esc(dayDescription(day))}" ${day.state==='future'?'disabled':''}><span class="day-square">${monthly?`<span class="day-number">${day.day}</span>${brief?`<small>${brief}</small>`:''}`:''}</span></button>`;
}
function heatmap(){
  const raw=calendarSource(),calendar=calendarData(),isMonth=calendarView==='month';
  const selected=calendar.days.find(day=>day.date===selectedDay&&day.state!=='future')||calendar.days.findLast(day=>day.seconds!=null)||calendar.days.findLast(day=>day.state!=='future');
  const [currentYear,currentMonth]=currentCalendarPeriod();
  const atCurrent=calendarYear===currentYear&&(!isMonth||calendarMonth===currentMonth);
  const periodLabel=isMonth?`${calendarYear} 年 ${calendarMonth} 月`:`${calendarYear} 年`;
  const offset=isMonth?(new Date(Date.UTC(calendarYear,calendarMonth-1,1)).getUTCDay()+6)%7:0;
  const total=raw?.totalReadTime;
  const monthBody=`<div class="month-calendar-layout"><div class="calendar-summary"><div><span class="calendar-summary-label">这个月，留给阅读</span><div class="calendar-total">${total==null?'—':(total/3600).toFixed(1)}<small>小时</small></div></div><div class="calendar-best"><span>读得最久的一天</span><strong>${calendar.best?`${calendar.best.date.slice(5).replace('-',' / ')} · ${secondsText(calendar.best.seconds)}`:'等待阅读记录'}</strong></div></div><div class="month-calendar"><div class="calendar-weekdays">${['一','二','三','四','五','六','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="month-days">${Array(offset).fill('<span class="calendar-padding" aria-hidden="true"></span>').join('')}${calendar.days.map(day=>calendarCell(day,selected,true)).join('')}</div></div></div>`;
  const yearBody=isMonth?'':`<div class="calendar-scroll year-scroll" tabindex="0" aria-label="年度每日阅读时长，小屏可左右滑动"><div class="year-calendar" style="--weeks:${calendar.weekCount}"><div class="year-months">${calendar.months.map(item=>`<span style="grid-column:${item.week+1}">${item.month} 月</span>`).join('')}</div><div class="year-weekdays">${['一','','三','','五','','日'].map(day=>`<span>${day}</span>`).join('')}</div><div class="year-days">${calendar.slots.map(day=>calendarCell(day,selected)).join('')}</div></div></div>`;
  return `<section class="reading-calendar ${isMonth?'monthly-calendar':'annual-calendar'}" aria-label="${isMonth?'月度':'年度'}阅读热力图" aria-busy="${calendarBusy}"><div class="calendar-heading"><div><h2>${icon('calendar')}阅读热力图 ${!live?'<span class="calendar-demo-tag">示例</span>':''}</h2><p>${calendarBusy?'正在读取阅读记录…':raw&&calendar.knownDays?`有效阅读 <strong>${calendar.activeDays}</strong> 天 · 最长连续 <strong>${calendar.longest}</strong> 天`:'逐日记录尚未提供'}</p></div><div class="segmented calendar-view-toggle" aria-label="热力图视图"><button data-calendar-view="month" class="${isMonth?'selected':''}" aria-pressed="${isMonth}">月度</button><button data-calendar-view="year" class="${!isMonth?'selected':''}" aria-pressed="${!isMonth}">年度</button></div></div><div class="calendar-period-nav"><button class="icon-button calendar-previous" data-calendar-shift="-1" aria-label="${isMonth?'上个月':'上一年'}" ${calendarYear===2000&&(!isMonth||calendarMonth===1)?'disabled':''}>${icon('chevron')}</button><strong>${periodLabel}</strong><button class="icon-button" data-calendar-shift="1" aria-label="${isMonth?'下个月':'下一年'}" ${atCurrent?'disabled':''}>${icon('chevron')}</button>${!atCurrent?`<button class="calendar-today" data-action="calendar-current">回到${isMonth?'本月':'本年'}</button>`:''}</div>${isMonth?monthBody:yearBody}${calendarError?`<div class="calendar-warning" role="alert">${esc(calendarError)}</div>`:''}${raw?.errors?.length?`<div class="calendar-warning">${raw.errors.map(error=>`${error.month} 月：${esc(error.message)}`).join('；')}<button data-action="calendar-retry">重试缺失月份</button></div>`:''}<div class="calendar-footer"><span id="calendar-detail" role="status">${selected?esc(dayDescription(selected)):''}</span><div class="calendar-legend"><span>少</span>${[0,1,2,3,4].map(level=>`<i class="level-${level}" title="${['未阅读','不足或等于15分钟','15至30分钟','30至60分钟','超过60分钟'][level]}"></i>`).join('')}<span>多</span><i class="unknown"></i><span>未提供</span></div></div></section>`;
}
function renderCalendar(){const region=document.querySelector('.reading-calendar');if(region)region.outerHTML=heatmap();}
async function loadCalendar(){calendarError=calendarCache.has(calendarKey())?'':'暂无该时段记录';calendarBusy=false;renderCalendar();}
async function shiftCalendar(amount){
  const [year,month]=currentCalendarPeriod();
  if(calendarView==='year')calendarYear=Math.min(year,Math.max(2000,calendarYear+amount));
  else{const index=Math.min(year*12+month-1,Math.max(2000*12,calendarYear*12+calendarMonth-1+amount));calendarYear=Math.floor(index/12);calendarMonth=index%12+1;}
  selectedDay='';await loadCalendar();
}
function libraryEntries(){
  const query=search.trim().toLocaleLowerCase();
  return shelf().entries.filter(book=>(libraryFilter==='all'||libraryFilter==='audio'&&book.kind==='audio'||libraryFilter==='finished'&&book.finished||libraryFilter==='reading'&&book.kind==='book'&&!book.finished&&book.lastRead>0)&&`${book.title}${book.author}`.toLocaleLowerCase().includes(query)).sort((a,b)=>librarySort==='title'?a.title.localeCompare(b.title,'zh-CN'):b.lastRead-a.lastRead||a.title.localeCompare(b.title,'zh-CN'));
}
function libraryBook(book){
  const status=book.kind==='articles'?'文章收藏':book.kind==='audio'?'有声书':book.finished?'已读完':book.progress!=null?`已读 ${book.progress}%`:book.lastRead?'最近读过':'待阅读';
  return `<button class="library-book" data-book="${esc(book.id)}" aria-label="查看《${esc(book.title)}》的阅读详情"><span class="library-cover-stage">${cover(book)}</span><span class="library-book-info"><strong class="library-book-title">${esc(book.title)}</strong><span class="library-book-author">${esc(book.author)}</span><span class="library-book-status ${book.finished?'finished':''}">${book.finished?icon('check'):''}${status}${book.lastRead?`<small>${dateText(book.lastRead).slice(5)}</small>`:''}</span>${book.progress!=null?`<span class="library-progress"><i style="width:${Math.min(100,Math.max(0,book.progress))}%"></i></span>`:''}</span></button>`;
}
function libraryResults(){const entries=libraryEntries();return entries.length?entries.slice(0,libraryLimit).map(libraryBook).join(''):placeholder(search?'没有找到这本书，试试其他关键词。':'当前分类还没有内容。');}
function updateLibrary(){const entries=libraryEntries();document.querySelector('#book-results').innerHTML=libraryResults();document.querySelector('#library-result-count').textContent=`${entries.length} 个条目`;document.querySelector('#library-more').hidden=entries.length<=libraryLimit;}
function library(){
  const s=shelf(),entries=libraryEntries();
  return `${header('YOUR PERSONAL LIBRARY','好书，<span>常在手边。</span>',`${s.electronic} 本电子书${s.audio?` · ${s.audio} 本有声书`:''}${s.articles?` · ${s.articles} 个文章收藏`:''}`)}${dashboard.errors?.shelf?message(dashboard.errors.shelf):''}${heatmap()}<section class="library-collection"><div class="library-section-heading"><h2>我的藏书 <span id="library-result-count">${entries.length} 个条目</span></h2><div class="library-display-controls"><label class="library-sort">排序<select id="library-sort" aria-label="书架排序"><option value="recent" ${librarySort==='recent'?'selected':''}>最近阅读</option><option value="title" ${librarySort==='title'?'selected':''}>书名</option></select></label><div class="segmented layout-toggle" aria-label="书架显示方式"><button data-library-layout="covers" class="${libraryLayout==='covers'?'selected':''}" aria-pressed="${libraryLayout==='covers'}" aria-label="封面视图">${icon('grid')}</button><button data-library-layout="list" class="${libraryLayout==='list'?'selected':''}" aria-pressed="${libraryLayout==='list'}" aria-label="列表视图">${icon('list')}</button></div></div></div><div class="toolbar library-toolbar"><label class="search-field">${icon('search')}<input id="book-search" placeholder="搜索书名或作者" aria-label="搜索书名或作者" value="${esc(search)}"></label><div class="segmented" aria-label="书架分类">${[['all','全部'],['reading','在读'],['finished','已读完'],['audio','有声书']].map(([key,label])=>`<button data-library-filter="${key}" class="${libraryFilter===key?'selected':''}" aria-pressed="${libraryFilter===key}">${label}</button>`).join('')}</div></div><div class="library-grid ${libraryLayout==='list'?'library-list':''}" id="book-results">${libraryResults()}</div><div id="library-more" class="library-more" ${entries.length<=libraryLimit?'hidden':''}><button class="secondary-button" data-action="more-books">再看 48 本 ${icon('plus')}</button></div></section>`;
}


function pendingOverview(){
  const entries=shelf().entries;
  const featured=[...entries.filter(book=>book.coverUrl),...entries.filter(book=>!book.coverUrl)].slice(0,4);
  return `${header('YOUR READING, YOUR RHYTHM','每一页，<span>都算数。</span>','读过的书，正在悄悄成为你的一部分。')}${message('暂无阅读统计')}<section class="stats" aria-label="阅读统计">${stat('公开书目',new Set(posts.map(post=>post.bookTitle)).size,'本','books','')}${stat('公开笔记',posts.length,'篇','pen','')}${stat('累计阅读与收听',null,'小时','clock','')}${stat('有效阅读',null,'天','calendar','')}</section><section class="shelf-section"><div class="section-title"><h2>书架上的几个坐标</h2><button class="text-button" data-view="library">查看书架 ${icon('chevron')}</button></div><div class="shelf-grid">${featured.map(bookCard).join('')||placeholder('暂时还没有公开书目。')}</div></section><section class="public-recent"><div class="section-title"><h2>最近整理的笔记</h2><button class="text-button" data-view="notes">全部 ${posts.length} 篇 ${icon('chevron')}</button></div><div class="public-notes">${posts.slice(0,3).map(post=>`<a class="public-note" href="${esc(post.path)}"><div><small>${esc(post.date)} · ${esc(post.topics.join(' / '))}</small><h2>${esc(post.title)}</h2><p>${esc(post.excerpt)}</p></div><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}
function notesView(){
  return `${header('THOUGHTS WORTH KEEPING','读过，也<span>想过。</span>',`把 ${posts.length} 篇公开笔记，整理成可以再次进入的思考路径。`)}<div class="toolbar"><label class="search-field">${icon('search')}<input id="public-note-search" type="search" placeholder="搜索书名或主题" aria-label="搜索公开读书笔记" value="${esc(search)}"></label><a class="text-button" href="${esc(new URL('../reading/notes/',import.meta.url).pathname)}">按主题浏览 ${icon('chevron')}</a></div><div id="public-notes" class="public-notes">${noteResults()}</div>`;
}
function noteResults(){
  const query=search.trim().toLocaleLowerCase();
  return posts.filter(post=>`${post.title} ${post.topics.join(' ')}`.toLocaleLowerCase().includes(query)).map(post=>`<a class="public-note" href="${esc(post.path)}"><div><small>${esc(post.date)} · ${esc(post.topics.join(' / '))}</small><h2>${esc(post.title)}</h2><p>${esc(post.excerpt)}</p></div><span aria-hidden="true">↗</span></a>`).join('')||placeholder('还没有找到相关笔记，试试其他关键词。');
}
function render(){
  document.querySelector('#breadcrumb-title').textContent=titles[view];
  for(const button of document.querySelectorAll('.sidebar [data-view]')){
    const active=button.dataset.view===view;button.classList.toggle('active',active);
    active?button.setAttribute('aria-current','page'):button.removeAttribute('aria-current');
  }
  main.innerHTML=({overview,library,notes:notesView})[view]();
  if(loadError)main.insertAdjacentHTML('afterbegin',message(loadError));
  document.querySelector('#shelf-count').textContent=shelf().total;
  document.querySelector('#notes-count').textContent=posts.length;
  document.querySelector('#data-badge').innerHTML=`<i></i>${sourceLabel()}`;
  document.querySelector('#data-source').textContent=snapshot.syncedAt?`更新于 ${new Date(snapshot.syncedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}`:'';
  hydrateIcons(main);
}
async function changeMode(next){if(!modeLabels[next])return;mode=next;dashboard=snapshot.dashboards[next]||emptyDashboard();render();}
function emptyDashboard(){const books=[...new Map(posts.map(post=>[post.bookTitle,post])).values()].map(post=>({bookId:post.path,title:post.bookTitle,author:'读书笔记',cover:post.cover}));return {stats:{},shelf:{books},progress:{},errors:{}};}
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),3500);}
function showDialog(content){document.querySelector('#dialog-content').innerHTML=content;hydrateIcons(dialog);if(!dialog.open)dialog.showModal();}
async function openBook(id){
  const book=bookFor(id);if(!book)return;
  const post=posts.find(post=>post.bookTitle===book.title||post.path===id);
  showDialog(`${cover(book,'book-detail-cover')}<h2 id="dialog-title">${esc(book.title)}</h2><p class="description">${esc(book.author)}</p><div class="detail-facts"><div><small>阅读进度</small><strong>${book.progress==null?'未提供':`${number(book.progress)}%`}</strong></div><div><small>累计阅读</small><strong>${secondsText(book.seconds)}</strong></div><div><small>最近阅读</small><strong>${dateText(book.lastRead)}</strong></div></div>${book.intro?`<p class="detail-note">${esc(book.intro)}</p>`:''}<div class="dialog-actions book-actions">${post?`<a class="secondary-button" href="${esc(post.path)}">读书笔记</a>`:''}${hrefLink(book)}</div>`);
}
document.addEventListener('click',async event=>{
  const category=event.target.closest('[data-category]');if(category){selectCategory(Number(category.dataset.category));return;}
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.view)navTo(button.dataset.view);
  if(button.dataset.mode)await changeMode(button.dataset.mode);
  if(button.dataset.book)await openBook(button.dataset.book);
  if(button.dataset.libraryFilter){libraryFilter=button.dataset.libraryFilter;libraryLimit=48;render();}
  if(button.dataset.libraryLayout){libraryLayout=button.dataset.libraryLayout;render();}
  if(button.dataset.calendarView){calendarView=button.dataset.calendarView;selectedDay='';await loadCalendar();}
  if(button.dataset.calendarShift)await shiftCalendar(Number(button.dataset.calendarShift));
  if(button.dataset.day){selectedDay=button.dataset.day;renderCalendar();}
  if(button.dataset.action==='more-books'){libraryLimit+=48;updateLibrary();}
  if(button.dataset.action==='calendar-current'){[calendarYear,calendarMonth]=currentCalendarPeriod();selectedDay='';await loadCalendar();}
  if(button.dataset.action==='calendar-retry')await loadCalendar();
  if(button.dataset.action==='category-retry')await loadCategory();
  if(button.classList.contains('bar')||button.classList.contains('hour-bar'))toast(button.getAttribute('aria-label'));
});
document.addEventListener('input',event=>{
  if(event.target.id==='book-search'){search=event.target.value;libraryLimit=48;updateLibrary();}
  if(event.target.id==='public-note-search'){search=event.target.value;document.querySelector('#public-notes').innerHTML=noteResults();}
});
document.addEventListener('change',async event=>{
  if(event.target.id==='category-range'){categoryMode=event.target.value;await loadCategory();}
  if(event.target.id==='library-sort'){librarySort=event.target.value;libraryLimit=48;updateLibrary();}
});
document.addEventListener('keydown',event=>{
  const cell=event.target.closest('[data-day]');if(!cell||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  event.preventDefault();const cells=[...document.querySelectorAll('[data-day]:not(:disabled)')],index=cells.indexOf(cell);
  const step=calendarView==='year'?{ArrowLeft:-7,ArrowRight:7,ArrowUp:-1,ArrowDown:1}:{ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  const next=event.key==='Home'?0:event.key==='End'?cells.length-1:Math.min(cells.length-1,Math.max(0,index+step[event.key]));
  if(cells[next]){selectedDay=cells[next].dataset.day;renderCalendar();document.querySelector(`[data-day="${selectedDay}"]`)?.focus();}
});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(titles[next]&&next!==view)navTo(next);});
document.querySelector('#dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
hydrateIcons();
try{
  const response=await fetch(new URL('./data.json',import.meta.url));
  if(!response.ok)throw new Error('暂时无法读取公开阅读记录，请稍后刷新。');
  const data=await response.json();snapshot=data.snapshot||snapshot;posts=data.posts||[];
  [calendarYear,calendarMonth]=currentCalendarPeriod();
  for(const [period,value]of Object.entries(snapshot.dashboards||{}))categoryCache.set(period,value.stats);
  for(const [key,value]of Object.entries(snapshot.calendars||{}))calendarCache.set(key,value);
  dashboard=snapshot.dashboards?.[mode]||emptyDashboard();
}catch(error){loadError=error.message;}
render();
