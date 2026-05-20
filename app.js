/**
 * ============================================================
 *  TRENING PWA – app.js
 *  UBW / LBW / FBW + Szablony + Eksport tekstowy
 *  Serie: osobne pola reps (powtórzenia) i weight (ciężar)
 * ============================================================
 */

'use strict';

/* ============================================================
   PREDEFINIOWANE SZABLONY – wbudowane w kod
   Zawsze dostępne, niezależnie od danych w localStorage.
   ID zaczyna się od "builtin_" – rozróżnia je od szablonów użytkownika.
   ============================================================ */
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin_lbw',
    name: 'LBW – Trening nóg',
    planType: 'LBW',
    builtin: true,
    exercises: [
      { name: 'Wykroki chodzone',        sets: 3 },
      { name: 'Hip thrusty',             sets: 3 },
      { name: 'Ball leg curl',           sets: 2 },
      { name: 'Suwnica izometryczna',    sets: 3 },
      { name: 'Uginanie nóg na maszynie',sets: 3 },
      { name: 'Seated calf raise',       sets: 3 },
    ]
  },
  {
    id: 'builtin_ubw',
    name: 'UBW – Trening górny',
    planType: 'UBW',
    builtin: true,
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
    id: 'builtin_fbw',
    name: 'FBW – Full Body',
    planType: 'FBW',
    builtin: true,
    exercises: [
      { name: 'Wyciskanie hantli na ławce skośnej',  sets: 3 },
      { name: 'Ściąganie drążka',                    sets: 3 },
      { name: 'Odwodzenie ramion (lateral raise)',   sets: 3 },
      { name: 'Tylna głowa barku na butterfly',      sets: 3 },
      { name: 'Triceps na wyciągu górnym',           sets: 3 },
      { name: 'Prostowanie nóg na maszynie',         sets: 3 },
      { name: 'Wspięcia na palce stojąc',            sets: 3 },
      { name: 'RDL jednonóż',                        sets: 3 },
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
      // Migracja starych serii: {weight: "10 x 30 kg"} → {reps: "", weight: "10 x 30 kg"}
      ['UBW','LBW','FBW'].forEach(plan => {
        const workouts = db.plans[plan]?.workouts || {};
        Object.values(workouts).forEach(w => {
          (w.exercises || []).forEach(ex => {
            (ex.sets || []).forEach(set => {
              if (!('reps' in set)) set.reps = '';
            });
          });
        });
      });
      return db;
    } catch {
      return this._defaultDB();
    }
  },

  save(db) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(db));
    } catch (e) {
      console.error('Błąd zapisu:', e);
    }
  },

  _defaultDB() {
    return {
      plans: {
        UBW: { workouts: {} },
        LBW: { workouts: {} },
        FBW: { workouts: {} }
      },
      templates: []
    };
  }
};

/* ============================================================
   APP
   ============================================================ */
