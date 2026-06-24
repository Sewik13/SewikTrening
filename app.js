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
    {name:'Front squat',sets:3},
    {name:'Hip thrusty',sets:3},
    {name:'Ball leg curl jednonóż',sets:2},
    {name:'Suwnica izometryczna obunoż',sets:3},
    {name:'Uginanie nóg na maszynie',sets:3},
    {name:'Seated calf raise',sets:3},
    {name:'Odwodzenie nóg na maszynie',sets:3},
  ]},
  { id:'builtin_ubw', name:'UBW – Trening górny', planType:'UBW', builtin:true, exercises:[
    {name:'Wyciskanie sztangi na ławce płaskiej',sets:4},
    {name:'Podciąganie',sets:3},
    {name:'Military press',sets:3},
    {name:'Wiosłowanie na wyciągu (seated row)',sets:4},
    {name:'Rozpiętki na bramie',sets:4},
    {name:'Lateral raise na wyciągu',sets:4},
    {name:'Triceps na wyciągu',sets:3},
    {name:'Uginanie ramion na modlitewniku',sets:3},
  ]},
  { id:'builtin_fbw', name:'FBW – Full Body', planType:'FBW', builtin:true, exercises:[
    {name:'Wyciskanie hantli na ławce skośnej',sets:4},
    {name:'Ściąganie drążka',sets:3},
    {name:'Tylna głowa barku na butterfly',sets:4},
    {name:'Triceps na wyciągu górnym',sets:3},
    {name:'Uginanie ramion skośne (incline curl)',sets:3},
    {name:'Odwodzenie ramion (lateral raise)',sets:4},
    {name:'Prostowanie nóg na maszynie',sets:3},
    {name:'Wspięcia na palce stojąc',sets:3},
    {name:'RDL jednonóż',sets:2},
  ]},
];

/* ── MAPA MIĘŚNIOWA ──────────────────────────────────────
   Dla każdego ćwiczenia: partie główne (1.0) i pomocnicze (0.5)
   ─────────────────────────────────────────────────────── */
