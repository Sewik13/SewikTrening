/**
 * ============================================================
 *  TRENING PWA – app.js
 *  UBW / LBW / FBW + Szablony treningów
 *  Dane: localStorage
 * ============================================================
 */

'use strict';

/* ============================================================
   STORAGE
   ============================================================ */
const Storage = {
  KEY: 'trening_pwa_v1',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      const db = raw ? JSON.parse(raw) : this._defaultDB();
      // Upewnij się, że pole templates istnieje (migracja starych danych)
      if (!db.templates) db.templates = [];
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
      templates: []   // lista szablonów treningów
    };
  }
};

/* ============================================================
   APP
   ============================================================ */
const App = {
  /* ---- stan ---- */
  currentPlan:      null,   // 'UBW' | 'LBW' | 'FBW'
  currentDate:      null,   // 'YYYY-MM-DD'
  db:               null,
  _toastTimer:      null,
  _pendingConfirm:  null,
  _copySourceDate:  null,
  _editingTemplateId: null, // id edytowanego szablonu (null = nowy)
  _useTemplateId:   null,   // id szablonu do użycia

  /* ============================================================
     INICJALIZACJA
     ============================================================ */
  init() {
    this.db = Storage.load();
    this._registerServiceWorker();
    this._showScreen('screen-home');
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
    const dates = Object.keys(workouts).sort((a, b) => b.localeCompare(a));

    const list  = document.getElementById('dates-list');
    const empty = document.getElementById('dates-empty');
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
      const card = document.createElement('div');
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
          <button class="date-card__copy" onclick="App.openCopyModal('${dateKey}')">KOPIUJ</button>
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
    document.getElementById('confirm-desc').textContent =
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
     EKRAN TRENINGU – ćwiczenia
     ============================================================ */
  openWorkout(dateKey) {
    this.currentDate = dateKey;
    document.getElementById('workout-title').textContent = this.currentPlan;
    document.getElementById('workout-date-label').textContent =
      this.currentPlan + ' · ' + this._formatDate(dateKey);
    this._renderWorkout();
    this._showScreen('screen-workout');
  },

  _renderWorkout() {
    const workout    = this._currentWorkout();
    const exercises  = workout.exercises || [];
    const container  = document.getElementById('exercises-container');
    const empty      = document.getElementById('exercises-empty');
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

    // nagłówek
    const header = document.createElement('div');
    header.className = 'exercise-header';
    header.innerHTML = `<span class="exercise-number">Ćw. ${exIndex + 1}</span>`;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'exercise-name-input';
    nameInput.placeholder = 'Nazwa ćwiczenia…';
    nameInput.value = exercise.name || '';
    nameInput.addEventListener('change', () => {
      this._currentWorkout().exercises[exIndex].name = nameInput.value.trim();
      Storage.save(this.db);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'exercise-delete-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => this._confirmDeleteExercise(exIndex));

    header.appendChild(nameInput);
    header.appendChild(delBtn);
    card.appendChild(header);

    // tabela serii
    const table = document.createElement('div');
    table.className = 'sets-table';
    const th = document.createElement('div');
    th.className = 'sets-table-header';
    th.innerHTML = '<span>SERIA</span><span>CIĘŻARY / WYNIK</span>';
    table.appendChild(th);
    (exercise.sets || []).forEach((set, si) => table.appendChild(this._buildSetRow(set, exIndex, si)));
    card.appendChild(table);

    // stopka
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

  _buildSetRow(set, exIndex, setIndex) {
    const row = document.createElement('div');
    row.className = 'set-row';

    const num = document.createElement('div');
    num.className = 'set-number';
    num.textContent = setIndex + 1;

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'text';
    input.className = 'set-weight-input';
    input.placeholder = 'np. 10 × 30 kg';
    input.value = set.weight || '';
    input.addEventListener('change', () => {
      this._currentWorkout().exercises[exIndex].sets[setIndex].weight = input.value.trim();
      Storage.save(this.db);
    });

    const del = document.createElement('button');
    del.className = 'set-delete-btn';
    del.textContent = '−';
    del.addEventListener('click', () => this.deleteSet(exIndex, setIndex));

    row.appendChild(num);
    row.appendChild(input);
    row.appendChild(del);
    return row;
  },

  addExercise() {
    const workout = this._currentWorkout();
    workout.exercises.push({ name: '', sets: [{ weight: '' }] });
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
    this._currentWorkout().exercises[exIndex].sets.push({ weight: '' });
    Storage.save(this.db);

    const container = document.getElementById('exercises-container');
    const oldCard   = container.querySelectorAll('.exercise-card')[exIndex];
    const newCard   = this._buildExerciseCard(this._currentWorkout().exercises[exIndex], exIndex);
    container.replaceChild(newCard, oldCard);

    const inputs = newCard.querySelectorAll('.set-weight-input');
    setTimeout(() => inputs[inputs.length - 1]?.focus(), 60);
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
        sets: (ex.sets || []).map(() => ({ weight: '' }))
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
      const exCount  = (tpl.exercises || []).length;
      const typeColor = this._planColor(tpl.planType);
      const card = document.createElement('div');
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
          <button class="date-card__copy" style="color:var(--color-accent);border-color:rgba(10,132,255,0.25);background:rgba(10,132,255,0.10);"
            onclick="App.openEditTemplateScreen('${tpl.id}')">EDYTUJ</button>
          <button class="date-card__delete" onclick="App._confirmDeleteTemplate('${tpl.id}')">✕</button>
        </div>`;
      list.appendChild(card);
    });
  },

  /* ============================================================
     SZABLONY – ekran tworzenia / edycji
     ============================================================ */
  openNewTemplateScreen() {
    this._editingTemplateId = null;
    document.getElementById('template-edit-title').textContent = 'Nowy plan';
    document.getElementById('tpl-name').value = '';
    this._selectTemplateType(null);           // odznacz wszystkie
    document.getElementById('tpl-exercises-container').innerHTML = '';
    this.addTemplateExercise();               // zacznij z jednym pustym
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

  /* Zaznacz przycisk typu planu */
  selectTemplateType(type) {
    this._selectTemplateType(type);
  },

  _selectTemplateType(type) {
    document.querySelectorAll('.plan-type-btn').forEach(btn => {
      btn.classList.toggle('plan-type-btn--active', btn.dataset.type === type);
    });
  },

  _getSelectedType() {
    const active = document.querySelector('.plan-type-btn--active');
    return active ? active.dataset.type : null;
  },

  /* Dodaj wiersz ćwiczenia w formularzu szablonu */
  addTemplateExercise() {
    this._appendTemplateExerciseRow('', 3);
  },

  _appendTemplateExerciseRow(name = '', sets = 3) {
    const container = document.getElementById('tpl-exercises-container');
    const idx  = container.querySelectorAll('.tpl-ex-row').length;
    const row  = document.createElement('div');
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
    // Renumeruj po dodaniu
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
      const numEl = row.querySelector('.tpl-ex-row__num');
      if (numEl) numEl.textContent = `Ćw. ${i + 1}`;
    });
  },

  /* Zapisz szablon */
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
      // Aktualizuj istniejący
      const tpl = this.db.templates.find(t => t.id === this._editingTemplateId);
      if (tpl) { tpl.name = name; tpl.planType = planType; tpl.exercises = exercises; }
    } else {
      // Nowy szablon
      this.db.templates.push({
        id:        'tpl_' + Date.now(),
        name,
        planType,
        exercises
      });
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
     SZABLONY – użyj (wybór daty → utwórz trening)
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

    // Utwórz trening w odpowiednim planie (UBW/LBW/FBW)
    const workouts = this.db.plans[tpl.planType].workouts;
    const existed  = !!workouts[dateKey];

    // Każde ćwiczenie dostaje tyle pustych serii, ile zdefiniowano w szablonie
    workouts[dateKey] = {
      exercises: tpl.exercises.map(ex => ({
        name: ex.name,
        sets: Array.from({ length: ex.sets }, () => ({ weight: '' }))
      }))
    };
    Storage.save(this.db);

    document.getElementById('modal-use-template').style.display = 'none';
    this._useTemplateId = null;

    this._toast(existed
      ? `Trening nadpisany (${this._formatDate(dateKey)})`
      : `Trening utworzony: ${this._formatDate(dateKey)}`);

    // Przejdź bezpośrednio do treningu
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

  /** Escape HTML w stringu (zabezpieczenie przed XSS w innerHTML) */
  _esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  },

  _toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2400);
  }
};

/* ============================================================
   URUCHOM
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());