const App = {
  currentPlan:        null,
  currentDate:        null,
  db:                 null,
  _toastTimer:        null,
  _pendingConfirm:    null,
  _copySourceDate:    null,
  _editingTemplateId: null,
  _useTemplateId:     null,
  // Przeciąganie ćwiczeń
  _drag: { active: false, srcIdx: null, overIdx: null, startY: 0, card: null, clone: null },

  /* ============================================================
     INICJALIZACJA
     ============================================================ */
  init() {
    this.db = Storage.load();
    this._injectBuiltinTemplates();
    this._registerServiceWorker();
    this._showScreen('screen-home');
  },

  /**
   * Wstrzykuje wbudowane szablony do bazy jeśli ich tam nie ma.
   * Identyfikowane po id zaczynającym się od "builtin_".
   * Nie nadpisuje szablonów użytkownika o tym samym id.
   */
  _injectBuiltinTemplates() {
    const existing = new Set((this.db.templates || []).map(t => t.id));
    let added = false;
    BUILTIN_TEMPLATES.forEach(tpl => {
      if (!existing.has(tpl.id)) {
        this.db.templates.unshift({ ...tpl }); // wstaw na początek listy
        added = true;
      }
    });
    if (added) Storage.save(this.db);
  },

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .catch(err => console.warn('SW:', err));
    }
  },

  /* ============================================================
     NAWIGACJA
     ============================================================ */
  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
  },

  goHome() {
    this.currentPlan = null;
    this.currentDate = null;
    this._showScreen('screen-home');
  },

  goToPlan() {
    this.currentDate = null;
    this._renderPlanScreen();
    this._showScreen('screen-plan');
  },

  openPlan(planName) {
    this.currentPlan = planName;
    this._renderPlanScreen();
    this._showScreen('screen-plan');
  },

  /* ============================================================
     EKRAN PLANU – lista dat
     ============================================================ */
  _renderPlanScreen() {
    document.getElementById('plan-title').textContent = this.currentPlan;

    const workouts = this.db.plans[this.currentPlan].workouts;
    const dates    = Object.keys(workouts).sort((a, b) => b.localeCompare(a));
    const list     = document.getElementById('dates-list');
    const empty    = document.getElementById('dates-empty');
    list.innerHTML = '';

    if (dates.length === 0) {
      list.style.display  = 'none';
      empty.style.display = 'flex';
      return;
    }
    list.style.display  = 'flex';
    empty.style.display = 'none';

    dates.forEach(dateKey => {
      const workout = workouts[dateKey];
      const exCount = (workout.exercises || []).length;
      const card    = document.createElement('div');
      card.className = 'date-card';
      card.innerHTML = `
        <div class="date-card__main" onclick="App.openWorkout('${dateKey}')">
          <div class="date-card__icon">📅</div>
          <div class="date-card__info">
            <div class="date-card__date">${this._formatDate(dateKey)}</div>
            <div class="date-card__meta">${exCount === 0 ? 'Brak ćwiczeń' : exCount + ' ' + this._plural(exCount,'ćwiczenie','ćwiczenia','ćwiczeń')}</div>
          </div>
        </div>
        <div class="date-card__arrow" onclick="App.openWorkout('${dateKey}')">›</div>
        <div class="date-card__actions">
          <button class="date-card__export" onclick="App.openExport('${dateKey}')" title="Eksportuj trening">✏️</button>
          <button class="date-card__copy"   onclick="App.openCopyModal('${dateKey}')">KOPIUJ</button>
          <button class="date-card__delete" onclick="App._confirmDeleteDate('${dateKey}')">✕</button>
        </div>`;
      list.appendChild(card);
    });
  },

  /* ============================================================
     DODAJ DATĘ
     ============================================================ */
  addDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date-input').value = today;
    document.getElementById('modal-date').style.display = 'flex';
  },

  confirmAddDate() {
    const dateKey = document.getElementById('date-input').value;
    if (!dateKey) { this._toast('Wybierz datę treningu'); return; }
    const workouts = this.db.plans[this.currentPlan].workouts;
    if (!workouts[dateKey]) {
      workouts[dateKey] = { exercises: [] };
      Storage.save(this.db);
    }
    this.closeDateModal();
    this.openWorkout(dateKey);
  },

  closeDateModal(event) {
    if (event && event.target !== document.getElementById('modal-date')) return;
    document.getElementById('modal-date').style.display = 'none';
  },

  /* ============================================================
     USUŃ DATĘ
     ============================================================ */
  _confirmDeleteDate(dateKey) {
    this._pendingConfirm = () => {
      delete this.db.plans[this.currentPlan].workouts[dateKey];
      Storage.save(this.db);
      this._renderPlanScreen();
      this._toast('Trening usunięty');
    };
    document.getElementById('confirm-title').textContent = 'Usuń trening';
    document.getElementById('confirm-desc').textContent  =
      `Czy na pewno chcesz usunąć trening z dnia ${this._formatDate(dateKey)}?`;
    document.getElementById('confirm-btn').onclick = () => {
      this._pendingConfirm && this._pendingConfirm();
      this.closeConfirmModal();
    };
    document.getElementById('modal-confirm').style.display = 'flex';
  },

  closeConfirmModal(event) {
    if (event && event.target !== document.getElementById('modal-confirm')) return;
    document.getElementById('modal-confirm').style.display = 'none';
    this._pendingConfirm = null;
  },

  /* ============================================================
     EKSPORT TEKSTOWY
     ============================================================ */
  openExport(dateKey) {
    const workout = this.db.plans[this.currentPlan].workouts[dateKey];
    if (!workout) return;

    // Buduj tekst eksportu
    const lines = [];
    lines.push(`${this.currentPlan} – ${this._formatDate(dateKey)}`);
    lines.push('═'.repeat(32));

    (workout.exercises || []).forEach((ex, i) => {
      lines.push(`\n${i + 1}. ${ex.name || '(bez nazwy)'}`);
      let exTotal = 0;
      (ex.sets || []).forEach((set, si) => {
        const reps   = set.reps   || '–';
        const weight = set.weight || '–';
        const vol    = this._calcVolume([set]);
        const volStr = vol.hasData ? ` → ${vol.total.toLocaleString('pl-PL')} kg` : '';
        lines.push(`   Seria ${si + 1}: ${reps} powt. × ${weight}${volStr}`);
        exTotal += vol.total;
      });
      if (exTotal > 0) {
        lines.push(`   ─ Objętość: ${exTotal.toLocaleString('pl-PL')} kg`);
      }
    });

    if ((workout.exercises || []).length === 0) {
      lines.push('\n(brak ćwiczeń)');
    }

    lines.push('\n' + '─'.repeat(32));
    lines.push(`Eksport: ${new Date().toLocaleString('pl-PL')}`);

    document.getElementById('export-text').value = lines.join('\n');
    document.getElementById('export-title').textContent =
      `${this.currentPlan} · ${this._formatDate(dateKey)}`;
    document.getElementById('modal-export').style.display = 'flex';
  },

  closeExportModal(event) {
    if (event && event.target !== document.getElementById('modal-export')) return;
    document.getElementById('modal-export').style.display = 'none';
  },

  copyExportText() {
    const ta = document.getElementById('export-text');
    ta.select();
    ta.setSelectionRange(0, 99999); // mobile
    try {
      // Nowoczesne API
      navigator.clipboard.writeText(ta.value).then(() => {
        this._toast('Skopiowano do schowka ✓');
      }).catch(() => {
        // Fallback
        document.execCommand('copy');
        this._toast('Skopiowano do schowka ✓');
      });
    } catch {
      document.execCommand('copy');
      this._toast('Skopiowano do schowka ✓');
    }
  },

  selectAllExport() {
    const ta = document.getElementById('export-text');
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, 99999);
  },

  /* ============================================================
     EKRAN TRENINGU – ćwiczenia
     ============================================================ */
  openWorkout(dateKey) {
    this.currentDate = dateKey;
    document.getElementById('workout-title').textContent     = this.currentPlan;
    document.getElementById('workout-date-label').textContent =
      this.currentPlan + ' · ' + this._formatDate(dateKey);
    this._renderWorkout();
    this._showScreen('screen-workout');
  },

  _renderWorkout() {
    const workout   = this._currentWorkout();
    const exercises = workout.exercises || [];
    const container = document.getElementById('exercises-container');
    const empty     = document.getElementById('exercises-empty');
    container.innerHTML = '';

    if (exercises.length === 0) {
      container.style.display = 'none';
      empty.style.display     = 'flex';
      return;
    }
    container.style.display = 'flex';
    empty.style.display     = 'none';
    exercises.forEach((ex, i) => container.appendChild(this._buildExerciseCard(ex, i)));
  },

  /* ============================================================
     KARTA ĆWICZENIA
     ============================================================ */
  _buildExerciseCard(exercise, exIndex) {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.dataset.exIndex = exIndex;

    // --- nagłówek ---
    const header = document.createElement('div');
    header.className = 'exercise-header';

    // Uchwyt do przeciągania
    const dragHandle = document.createElement('div');
    dragHandle.className   = 'drag-handle';
    dragHandle.innerHTML   = '⠿';
    dragHandle.title       = 'Przeciągnij, żeby zmienić kolejność';
    this._attachDragHandle(dragHandle, exIndex);

    header.appendChild(dragHandle);
    header.innerHTML += `<span class="exercise-number">Ćw. ${exIndex + 1}</span>`;
    // przywróć dragHandle (innerHTML skasowało referencję)
    header.insertBefore(dragHandle, header.firstChild);

    const nameInput = document.createElement('input');
    nameInput.type        = 'text';
    nameInput.className   = 'exercise-name-input';
    nameInput.placeholder = 'Nazwa ćwiczenia…';
    nameInput.value       = exercise.name || '';
    nameInput.addEventListener('change', () => {
      this._currentWorkout().exercises[exIndex].name = nameInput.value.trim();
      Storage.save(this.db);
    });

    const delBtn = document.createElement('button');
    delBtn.className   = 'exercise-delete-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => this._confirmDeleteExercise(exIndex));

    header.appendChild(nameInput);
    header.appendChild(delBtn);
    card.appendChild(header);

    // --- tabela serii ---
    const table = document.createElement('div');
    table.className = 'sets-table';
    const th = document.createElement('div');
    th.className = 'sets-table-header';
    th.innerHTML = '<span>SERIA</span><span>POWT.</span><span>CIĘŻAR</span>';
    table.appendChild(th);
    (exercise.sets || []).forEach((set, si) =>
      table.appendChild(this._buildSetRow(set, exIndex, si, table))
    );
    card.appendChild(table);

    // --- pasek objętości ---
    card.appendChild(this._buildVolumeBar(exercise.sets || []));

    // --- stopka ---
    const footer = document.createElement('div');
    footer.className = 'exercise-footer';
    const addSetBtn = document.createElement('button');
    addSetBtn.className = 'btn-add-set';
    addSetBtn.innerHTML = '<span>+</span> Dodaj serię';
    addSetBtn.addEventListener('click', () => this.addSet(exIndex));
    footer.appendChild(addSetBtn);
    card.appendChild(footer);

    return card;
  },

  /* ============================================================
     DRAG & DROP – zmiana kolejności ćwiczeń
     Działa na mobile (touch) i desktopie (mouse).
     ============================================================ */
  _attachDragHandle(handle, exIndex) {
    // Touch (iPhone)
    handle.addEventListener('touchstart', e => this._onDragStart(e, exIndex, true),  { passive: false });
    // Mouse (desktop)
    handle.addEventListener('mousedown',  e => this._onDragStart(e, exIndex, false), { passive: false });
  },

  _onDragStart(e, srcIdx, isTouch) {
    e.preventDefault();
    const card = e.currentTarget.closest('.exercise-card');
    if (!card) return;

    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const rect    = card.getBoundingClientRect();

    // Klon wizualny – "duch" przeciąganej karty
    const clone = card.cloneNode(true);
    clone.className          = 'exercise-card exercise-card--drag-ghost';
    clone.style.width        = rect.width + 'px';
    clone.style.top          = rect.top + window.scrollY + 'px';
    clone.style.left         = rect.left + 'px';
    document.body.appendChild(clone);

    card.classList.add('exercise-card--dragging');

    this._drag = {
      active: true,
      srcIdx,
      overIdx: srcIdx,
      startY:  clientY,
      offsetY: clientY - rect.top,
      card,
      clone,
      isTouch
    };

    if (isTouch) {
      document.addEventListener('touchmove', this._boundDragMove  = e => this._onDragMove(e, true),  { passive: false });
      document.addEventListener('touchend',  this._boundDragEnd   = e => this._onDragEnd(e, true),   { passive: false });
    } else {
      document.addEventListener('mousemove', this._boundDragMove  = e => this._onDragMove(e, false));
      document.addEventListener('mouseup',   this._boundDragEnd   = e => this._onDragEnd(e, false));
    }
  },

  _onDragMove(e, isTouch) {
    if (!this._drag.active) return;
    e.preventDefault();

    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    const d       = this._drag;

    // Porusz klonem
    d.clone.style.top = (clientY - d.offsetY + window.scrollY) + 'px';

    // Znajdź nad którą kartą jesteśmy
    const container = document.getElementById('exercises-container');
    const cards     = Array.from(container.querySelectorAll('.exercise-card:not(.exercise-card--drag-ghost)'));
    let overIdx = d.srcIdx;
    cards.forEach((c, i) => {
      const r   = c.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (clientY > mid) overIdx = parseInt(c.dataset.exIndex ?? i);
    });

    if (overIdx !== d.overIdx) {
      // Wyczyść stare podświetlenie
      cards.forEach(c => c.classList.remove('exercise-card--drop-above', 'exercise-card--drop-below'));

      // Podświetl cel
      if (overIdx !== d.srcIdx) {
        const targetCard = cards.find(c => parseInt(c.dataset.exIndex) === overIdx);
        if (targetCard) {
          targetCard.classList.add(
            overIdx < d.srcIdx ? 'exercise-card--drop-above' : 'exercise-card--drop-below'
          );
        }
      }
      d.overIdx = overIdx;
    }
  },

  _onDragEnd(e, isTouch) {
    if (!this._drag.active) return;
    const d = this._drag;

    // Usuń listenery
    if (isTouch) {
      document.removeEventListener('touchmove', this._boundDragMove);
      document.removeEventListener('touchend',  this._boundDragEnd);
    } else {
      document.removeEventListener('mousemove', this._boundDragMove);
      document.removeEventListener('mouseup',   this._boundDragEnd);
    }

    // Posprzątaj DOM
    d.clone.remove();
    d.card.classList.remove('exercise-card--dragging');
    document.querySelectorAll('.exercise-card--drop-above, .exercise-card--drop-below')
      .forEach(c => c.classList.remove('exercise-card--drop-above', 'exercise-card--drop-below'));

    const srcIdx  = d.srcIdx;
    const destIdx = d.overIdx;
    this._drag = { active: false };

    // Przesuń ćwiczenie w danych
    if (srcIdx !== destIdx) {
      const exercises = this._currentWorkout().exercises;
      const [moved]   = exercises.splice(srcIdx, 1);
      exercises.splice(destIdx, 0, moved);
      Storage.save(this.db);
      this._renderWorkout();
    }
  },

  /* ============================================================
     OBLICZANIE OBJĘTOŚCI
     ============================================================ */

  /**
   * Parsuje ciężar z pola tekstowego → liczba kg.
   * Obsługuje: "75", "75 kg", "75.5", "75,5", "75kg".
   * Zwraca 0 jeśli nie można sparsować.
   */
  _parseWeight(str) {
    if (!str) return 0;
    // usuń jednostki, zamień przecinek na kropkę
    const cleaned = String(str)
      .replace(/[kK][gG]?/g, '')   // kg, Kg, KG, k
      .replace(',', '.')
      .trim();
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  },

  /**
   * Oblicza objętość jednego ćwiczenia (suma reps × weight).
   * Zwraca obiekt { total, sets, hasData }
   * sets = tablica { reps, weight, vol } dla każdej serii
   */
  _calcVolume(sets) {
    let total   = 0;
    let hasData = false;
    const detail = (sets || []).map(set => {
      const reps   = parseInt(set.reps)          || 0;
      const weight = this._parseWeight(set.weight);
      const vol    = reps * weight;
      if (reps > 0 && weight > 0) hasData = true;
      total += vol;
      return { reps, weight, vol };
    });
    return { total, sets: detail, hasData };
  },

  /** Buduje wizualny pasek objętości pod tabelą serii */
  _buildVolumeBar(sets) {
    const { total, sets: detail, hasData } = this._calcVolume(sets);

    const bar = document.createElement('div');
    bar.className = 'volume-bar';

    if (!hasData) {
      bar.innerHTML = `
        <div class="volume-bar__label">OBJĘTOŚĆ</div>
        <div class="volume-bar__empty">Wpisz powtórzenia i ciężar</div>`;
      return bar;
    }

    // Szczegółowe wiersze
    const rowsHTML = detail
      .map((s, i) => {
        if (s.reps === 0 && s.weight === 0) {
          return `<div class="volume-detail__row">
            <span class="volume-detail__num">${i + 1}</span>
            <span class="volume-detail__calc volume-detail__empty">—</span>
          </div>`;
        }
        // Sprawdzenie: wyświetl wyrażenie i wynik
        const expr = `${s.reps} × ${s.weight} kg`;
        const res  = s.vol > 0 ? `= ${s.vol.toLocaleString('pl-PL')} kg` : '= —';
        return `<div class="volume-detail__row">
          <span class="volume-detail__num">${i + 1}</span>
          <span class="volume-detail__calc">${expr} <span class="volume-detail__result">${res}</span></span>
        </div>`;
      })
      .join('');

    bar.innerHTML = `
      <div class="volume-bar__header">
        <div class="volume-bar__label">OBJĘTOŚĆ</div>
        <div class="volume-bar__total">${total.toLocaleString('pl-PL')} kg</div>
      </div>
      <div class="volume-detail">${rowsHTML}</div>`;

    return bar;
  },

  /**
   * Aktualizuje pasek objętości na żywo, bez przebudowy całej karty.
   * Wywołuje się po każdej zmianie reps/weight w danej karcie.
   */
  _refreshVolumeBar(card, exIndex) {
    const sets  = this._currentWorkout().exercises[exIndex]?.sets || [];
    const oldBar = card.querySelector('.volume-bar');
    const newBar = this._buildVolumeBar(sets);
    if (oldBar) card.replaceChild(newBar, oldBar);
    else card.insertBefore(newBar, card.querySelector('.exercise-footer'));
  },

  /* ============================================================
     WIERSZ SERII – dwa pola: reps + weight
     ============================================================ */
  _buildSetRow(set, exIndex, setIndex, tableRef) {
    const row = document.createElement('div');
    row.className = 'set-row';

    // numer serii
    const num = document.createElement('div');
    num.className   = 'set-number';
    num.textContent = setIndex + 1;

    // pole: powtórzenia
    const repsInput = document.createElement('input');
    repsInput.type        = 'number';
    repsInput.inputMode   = 'numeric';
    repsInput.className   = 'set-reps-input';
    repsInput.placeholder = 'np. 10';
    repsInput.min         = '0';
    repsInput.value       = set.reps || '';
    repsInput.addEventListener('input', () => {
      this._currentWorkout().exercises[exIndex].sets[setIndex].reps = repsInput.value.trim();
      Storage.save(this.db);
      // Aktualizuj objętość na żywo
      const card = repsInput.closest('.exercise-card');
      if (card) this._refreshVolumeBar(card, exIndex);
    });

    // separator ×
    const sep = document.createElement('span');
    sep.className   = 'set-separator';
    sep.textContent = '×';

    // pole: ciężar
    const weightInput = document.createElement('input');
    weightInput.type        = 'text';
    weightInput.inputMode   = 'decimal';
    weightInput.className   = 'set-weight-input';
    weightInput.placeholder = 'kg';
    weightInput.value       = set.weight || '';
    weightInput.addEventListener('input', () => {
      this._currentWorkout().exercises[exIndex].sets[setIndex].weight = weightInput.value.trim();
      Storage.save(this.db);
      // Aktualizuj objętość na żywo
      const card = weightInput.closest('.exercise-card');
      if (card) this._refreshVolumeBar(card, exIndex);
    });

    // przycisk usuń serię
    const del = document.createElement('button');
    del.className   = 'set-delete-btn';
    del.textContent = '−';
    del.addEventListener('click', () => this.deleteSet(exIndex, setIndex));

    row.appendChild(num);
    row.appendChild(repsInput);
    row.appendChild(sep);
    row.appendChild(weightInput);
    row.appendChild(del);
    return row;
  },

  addExercise() {
    const workout = this._currentWorkout();
    workout.exercises.push({ name: '', sets: [{ reps: '', weight: '' }] });
    Storage.save(this.db);

    document.getElementById('exercises-empty').style.display = 'none';
    const container = document.getElementById('exercises-container');
    container.style.display = 'flex';

    const idx  = workout.exercises.length - 1;
    const card = this._buildExerciseCard(workout.exercises[idx], idx);
    container.appendChild(card);

    setTimeout(() => card.querySelector('.exercise-name-input')?.focus(), 80);
    setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  },

  _confirmDeleteExercise(exIndex) {
    const name = this._currentWorkout().exercises[exIndex]?.name || `Ćwiczenie ${exIndex + 1}`;
    this._pendingConfirm = () => {
      this._currentWorkout().exercises.splice(exIndex, 1);
      Storage.save(this.db);
      this._renderWorkout();
      this._toast('Ćwiczenie usunięte');
    };
    document.getElementById('confirm-title').textContent = 'Usuń ćwiczenie';
    document.getElementById('confirm-desc').textContent  = `Czy na pewno usunąć "${name}"?`;
    document.getElementById('confirm-btn').onclick = () => {
      this._pendingConfirm && this._pendingConfirm();
      this.closeConfirmModal();
    };
    document.getElementById('modal-confirm').style.display = 'flex';
  },

  addSet(exIndex) {
    this._currentWorkout().exercises[exIndex].sets.push({ reps: '', weight: '' });
    Storage.save(this.db);

    const container = document.getElementById('exercises-container');
    const oldCard   = container.querySelectorAll('.exercise-card')[exIndex];
    const newCard   = this._buildExerciseCard(this._currentWorkout().exercises[exIndex], exIndex);
    container.replaceChild(newCard, oldCard);

    // fokus na polu reps ostatniej serii
    const repsInputs = newCard.querySelectorAll('.set-reps-input');
    setTimeout(() => repsInputs[repsInputs.length - 1]?.focus(), 60);
  },

  deleteSet(exIndex, setIndex) {
    const sets = this._currentWorkout().exercises[exIndex].sets;
    if (sets.length <= 1) { this._toast('Minimalna liczba serii to 1'); return; }
    sets.splice(setIndex, 1);
    Storage.save(this.db);

    const container = document.getElementById('exercises-container');
    const oldCard   = container.querySelectorAll('.exercise-card')[exIndex];
    const newCard   = this._buildExerciseCard(this._currentWorkout().exercises[exIndex], exIndex);
    container.replaceChild(newCard, oldCard);
  },

  /* ============================================================
     KOPIUJ TRENING
     ============================================================ */
  openCopyModal(sourceDateKey) {
    this._copySourceDate = sourceDateKey;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('copy-date-input').value = today;
    document.getElementById('copy-source-label').textContent =
      `Kopiujesz ćwiczenia z dnia ${this._formatDate(sourceDateKey)}`;
    document.getElementById('modal-copy').style.display = 'flex';
  },

  closeCopyModal(event) {
    if (event && event.target !== document.getElementById('modal-copy')) return;
    document.getElementById('modal-copy').style.display = 'none';
    this._copySourceDate = null;
  },

  confirmCopy() {
    const targetDate = document.getElementById('copy-date-input').value;
    if (!targetDate) { this._toast('Wybierz datę docelową'); return; }
    if (targetDate === this._copySourceDate) { this._toast('Wybierz inną datę niż źródłowa'); return; }

    const workouts = this.db.plans[this.currentPlan].workouts;
    const src = workouts[this._copySourceDate];
    if (!src) { this._toast('Błąd: brak treningu źródłowego'); return; }

    const existed = !!workouts[targetDate];
    workouts[targetDate] = {
      exercises: (src.exercises || []).map(ex => ({
        name: ex.name,
        sets: (ex.sets || []).map(() => ({ reps: '', weight: '' }))
      }))
    };
    Storage.save(this.db);
    document.getElementById('modal-copy').style.display = 'none';
    this._copySourceDate = null;
    this._toast(existed
      ? `Skopiowano (nadpisano ${this._formatDate(targetDate)})`
      : `Skopiowano do ${this._formatDate(targetDate)}`);
    this._renderPlanScreen();
    this.openWorkout(targetDate);
  },

  /* ============================================================
     USUŃ TRENING
     ============================================================ */
  deleteWorkout() {
    this._pendingConfirm = () => {
      delete this.db.plans[this.currentPlan].workouts[this.currentDate];
      Storage.save(this.db);
      this._toast('Trening usunięty');
      this.goToPlan();
    };
    document.getElementById('confirm-title').textContent = 'Usuń cały trening';
    document.getElementById('confirm-desc').textContent  =
      `Usunąć trening z dnia ${this._formatDate(this.currentDate)}?`;
    document.getElementById('confirm-btn').onclick = () => {
      this._pendingConfirm && this._pendingConfirm();
      this.closeConfirmModal();
    };
    document.getElementById('modal-confirm').style.display = 'flex';
  },

  /* ============================================================
     SZABLONY – ekran listy
     ============================================================ */
  openTemplates() {
    this._renderTemplatesScreen();
    this._showScreen('screen-templates');
  },

  _renderTemplatesScreen() {
    const templates = this.db.templates || [];
    const list  = document.getElementById('templates-list');
    const empty = document.getElementById('templates-empty');
    list.innerHTML = '';

    if (templates.length === 0) {
      list.style.display  = 'none';
      empty.style.display = 'flex';
      return;
    }
    list.style.display  = 'flex';
    empty.style.display = 'none';

    templates.forEach(tpl => {
      const exCount = (tpl.exercises || []).length;
      const card    = document.createElement('div');
      card.className = 'date-card';
      card.innerHTML = `
        <div class="date-card__main" onclick="App.openUseTemplateModal('${tpl.id}')">
          <div class="date-card__icon">📋</div>
          <div class="date-card__info">
            <div class="date-card__date" style="display:flex;align-items:center;gap:8px;">
              ${this._esc(tpl.name)}
              <span class="plan-badge plan-badge--${tpl.planType}">${tpl.planType}</span>
            </div>
            <div class="date-card__meta">${exCount} ${this._plural(exCount,'ćwiczenie','ćwiczenia','ćwiczeń')}</div>
          </div>
        </div>
        <div class="date-card__arrow" onclick="App.openUseTemplateModal('${tpl.id}')">›</div>
        <div class="date-card__actions">
          <button class="date-card__copy"
            style="color:var(--color-accent);border-color:rgba(10,132,255,0.25);background:rgba(10,132,255,0.10);"
            onclick="App.openEditTemplateScreen('${tpl.id}')">EDYTUJ</button>
          <button class="date-card__delete" onclick="App._confirmDeleteTemplate('${tpl.id}')">✕</button>
        </div>`;
      list.appendChild(card);
    });
  },

  /* ============================================================
     SZABLONY – tworzenie / edycja
     ============================================================ */
  openNewTemplateScreen() {
    this._editingTemplateId = null;
    document.getElementById('template-edit-title').textContent = 'Nowy plan';
    document.getElementById('tpl-name').value = '';
    this._selectTemplateType(null);
    document.getElementById('tpl-exercises-container').innerHTML = '';
    this.addTemplateExercise();
    this._showScreen('screen-template-edit');
  },

  openEditTemplateScreen(id) {
    const tpl = this.db.templates.find(t => t.id === id);
    if (!tpl) return;
    this._editingTemplateId = id;
    document.getElementById('template-edit-title').textContent = 'Edytuj plan';
    document.getElementById('tpl-name').value = tpl.name;
    this._selectTemplateType(tpl.planType);
    const container = document.getElementById('tpl-exercises-container');
    container.innerHTML = '';
    (tpl.exercises || []).forEach(ex => this._appendTemplateExerciseRow(ex.name, ex.sets));
    this._showScreen('screen-template-edit');
  },

  selectTemplateType(type) { this._selectTemplateType(type); },

  _selectTemplateType(type) {
    document.querySelectorAll('.plan-type-btn').forEach(btn => {
      btn.classList.toggle('plan-type-btn--active', btn.dataset.type === type);
    });
  },

  _getSelectedType() {
    const active = document.querySelector('.plan-type-btn--active');
    return active ? active.dataset.type : null;
  },

  addTemplateExercise() { this._appendTemplateExerciseRow('', 3); },

  _appendTemplateExerciseRow(name = '', sets = 3) {
    const container = document.getElementById('tpl-exercises-container');
    const idx = container.querySelectorAll('.tpl-ex-row').length;
    const row = document.createElement('div');
    row.className = 'tpl-ex-row';
    row.innerHTML = `
      <div class="tpl-ex-row__num">Ćw. ${idx + 1}</div>
      <div class="tpl-ex-row__fields">
        <input type="text" class="field-input tpl-ex-name"
          placeholder="Nazwa ćwiczenia…" value="${this._esc(name)}" />
        <div class="tpl-ex-sets-wrap">
          <label class="tpl-sets-label">Liczba serii:</label>
          <div class="tpl-sets-stepper">
            <button type="button" class="stepper-btn" onclick="App._stepSets(this,-1)">−</button>
            <span class="stepper-val">${Number(sets) || 1}</span>
            <button type="button" class="stepper-btn" onclick="App._stepSets(this,1)">+</button>
          </div>
        </div>
      </div>
      <button type="button" class="tpl-ex-del" onclick="App._removeTemplateExerciseRow(this)">✕</button>`;
    container.appendChild(row);
    this._renumberTemplateRows();
  },

  _stepSets(btn, delta) {
    const valEl = btn.parentElement.querySelector('.stepper-val');
    const cur   = parseInt(valEl.textContent) || 1;
    valEl.textContent = Math.max(1, Math.min(20, cur + delta));
  },

  _removeTemplateExerciseRow(btn) {
    const container = document.getElementById('tpl-exercises-container');
    if (container.querySelectorAll('.tpl-ex-row').length <= 1) {
      this._toast('Minimum 1 ćwiczenie');
      return;
    }
    btn.closest('.tpl-ex-row').remove();
    this._renumberTemplateRows();
  },

  _renumberTemplateRows() {
    document.querySelectorAll('.tpl-ex-row').forEach((row, i) => {
      const n = row.querySelector('.tpl-ex-row__num');
      if (n) n.textContent = `Ćw. ${i + 1}`;
    });
  },

  saveTemplate() {
    const name = document.getElementById('tpl-name').value.trim();
    if (!name) { this._toast('Wpisz nazwę planu'); return; }
    const planType = this._getSelectedType();
    if (!planType) { this._toast('Wybierz typ planu (UBW / LBW / FBW)'); return; }
    const rows = document.querySelectorAll('.tpl-ex-row');
    if (rows.length === 0) { this._toast('Dodaj co najmniej jedno ćwiczenie'); return; }

    const exercises = [];
    let valid = true;
    rows.forEach((row, i) => {
      const exName = row.querySelector('.tpl-ex-name').value.trim();
      if (!exName) { this._toast(`Wpisz nazwę ćwiczenia ${i + 1}`); valid = false; return; }
      const sets = parseInt(row.querySelector('.stepper-val').textContent) || 1;
      exercises.push({ name: exName, sets });
    });
    if (!valid) return;

    if (this._editingTemplateId) {
      const tpl = this.db.templates.find(t => t.id === this._editingTemplateId);
      if (tpl) { tpl.name = name; tpl.planType = planType; tpl.exercises = exercises; }
    } else {
      this.db.templates.push({ id: 'tpl_' + Date.now(), name, planType, exercises });
    }
    Storage.save(this.db);
    this._toast(this._editingTemplateId ? 'Plan zaktualizowany' : 'Plan zapisany');
    this._editingTemplateId = null;
    this.openTemplates();
  },

  /* ============================================================
     SZABLONY – usuń
     ============================================================ */
  _confirmDeleteTemplate(id) {
    const tpl = this.db.templates.find(t => t.id === id);
    if (!tpl) return;
    this._pendingConfirm = () => {
      this.db.templates = this.db.templates.filter(t => t.id !== id);
      Storage.save(this.db);
      this._renderTemplatesScreen();
      this._toast('Plan usunięty');
    };
    document.getElementById('confirm-title').textContent = 'Usuń plan';
    document.getElementById('confirm-desc').textContent  = `Usunąć plan "${tpl.name}"?`;
    document.getElementById('confirm-btn').onclick = () => {
      this._pendingConfirm && this._pendingConfirm();
      this.closeConfirmModal();
    };
    document.getElementById('modal-confirm').style.display = 'flex';
  },

  /* ============================================================
     SZABLONY – użyj
     ============================================================ */
  openUseTemplateModal(id) {
    const tpl = this.db.templates.find(t => t.id === id);
    if (!tpl) return;
    this._useTemplateId = id;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('use-template-date').value = today;
    document.getElementById('use-template-desc').innerHTML =
      `Tworzysz trening <strong>${this._esc(tpl.name)}</strong>` +
      ` <span class="plan-badge plan-badge--${tpl.planType}">${tpl.planType}</span>`;
    document.getElementById('modal-use-template').style.display = 'flex';
  },

  closeUseTemplateModal(event) {
    if (event && event.target !== document.getElementById('modal-use-template')) return;
    document.getElementById('modal-use-template').style.display = 'none';
    this._useTemplateId = null;
  },

  confirmUseTemplate() {
    const dateKey = document.getElementById('use-template-date').value;
    if (!dateKey) { this._toast('Wybierz datę treningu'); return; }
    const tpl = this.db.templates.find(t => t.id === this._useTemplateId);
    if (!tpl) { this._toast('Błąd: nie znaleziono planu'); return; }

    const workouts = this.db.plans[tpl.planType].workouts;
    const existed  = !!workouts[dateKey];
    workouts[dateKey] = {
      exercises: tpl.exercises.map(ex => ({
        name: ex.name,
        sets: Array.from({ length: ex.sets }, () => ({ reps: '', weight: '' }))
      }))
    };
    Storage.save(this.db);
    document.getElementById('modal-use-template').style.display = 'none';
    this._useTemplateId = null;
    this._toast(existed
      ? `Trening nadpisany (${this._formatDate(dateKey)})`
      : `Trening utworzony: ${this._formatDate(dateKey)}`);
    this.currentPlan = tpl.planType;
    this._renderPlanScreen();
    this.openWorkout(dateKey);
  },

  /* ============================================================
     HELPERY
     ============================================================ */
  _currentWorkout() {
    return this.db.plans[this.currentPlan].workouts[this.currentDate];
  },

  _formatDate(dateKey) {
    const [y, m, d] = dateKey.split('-');
    return `${d}.${m}.${y}`;
  },

  _plural(n, one, few, many) {
    if (n === 1) return `${n} ${one}`;
    if (n >= 2 && n <= 4) return `${n} ${few}`;
    return `${n} ${many}`;
  },

  _planColor(type) {
    return { UBW: 'var(--color-ubw)', LBW: 'var(--color-lbw)', FBW: 'var(--color-fbw)' }[type] || '#fff';
  },

  _esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  _toast(msg) {
    const el = document.getElementById('toast');
    el.textContent    = msg;
    el.style.display  = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