const MUSCLE_MAP = {
  // UBW
  'wyciskanie sztangi na ławce płaskiej':  {'Klatka środek':1,'Triceps':1,'Bark przód':0.5,'Brzuch':0.5},
  'podciąganie':                           {'Plecy szerokie':1,'Biceps':1,'Bark tył':0.5,'Brzuch':0.5},
  'military press':                        {'Bark przód':1,'Triceps':1,'Bark bok':0.5,'Brzuch':0.5},
  'wiosłowanie na wyciągu (seated row)':   {'Plecy górne':1,'Biceps':0.5,'Bark tył':0.5},
  'rozpiętki na bramie':                   {'Klatka środek':1,'Bark przód':0.5},
  'lateral raise na wyciągu':             {'Bark bok':1},
  'triceps na wyciągu':                    {'Triceps':1},
  'uginanie ramion na modlitewniku':       {'Biceps':1},
  // FBW
  'wyciskanie hantli na ławce skośnej':    {'Klatka góra':1,'Triceps':1,'Bark przód':0.5,'Brzuch':0.5},
  'ściąganie drążka':                      {'Plecy szerokie':1,'Biceps':0.5,'Bark tył':0.5},
  'tylna głowa barku na butterfly':        {'Bark tył':1,'Plecy górne':0.5},
  'triceps na wyciągu górnym':             {'Triceps':1},
  'uginanie ramion skośne (incline curl)': {'Biceps':1},
  'odwodzenie ramion (lateral raise)':     {'Bark bok':1},
  'prostowanie nóg na maszynie':           {'Czworogłowy':1},
  'wspięcia na palce stojąc':              {'Łydki':1},
  'rdl jednonóż':                          {'Dwugłowy uda':1,'Pośladki':0.5,'Brzuch':0.5},
  // LBW
  'front squat':                           {'Czworogłowy':1,'Pośladki':0.5,'Brzuch':1},
  'hip thrusty':                           {'Pośladki':1,'Dwugłowy uda':0.5},
  'ball leg curl jednonóż':                {'Dwugłowy uda':1,'Pośladki':0.5},
  'suwnica izometryczna obunoż':           {'Czworogłowy':1,'Pośladki':0.5},
  'uginanie nóg na maszynie':              {'Dwugłowy uda':1},
  'seated calf raise':                     {'Łydki':1},
  'odwodzenie nóg na maszynie':            {'Pośladki':1},
  // Baza ćwiczeń – dodatkowe
  'rozpiętki na bramie (ustawienie dolne — wyciągi nisko)': {'Klatka góra':1,'Bark przód':0.5},
  'rozpiętki na bramie (ustawienie środkowe)':              {'Klatka środek':1,'Bark przód':0.5},
  'rozpiętki na bramie (ustawienie górne — wyciągi wysoko)':{'Klatka dół':1,'Bark przód':0.5},
  'wyciskanie hantli na ławce skośnej (górna)':  {'Klatka góra':1,'Triceps':1,'Bark przód':0.5},
  'wyciskanie sztangi na skośnej':               {'Klatka góra':1,'Triceps':1,'Bark przód':0.5},
  'rozpiętki na skośnej':                        {'Klatka góra':1,'Bark przód':0.5},
  'wyciskanie hantli na płaskiej':               {'Klatka środek':1,'Triceps':1,'Bark przód':0.5},
  'rozpiętki z hantlami na płaskiej':            {'Klatka środek':1,'Bark przód':0.5},
  'butterfly (peck deck)':                       {'Klatka środek':1},
  'wyciskanie na ławce ujemnej':                 {'Klatka dół':1,'Triceps':1,'Bark przód':0.5},
  'rozpiętki na ławce ujemnej':                  {'Klatka dół':1},
  'dips (dipy)':                                 {'Klatka dół':1,'Triceps':1,'Bark przód':0.5},
  'wiosłowanie sztangą':           {'Plecy górne':1,'Biceps':0.5,'Bark tył':0.5},
  'wiosłowanie hantlem jednoręcznie':{'Plecy górne':1,'Biceps':0.5,'Bark tył':0.5},
  'wiosłowanie wąskim chwytem':    {'Plecy górne':1,'Biceps':0.5,'Bark tył':0.5},
  'face pull':                     {'Bark tył':1,'Plecy górne':0.5},
  'wznosy ramion w tył (rear delt row)': {'Bark tył':1,'Plecy górne':0.5},
  'ściąganie drążka wąskim chwytem':{'Plecy szerokie':1,'Biceps':0.5},
  'martwy ciąg':                   {'Plecy górne':1,'Dwugłowy uda':1,'Pośladki':0.5,'Brzuch':0.5},
  'pullover z hantlem':            {'Plecy szerokie':1,'Klatka środek':0.5},
  'wyciskanie hantli nad głowę':   {'Bark przód':1,'Triceps':1,'Bark bok':0.5},
  'wznosy hantli przed siebie':    {'Bark przód':1},
  'wyciskanie arnolda':            {'Bark przód':1,'Bark bok':0.5,'Triceps':1},
  'upright row':                   {'Bark bok':1,'Bark przód':0.5,'Plecy górne':0.5},
  'wznosy hantli w opadzie tułowia': {'Bark tył':1,'Plecy górne':0.5},
  'odwodzenie ramion w tył na wyciągu': {'Bark tył':1},
  'uginanie ramion ze sztangą':    {'Biceps':1},
  'uginanie ramion z hantlami naprzemiennie': {'Biceps':1},
  'uginanie ramion na wyciągu':    {'Biceps':1},
  'uginanie ramion młotkowe (hammer curl)': {'Biceps':1},
  'triceps na wyciągu (pushdown)': {'Triceps':1},
  'wąskie wyciskanie sztangi':     {'Triceps':1,'Klatka środek':0.5,'Bark przód':0.5},
  'french press':                  {'Triceps':1},
  'kickback z hantlem':            {'Triceps':1},
  'przysiad ze sztangą':           {'Czworogłowy':1,'Pośladki':0.5,'Brzuch':0.5},
  'suwnica (leg press)':           {'Czworogłowy':1,'Pośladki':0.5},
  'hack squat':                    {'Czworogłowy':1,'Pośladki':0.5,'Brzuch':0.5},
  'wykroki chodzone':              {'Czworogłowy':1,'Pośladki':0.5},
  'wykroki bułgarskie':            {'Czworogłowy':1,'Pośladki':1,'Brzuch':0.5},
  'rdl obunoż':                    {'Dwugłowy uda':1,'Pośladki':0.5,'Brzuch':0.5},
  'uginanie nóg na maszynie (leżąc)':   {'Dwugłowy uda':1},
  'uginanie nóg na maszynie (siedzenie)':{'Dwugłowy uda':1},
  'nordic curl':                   {'Dwugłowy uda':1,'Brzuch':0.5},
  'hip thrust jednonóż':           {'Pośladki':1,'Dwugłowy uda':0.5},
  'glute bridge':                  {'Pośladki':1,'Dwugłowy uda':0.5},
  'cable kickback':                {'Pośladki':1},
  'odwodzenie nogi na maszynie':   {'Pośladki':1},
  'donkey calf raise':             {'Łydki':1},
  'wspięcia na palce na suwnicy':  {'Łydki':1},
};

