/**
 * TRENING PWA – app.js
 * Firebase Firestore + Google Auth + pełna funkcjonalność
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ── FIREBASE CONFIG ─────────────────────────────────────── */
const firebaseConfig = {
  apiKey:            "AIzaSyCauQOrygorNofcbFewo5jSlQnL9vsdeJY",
  authDomain:        "trening-app-d7425.firebaseapp.com",
  projectId:         "trening-app-d7425",
  storageBucket:     "trening-app-d7425.firebasestorage.app",
  messagingSenderId: "255226705784",
  appId:             "1:255226705784:web:1a27eaafed4e037c053a8d"
};

const firebase   = initializeApp(firebaseConfig);
const auth       = getAuth(firebase);
const db         = getFirestore(firebase);
const provider   = new GoogleAuthProvider();

/* ── PREDEFINIOWANE SZABLONY ─────────────────────────────── */
const BUILTIN = [
  { id:'builtin_lbw', name:'LBW – Trening nóg', planType:'LBW', builtin:true, exercises:[
    {name:'Wykroki chodzone',sets:3},{name:'Hip thrusty',sets:3},{name:'Ball leg curl jednonóż',sets:2},
    {name:'Suwnica izometryczna obunoż',sets:3},{name:'Uginanie nóg na maszynie',sets:3},{name:'Seated calf raise',sets:3}]},
  { id:'builtin_ubw', name:'UBW – Trening górny', planType:'UBW', builtin:true, exercises:[
    {name:'Wyciskanie sztangi na ławce płaskiej',sets:3},{name:'Podciąganie',sets:3},
    {name:'Military press',sets:3},{name:'Wiosłowanie na wyciągu (seated row)',sets:3},
    {name:'Rozpiętki na bramie',sets:3},{name:'Triceps na wyciągu',sets:3},
    {name:'Uginanie ramion na modlitewniku',sets:3}]},
  { id:'builtin_fbw', name:'FBW – Full Body', planType:'FBW', builtin:true, exercises:[
    {name:'Wyciskanie hantli na ławce skośnej',sets:3},{name:'Ściąganie drążka',sets:3},
    {name:'Odwodzenie ramion (lateral raise)',sets:3},{name:'Tylna głowa barku na butterfly',sets:3},
    {name:'Triceps na wyciągu górnym',sets:3},{name:'Prostowanie nóg na maszynie',sets:3},
    {name:'Wspięcia na palce stojąc',sets:3},{name:'RDL jednonóż',sets:3}]},
];

/* ── DOMYŚLNA STRUKTURA BAZY ─────────────────────────────── */
function defaultDB() {
  return {
    plans: { UBW:{workouts:{}}, LBW:{workouts:{}}, FBW:{workouts:{}} },
    templates: [],
    records: {}
  };
}

function migrateDB(db) {
  if (!db.templates) db.templates = [];
  if (!db.records)   db.records   = {};
  if (!db.plans)     db.plans     = { UBW:{workouts:{}}, LBW:{workouts:{}}, FBW:{workouts:{}} };
  ['UBW','LBW','FBW'].forEach(p => {
    if (!db.plans[p]) db.plans[p] = {workouts:{}};
    Object.values(db.plans[p].workouts||{}).forEach(w => {
      (w.exercises||[]).forEach(ex => {
        if (!('superSet' in ex)) ex.superSet = false;
        (ex.sets||[]).forEach(s => {
          if (!('reps'   in s)) s.reps   = '';
          if (!('weight' in s)) s.weight = '';
          if (!('note'   in s)) s.note   = '';
        });
      });
    });
  });
  return db;
}

/* ── AUTH ────────────────────────────────────────────────── */
const Auth = {
  user: null,
  unsubscribeSnapshot: null,

  async signIn() {
    try {
      await signInWithPopup(auth, provider);
    } catch(e) {
      App._toast('Błąd logowania: ' + e.message);
    }
  },

  async signOut() {
    App._confirm('Wyloguj', 'Czy na pewno chcesz się wylogować?', async () => {
      if (Auth.unsubscribeSnapshot) Auth.unsubscribeSnapshot();
      await signOut(auth);
    });
  },

  init() {
    onAuthStateChanged(auth, async user => {
      this.user = user;
      if (user) {
        // Zalogowany
        document.getElementById('user-name').textContent   = user.displayName || user.email;
        const av = document.getElementById('user-avatar');
        if (user.photoURL) { av.src = user.photoURL; av.style.display='block'; }
        this._loadAndListen();
      } else {
        // Wylogowany
        if (this.unsubscribeSnapshot) { this.unsubscribeSnapshot(); this.unsubscribeSnapshot=null; }
        App.db = null;
        this._showLogin();
      }
    });
  },

  _userDoc() {
    return doc(db, 'users', this.user.uid);
  },

  async _loadAndListen() {
    this._showLoading();
    try {
      // Pierwsze pobranie danych
      const snap = await getDoc(this._userDoc());
      if (snap.exists()) {
        App.db = migrateDB(snap.data());
      } else {
        // Nowy użytkownik — utwórz bazę
        App.db = defaultDB();
        App._injectBuiltins();
        await setDoc(this._userDoc(), App.db);
      }
      App._injectBuiltins();
      this._showApp();

      // Nasłuchuj zmian w czasie rzeczywistym (synchronizacja między urządzeniami)
      this.unsubscribeSnapshot = onSnapshot(this._userDoc(), snap => {
        if (snap.exists() && App.db) {
          const remote = migrateDB(snap.data());
          // Aktualizuj lokalny stan tylko gdy jesteśmy na ekranie głównym
          // (żeby nie przerywać edycji)
          App.db = remote;
        }
      });
    } catch(e) {
      App._toast('Błąd ładowania danych: ' + e.message);
      this._showLogin();
    }
  },

  _showLogin() {
    document.getElementById('loading-overlay').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.getElementById('screen-login').classList.add('active');
  },
  _showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
  },
  _showApp() {
    document.getElementById('loading-overlay').style.display = 'none';
    App._show('screen-home');
  }
};

