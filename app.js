/**
 * ============================================================
 *  TRENING PWA – app.js  (kompletna wersja)
 *  • Dwa pola serii: powtórzenia + ciężar
 *  • Objętość treningowa z weryfikacją
 *  • Notatki do serii
 *  • Checkbox SuperSeria (SS)
 *  • Rekordy osobiste (🚀) – objętość i ciężar
 *  • Przeciąganie ćwiczeń (naprawione, płynne)
 *  • Zmiana kolejności w szablonach
 *  • Predefiniowane szablony wbudowane w kod
 *  • Eksport tekstowy
 * ============================================================
 */
'use strict';

/* ============================================================
   PREDEFINIOWANE SZABLONY
   ============================================================ */
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin_lbw', name: 'LBW – Trening nóg', planType: 'LBW', builtin: true,
    exercises: [
      { name: 'Wykroki chodzone',         sets: 3 },
      { name: 'Hip thrusty',              sets: 3 },
      { name: 'Ball leg curl',            sets: 2 },
      { name: 'Suwnica izometryczna',     sets: 3 },
      { name: 'Uginanie nóg na maszynie', sets: 3 },
      { name: 'Seated calf raise',        sets: 3 },
    ]
  },
  {
    id: 'builtin_ubw', name: 'UBW – Trening górny', planType: 'UBW', builtin: true,
    exercises: [
      { name: 'Wyciskanie sztangi na ławce płaskiej', sets: 3 },
      { name: 'Podciąganie',                          sets: 3 },
      { name: 'Military press',                       sets: 3 },
      { name: 'Wiosłowanie na wyciągu (seated row)',  sets: 3 },
      { name: 'Rozpiętki na bramie',                  sets: 3 },
      { name: 'Triceps na wyciągu',                   sets: 3 },
      { name: 'Uginanie ramion na modlitewniku',      sets: 3 },
    ]
  },
  {
    id: 'builtin_fbw', name: 'FBW – Full Body', planType: 'FBW', builtin: true,
    exercises: [
      { name: 'Wyciskanie hantli na ławce skośnej', sets: 3 },
      { name: 'Ściąganie drążka',                   sets: 3 },
      { name: 'Odwodzenie ramion (lateral raise)',  sets: 3 },
      { name: 'Tylna głowa barku na butterfly',     sets: 3 },
      { name: 'Triceps na wyciągu górnym',          sets: 3 },
      { name: 'Prostowanie nóg na maszynie',        sets: 3 },
      { name: 'Wspięcia na palce stojąc',           sets: 3 },
      { name: 'RDL jednonóż',                       sets: 3 },
    ]
  },
];

/* ============================================================
   STORAGE
   ============================================================ */
const Storage = {
  KEY: 'trening_pwa_v1',
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const db  = raw ? JSON.parse(raw) : this._defaultDB();
      if (!db.templates) db.templates = [];
      if (!db.records)   db.records   = {};   // { 'ExName': { maxWeight, maxVolume } }
      ['UBW','LBW','FBW'].forEach(plan => {
        Object.values(db.plans[plan]?.workouts || {}).forEach(w => {
          (w.exercises || []).forEach(ex => {
            (ex.sets || []).forEach(set => {
              if (!('reps'   in set)) set.reps   = '';
              if (!('note'   in set)) set.note   = '';
            });
            if (!('superSet' in ex)) ex.superSet = false;
          });
        });
      });
      return db;
    } catch { return this._defaultDB(); }
  },
  save(db) {
    try { localStorage.setItem(this.KEY, JSON.stringify(db)); }
    catch(e) { console.error('Błąd zapisu:', e); }
  },
  _defaultDB() {
    return {
      plans: { UBW:{workouts:{}}, LBW:{workouts:{}}, FBW:{workouts:{}} },
      templates: [],
      records: {}
    };
  }
};

/* ============================================================
   APP
   ============================================================ */