/* Zwraca mapę mięśniową dla ćwiczenia (case-insensitive) */
function getMuscles(exName) {
  return MUSCLE_MAP[(exName||'').trim().toLowerCase()] || null;
}

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
    let changed = false;
    BUILTIN.forEach(tpl => {
      const idx = this.db.templates.findIndex(t => t.id === tpl.id);
      if (idx === -1) {
        // Nie ma — dodaj na początku
        this.db.templates.unshift({...tpl});
        changed = true;
      } else {
        // Jest — zaktualizuj ćwiczenia (zachowaj id i builtin flag)
        const existing = this.db.templates[idx];
        const exercisesChanged = JSON.stringify(existing.exercises) !== JSON.stringify(tpl.exercises);
        const nameChanged = existing.name !== tpl.name;
        if (exercisesChanged || nameChanged) {
          this.db.templates[idx] = { ...tpl };
          changed = true;
        }
      }
    });
    if (changed) DB.save(this.db);
  },

  /**
   * Przelicza wszystkie rekordy od zera na podstawie całej historii treningów.
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

  /**
   * Znajduje poprzedni trening (wcześniejsza data) dla tego samego planu
   * i zwraca ćwiczenie o tej samej nazwie, jeśli istnieje.
   */
  _findLastSession(exName) {
    if (!exName) return null;
    const workouts = this.db.plans[this.plan].workouts;
    // Posortuj daty malejąco i znajdź pierwszą wcześniejszą niż aktualna
    const prevDates = Object.keys(workouts)
      .filter(d => d < this.date)
      .sort((a,b) => b.localeCompare(a));
    for (const d of prevDates) {
      const ex = (workouts[d].exercises||[]).find(
        e => (e.name||'').trim().toLowerCase() === exName.trim().toLowerCase()
      );
      if (ex && (ex.sets||[]).some(s => s.reps || s.weight)) {
        return { date: d, exercise: ex };
      }
    }
    return null;
  },

  /** Pokazuje popup z wynikami z poprzedniego treningu */
  showLastSession(exName, cardEl) {
    // Usuń istniejący popup jeśli jest
    document.querySelectorAll('.last-session-popup').forEach(p=>p.remove());

    const last = this._findLastSession(exName);
    if (!last) { this._toast('Brak poprzednich wyników dla tego ćwiczenia'); return; }

    const popup = document.createElement('div');
    popup.className = 'last-session-popup';

    const setsHTML = (last.exercise.sets||[]).map((s,i) => {
      const r = s.reps   || '—';
      const w = s.weight || '—';
      const n = s.note   ? `<span class="lsp-note">${this._esc(s.note)}</span>` : '';
      return `<div class="lsp-row">
        <span class="lsp-num">${i+1}</span>
        <span class="lsp-val">${r} powt. × ${w}</span>
        ${n}
      </div>`;
    }).join('');

    const vol = this._calcVol(last.exercise.sets||[]);
    const volStr = vol.hasData
      ? `<div class="lsp-vol">Objętość: ${vol.total.toLocaleString('pl-PL')} kg</div>`
      : '';

    popup.innerHTML = `
      <div class="lsp-header">
        <div class="lsp-title">
          <span class="lsp-icon">🔍</span>
          <span class="lsp-name">${this._esc(last.exercise.name)}</span>
        </div>
        <div class="lsp-date">${this._fmt(last.date)}</div>
        <button class="lsp-close" onclick="this.closest('.last-session-popup').remove()">✕</button>
      </div>
      <div class="lsp-sets">${setsHTML}</div>
      ${volStr}`;

    // Wstaw popup bezpośrednio pod nagłówkiem karty
    const hdr = cardEl.querySelector('.exercise-header');
    hdr.insertAdjacentElement('afterend', popup);

    // Animacja wejścia
    requestAnimationFrame(() => popup.classList.add('lsp-visible'));
  },

  _renderWorkout(mode='update') {
    const exs = this._cw().exercises||[];
    const cont = document.getElementById('exercises-container');
    const empty = document.getElementById('exercises-empty');
    cont.innerHTML='';
    if (!exs.length) { cont.style.display='none'; empty.style.display='flex'; return; }
    cont.style.display='flex'; empty.style.display='none';
    exs.forEach((ex,i)=>cont.appendChild(this._buildCard(ex,i,mode)));
    this._initDnd();
  },

  /* EXERCISE CARD */
  _buildCard(ex, idx, mode='update') {
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

    // Ikonka lupy — poprzedni trening
    const lastSession = this._findLastSession(ex.name);
    const lupaBtn = document.createElement('button');
    lupaBtn.className = 'lupa-btn' + (lastSession ? '' : ' lupa-btn--disabled');
    lupaBtn.textContent = '🔍';
    lupaBtn.title = lastSession
      ? `Poprzedni trening: ${this._fmt(lastSession.date)}`
      : 'Brak poprzednich wyników';
    lupaBtn.addEventListener('click', () => {
      // Jeśli popup już jest otwarty — zamknij
      const existing = card.querySelector('.last-session-popup');
      if (existing) { existing.remove(); return; }
      App.showLastSession(ex.name, card);
    });

    const delBtn = document.createElement('button');
    delBtn.className='exercise-delete-btn'; delBtn.textContent='✕';
    delBtn.addEventListener('click',()=>this._confirmDelEx(idx));

    hdr.append(handle, num, nameIn, ssLabel, lupaBtn, delBtn);
    card.appendChild(hdr);

    const tbl = document.createElement('div'); tbl.className='sets-table';
    const th = document.createElement('div'); th.className='sets-table-header';
    th.innerHTML='<span>#</span><span>POWT.</span><span></span><span>CIĘŻAR</span><span>NOTA</span><span></span>';
    tbl.appendChild(th);
    (ex.sets||[]).forEach((s,si)=>tbl.appendChild(this._buildRow(s,idx,si)));
    card.appendChild(tbl);

    card.appendChild(this._buildVolBar(ex,idx,mode));

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
      this._renderWorkout('check'); this._toast('Ćwiczenie usunięte');
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
    this._rebuildCard(exIdx, 'check');
  },

  _rebuildCard(exIdx, mode='update') {
    const cont = document.getElementById('exercises-container');
    const old = cont.querySelectorAll('.exercise-card')[exIdx];
    const nw = this._buildCard(this._cw().exercises[exIdx], exIdx, mode);
    cont.replaceChild(nw,old); this._initDnd();
  },

  /* ============================================================
     VOLUME + RECORDS – czysta logika od zera
     
     records[key] = { maxWeight: number, maxVolume: number }
     
     maxWeight = największy ciężar w POJEDYNCZEJ SERII kiedykolwiek
     maxVolume = największa SUMA (reps × weight) wszystkich serii ćwiczenia
                 w jednym dniu treningu
     
     Badge OBJĘTOŚĆ  → gdy dzisiejsza suma >= rekord sumy
     Badge PR        → gdy największy ciężar w serii >= rekord ciężaru
     ============================================================ */

  _parseW(s) {
    if (!s) return 0;
    const v = parseFloat(String(s).replace(/[kK][gG]?/g,'').replace(',','.').trim());
    return (isNaN(v) || v < 0) ? 0 : v;
  },

  /** Oblicza objętość i szczegóły serii */
  _calcVol(sets) {
    let total = 0, hasData = false;
    const detail = (sets||[]).map(s => {
      const r = parseInt(s.reps) || 0;
      const w = this._parseW(s.weight);
      const v = r * w;
      if (r > 0 && w > 0) hasData = true;
      total += v;
      return { r, w, v };
    });
    return { total, detail, hasData };
  },

  /**
   * Sprawdza rekordy i opcjonalnie je aktualizuje.
   *
   * mode='update' : wywołane przy wpisywaniu na żywo
   *   → aktualizuje records[key] jeśli aktualne wartości są wyższe
   *   → zwraca czy AKTUALNE wartości są rekordowe (>=)
   *
   * mode='check' : wywołane po usunięciu (po _rebuildAllRecords)
   *   → NIE modyfikuje records (już przeliczone)
   *   → tylko sprawdza czy aktualne wartości = rekordowi
   */
  _checkRec(name, sets, mode) {
    const key = (name||'').trim().toLowerCase();
    if (!key) return { badgeVol: false, badgePR: false };

    const { total, detail } = this._calcVol(sets);

    // Największy ciężar w pojedynczej serii (tego ćwiczenia dziś)
    const maxWToday = detail.reduce((max, d) => d.w > max ? d.w : max, 0);

    // Pobierz aktualny rekord (lub zerowy jeśli pierwszy raz)
    const rec = this.db.records[key] || { maxWeight: 0, maxVolume: 0 };

    if (mode === 'update') {
      let changed = false;
      // Rekord ciężaru: największy ciężar w jednej serii
      if (maxWToday > 0 && maxWToday > rec.maxWeight) {
        rec.maxWeight = maxWToday;
        changed = true;
      }
      // Rekord objętości: suma reps×kg całego ćwiczenia w jednym treningu
      if (total > 0 && total > rec.maxVolume) {
        rec.maxVolume = total;
        changed = true;
      }
      this.db.records[key] = rec;
      if (changed) DB.save(this.db);
    }

    // Pokaż badge gdy aktualna wartość >= rekordowi
    // (>= bo po zapisaniu rekordu chcemy widzieć badge przy ponownym otwarciu)
    const badgeVol = total > 0 && rec.maxVolume > 0 && total >= rec.maxVolume;
    const badgePR  = maxWToday > 0 && rec.maxWeight > 0 && maxWToday >= rec.maxWeight;

    return { badgeVol, badgePR };
  },

  /**
   * Przelicza wszystkie rekordy od zera na podstawie całej historii.
   * Wywoływane PO usunięciu treningu/ćwiczenia/serii.
   * Gwarantuje poprawność rekordów niezależnie od kolejności operacji.
   */
  _rebuildAllRecords() {
    const fresh = {};
    ['UBW','LBW','FBW'].forEach(plan => {
      Object.values(this.db.plans[plan].workouts || {}).forEach(workout => {
        (workout.exercises || []).forEach(ex => {
          const key = (ex.name||'').trim().toLowerCase();
          if (!key) return;
          const { total, detail } = this._calcVol(ex.sets||[]);
          const maxW = detail.reduce((m, d) => d.w > m ? d.w : m, 0);
          if (!fresh[key]) fresh[key] = { maxWeight: 0, maxVolume: 0 };
          if (maxW  > fresh[key].maxWeight) fresh[key].maxWeight = maxW;
          if (total > fresh[key].maxVolume) fresh[key].maxVolume = total;
        });
      });
    });
    this.db.records = fresh;
    DB.save(this.db);
  },

  /** Buduje pasek objętości pod tabelą serii */
  _buildVolBar(ex, idx, mode='update') {
    const sets = ex.sets || [];
    const { total, detail, hasData } = this._calcVol(sets);
    const bar = document.createElement('div');
    bar.className = 'volume-bar';

    // Brak danych – pokaż placeholder
    if (!hasData) {
      bar.innerHTML = `<div class="vol-header">
        <span class="vol-label vol-label--empty">Wpisz dane</span>
      </div>`;
      return bar;
    }

    const { badgeVol, badgePR } = this._checkRec(ex.name, sets, mode);

    // Badge OBJĘTOŚĆ – rekord sumy
    const volBadge = badgeVol
      ? `<span class="rec-badge rec-badge--vol">
           <img src="icons/icon-vol.svg" class="rec-icon" alt="Rekord objętości"/>
           OBJ
         </span>` : '';

    // Badge PR – rekord ciężaru w serii
    const prBadge = badgePR
      ? `<span class="rec-badge rec-badge--pr">
           <img src="icons/icon-pr.svg" class="rec-icon" alt="Personal Record"/>
           PR
         </span>` : '';

    // Wiersze serii ze sprawdzeniem
    const rowsHTML = detail.map((d, i) => {
      if (d.r === 0 && d.w === 0) {
        return `<div class="vol-row">
          <span class="vol-row-num">${i+1}</span>
          <span class="vol-row-empty">—</span>
        </div>`;
      }
      const res = d.v > 0
        ? `= <strong>${d.v.toLocaleString('pl-PL')} kg</strong>`
        : '= —';
      return `<div class="vol-row">
        <span class="vol-row-num">${i+1}</span>
        <span class="vol-row-calc">${d.r} × ${d.w} kg ${res}</span>
      </div>`;
    }).join('');

    bar.innerHTML = `
      <div class="vol-header">
        <span class="vol-label">
          <img src="icons/icon-vol.svg" class="vol-icon" alt="Objętość"/>
        </span>
        <span class="vol-total">
          ${total.toLocaleString('pl-PL')} kg
          ${volBadge}${prBadge}
        </span>
      </div>
      <div class="vol-rows">${rowsHTML}</div>`;
    return bar;
  },

  _refreshVol(card, exIdx) {
    if (!card) return;
    const ex  = this._cw().exercises[exIdx];
    const old = card.querySelector('.volume-bar');
    const nw  = this._buildVolBar(ex, exIdx, 'update');
    if (old) card.replaceChild(nw, old);
    else card.insertBefore(nw, card.querySelector('.exercise-footer'));
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

  /* ============================================================
     BODŹCE – tygodniowy wolumen mięśni
     ============================================================ */

  _currentWeekKey: null, // 'YYYY-Www' ISO week key

  openStimuli() {
    this._renderStimuliWeeks();
    this._show('screen-stimuli');
  },

  _showStimuliWeekBack() {
    this._show('screen-stimuli-week');
  },

  /** Zwraca ISO-week key: YYYY-Www */
  _isoWeekKey(dateStr) {
    const d = new Date(dateStr);
    const tmp = new Date(d);
    tmp.setHours(0,0,0,0);
    tmp.setDate(tmp.getDate() + 3 - (tmp.getDay()||7) + 1);
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const wn = 1 + Math.round(((tmp - week1) / 86400000 - 3 + (week1.getDay()||7)) / 7);
    return `${tmp.getFullYear()}-W${String(wn).padStart(2,'0')}`;
  },

  /** Zwraca pon i ndz dla tygodnia z danej daty */
  _weekBounds(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay() || 7; // 1=pon, 7=ndz
    const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { mon, sun };
  },

  /** Formatuje datę jako DD.MM */
  _fmtShort(date) {
    return String(date.getDate()).padStart(2,'0') + '.' + String(date.getMonth()+1).padStart(2,'0');
  },

  /**
   * Oblicza bodźce dla wszystkich tygodni.
   * Zwraca Map: weekKey → { label, mon, sun, muscles: {muscleName → {sets, exercises:[{name,sets,type}]}} }
   */
  _calcAllStimuli() {
    const weeks = new Map();

    ['UBW','LBW','FBW'].forEach(plan => {
      const workouts = this.db.plans[plan].workouts || {};
      Object.entries(workouts).forEach(([dateKey, workout]) => {
        const wk = this._isoWeekKey(dateKey);
        if (!weeks.has(wk)) {
          const { mon, sun } = this._weekBounds(dateKey);
          weeks.set(wk, {
            key: wk,
            label: `${this._fmtShort(mon)} – ${this._fmtShort(sun)}.${sun.getFullYear()}`,
            mon, sun,
            muscles: {}
          });
        }
        const week = weeks.get(wk);

        (workout.exercises || []).forEach(ex => {
          const muscles = getMuscles(ex.name);
          if (!muscles) return;
          const setCount = (ex.sets || []).length;

          Object.entries(muscles).forEach(([muscle, factor]) => {
            if (!week.muscles[muscle]) week.muscles[muscle] = { sets: 0, exercises: [] };
            const contribution = setCount * factor;
            week.muscles[muscle].sets += contribution;
            week.muscles[muscle].exercises.push({
              name: ex.name,
              sets: setCount,
              factor,
              contribution,
              plan,
              date: dateKey
            });
          });
        });
      });
    });

    // Posortuj tygodnie malejąco (najnowszy pierwszy)
    return new Map([...weeks.entries()].sort((a,b) => b[0].localeCompare(a[0])));
  },

  _renderStimuliWeeks() {
    const weeks = this._calcAllStimuli();
    const body = document.getElementById('stimuli-weeks-body');
    body.innerHTML = '';

    if (weeks.size === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Brak danych treningowych.</p></div>`;
      return;
    }

    weeks.forEach((week, wk) => {
      const totalSets = Object.values(week.muscles).reduce((s,m) => s + m.sets, 0);
      const muscleCount = Object.keys(week.muscles).length;

      const card = document.createElement('button');
      card.className = 'stimuli-week-card';
      card.innerHTML = `
        <div class="stimuli-week-info">
          <div class="stimuli-week-label">${week.label}</div>
          <div class="stimuli-week-meta">${muscleCount} partii · ${totalSets.toFixed(1)} serii łącznie</div>
        </div>
        <div class="stimuli-week-arrow">›</div>`;
      card.addEventListener('click', () => this._openStimuliWeek(wk, weeks.get(wk)));
      body.appendChild(card);
    });
  },

  _openStimuliWeek(wk, week) {
    this._currentWeekKey = wk;
    document.getElementById('stimuli-week-title').textContent = week.label;

    const body = document.getElementById('stimuli-week-body');
    body.innerHTML = '';

    // Kolejność partii
    const ORDER = [
      'Klatka góra','Klatka środek','Klatka dół',
      'Plecy górne','Plecy szerokie',
      'Bark przód','Bark bok','Bark tył',
      'Biceps','Triceps',
      'Czworogłowy','Dwugłowy uda','Pośladki','Łydki','Brzuch'
    ];

    // Rekomendacje serii tygodniowych (dla redukcji)
    const REC = {
      'Klatka góra':10,'Klatka środek':10,'Klatka dół':6,
      'Plecy górne':10,'Plecy szerokie':10,
      'Bark przód':6,'Bark bok':8,'Bark tył':8,
      'Biceps':6,'Triceps':6,
      'Czworogłowy':8,'Dwugłowy uda':8,'Pośladki':10,'Łydki':4,'Brzuch':4
    };

    const isUpper = ['Klatka góra','Klatka środek','Klatka dół','Plecy górne','Plecy szerokie','Bark przód','Bark bok','Bark tył','Biceps','Triceps'];

    // Sekcje
    let lastSection = null;
    ORDER.forEach(muscle => {
      const data = week.muscles[muscle];
      const sets = data ? data.sets : 0;
      const rec  = REC[muscle] || 8;
      const pct  = Math.min(sets / rec, 1);
      const section = isUpper.includes(muscle) ? 'GÓRA' : 'DÓŁ';

      if (section !== lastSection) {
        const lbl = document.createElement('div');
        lbl.className = `stimuli-section-label stimuli-section-label--${section === 'GÓRA' ? 'upper' : 'lower'}`;
        lbl.textContent = section === 'GÓRA' ? 'GÓRA CIAŁA' : 'DÓŁ CIAŁA';
        body.appendChild(lbl);
        lastSection = section;
      }

      const row = document.createElement('button');
      row.className = 'stimuli-muscle-row';
      row.disabled = sets === 0;

      // Kolor paska
      let barColor = '#FF453A'; // czerwony < 50%
      if (pct >= 1)   barColor = '#30D158'; // zielony = 100%
      else if (pct >= 0.5) barColor = '#FF9F0A'; // pomarańczowy 50-99%

      row.innerHTML = `
        <div class="stimuli-muscle-name">${muscle}</div>
        <div class="stimuli-muscle-right">
          <div class="stimuli-bar-wrap">
            <div class="stimuli-bar" style="width:${(pct*100).toFixed(0)}%;background:${barColor};"></div>
          </div>
          <div class="stimuli-sets-num" style="color:${barColor};">${sets > 0 ? sets.toFixed(1) : '0'}</div>
          <div class="stimuli-rec">/ ${rec}</div>
          <div class="stimuli-arrow">${sets > 0 ? '›' : ''}</div>
        </div>`;

      if (sets > 0) {
        row.addEventListener('click', () => this._openStimuliMuscle(muscle, data, week.label));
      }
      body.appendChild(row);
    });

    const note = document.createElement('div');
    note.className = 'stimuli-note';
    note.textContent = 'Liczby po prawej: Twoje serie / rekomendacja tygodniowa (redukcja)';
    body.appendChild(note);

    this._show('screen-stimuli-week');
  },

  _openStimuliMuscle(muscle, data, weekLabel) {
    document.getElementById('stimuli-muscle-title').textContent = muscle;
    const body = document.getElementById('stimuli-muscle-body');
    body.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'stimuli-muscle-header';
    header.innerHTML = `<span class="stimuli-muscle-week">${weekLabel}</span>
      <span class="stimuli-muscle-total">${data.sets.toFixed(1)} serii łącznie</span>`;
    body.appendChild(header);

    // Grupuj po ćwiczeniu
    const byEx = {};
    data.exercises.forEach(e => {
      const k = e.name;
      if (!byEx[k]) byEx[k] = { name:e.name, contribution:0, sets:e.sets, factor:e.factor, dates:[] };
      byEx[k].contribution += e.contribution;
      byEx[k].dates.push({ plan:e.plan, date:e.date });
    });

    Object.values(byEx).forEach(ex => {
      const typeLabel = ex.factor === 1 ? 'główna' : 'pomocnicza';
      const typeClass = ex.factor === 1 ? 'type--main' : 'type--aux';
      const card = document.createElement('div');
      card.className = 'stimuli-ex-card';
      const datesHTML = ex.dates.map(d =>
        `<span class="stimuli-ex-date">${d.plan} · ${this._fmt(d.date)}</span>`
      ).join('');
      card.innerHTML = `
        <div class="stimuli-ex-top">
          <span class="stimuli-ex-name">${this._esc(ex.name)}</span>
          <span class="stimuli-ex-type ${typeClass}">${typeLabel}</span>
        </div>
        <div class="stimuli-ex-detail">
          ${ex.sets} serii × ${ex.factor} = <strong>${ex.contribution.toFixed(1)}</strong> serii efektywnych
        </div>
        <div class="stimuli-ex-dates">${datesHTML}</div>`;
      body.appendChild(card);
    });

    this._show('screen-stimuli-muscle');
  },

  /* ============================================================
     ĆWICZENIA – baza wg partii mięśniowych
     ============================================================ */

  // Baza ćwiczeń wg grup mięśniowych
  _exerciseDB: {
    'KLATKA PIERSIOWA GÓRA': [
      'Wyciskanie hantli na ławce skośnej (górna)',
      'Wyciskanie sztangi na skośnej',
      'Rozpiętki na skośnej',
      'Rozpiętki na bramie (ustawienie dolne — wyciągi nisko)',
      'Pompki ze stopami uniesionymi',
    ],
    'KLATKA PIERSIOWA ŚRODEK': [
      'Wyciskanie sztangi na płaskiej',
      'Wyciskanie hantli na płaskiej',
      'Rozpiętki z hantlami na płaskiej',
      'Rozpiętki na bramie (ustawienie środkowe)',
      'Pompki klasyczne',
      'Butterfly (peck deck)',
    ],
    'KLATKA PIERSIOWA DÓŁ': [
      'Wyciskanie na ławce ujemnej',
      'Rozpiętki na ławce ujemnej',
      'Rozpiętki na bramie (ustawienie górne — wyciągi wysoko)',
      'Dips (dipy)',
    ],
    'PLECY GÓRNE': [
      'Wiosłowanie sztangą',
      'Wiosłowanie hantlem jednoręcznie',
      'Wiosłowanie na wyciągu (seated row)',
      'Wiosłowanie wąskim chwytem',
      'Face pull',
      'Wznosy ramion w tył (rear delt row)',
    ],
    'PLECY SZEROKIE': [
      'Podciąganie na drążku',
      'Ściąganie drążka (lat pulldown)',
      'Ściąganie drążka wąskim chwytem',
      'Martwy ciąg',
      'Pullover z hantlem',
    ],
    'BARK PRZÓD': [
      'Military press (sztanga)',
      'Wyciskanie hantli nad głowę',
      'Wznosy hantli przed siebie',
      'Wyciskanie Arnolda',
    ],
    'BARK BOK': [
      'Odwodzenie ramion (lateral raise)',
      'Lateral raise na wyciągu',
      'Upright row',
    ],
    'BARK TYŁ': [
      'Tylna głowa barku na butterfly',
      'Wznosy hantli w opadzie tułowia',
      'Face pull',
      'Odwodzenie ramion w tył na wyciągu',
    ],
    'BICEPS': [
      'Uginanie ramion ze sztangą',
      'Uginanie ramion na modlitewniku',
      'Uginanie ramion z hantlami naprzemiennie',
      'Uginanie ramion na wyciągu',
      'Uginanie ramion młotkowe (hammer curl)',
    ],
    'TRICEPS': [
      'Triceps na wyciągu (pushdown)',
      'Triceps na wyciągu górnym (overhead)',
      'Wąskie wyciskanie sztangi',
      'French press',
      'Dips (dipy)',
      'Kickback z hantlem',
    ],
    'CZWOROGŁOWY UDA': [
      'Przysiad ze sztangą',
      'Suwnica (leg press)',
      'Prostowanie nóg na maszynie',
      'Hack squat',
      'Wykroki chodzone',
      'Wykroki bułgarskie',
    ],
    'DWUGŁOWY UDA': [
      'RDL jednonóż',
      'RDL obunoż',
      'Uginanie nóg na maszynie (leżąc)',
      'Uginanie nóg na maszynie (siedzenie)',
      'Ball leg curl jednonóż',
      'Nordic curl',
    ],
    'POŚLADKI': [
      'Hip thrusty',
      'Hip thrust jednonóż',
      'Glute bridge',
      'Suwnica izometryczna obunoż',
      'Odwodzenie nogi na maszynie',
      'Cable kickback',
      'RDL jednonóż',
    ],
    'ŁYDKI': [
      'Seated calf raise',
      'Wspięcia na palce stojąc',
      'Wspięcia na palce na suwnicy',
      'Donkey calf raise',
    ],
  },

  _currentExGroup: null,  // aktualnie wybrana grupa
  _currentExName:  null,  // aktualnie wybrane ćwiczenie
  _currentExPlan:  null,  // wybrany plan (UBW/LBW/FBW)

  openExercises() {
    this._show('screen-exercises');
  },

  openExGroup(group) {
    this._currentExGroup = group;
    document.getElementById('ex-list-title').textContent = group;
    const exercises = this._exerciseDB[group] || [];
    const body = document.getElementById('ex-list-body');
    body.innerHTML = '';

    const isUpper = !['CZWOROGŁOWY UDA','DWUGŁOWY UDA','POŚLADKI','ŁYDKI'].includes(group);

    exercises.forEach(exName => {
      const btn = document.createElement('button');
      btn.className = `ex-item-btn ex-item-btn--${isUpper ? 'upper' : 'lower'}`;
      btn.innerHTML = `<span class="ex-item-name">${this._esc(exName)}</span><span class="ex-item-arrow">›</span>`;
      btn.addEventListener('click', () => this._selectExercise(exName));
      body.appendChild(btn);
    });

    this._show('screen-ex-list');
  },

  _selectExercise(exName) {
    this._currentExName = exName;
    document.getElementById('ex-plan-title').textContent = this._esc(exName);
    document.getElementById('modal-ex-plan').style.display = 'flex';
  },

  closeExPlanModal(e) {
    if (e && e.target !== document.getElementById('modal-ex-plan')) return;
    document.getElementById('modal-ex-plan').style.display = 'none';
  },

  selectExPlan(plan) {
    this._currentExPlan = plan;
    document.getElementById('modal-ex-plan').style.display = 'none';
    // Otwórz modal daty
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ex-date-input').value = today;
    document.getElementById('ex-date-title').textContent = `${this._currentExName}`;
    document.getElementById('ex-date-desc').textContent =
      `Plan: ${plan} · Wybierz datę treningu:`;
    document.getElementById('modal-ex-date').style.display = 'flex';
  },

  closeExDateModal(e) {
    if (e && e.target !== document.getElementById('modal-ex-date')) return;
    document.getElementById('modal-ex-date').style.display = 'none';
  },

  confirmExDate() {
    const dk = document.getElementById('ex-date-input').value;
    if (!dk) { this._toast('Wybierz datę'); return; }

    const plan = this._currentExPlan;
    const exName = this._currentExName;
    const ws = this.db.plans[plan].workouts;

    // Utwórz trening jeśli nie istnieje
    if (!ws[dk]) ws[dk] = { exercises: [] };

    // Dodaj ćwiczenie jeśli jeszcze nie ma
    const exists = ws[dk].exercises.some(
      e => e.name.trim().toLowerCase() === exName.trim().toLowerCase()
    );
    if (!exists) {
      ws[dk].exercises.push({ name: exName, superSet: false, sets: [{ reps:'', weight:'', note:'' }] });
    }
    DB.save(this.db);

    document.getElementById('modal-ex-date').style.display = 'none';
    this._toast(`Dodano do ${plan} · ${this._fmt(dk)}`);

    // Przejdź do treningu
    this.plan = plan;
    this._renderPlan();
    this.openWorkout(dk);
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