/* ── STORAGE (Firebase) ──────────────────────────────────── */
const DB = {
  // Zapisz cały dokument do Firestore (debounced — max raz na sekundę)
  _saveTimer: null,
  save(data) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (!Auth.user) return;
      try {
        await setDoc(doc(db, 'users', Auth.user.uid), data);
      } catch(e) {
        console.error('Błąd zapisu:', e);
      }
    }, 800);
  }
};

/* ── APP ─────────────────────────────────────────────────── */
const App = {
  plan: null, date: null, db: null,
  _toast_t: null, _pendingCb: null,
  _copyDate: null, _editTplId: null, _useTplId: null,

  _injectBuiltins() {
    if (!this.db) return;
    const ids = new Set(this.db.templates.map(t=>t.id));
    let ch = false;
    [...BUILTIN].reverse().forEach(t => {
      if (!ids.has(t.id)) { this.db.templates.unshift({...t}); ch=true; }
    });
    if (ch) DB.save(this.db);
  },

  /**
   * Przelicza wszystkie rekordy od zera na podstawie całej historii treningów.
   * Wywoływane po usunięciu treningu lub serii — żeby rekordy wróciły do
   * poprzednich wartości gdy usunięty trening był rekordowy.
   */
  _rebuildAllRecords() {
    const fresh = {};
    ['UBW','LBW','FBW'].forEach(plan => {
      Object.values(this.db.plans[plan].workouts||{}).forEach(workout => {
        (workout.exercises||[]).forEach(ex => {
          const key = (ex.name||'').trim().toLowerCase();
          if (!key) return;
          const {total, detail} = this._calcVol(ex.sets||[]);
          const maxW = Math.max(0, ...detail.map(d=>d.w));
          if (!fresh[key]) fresh[key] = {maxWeight:0, maxVolume:0};
          if (maxW  > fresh[key].maxWeight)  fresh[key].maxWeight  = maxW;
          if (total > fresh[key].maxVolume)  fresh[key].maxVolume  = total;
        });
      });
    });
    this.db.records = fresh;
    DB.save(this.db);
  },

  /* NAVIGATION */
  _show(id) {
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); window.scrollTo(0,0); }
  },
  goHome()    { this.plan=null; this.date=null; this._show('screen-home'); },
  goToPlan()  { this.date=null; this._renderPlan(); this._show('screen-plan'); },
  openPlan(p) { this.plan=p;    this._renderPlan(); this._show('screen-plan'); },
  openTemplates() { this._renderTpls(); this._show('screen-templates'); },

  /* PLAN SCREEN */
  _renderPlan() {
    document.getElementById('plan-title').textContent = this.plan;
    const ws = this.db.plans[this.plan].workouts;
    const dates = Object.keys(ws).sort((a,b)=>b.localeCompare(a));
    const list = document.getElementById('dates-list');
    const empty = document.getElementById('dates-empty');
    list.innerHTML = '';
    if (!dates.length) { list.style.display='none'; empty.style.display='flex'; return; }
    list.style.display='flex'; empty.style.display='none';
    dates.forEach(dk => {
      const cnt = (ws[dk].exercises||[]).length;
      const c = document.createElement('div'); c.className='date-card';
      c.innerHTML = `
        <div class="date-card__main" onclick="App.openWorkout('${dk}')">
          <div class="date-card__icon">📅</div>
          <div class="date-card__info">
            <div class="date-card__date">${this._fmt(dk)}</div>
            <div class="date-card__meta">${cnt===0?'Brak ćwiczeń':cnt+' '+this._pl(cnt,'ćwiczenie','ćwiczenia','ćwiczeń')}</div>
          </div>
        </div>
        <div class="date-card__arrow" onclick="App.openWorkout('${dk}')">›</div>
        <div class="date-card__actions">
          <button class="date-card__export" onclick="App.openExport('${dk}')">✏️</button>
          <button class="date-card__copy" onclick="App.openCopyModal('${dk}')">KOPIUJ</button>
          <button class="date-card__delete" onclick="App._confirmDelDate('${dk}')">✕</button>
        </div>`;
      list.appendChild(c);
    });
  },

  /* DATE MODALS */
  addDate() {
    document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-date').style.display='flex';
  },
  confirmAddDate() {
    const dk = document.getElementById('date-input').value;
    if (!dk) { this._toast('Wybierz datę'); return; }
    const ws = this.db.plans[this.plan].workouts;
    if (!ws[dk]) { ws[dk]={exercises:[]}; DB.save(this.db); }
    this.closeDateModal(); this.openWorkout(dk);
  },
  closeDateModal(e) {
    if (e && e.target!==document.getElementById('modal-date')) return;
    document.getElementById('modal-date').style.display='none';
  },
  _confirmDelDate(dk) {
    this._confirm('Usuń trening',`Usunąć trening z dnia ${this._fmt(dk)}?`, ()=>{
      delete this.db.plans[this.plan].workouts[dk];
      this._rebuildAllRecords();
      this._renderPlan(); this._toast('Trening usunięty');
    });
  },
  closeConfirmModal(e) {
    if (e && e.target!==document.getElementById('modal-confirm')) return;
    document.getElementById('modal-confirm').style.display='none';
    this._pendingCb=null;
  },

  /* COPY WORKOUT */
  openCopyModal(dk) {
    this._copyDate = dk;
    document.getElementById('copy-date-input').value = new Date().toISOString().split('T')[0];
    document.getElementById('copy-source-label').textContent = `Kopiujesz ćwiczenia z dnia ${this._fmt(dk)}`;
    document.getElementById('modal-copy').style.display='flex';
  },
  closeCopyModal(e) {
    if (e && e.target!==document.getElementById('modal-copy')) return;
    document.getElementById('modal-copy').style.display='none'; this._copyDate=null;
  },
  confirmCopy() {
    const td = document.getElementById('copy-date-input').value;
    if (!td) { this._toast('Wybierz datę'); return; }
    if (td===this._copyDate) { this._toast('Wybierz inną datę'); return; }
    const ws = this.db.plans[this.plan].workouts;
    const src = ws[this._copyDate]; if (!src) { this._toast('Błąd'); return; }
    ws[td] = { exercises:(src.exercises||[]).map(ex=>({
      name:ex.name, superSet:false,
      sets:(ex.sets||[]).map(()=>({reps:'',weight:'',note:''}))
    }))};
    DB.save(this.db);
    document.getElementById('modal-copy').style.display='none'; this._copyDate=null;
    this._toast(`Skopiowano do ${this._fmt(td)}`);
    this._renderPlan(); this.openWorkout(td);
  },

  /* EXPORT */
  openExport(dk) {
    const wo = this.db.plans[this.plan].workouts[dk]; if (!wo) return;
    const lines = [`${this.plan} – ${this._fmt(dk)}`, '═'.repeat(30)];
    (wo.exercises||[]).forEach((ex,i)=>{
      lines.push(`\n${i+1}. ${ex.name||'(bez nazwy)'}${ex.superSet?' [SS]':''}`);
      let tot=0;
      (ex.sets||[]).forEach((s,si)=>{
        const v=this._calcVol([s]);
        const vs=v.hasData?` → ${v.total.toLocaleString('pl-PL')} kg`:'';
        const n=s.note?` (${s.note})`:'';
        lines.push(`   Seria ${si+1}: ${s.reps||'–'} powt. × ${s.weight||'–'}${vs}${n}`);
        tot+=v.total;
      });
      if (tot>0) lines.push(`   Objętość: ${tot.toLocaleString('pl-PL')} kg`);
    });
    lines.push('\n'+'─'.repeat(30), `Eksport: ${new Date().toLocaleString('pl-PL')}`);
    document.getElementById('export-text').value = lines.join('\n');
    document.getElementById('export-title').textContent = `${this.plan} · ${this._fmt(dk)}`;
    document.getElementById('modal-export').style.display='flex';
  },
  closeExportModal(e) {
    if (e && e.target!==document.getElementById('modal-export')) return;
    document.getElementById('modal-export').style.display='none';
  },
  copyExportText() {
    const ta=document.getElementById('export-text'); ta.select(); ta.setSelectionRange(0,99999);
    navigator.clipboard?.writeText(ta.value).then(()=>this._toast('Skopiowano ✓'))
      .catch(()=>{ document.execCommand('copy'); this._toast('Skopiowano ✓'); });
  },
  selectAllExport() {
    const ta=document.getElementById('export-text'); ta.focus(); ta.select(); ta.setSelectionRange(0,99999);
  },

  /* WORKOUT */
  openWorkout(dk) {
    this.date=dk;
    document.getElementById('workout-title').textContent = this.plan;
    document.getElementById('workout-date-label').textContent = `${this.plan} · ${this._fmt(dk)}`;
    this._renderWorkout(); this._show('screen-workout');
  },
  deleteWorkout() {
    this._confirm('Usuń trening',`Usunąć trening z dnia ${this._fmt(this.date)}?`, ()=>{
      delete this.db.plans[this.plan].workouts[this.date];
      this._rebuildAllRecords();
      this._toast('Trening usunięty'); this.goToPlan();
    });
  },
  _cw() { return this.db.plans[this.plan].workouts[this.date]; },
  _renderWorkout() {
    const exs = this._cw().exercises||[];
    const cont = document.getElementById('exercises-container');
    const empty = document.getElementById('exercises-empty');
    cont.innerHTML='';
    if (!exs.length) { cont.style.display='none'; empty.style.display='flex'; return; }
    cont.style.display='flex'; empty.style.display='none';
    exs.forEach((ex,i)=>cont.appendChild(this._buildCard(ex,i)));
    this._initDnd();
  },

  /* EXERCISE CARD */
  _buildCard(ex, idx) {
    const card = document.createElement('div');
    card.className = 'exercise-card' + (ex.superSet?' exercise-card--ss':'');
    card.dataset.idx = idx;

    const hdr = document.createElement('div'); hdr.className='exercise-header';
    const handle = document.createElement('div'); handle.className='drag-handle'; handle.textContent='⠿';
    const num = document.createElement('span'); num.className='ex-num'; num.textContent=`Ćw. ${idx+1}`;

    const nameIn = document.createElement('input');
    nameIn.type='text'; nameIn.className='exercise-name-input';
    nameIn.placeholder='Nazwa ćwiczenia…'; nameIn.value=ex.name||'';
    nameIn.addEventListener('change',()=>{ this._cw().exercises[idx].name=nameIn.value.trim(); DB.save(this.db); });

    const ssLabel = document.createElement('label');
    ssLabel.className='ss-label'+(ex.superSet?' is-active':'');
    const ssCb = document.createElement('input');
    ssCb.type='checkbox'; ssCb.className='ss-checkbox'; ssCb.checked=!!ex.superSet;
    ssCb.addEventListener('change',()=>{
      this._cw().exercises[idx].superSet=ssCb.checked;
      DB.save(this.db);
      card.classList.toggle('exercise-card--ss', ssCb.checked);
      ssLabel.classList.toggle('is-active', ssCb.checked);
    });
    ssLabel.appendChild(ssCb); ssLabel.append('SS');

    const delBtn = document.createElement('button');
    delBtn.className='exercise-delete-btn'; delBtn.textContent='✕';
    delBtn.addEventListener('click',()=>this._confirmDelEx(idx));

    hdr.append(handle, num, nameIn, ssLabel, delBtn);
    card.appendChild(hdr);

    const tbl = document.createElement('div'); tbl.className='sets-table';
    const th = document.createElement('div'); th.className='sets-table-header';
    th.innerHTML='<span>#</span><span>POWT.</span><span></span><span>CIĘŻAR</span><span>NOTA</span><span></span>';
    tbl.appendChild(th);
    (ex.sets||[]).forEach((s,si)=>tbl.appendChild(this._buildRow(s,idx,si)));
    card.appendChild(tbl);

    card.appendChild(this._buildVolBar(ex,idx));

    const foot = document.createElement('div'); foot.className='exercise-footer';
    const addBtn = document.createElement('button'); addBtn.className='btn-add-set';
    addBtn.innerHTML='<span>+</span> Dodaj serię';
    addBtn.addEventListener('click',()=>this.addSet(idx));
    foot.appendChild(addBtn); card.appendChild(foot);

    return card;
  },

  /* SET ROW */
  _buildRow(set, exIdx, setIdx) {
    const row = document.createElement('div'); row.className='set-row';
    const num = document.createElement('div'); num.className='set-number'; num.textContent=setIdx+1;

    const rIn = document.createElement('input');
    rIn.type='number'; rIn.inputMode='numeric'; rIn.className='set-reps-input';
    rIn.placeholder='Powt.'; rIn.min='0'; rIn.value=set.reps||'';
    rIn.addEventListener('input',()=>{
      this._cw().exercises[exIdx].sets[setIdx].reps=rIn.value.trim();
      DB.save(this.db);
      this._refreshVol(rIn.closest('.exercise-card'),exIdx);
    });

    const sep = document.createElement('span'); sep.className='set-separator'; sep.textContent='×';

    const wIn = document.createElement('input');
    wIn.type='text'; wIn.inputMode='decimal'; wIn.className='set-weight-input';
    wIn.placeholder='kg'; wIn.value=set.weight||'';
    wIn.addEventListener('input',()=>{
      this._cw().exercises[exIdx].sets[setIdx].weight=wIn.value.trim();
      DB.save(this.db);
      this._refreshVol(wIn.closest('.exercise-card'),exIdx);
    });

    const noteCell = document.createElement('div'); noteCell.className='note-cell';
    const noteBtn = document.createElement('button');
    noteBtn.className='note-btn'+(set.note?' has-note':'');
    noteBtn.textContent='✏️'; noteBtn.title='Notatka do serii';
    noteBtn.addEventListener('click',()=>{
      const nr = row.nextElementSibling;
      if (nr && nr.classList.contains('note-row')) {
        nr.classList.toggle('visible');
        if (nr.classList.contains('visible')) nr.querySelector('input').focus();
      }
    });
    noteCell.appendChild(noteBtn);

    const del = document.createElement('button'); del.className='set-delete-btn'; del.textContent='−';
    del.addEventListener('click',()=>this.deleteSet(exIdx,setIdx));

    row.append(num,rIn,sep,wIn,noteCell,del);

    const noteRow = document.createElement('div');
    noteRow.className='note-row'+(set.note?' visible':'');
    const noteIn = document.createElement('input');
    noteIn.type='text'; noteIn.placeholder='Notatka do serii…'; noteIn.value=set.note||'';
    noteIn.addEventListener('input',()=>{
      this._cw().exercises[exIdx].sets[setIdx].note=noteIn.value.trim();
      DB.save(this.db);
      noteBtn.classList.toggle('has-note',!!noteIn.value.trim());
    });
    noteRow.appendChild(noteIn);

    const frag = document.createDocumentFragment();
    frag.appendChild(row); frag.appendChild(noteRow);
    return frag;
  },

  addExercise() {
    const wo = this._cw();
    wo.exercises.push({name:'',superSet:false,sets:[{reps:'',weight:'',note:''}]});
    DB.save(this.db);
    document.getElementById('exercises-empty').style.display='none';
    const cont = document.getElementById('exercises-container'); cont.style.display='flex';
    const idx = wo.exercises.length-1;
    const card = this._buildCard(wo.exercises[idx],idx);
    cont.appendChild(card);
    this._initDnd();
    setTimeout(()=>card.querySelector('.exercise-name-input')?.focus(),80);
    setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'nearest'}),100);
  },

  _confirmDelEx(idx) {
    const name = this._cw().exercises[idx]?.name||`Ćwiczenie ${idx+1}`;
    this._confirm('Usuń ćwiczenie',`Usunąć "${name}"?`, ()=>{
      this._cw().exercises.splice(idx,1);
      this._rebuildAllRecords();
      this._renderWorkout(); this._toast('Ćwiczenie usunięte');
    });
  },

  addSet(exIdx) {
    this._cw().exercises[exIdx].sets.push({reps:'',weight:'',note:''});
    DB.save(this.db); this._rebuildCard(exIdx);
    const card = document.getElementById('exercises-container').querySelectorAll('.exercise-card')[exIdx];
    const ri = card?.querySelectorAll('.set-reps-input');
    setTimeout(()=>ri?.[ri.length-1]?.focus(),60);
  },

  deleteSet(exIdx,setIdx) {
    const sets = this._cw().exercises[exIdx].sets;
    if (sets.length<=1) { this._toast('Minimalna liczba serii to 1'); return; }
    sets.splice(setIdx,1);
    this._rebuildAllRecords();
    this._rebuildCard(exIdx);
  },

  _rebuildCard(exIdx) {
    const cont = document.getElementById('exercises-container');
    const old = cont.querySelectorAll('.exercise-card')[exIdx];
    const nw = this._buildCard(this._cw().exercises[exIdx],exIdx);
    cont.replaceChild(nw,old); this._initDnd();
  },

  /* VOLUME + RECORDS */
  _parseW(s) {
    if (!s) return 0;
    const v = parseFloat(String(s).replace(/[kK][gG]?/g,'').replace(',','.').trim());
    return isNaN(v)||v<0 ? 0 : v;
  },
  _calcVol(sets) {
    let total=0, hasData=false;
    const detail=(sets||[]).map(s=>{
      const r=parseInt(s.reps)||0, w=this._parseW(s.weight), v=r*w;
      if(r>0&&w>0) hasData=true; total+=v; return {r,w,v};
    });
    return {total,detail,hasData};
  },

  /**
   * Aktualizuje rekordy w bazie jeśli nowe wartości są wyższe.
   * Zawsze zwraca czy AKTUALNE wartości są na poziomie rekordu (>=),
   * dzięki czemu badge pojawia się też przy ponownym otwarciu.
   */
  _updateRec(name,sets) {
    const key=(name||'').trim().toLowerCase(); if(!key) return {prVol:false,prW:false};
    const {total,detail}=this._calcVol(sets);
    const maxW=Math.max(0,...detail.map(d=>d.w));
    const rec=this.db.records[key]||{maxWeight:0,maxVolume:0};

    // Zaktualizuj rekord jeśli nowa wartość jest wyższa
    let changed=false;
    if(maxW>0  && maxW>rec.maxWeight)  { rec.maxWeight=maxW;   changed=true; }
    if(total>0 && total>rec.maxVolume) { rec.maxVolume=total;  changed=true; }
    this.db.records[key]=rec;
    if(changed) DB.save(this.db);

    // Pokaż badge gdy aktualna wartość RÓWNA SIĘ lub PRZEWYŻSZA rekord
    // (>= żeby badge był widoczny przy ponownym otwarciu, nie tylko przy biciu rekordu)
    const prW   = maxW>0   && rec.maxWeight>0  && maxW   >= rec.maxWeight;
    const prVol = total>0  && rec.maxVolume>0  && total  >= rec.maxVolume;
    return {prVol, prW};
  },

  _buildVolBar(ex,idx) {
    const sets=ex.sets||[];
    const {total,detail,hasData}=this._calcVol(sets);
    const bar=document.createElement('div'); bar.className='volume-bar';
    if (!hasData) {
      bar.innerHTML=`<div class="vol-header"><span class="vol-label">OBJĘTOŚĆ</span><span class="vol-empty-txt">Wpisz dane</span></div>`;
      return bar;
    }
    const {prVol,prW}=this._updateRec(ex.name,sets);
    const volBadge=prVol?'<span class="pr-badge">🚀 PR</span>':'';
    const wBadge=prW?'<span class="pr-badge pr-badge--w">🚀 CIĘŻAR</span>':'';
    const rowsHTML=detail.map((d,i)=>{
      if(d.r===0&&d.w===0) return `<div class="vol-row"><span class="vol-row-num">${i+1}</span><span class="vol-row-empty">—</span></div>`;
      const res=d.v>0?`= <strong>${d.v.toLocaleString('pl-PL')} kg</strong>`:'= —';
      return `<div class="vol-row"><span class="vol-row-num">${i+1}</span><span class="vol-row-calc">${d.r} × ${d.w} kg ${res}</span></div>`;
    }).join('');
    bar.innerHTML=`<div class="vol-header"><span class="vol-label">OBJĘTOŚĆ</span>
      <span class="vol-total">${total.toLocaleString('pl-PL')} kg ${volBadge}${wBadge}</span></div>
      <div class="vol-rows">${rowsHTML}</div>`;
    return bar;
  },
  _refreshVol(card,exIdx) {
    if(!card) return;
    const ex=this._cw().exercises[exIdx];
    const old=card.querySelector('.volume-bar');
    const nw=this._buildVolBar(ex,exIdx);
    if(old) card.replaceChild(nw,old);
    else card.insertBefore(nw,card.querySelector('.exercise-footer'));
  },

  /* DRAG & DROP – ćwiczenia */
  _initDnd() {
    const cont=document.getElementById('exercises-container');
    cont.querySelectorAll('.drag-handle').forEach(h=>{
      const f=h.cloneNode(true); h.parentNode.replaceChild(f,h);
      f.addEventListener('touchstart',e=>this._dndStart(e,true), {passive:false});
      f.addEventListener('mousedown', e=>this._dndStart(e,false),{passive:false});
    });
  },
  _dndStart(e,isTouch) {
    e.preventDefault(); e.stopPropagation();
    const card=e.currentTarget.closest('.exercise-card'); if(!card) return;
    const cont=document.getElementById('exercises-container');
    const cards=Array.from(cont.querySelectorAll('.exercise-card'));
    const srcIdx=cards.indexOf(card); if(srcIdx<0) return;
    const cy=isTouch?e.touches[0].clientY:e.clientY;
    const rect=card.getBoundingClientRect();
    const ghost=card.cloneNode(true);
    ghost.className='exercise-card exercise-card--ghost';
    ghost.style.cssText=`position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
    document.body.appendChild(ghost);
    card.classList.add('exercise-card--src');
    const state={srcIdx,targetIdx:srcIdx,ghost,cards,offsetY:cy-rect.top};
    const mv=ev=>this._dndMove(ev,isTouch,state);
    const up=ev=>this._dndEnd(ev,isTouch,state,mv,up);
    document.addEventListener(isTouch?'touchmove':'mousemove',mv,{passive:false});
    document.addEventListener(isTouch?'touchend':'mouseup',up);
  },
  _dndMove(e,isTouch,state) {
    e.preventDefault();
    const cy=isTouch?e.touches[0].clientY:e.clientY;
    state.ghost.style.top=(cy-state.offsetY)+'px';
    let t=state.srcIdx;
    state.cards.forEach((c,i)=>{
      if(c.classList.contains('exercise-card--src')) return;
      const r=c.getBoundingClientRect();
      if(cy>r.top+r.height*0.3) t=i;
    });
    if(t!==state.targetIdx) {
      state.cards.forEach(c=>c.classList.remove('dnd-above','dnd-below'));
      if(t!==state.srcIdx) state.cards[t]?.classList.add(t<state.srcIdx?'dnd-above':'dnd-below');
      state.targetIdx=t;
    }
  },
  _dndEnd(e,isTouch,state,mv,up) {
    document.removeEventListener(isTouch?'touchmove':'mousemove',mv);
    document.removeEventListener(isTouch?'touchend':'mouseup',up);
    state.ghost.remove();
    state.cards.forEach(c=>c.classList.remove('exercise-card--src','dnd-above','dnd-below'));
    if(state.srcIdx!==state.targetIdx) {
      const exs=this._cw().exercises;
      const [m]=exs.splice(state.srcIdx,1); exs.splice(state.targetIdx,0,m);
      DB.save(this.db); this._renderWorkout();
    }
  },

  /* DRAG & DROP – szablony */
  _initTplDnd() {
    document.querySelectorAll('#tpl-ex-container .tpl-drag-handle').forEach(h=>{
      const f=h.cloneNode(true); h.parentNode.replaceChild(f,h);
      f.addEventListener('touchstart',e=>this._tplDndStart(e,true), {passive:false});
      f.addEventListener('mousedown', e=>this._tplDndStart(e,false),{passive:false});
    });
  },
  _tplDndStart(e,isTouch) {
    e.preventDefault(); e.stopPropagation();
    const row=e.currentTarget.closest('.tpl-ex-row'); if(!row) return;
    const cont=document.getElementById('tpl-ex-container');
    const rows=Array.from(cont.querySelectorAll('.tpl-ex-row'));
    const srcIdx=rows.indexOf(row);
    const cy=isTouch?e.touches[0].clientY:e.clientY;
    const rect=row.getBoundingClientRect();
    const ghost=row.cloneNode(true);
    ghost.className='tpl-ex-row tpl-ex-row--ghost';
    ghost.style.cssText=`position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
    document.body.appendChild(ghost);
    row.classList.add('tpl-ex-row--src');
    const state={srcIdx,targetIdx:srcIdx,ghost,rows,offsetY:cy-rect.top};
    const mv=ev=>this._tplDndMove(ev,isTouch,state);
    const up=ev=>this._tplDndEnd(ev,isTouch,state,mv,up);
    document.addEventListener(isTouch?'touchmove':'mousemove',mv,{passive:false});
    document.addEventListener(isTouch?'touchend':'mouseup',up);
  },
  _tplDndMove(e,isTouch,state) {
    e.preventDefault();
    const cy=isTouch?e.touches[0].clientY:e.clientY;
    state.ghost.style.top=(cy-state.offsetY)+'px';
    let t=state.srcIdx;
    state.rows.forEach((r,i)=>{
      if(r.classList.contains('tpl-ex-row--src')) return;
      const rb=r.getBoundingClientRect();
      if(cy>rb.top+rb.height*0.3) t=i;
    });
    if(t!==state.targetIdx) {
      state.rows.forEach(r=>r.classList.remove('tpl-dnd-above','tpl-dnd-below'));
      if(t!==state.srcIdx) state.rows[t]?.classList.add(t<state.srcIdx?'tpl-dnd-above':'tpl-dnd-below');
      state.targetIdx=t;
    }
  },
  _tplDndEnd(e,isTouch,state,mv,up) {
    document.removeEventListener(isTouch?'touchmove':'mousemove',mv);
    document.removeEventListener(isTouch?'touchend':'mouseup',up);
    state.ghost.remove();
    state.rows.forEach(r=>r.classList.remove('tpl-ex-row--src','tpl-dnd-above','tpl-dnd-below'));
    if(state.srcIdx!==state.targetIdx) {
      const cont=document.getElementById('tpl-ex-container');
      const all=Array.from(cont.querySelectorAll('.tpl-ex-row'));
      const [m]=all.splice(state.srcIdx,1); all.splice(state.targetIdx,0,m);
      cont.innerHTML=''; all.forEach(r=>cont.appendChild(r));
      this._renum();
    }
  },

  /* TEMPLATES */
  _renderTpls() {
    const tpls=this.db.templates||[];
    const list=document.getElementById('templates-list');
    const empty=document.getElementById('templates-empty');
    list.innerHTML='';
    if(!tpls.length){list.style.display='none';empty.style.display='flex';return;}
    list.style.display='flex'; empty.style.display='none';
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
          <button class="date-card__copy" style="color:#0A84FF;border-color:rgba(10,132,255,.25);background:rgba(10,132,255,.1);"
            onclick="App.openEditTpl('${tpl.id}')">EDYTUJ</button>
          <button class="date-card__delete" onclick="App._confirmDelTpl('${tpl.id}')">✕</button>
        </div>`;
      list.appendChild(c);
    });
  },

  openNewTpl() {
    this._editTplId=null;
    document.getElementById('tpl-edit-title').textContent='Nowy plan';
    document.getElementById('tpl-name').value='';
    this._selTplType(null);
    document.getElementById('tpl-ex-container').innerHTML='';
    this.addTplExRow('',3);
    this._show('screen-tpl-edit');
  },
  openEditTpl(id) {
    const tpl=this.db.templates.find(t=>t.id===id); if(!tpl) return;
    this._editTplId=id;
    document.getElementById('tpl-edit-title').textContent='Edytuj plan';
    document.getElementById('tpl-name').value=tpl.name;
    this._selTplType(tpl.planType);
    const cont=document.getElementById('tpl-ex-container'); cont.innerHTML='';
    (tpl.exercises||[]).forEach(ex=>this.addTplExRow(ex.name,ex.sets));
    this._initTplDnd();
    this._show('screen-tpl-edit');
  },
  selectTemplateType(t) { this._selTplType(t); },
  _selTplType(t) {
    document.querySelectorAll('.plan-type-btn').forEach(b=>b.classList.toggle('plan-type-btn--active',b.dataset.type===t));
  },
  _getTplType() { const a=document.querySelector('.plan-type-btn--active'); return a?a.dataset.type:null; },
  addTemplateExercise() { this.addTplExRow('',3); },
  addTplExRow(name='',sets=3) {
    const cont=document.getElementById('tpl-ex-container');
    const idx=cont.querySelectorAll('.tpl-ex-row').length;
    const row=document.createElement('div'); row.className='tpl-ex-row';
    row.innerHTML=`
      <div class="tpl-drag-handle">⠿</div>
      <div class="tpl-ex-row__num">Ćw. ${idx+1}</div>
      <div class="tpl-ex-row__fields">
        <input type="text" class="field-input tpl-ex-name" placeholder="Nazwa ćwiczenia…" value="${this._esc(name)}"/>
        <div class="tpl-ex-sets-wrap">
          <label class="tpl-sets-label">Liczba serii:</label>
          <div class="tpl-sets-stepper">
            <button type="button" class="stepper-btn" onclick="App._step(this,-1)">−</button>
            <span class="stepper-val">${Number(sets)||1}</span>
            <button type="button" class="stepper-btn" onclick="App._step(this,1)">+</button>
          </div>
        </div>
      </div>
      <button type="button" class="tpl-ex-del" onclick="App._removeTplRow(this)">✕</button>`;
    cont.appendChild(row);
    this._renum(); this._initTplDnd();
  },
  _step(btn,d) {
    const v=btn.parentElement.querySelector('.stepper-val');
    v.textContent=Math.max(1,Math.min(20,(parseInt(v.textContent)||1)+d));
  },
  _removeTplRow(btn) {
    const cont=document.getElementById('tpl-ex-container');
    if(cont.querySelectorAll('.tpl-ex-row').length<=1){this._toast('Minimum 1 ćwiczenie');return;}
    btn.closest('.tpl-ex-row').remove(); this._renum();
  },
  _renum() {
    document.querySelectorAll('.tpl-ex-row').forEach((r,i)=>{
      const n=r.querySelector('.tpl-ex-row__num'); if(n) n.textContent=`Ćw. ${i+1}`;
    });
  },
  saveTemplate() {
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
    if(!ok) return;
    if(this._editTplId) {
      const tpl=this.db.templates.find(t=>t.id===this._editTplId);
      if(tpl){tpl.name=name;tpl.planType=planType;tpl.exercises=exercises;}
    } else {
      this.db.templates.push({id:'tpl_'+Date.now(),name,planType,exercises});
    }
    DB.save(this.db);
    this._toast(this._editTplId?'Plan zaktualizowany':'Plan zapisany');
    this._editTplId=null; this.openTemplates();
  },
  _confirmDelTpl(id) {
    const tpl=this.db.templates.find(t=>t.id===id); if(!tpl) return;
    this._confirm('Usuń plan',`Usunąć plan "${tpl.name}"?`, ()=>{
      this.db.templates=this.db.templates.filter(t=>t.id!==id);
      DB.save(this.db); this._renderTpls(); this._toast('Plan usunięty');
    });
  },
  openUseTplModal(id) {
    const tpl=this.db.templates.find(t=>t.id===id); if(!tpl) return;
    this._useTplId=id;
    document.getElementById('use-tpl-date').value=new Date().toISOString().split('T')[0];
    document.getElementById('use-tpl-desc').innerHTML=
      `Tworzysz trening <strong>${this._esc(tpl.name)}</strong> <span class="plan-badge plan-badge--${tpl.planType}">${tpl.planType}</span>`;
    document.getElementById('modal-use-tpl').style.display='flex';
  },
  closeUseTplModal(e) {
    if(e&&e.target!==document.getElementById('modal-use-tpl')) return;
    document.getElementById('modal-use-tpl').style.display='none'; this._useTplId=null;
  },
  confirmUseTpl() {
    const dk=document.getElementById('use-tpl-date').value;
    if(!dk){this._toast('Wybierz datę');return;}
    const tpl=this.db.templates.find(t=>t.id===this._useTplId);
    if(!tpl){this._toast('Błąd');return;}
    const ws=this.db.plans[tpl.planType].workouts;
    ws[dk]={exercises:tpl.exercises.map(ex=>({
      name:ex.name,superSet:false,
      sets:Array.from({length:ex.sets},()=>({reps:'',weight:'',note:''}))
    }))};
    DB.save(this.db);
    document.getElementById('modal-use-tpl').style.display='none'; this._useTplId=null;
    this._toast(`Trening utworzony: ${this._fmt(dk)}`);
    this.plan=tpl.planType; this._renderPlan(); this.openWorkout(dk);
  },

  /* HELPERS */
  _fmt(dk)  { const[y,m,d]=dk.split('-'); return `${d}.${m}.${y}`; },
  _pl(n,a,b,c) { if(n===1) return`${n} ${a}`; if(n>=2&&n<=4) return`${n} ${b}`; return`${n} ${c}`; },
  _esc(s)   { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  _toast(msg) {
    const el=document.getElementById('toast'); el.textContent=msg; el.style.display='block';
    clearTimeout(this._toast_t); this._toast_t=setTimeout(()=>{el.style.display='none';},2500);
  },
  _confirm(title,desc,cb) {
    this._pendingCb=cb;
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-desc').textContent=desc;
    document.getElementById('confirm-btn').onclick=()=>{ this._pendingCb?.(); this.closeConfirmModal(); };
    document.getElementById('modal-confirm').style.display='flex';
  },
};

/* Eksponuj globalne handlery */
window.App  = App;
window.Auth = Auth;

/* START */
document.addEventListener('DOMContentLoaded', () => Auth.init());