const App = {
  currentPlan: null, currentDate: null, db: null,
  _toastTimer: null, _pendingConfirm: null,
  _copySourceDate: null, _editingTemplateId: null, _useTemplateId: null,
  // drag state
  _dnd: { on:false, srcIdx:null, targetIdx:null, ghost:null, cards:[], startY:0, offsetY:0 },
  // drag dla szablonów
  _tplDnd: { on:false, srcIdx:null, targetIdx:null, ghost:null, rows:[], offsetY:0 },

  /* ---- INIT ---- */
  init() {
    this.db = Storage.load();
    this._injectBuiltins();
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    this._showScreen('screen-home');
  },

  _injectBuiltins() {
    const ids = new Set(this.db.templates.map(t=>t.id));
    let changed = false;
    [...BUILTIN_TEMPLATES].reverse().forEach(tpl => {
      if (!ids.has(tpl.id)) { this.db.templates.unshift({...tpl}); changed=true; }
    });
    if (changed) Storage.save(this.db);
  },

  /* ---- NAWIGACJA ---- */
  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); window.scrollTo(0,0); }
  },
  goHome()   { this.currentPlan=null; this.currentDate=null; this._showScreen('screen-home'); },
  goToPlan() { this.currentDate=null; this._renderPlanScreen(); this._showScreen('screen-plan'); },
  openPlan(p){ this.currentPlan=p; this._renderPlanScreen(); this._showScreen('screen-plan'); },

  /* ---- EKRAN PLANU ---- */
  _renderPlanScreen() {
    document.getElementById('plan-title').textContent = this.currentPlan;
    const workouts = this.db.plans[this.currentPlan].workouts;
    const dates    = Object.keys(workouts).sort((a,b)=>b.localeCompare(a));
    const list=document.getElementById('dates-list'), empty=document.getElementById('dates-empty');
    list.innerHTML='';
    if (!dates.length) { list.style.display='none'; empty.style.display='flex'; return; }
    list.style.display='flex'; empty.style.display='none';
    dates.forEach(dk => {
      const cnt = (workouts[dk].exercises||[]).length;
      const c = document.createElement('div'); c.className='date-card';
      c.innerHTML=`
        <div class="date-card__main" onclick="App.openWorkout('${dk}')">
          <div class="date-card__icon">📅</div>
          <div class="date-card__info">
            <div class="date-card__date">${this._fmt(dk)}</div>
            <div class="date-card__meta">${cnt===0?'Brak ćwiczeń':cnt+' '+this._pl(cnt,'ćwiczenie','ćwiczenia','ćwiczeń')}</div>
          </div>
        </div>
        <div class="date-card__arrow" onclick="App.openWorkout('${dk}')">›</div>
        <div class="date-card__actions">
          <button class="date-card__export" onclick="App.openExport('${dk}')" title="Eksport">✏️</button>
          <button class="date-card__copy" onclick="App.openCopyModal('${dk}')">KOPIUJ</button>
          <button class="date-card__delete" onclick="App._confirmDeleteDate('${dk}')">✕</button>
        </div>`;
      list.appendChild(c);
    });
  },

  /* ---- DATY ---- */
  addDate() {
    document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-date').style.display='flex';
  },
  confirmAddDate() {
    const dk=document.getElementById('date-input').value;
    if (!dk) { this._toast('Wybierz datę'); return; }
    const w=this.db.plans[this.currentPlan].workouts;
    if (!w[dk]) { w[dk]={exercises:[]}; Storage.save(this.db); }
    this.closeDateModal(); this.openWorkout(dk);
  },
  closeDateModal(e) {
    if (e&&e.target!==document.getElementById('modal-date')) return;
    document.getElementById('modal-date').style.display='none';
  },
  _confirmDeleteDate(dk) {
    this._confirm('Usuń trening',`Usunąć trening z dnia ${this._fmt(dk)}?`,()=>{
      delete this.db.plans[this.currentPlan].workouts[dk];
      Storage.save(this.db); this._renderPlanScreen(); this._toast('Trening usunięty');
    });
  },
  closeConfirmModal(e) {
    if (e&&e.target!==document.getElementById('modal-confirm')) return;
    document.getElementById('modal-confirm').style.display='none';
    this._pendingConfirm=null;
  },

  /* ---- EKSPORT ---- */
  openExport(dk) {
    const workout=this.db.plans[this.currentPlan].workouts[dk];
    if (!workout) return;
    const lines=[`${this.currentPlan} – ${this._fmt(dk)}`,'═'.repeat(32)];
    (workout.exercises||[]).forEach((ex,i)=>{
      lines.push(`\n${i+1}. ${ex.name||'(bez nazwy)'}${ex.superSet?' [SS]':''}`);
      let tot=0;
      (ex.sets||[]).forEach((set,si)=>{
        const r=set.reps||'–', w=set.weight||'–';
        const v=this._calcVol([set]);
        const vs=v.hasData?` → ${v.total.toLocaleString('pl-PL')} kg`:'';
        const n=set.note?` (${set.note})`:'';
        lines.push(`   Seria ${si+1}: ${r} powt. × ${w}${vs}${n}`);
        tot+=v.total;
      });
      if (tot>0) lines.push(`   ─ Objętość: ${tot.toLocaleString('pl-PL')} kg`);
    });
    if (!(workout.exercises||[]).length) lines.push('\n(brak ćwiczeń)');
    lines.push('\n'+'─'.repeat(32),`Eksport: ${new Date().toLocaleString('pl-PL')}`);
    document.getElementById('export-text').value=lines.join('\n');
    document.getElementById('export-title').textContent=`${this.currentPlan} · ${this._fmt(dk)}`;
    document.getElementById('modal-export').style.display='flex';
  },
  closeExportModal(e) {
    if (e&&e.target!==document.getElementById('modal-export')) return;
    document.getElementById('modal-export').style.display='none';
  },
  copyExportText() {
    const ta=document.getElementById('export-text');
    ta.select(); ta.setSelectionRange(0,99999);
    navigator.clipboard?.writeText(ta.value)
      .then(()=>this._toast('Skopiowano ✓'))
      .catch(()=>{ document.execCommand('copy'); this._toast('Skopiowano ✓'); });
  },
  selectAllExport() {
    const ta=document.getElementById('export-text');
    ta.focus(); ta.select(); ta.setSelectionRange(0,99999);
  },

  /* ---- KOPIUJ TRENING ---- */
  openCopyModal(dk) {
    this._copySourceDate=dk;
    document.getElementById('copy-date-input').value=new Date().toISOString().split('T')[0];
    document.getElementById('copy-source-label').textContent=`Kopiujesz ćwiczenia z dnia ${this._fmt(dk)}`;
    document.getElementById('modal-copy').style.display='flex';
  },
  closeCopyModal(e) {
    if (e&&e.target!==document.getElementById('modal-copy')) return;
    document.getElementById('modal-copy').style.display='none'; this._copySourceDate=null;
  },
  confirmCopy() {
    const td=document.getElementById('copy-date-input').value;
    if (!td) { this._toast('Wybierz datę'); return; }
    if (td===this._copySourceDate) { this._toast('Wybierz inną datę'); return; }
    const w=this.db.plans[this.currentPlan].workouts;
    const src=w[this._copySourceDate];
    if (!src) { this._toast('Błąd'); return; }
    const existed=!!w[td];
    w[td]={ exercises:(src.exercises||[]).map(ex=>({
      name:ex.name, superSet:false,
      sets:(ex.sets||[]).map(()=>({reps:'',weight:'',note:''}))
    }))};
    Storage.save(this.db);
    document.getElementById('modal-copy').style.display='none'; this._copySourceDate=null;
    this._toast(existed?`Nadpisano ${this._fmt(td)}`:`Skopiowano do ${this._fmt(td)}`);
    this._renderPlanScreen(); this.openWorkout(td);
  },

  /* ---- TRENING ---- */
  openWorkout(dk) {
    this.currentDate=dk;
    document.getElementById('workout-title').textContent=this.currentPlan;
    document.getElementById('workout-date-label').textContent=`${this.currentPlan} · ${this._fmt(dk)}`;
    this._renderWorkout(); this._showScreen('screen-workout');
  },
  deleteWorkout() {
    this._confirm('Usuń trening',`Usunąć trening z dnia ${this._fmt(this.currentDate)}?`,()=>{
      delete this.db.plans[this.currentPlan].workouts[this.currentDate];
      Storage.save(this.db); this._toast('Trening usunięty'); this.goToPlan();
    });
  },
  _renderWorkout() {
    const wo=this._cw(), exs=wo.exercises||[];
    const cont=document.getElementById('exercises-container');
    const empty=document.getElementById('exercises-empty');
    cont.innerHTML='';
    if (!exs.length) { cont.style.display='none'; empty.style.display='flex'; return; }
    cont.style.display='flex'; empty.style.display='none';
    exs.forEach((ex,i)=>cont.appendChild(this._buildCard(ex,i)));
    this._initDnd();
  },

  /* ============================================================
     KARTA ĆWICZENIA
     ============================================================ */
  _buildCard(ex, idx) {
    const card=document.createElement('div');
    card.className='exercise-card'; card.dataset.idx=idx;

    /* -- NAGŁÓWEK -- */
    const hdr=document.createElement('div'); hdr.className='exercise-header';

    const handle=document.createElement('div'); handle.className='drag-handle'; handle.textContent='⠿';
    const numSpan=document.createElement('span'); numSpan.className='exercise-number'; numSpan.textContent=`Ćw. ${idx+1}`;

    const nameIn=document.createElement('input');
    nameIn.type='text'; nameIn.className='exercise-name-input';
    nameIn.placeholder='Nazwa ćwiczenia…'; nameIn.value=ex.name||'';
    nameIn.addEventListener('change',()=>{ this._cw().exercises[idx].name=nameIn.value.trim(); Storage.save(this.db); });

    // SS checkbox
    const ssWrap=document.createElement('label'); ssWrap.className='ss-label';
    const ssCb=document.createElement('input'); ssCb.type='checkbox'; ssCb.className='ss-checkbox'; ssCb.checked=!!ex.superSet;
    ssCb.addEventListener('change',()=>{ this._cw().exercises[idx].superSet=ssCb.checked; Storage.save(this.db); card.classList.toggle('exercise-card--ss', ssCb.checked); });
    ssWrap.appendChild(ssCb); ssWrap.append('SS');

    const delBtn=document.createElement('button'); delBtn.className='exercise-delete-btn'; delBtn.textContent='✕';
    delBtn.addEventListener('click',()=>this._confirmDelEx(idx));

    hdr.append(handle, numSpan, nameIn, ssWrap, delBtn);
    if (ex.superSet) card.classList.add('exercise-card--ss');
    card.appendChild(hdr);

    /* -- TABELA SERII -- */
    const tbl=document.createElement('div'); tbl.className='sets-table';
    const th=document.createElement('div'); th.className='sets-table-header';
    th.innerHTML='<span>#</span><span>POWT.</span><span>CIĘŻAR</span><span class="th-note">NOTATKA</span><span></span>';
    tbl.appendChild(th);
    (ex.sets||[]).forEach((set,si)=>tbl.appendChild(this._buildRow(set,idx,si)));
    card.appendChild(tbl);

    /* -- OBJĘTOŚĆ -- */
    card.appendChild(this._buildVolBar(ex, idx));

    /* -- STOPKA -- */
    const foot=document.createElement('div'); foot.className='exercise-footer';
    const addBtn=document.createElement('button'); addBtn.className='btn-add-set';
    addBtn.innerHTML='<span>+</span> Dodaj serię';
    addBtn.addEventListener('click',()=>this.addSet(idx));
    foot.appendChild(addBtn); card.appendChild(foot);

    return card;
  },

  /* ============================================================
     WIERSZ SERII
     ============================================================ */
  _buildRow(set, exIdx, setIdx) {
    const row=document.createElement('div'); row.className='set-row';

    const num=document.createElement('div'); num.className='set-number'; num.textContent=setIdx+1;

    const rIn=document.createElement('input');
    rIn.type='number'; rIn.inputMode='numeric'; rIn.className='set-reps-input';
    rIn.placeholder='Powt'; rIn.min='0'; rIn.value=set.reps||'';
    rIn.addEventListener('input',()=>{
      this._cw().exercises[exIdx].sets[setIdx].reps=rIn.value.trim();
      Storage.save(this.db);
      this._refreshVolBar(rIn.closest('.exercise-card'), exIdx);
    });

    const sep=document.createElement('span'); sep.className='set-separator'; sep.textContent='×';

    const wIn=document.createElement('input');
    wIn.type='text'; wIn.inputMode='decimal'; wIn.className='set-weight-input';
    wIn.placeholder='kg'; wIn.value=set.weight||'';
    wIn.addEventListener('input',()=>{
      this._cw().exercises[exIdx].sets[setIdx].weight=wIn.value.trim();
      Storage.save(this.db);
      this._refreshVolBar(wIn.closest('.exercise-card'), exIdx);
    });

    // notatka
    const noteWrap=document.createElement('div'); noteWrap.className='note-wrap';
    const noteBtn=document.createElement('button'); noteBtn.className='note-btn'; noteBtn.title='Notatka';
    noteBtn.textContent='✏️'; if (set.note) noteBtn.classList.add('note-btn--active');
    const noteFld=document.createElement('input');
    noteFld.type='text'; noteFld.className='note-field'; noteFld.placeholder='Notatka…'; noteFld.value=set.note||'';
    noteFld.style.display='none';
    noteBtn.addEventListener('click',()=>{
      const open=noteFld.style.display==='none';
      noteFld.style.display=open?'block':'none';
      if (open) noteFld.focus();
    });
    noteFld.addEventListener('input',()=>{
      this._cw().exercises[exIdx].sets[setIdx].note=noteFld.value.trim();
      Storage.save(this.db);
      noteBtn.classList.toggle('note-btn--active', !!noteFld.value.trim());
    });
    noteWrap.append(noteBtn, noteFld);

    const del=document.createElement('button'); del.className='set-delete-btn'; del.textContent='−';
    del.addEventListener('click',()=>this.deleteSet(exIdx,setIdx));

    row.append(num,rIn,sep,wIn,noteWrap,del);
    return row;
  },

  addExercise() {
    const wo=this._cw();
    wo.exercises.push({name:'',superSet:false,sets:[{reps:'',weight:'',note:''}]});
    Storage.save(this.db);
    document.getElementById('exercises-empty').style.display='none';
    const cont=document.getElementById('exercises-container'); cont.style.display='flex';
    const idx=wo.exercises.length-1;
    const card=this._buildCard(wo.exercises[idx],idx);
    cont.appendChild(card);
    this._initDnd();
    setTimeout(()=>card.querySelector('.exercise-name-input')?.focus(),80);
    setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'nearest'}),100);
  },

  _confirmDelEx(idx) {
    const name=this._cw().exercises[idx]?.name||`Ćwiczenie ${idx+1}`;
    this._confirm('Usuń ćwiczenie',`Usunąć "${name}"?`,()=>{
      this._cw().exercises.splice(idx,1); Storage.save(this.db);
      this._renderWorkout(); this._toast('Ćwiczenie usunięte');
    });
  },

  addSet(exIdx) {
    this._cw().exercises[exIdx].sets.push({reps:'',weight:'',note:''});
    Storage.save(this.db);
    this._rebuildCard(exIdx);
    const card=document.getElementById('exercises-container').querySelectorAll('.exercise-card')[exIdx];
    const rInputs=card?.querySelectorAll('.set-reps-input');
    setTimeout(()=>rInputs?.[rInputs.length-1]?.focus(),60);
  },

  deleteSet(exIdx, setIdx) {
    const sets=this._cw().exercises[exIdx].sets;
    if (sets.length<=1) { this._toast('Minimalna liczba serii to 1'); return; }
    sets.splice(setIdx,1); Storage.save(this.db); this._rebuildCard(exIdx);
  },

  _rebuildCard(exIdx) {
    const cont=document.getElementById('exercises-container');
    const old=cont.querySelectorAll('.exercise-card')[exIdx];
    const nw=this._buildCard(this._cw().exercises[exIdx],exIdx);
    cont.replaceChild(nw,old);
    this._initDnd();
  },

  /* ============================================================
     OBJĘTOŚĆ + REKORDY
     ============================================================ */
  _parseW(str) {
    if (!str) return 0;
    const v=parseFloat(String(str).replace(/[kK][gG]?/g,'').replace(',','.').trim());
    return isNaN(v)||v<0?0:v;
  },

  _calcVol(sets) {
    let total=0, hasData=false;
    const detail=(sets||[]).map(set=>{
      const r=parseInt(set.reps)||0, w=this._parseW(set.weight), v=r*w;
      if(r>0&&w>0) hasData=true; total+=v;
      return {r,w,v};
    });
    return {total,detail,hasData};
  },

  /** Zwraca max ciężar i objętość kiedykolwiek wpisaną dla ćwiczenia o danej nazwie */
  _getRecords(name) {
    const key=(name||'').trim().toLowerCase();
    if (!key) return {maxWeight:0, maxVolume:0};
    const rec=this.db.records[key];
    return rec ? rec : {maxWeight:0, maxVolume:0};
  },

  /** Aktualizuje rekordy i zwraca { newWeightPR, newVolPR } */
  _updateRecords(name, sets) {
    const key=(name||'').trim().toLowerCase();
    if (!key) return {newWeightPR:false, newVolPR:false};
    const {total, detail}=this._calcVol(sets);
    const maxW=Math.max(0,...detail.map(d=>d.w));
    const rec=this.db.records[key]||{maxWeight:0,maxVolume:0};
    const newWeightPR=maxW>0&&maxW>rec.maxWeight;
    const newVolPR=total>0&&total>rec.maxVolume;
    if (newWeightPR) rec.maxWeight=maxW;
    if (newVolPR)    rec.maxVolume=total;
    this.db.records[key]=rec;
    if (newWeightPR||newVolPR) Storage.save(this.db);
    return {newWeightPR, newVolPR};
  },

  _buildVolBar(ex, exIdx) {
    const sets=ex.sets||[];
    const {total,detail,hasData}=this._calcVol(sets);
    const name=(ex.name||'').trim();

    // Sprawdź PR na podstawie aktualnych danych
    const {newWeightPR,newVolPR}=name?this._updateRecords(name,sets):{newWeightPR:false,newVolPR:false};

    const bar=document.createElement('div'); bar.className='volume-bar';

    if (!hasData) {
      bar.innerHTML=`<div class="vol-empty"><span class="vol-label">OBJĘTOŚĆ</span><span class="vol-empty-txt">Wpisz dane</span></div>`;
      return bar;
    }

    const volPRbadge=newVolPR?'<span class="pr-badge" title="Nowy rekord objętości!">🚀 PR</span>':'';
    const wPRbadge=newWeightPR?'<span class="pr-badge pr-badge--weight" title="Nowy rekord ciężaru!">🚀 CIĘŻAR</span>':'';

    const rowsHTML=detail.map((d,i)=>{
      if(d.r===0&&d.w===0) return `<div class="vol-row"><span class="vol-row-num">${i+1}</span><span class="vol-row-empty">—</span></div>`;
      const res=d.v>0?`= <strong>${d.v.toLocaleString('pl-PL')} kg</strong>`:'= —';
      return `<div class="vol-row"><span class="vol-row-num">${i+1}</span><span class="vol-row-calc">${d.r} × ${d.w} kg ${res}</span></div>`;
    }).join('');

    bar.innerHTML=`
      <div class="vol-header">
        <span class="vol-label">OBJĘTOŚĆ</span>
        <span class="vol-total">${total.toLocaleString('pl-PL')} kg ${volPRbadge} ${wPRbadge}</span>
      </div>
      <div class="vol-rows">${rowsHTML}</div>`;
    return bar;
  },

  _refreshVolBar(card, exIdx) {
    if (!card) return;
    const ex=this._cw().exercises[exIdx];
    const old=card.querySelector('.volume-bar');
    const nw=this._buildVolBar(ex, exIdx);
    if (old) card.replaceChild(nw,old);
    else card.insertBefore(nw, card.querySelector('.exercise-footer'));
  },

  /* ============================================================
     DRAG & DROP ĆWICZEŃ (naprawione)
     Używa indeksów opartych na pozycji w DOM, nie data-idx.
     ============================================================ */
  _initDnd() {
    const cont=document.getElementById('exercises-container');
    cont.querySelectorAll('.drag-handle').forEach((h,i)=>{
      // usuń stare listenery przez klonowanie
      const fresh=h.cloneNode(true); h.parentNode.replaceChild(fresh,h);
      fresh.addEventListener('touchstart', e=>this._dndStart(e,true),  {passive:false});
      fresh.addEventListener('mousedown',  e=>this._dndStart(e,false), {passive:false});
    });
  },

  _dndStart(e, isTouch) {
    e.preventDefault(); e.stopPropagation();
    const handle=e.currentTarget;
    const card=handle.closest('.exercise-card');
    if (!card) return;
    const cont=document.getElementById('exercises-container');
    const cards=Array.from(cont.querySelectorAll('.exercise-card'));
    const srcIdx=cards.indexOf(card);
    if (srcIdx<0) return;

    const clientY=isTouch?e.touches[0].clientY:e.clientY;
    const rect=card.getBoundingClientRect();

    // klon-duch
    const ghost=card.cloneNode(true);
    ghost.className='exercise-card exercise-card--ghost';
    ghost.style.cssText=`position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
    document.body.appendChild(ghost);
    card.classList.add('exercise-card--src');

    this._dnd={on:true,srcIdx,targetIdx:srcIdx,ghost,cards,isTouch,offsetY:clientY-rect.top};

    const mv=ev=>this._dndMove(ev,isTouch);
    const up=ev=>this._dndEnd(ev,isTouch,mv,up);
    if (isTouch) { document.addEventListener('touchmove',mv,{passive:false}); document.addEventListener('touchend',up); }
    else         { document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up); }
  },

  _dndMove(e, isTouch) {
    if (!this._dnd.on) return;
    e.preventDefault();
    const {ghost,cards,srcIdx,offsetY}=this._dnd;
    const clientY=isTouch?e.touches[0].clientY:e.clientY;
    ghost.style.top=(clientY-offsetY)+'px';

    // wyznacz target na podstawie środka każdej karty
    let target=srcIdx;
    cards.forEach((c,i)=>{
      if (c.classList.contains('exercise-card--src')) return;
      const r=c.getBoundingClientRect();
      if (clientY>r.top+r.height*0.3) target=i;
    });
    if (target!==this._dnd.targetIdx) {
      cards.forEach(c=>c.classList.remove('dnd-above','dnd-below'));
      if (target!==srcIdx) {
        cards[target]?.classList.add(target<srcIdx?'dnd-above':'dnd-below');
      }
      this._dnd.targetIdx=target;
    }
  },

  _dndEnd(e, isTouch, mv, up) {
    if (!this._dnd.on) return;
    if (isTouch) { document.removeEventListener('touchmove',mv); document.removeEventListener('touchend',up); }
    else         { document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); }

    const {ghost,cards,srcIdx,targetIdx}=this._dnd;
    ghost.remove();
    cards.forEach(c=>c.classList.remove('exercise-card--src','dnd-above','dnd-below'));
    this._dnd={on:false};

    if (srcIdx!==targetIdx) {
      const exs=this._cw().exercises;
      const [m]=exs.splice(srcIdx,1); exs.splice(targetIdx,0,m);
      Storage.save(this.db); this._renderWorkout();
    }
  },

  /* ============================================================
     DRAG & DROP W SZABLONACH
     ============================================================ */
  _initTplDnd() {
    document.querySelectorAll('#tpl-exercises-container .tpl-drag-handle').forEach(h=>{
      const fresh=h.cloneNode(true); h.parentNode.replaceChild(fresh,h);
      fresh.addEventListener('touchstart',e=>this._tplDndStart(e,true),{passive:false});
      fresh.addEventListener('mousedown', e=>this._tplDndStart(e,false),{passive:false});
    });
  },

  _tplDndStart(e, isTouch) {
    e.preventDefault(); e.stopPropagation();
    const row=e.currentTarget.closest('.tpl-ex-row');
    if (!row) return;
    const cont=document.getElementById('tpl-exercises-container');
    const rows=Array.from(cont.querySelectorAll('.tpl-ex-row'));
    const srcIdx=rows.indexOf(row);
    const clientY=isTouch?e.touches[0].clientY:e.clientY;
    const rect=row.getBoundingClientRect();
    const ghost=row.cloneNode(true);
    ghost.className='tpl-ex-row tpl-ex-row--ghost';
    ghost.style.cssText=`position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
    document.body.appendChild(ghost);
    row.classList.add('tpl-ex-row--src');
    this._tplDnd={on:true,srcIdx,targetIdx:srcIdx,ghost,rows,isTouch,offsetY:clientY-rect.top};
    const mv=ev=>this._tplDndMove(ev,isTouch);
    const up=ev=>this._tplDndEnd(ev,isTouch,mv,up);
    if (isTouch){document.addEventListener('touchmove',mv,{passive:false});document.addEventListener('touchend',up);}
    else{document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);}
  },

  _tplDndMove(e,isTouch){
    if(!this._tplDnd.on)return; e.preventDefault();
    const {ghost,rows,srcIdx,offsetY}=this._tplDnd;
    const cy=isTouch?e.touches[0].clientY:e.clientY;
    ghost.style.top=(cy-offsetY)+'px';
    let target=srcIdx;
    rows.forEach((r,i)=>{
      if(r.classList.contains('tpl-ex-row--src'))return;
      const rb=r.getBoundingClientRect();
      if(cy>rb.top+rb.height*0.3)target=i;
    });
    if(target!==this._tplDnd.targetIdx){
      rows.forEach(r=>r.classList.remove('tpl-dnd-above','tpl-dnd-below'));
      if(target!==srcIdx)rows[target]?.classList.add(target<srcIdx?'tpl-dnd-above':'tpl-dnd-below');
      this._tplDnd.targetIdx=target;
    }
  },

  _tplDndEnd(e,isTouch,mv,up){
    if(!this._tplDnd.on)return;
    if(isTouch){document.removeEventListener('touchmove',mv);document.removeEventListener('touchend',up);}
    else{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);}
    const{ghost,rows,srcIdx,targetIdx}=this._tplDnd;
    ghost.remove(); rows.forEach(r=>r.classList.remove('tpl-ex-row--src','tpl-dnd-above','tpl-dnd-below'));
    this._tplDnd={on:false};
    if(srcIdx!==targetIdx){
      const cont=document.getElementById('tpl-exercises-container');
      const allRows=Array.from(cont.querySelectorAll('.tpl-ex-row'));
      const moved=allRows.splice(srcIdx,1)[0]; allRows.splice(targetIdx,0,moved);
      cont.innerHTML=''; allRows.forEach(r=>cont.appendChild(r));
      this._renumberTplRows();
    }
  },

  /* ============================================================
     SZABLONY – lista
     ============================================================ */
  openTemplates(){this._renderTplScreen();this._showScreen('screen-templates');},
  _renderTplScreen(){
    const tpls=this.db.templates||[];
    const list=document.getElementById('templates-list'),empty=document.getElementById('templates-empty');
    list.innerHTML='';
    if(!tpls.length){list.style.display='none';empty.style.display='flex';return;}
    list.style.display='flex';empty.style.display='none';
    tpls.forEach(tpl=>{
      const cnt=(tpl.exercises||[]).length, c=document.createElement('div'); c.className='date-card';
      c.innerHTML=`
        <div class="date-card__main" onclick="App.openUseTplModal('${tpl.id}')">
          <div class="date-card__icon">📋</div>
          <div class="date-card__info">
            <div class="date-card__date" style="display:flex;align-items:center;gap:6px;">
              ${this._esc(tpl.name)}<span class="plan-badge plan-badge--${tpl.planType}">${tpl.planType}</span>
            </div>
            <div class="date-card__meta">${cnt} ${this._pl(cnt,'ćwiczenie','ćwiczenia','ćwiczeń')}</div>
          </div>
        </div>
        <div class="date-card__arrow" onclick="App.openUseTplModal('${tpl.id}')">›</div>
        <div class="date-card__actions">
          <button class="date-card__copy" style="color:var(--color-accent);border-color:rgba(10,132,255,.25);background:rgba(10,132,255,.10);"
            onclick="App.openEditTpl('${tpl.id}')">EDYTUJ</button>
          <button class="date-card__delete" onclick="App._confirmDelTpl('${tpl.id}')">✕</button>
        </div>`;
      list.appendChild(c);
    });
  },

  /* ---- Tworzenie / edycja szablonu ---- */
  openNewTpl(){
    this._editingTemplateId=null;
    document.getElementById('template-edit-title').textContent='Nowy plan';
    document.getElementById('tpl-name').value='';
    this._selTplType(null);
    document.getElementById('tpl-exercises-container').innerHTML='';
    this._addTplExRow('',3);
    this._showScreen('screen-template-edit');
  },
  openEditTpl(id){
    const tpl=this.db.templates.find(t=>t.id===id); if(!tpl)return;
    this._editingTemplateId=id;
    document.getElementById('template-edit-title').textContent='Edytuj plan';
    document.getElementById('tpl-name').value=tpl.name;
    this._selTplType(tpl.planType);
    const cont=document.getElementById('tpl-exercises-container'); cont.innerHTML='';
    (tpl.exercises||[]).forEach(ex=>this._addTplExRow(ex.name,ex.sets));
    this._initTplDnd();
    this._showScreen('screen-template-edit');
  },
  openNewTemplateScreen(){ this.openNewTpl(); },
  openEditTemplateScreen(id){ this.openEditTpl(id); },

  selectTemplateType(t){this._selTplType(t);},
  _selTplType(t){
    document.querySelectorAll('.plan-type-btn').forEach(b=>b.classList.toggle('plan-type-btn--active',b.dataset.type===t));
  },
  _getTplType(){ const a=document.querySelector('.plan-type-btn--active'); return a?a.dataset.type:null; },

  addTemplateExercise(){ this._addTplExRow('',3); },
  _addTplExRow(name='',sets=3){
    const cont=document.getElementById('tpl-exercises-container');
    const idx=cont.querySelectorAll('.tpl-ex-row').length;
    const row=document.createElement('div'); row.className='tpl-ex-row';
    row.innerHTML=`
      <div class="tpl-drag-handle">⠿</div>
      <div class="tpl-ex-row__num">Ćw. ${idx+1}</div>
      <div class="tpl-ex-row__fields">
        <input type="text" class="field-input tpl-ex-name" placeholder="Nazwa ćwiczenia…" value="${this._esc(name)}" />
        <div class="tpl-ex-sets-wrap">
          <label class="tpl-sets-label">Liczba serii:</label>
          <div class="tpl-sets-stepper">
            <button type="button" class="stepper-btn" onclick="App._stepSets(this,-1)">−</button>
            <span class="stepper-val">${Number(sets)||1}</span>
            <button type="button" class="stepper-btn" onclick="App._stepSets(this,1)">+</button>
          </div>
        </div>
      </div>
      <button type="button" class="tpl-ex-del" onclick="App._removeTplRow(this)">✕</button>`;
    cont.appendChild(row);
    this._renumberTplRows();
    this._initTplDnd();
  },
  _stepSets(btn,d){
    const v=btn.parentElement.querySelector('.stepper-val');
    v.textContent=Math.max(1,Math.min(20,(parseInt(v.textContent)||1)+d));
  },
  _removeTplRow(btn){
    const cont=document.getElementById('tpl-exercises-container');
    if(cont.querySelectorAll('.tpl-ex-row').length<=1){this._toast('Minimum 1 ćwiczenie');return;}
    btn.closest('.tpl-ex-row').remove(); this._renumberTplRows();
  },
  _renumberTplRows(){
    document.querySelectorAll('.tpl-ex-row').forEach((r,i)=>{
      const n=r.querySelector('.tpl-ex-row__num'); if(n)n.textContent=`Ćw. ${i+1}`;
    });
  },
  saveTemplate(){
    const name=document.getElementById('tpl-name').value.trim();
    if(!name){this._toast('Wpisz nazwę planu');return;}
    const planType=this._getTplType();
    if(!planType){this._toast('Wybierz typ planu');return;}
    const rows=document.querySelectorAll('.tpl-ex-row');
    if(!rows.length){this._toast('Dodaj ćwiczenie');return;}
    const exercises=[]; let ok=true;
    rows.forEach((r,i)=>{
      const n=r.querySelector('.tpl-ex-name').value.trim();
      if(!n){this._toast(`Wpisz nazwę ćwiczenia ${i+1}`);ok=false;return;}
      exercises.push({name:n,sets:parseInt(r.querySelector('.stepper-val').textContent)||1});
    });
    if(!ok)return;
    if(this._editingTemplateId){
      const tpl=this.db.templates.find(t=>t.id===this._editingTemplateId);
      if(tpl){tpl.name=name;tpl.planType=planType;tpl.exercises=exercises;}
    } else {
      this.db.templates.push({id:'tpl_'+Date.now(),name,planType,exercises});
    }
    Storage.save(this.db);
    this._toast(this._editingTemplateId?'Plan zaktualizowany':'Plan zapisany');
    this._editingTemplateId=null; this.openTemplates();
  },
  _confirmDelTpl(id){
    const tpl=this.db.templates.find(t=>t.id===id); if(!tpl)return;
    this._confirm('Usuń plan',`Usunąć plan "${tpl.name}"?`,()=>{
      this.db.templates=this.db.templates.filter(t=>t.id!==id);
      Storage.save(this.db); this._renderTplScreen(); this._toast('Plan usunięty');
    });
  },

  /* ---- Użyj szablonu ---- */
  openUseTplModal(id){
    const tpl=this.db.templates.find(t=>t.id===id); if(!tpl)return;
    this._useTemplateId=id;
    document.getElementById('use-template-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('use-template-desc').innerHTML=
      `Tworzysz trening <strong>${this._esc(tpl.name)}</strong> <span class="plan-badge plan-badge--${tpl.planType}">${tpl.planType}</span>`;
    document.getElementById('modal-use-template').style.display='flex';
  },
  openUseTemplateModal(id){this.openUseTplModal(id);},
  closeUseTemplateModal(e){
    if(e&&e.target!==document.getElementById('modal-use-template'))return;
    document.getElementById('modal-use-template').style.display='none'; this._useTemplateId=null;
  },
  confirmUseTemplate(){
    const dk=document.getElementById('use-template-date').value;
    if(!dk){this._toast('Wybierz datę');return;}
    const tpl=this.db.templates.find(t=>t.id===this._useTemplateId);
    if(!tpl){this._toast('Błąd');return;}
    const w=this.db.plans[tpl.planType].workouts;
    const existed=!!w[dk];
    w[dk]={exercises:tpl.exercises.map(ex=>({
      name:ex.name,superSet:false,
      sets:Array.from({length:ex.sets},()=>({reps:'',weight:'',note:''}))
    }))};
    Storage.save(this.db);
    document.getElementById('modal-use-template').style.display='none'; this._useTemplateId=null;
    this._toast(existed?`Nadpisano ${this._fmt(dk)}`:`Trening utworzony: ${this._fmt(dk)}`);
    this.currentPlan=tpl.planType; this._renderPlanScreen(); this.openWorkout(dk);
  },

  /* ============================================================
     HELPERY
     ============================================================ */
  _cw(){ return this.db.plans[this.currentPlan].workouts[this.currentDate]; },
  _fmt(dk){ const[y,m,d]=dk.split('-'); return `${d}.${m}.${y}`; },
  _pl(n,a,b,c){ if(n===1)return`${n} ${a}`; if(n>=2&&n<=4)return`${n} ${b}`; return`${n} ${c}`; },
  _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  _toast(msg){
    const el=document.getElementById('toast'); el.textContent=msg; el.style.display='block';
    clearTimeout(this._toastTimer); this._toastTimer=setTimeout(()=>{el.style.display='none';},2500);
  },
  _confirm(title,desc,cb){
    this._pendingConfirm=cb;
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-desc').textContent=desc;
    document.getElementById('confirm-btn').onclick=()=>{this._pendingConfirm?.();this.closeConfirmModal();};
    document.getElementById('modal-confirm').style.display='flex';
  },
};

document.addEventListener('DOMContentLoaded',()=>App.init());
