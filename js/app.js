"use strict";


    // Os registros são carregados de js/data.js para facilitar a manutenção.
    const RECORDS = MAPA_DATA;

    const DAY_DEFINITIONS = Object.freeze({
      Seg: { label: "Segunda-feira", order: 1, color: "#2563eb" },
      Ter: { label: "Terça-feira", order: 2, color: "#16a34a" },
      Qua: { label: "Quarta-feira", order: 3, color: "#7c3aed" },
      Qui: { label: "Quinta-feira", order: 4, color: "#0d9488" },
      Sex: { label: "Sexta-feira", order: 5, color: "#e11d48" },
      "Sáb": { label: "Sábado", order: 6, color: "#b45309" },
      "Em definição": { label: "Dia a definir", order: 99, color: "#737373" }
    });

    const PROFILE_COPY = Object.freeze({
      all: "",
      freshman: " para calouros",
      veteran: " para veteranos",
      special: " de estágios, TCC e projetos integradores"
    });
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
    const FAVORITE_STORAGE_KEY = "mapaSalaPresencial.favoriteFilters.v1";
    const STRUCTURED_FILTER_KEYS = Object.freeze(["scope", "course", "discipline", "semester", "day", "shift"]);
    const FILTER_DEFAULTS = Object.freeze({ scope: "all", course: "", discipline: "", semester: "", day: "", shift: "" });
    let savedFavorite = null;

    const state = {
      scope: "all",
      query: "",
      course: "",
      discipline: "",
      semester: "",
      day: "",
      shift: ""
    };

    const elements = {
      finder: document.getElementById("finder"),
      search: document.getElementById("searchInput"),
      clearSearch: document.getElementById("clearSearch"),
      filtersGrid: document.getElementById("filtersGrid"),
      course: document.getElementById("courseFilter"),
      discipline: document.getElementById("disciplineFilter"),
      semester: document.getElementById("semesterFilter"),
      semesterField: document.getElementById("semesterField"),
      dayFilter: document.getElementById("dayFilter"),
      shiftFilter: document.getElementById("shiftFilter"),
      scopeTabs: [...document.querySelectorAll(".scope-tab")],
      results: document.getElementById("resultsList"),
      summary: document.getElementById("resultsSummary"),
      empty: document.getElementById("emptyState"),
      reset: document.getElementById("resetFilters"),
      emptyReset: document.getElementById("emptyReset"),
      freshmanCta: document.getElementById("freshmanCta"),
      browseCta: document.getElementById("browseCta"),
      favoriteButton: document.getElementById("favoriteButton"),
      favoriteHeart: document.getElementById("favoriteHeart"),
      favoriteButtonLabel: document.getElementById("favoriteButtonLabel"),
      favoriteSummary: document.getElementById("favoriteSummary"),
      removeFavorite: document.getElementById("removeFavorite")
    };

    function stripAccents(value = "") {
      return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    function searchable(value = "") {
      return stripAccents(value).toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
    }

    function escapeHtml(value = "") {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function canonicalCourse(coursePart) {
      const cleaned = searchable(coursePart).replace(/[.,]/g, "").replace(/\s+/g, " ");
      const aliases = {
        administracao: "Administração",
        "cst em logistica": "Logística",
        direito: "Direito",
        enfermagem: "Enfermagem",
        "eng civil": "Engenharia Civil",
        "engenharia civil": "Engenharia Civil",
        civil: "Engenharia Civil",
        "eng mecanica": "Engenharia Mecânica",
        "engenharia mecanica": "Engenharia Mecânica",
        mecanica: "Engenharia Mecânica",
        "eng eletrica": "Engenharia Elétrica",
        "engenharia eletrica": "Engenharia Elétrica",
        eletrica: "Engenharia Elétrica",
        "eng producao": "Engenharia de Produção",
        "engenharia de producao": "Engenharia de Produção",
        producao: "Engenharia de Produção",
        "eng quimica": "Engenharia Química",
        "engenharia quimica": "Engenharia Química",
        quimica: "Engenharia Química",
        "engenharia da computacao": "Engenharia da Computação",
        farmacia: "Farmácia",
        logistica: "Logística",
        "medicina veterinaria": "Medicina Veterinária",
        odontologia: "Odontologia",
        psicologia: "Psicologia",
        tads: "TADS",
        "tecnico de enfermagem": "Técnico em Enfermagem",
        "tecnico em enfermagem": "Técnico em Enfermagem"
      };
      return aliases[cleaned] || coursePart.trim();
    }

    function getCourseAliases(course) {
      return [...new Set(String(course || "").split("/").map(canonicalCourse).filter(Boolean))];
    }

    function parseLocation(sourceValue) {
      const source = String(sourceValue || "").trim();
      const blockRoom = source.match(/^(?:sala\s*)?([A-Z])\s*-?\s*(\d+)$/i);
      if (blockRoom) {
        return {
          original: source,
          roomNumber: Number(blockRoom[2]),
          tileLabel: "Sala",
          tileValue: blockRoom[2],
          tileSubtitle: `Bloco ${blockRoom[1].toUpperCase()}`
        };
      }

      const labRoom = source.match(/^Lab\s+Info\s+(\d+)$/i);
      if (labRoom) {
        return {
          original: source,
          roomNumber: Number(labRoom[1]),
          tileLabel: "Laboratório",
          tileValue: labRoom[1],
          tileSubtitle: "Lab. de informática"
        };
      }

      const isUndefined = !source || searchable(source) === "em definicao";
      return {
        original: source || "Em Definição",
        roomNumber: null,
        tileLabel: "Local",
        tileValue: isUndefined ? "A definir" : source,
        tileSubtitle: isUndefined ? "Consulte a coordenação" : "Local específico"
      };
    }

    const entries = RECORDS.flatMap((row) => {
      const days = row.days?.length ? row.days : ["Em definição"];
      return days.map((dayKey, dayIndex) => ({
        ...row,
        dayKey: DAY_DEFINITIONS[dayKey] ? dayKey : "Em definição",
        location: parseLocation(row.room),
        courseAliases: getCourseAliases(row.course),
        isFreshman: row.groups.includes("calouros"),
        isVeteran: row.groups.includes("veteranos"),
        isSpecial: row.groups.includes("outros"),
        uniqueId: `${row.id}-${dayIndex}`
      }));
    });

    function scopeMatches(entry) {
      if (state.scope === "freshman") return entry.isFreshman;
      if (state.scope === "veteran") return entry.isVeteran;
      if (state.scope === "special") return entry.isSpecial;
      return true;
    }

    function populateFilters() {
      Object.entries(DAY_DEFINITIONS).forEach(([key, definition]) => {
        if (!entries.some((entry) => entry.dayKey === key)) return;
        const button = document.createElement("button");
        button.className = "filter-chip day-filter-button";
        button.type = "button";
        button.dataset.day = key;
        button.setAttribute("aria-pressed", "false");
        button.style.setProperty("--filter-color", definition.color);
        button.innerHTML = `<span class="day-chip-dot" aria-hidden="true"></span>${escapeHtml(key)}`;
        elements.dayFilter.appendChild(button);
      });
    }

    function entryMatchesStructuredFilters(entry, omittedKey = "") {
      if (omittedKey !== "scope" && !scopeMatches(entry)) return false;
      if (omittedKey !== "course" && state.course && !entry.courseAliases.includes(state.course)) return false;
      if (omittedKey !== "discipline" && state.discipline && entry.subject !== state.discipline) return false;
      if (omittedKey !== "semester" && state.semester && !entry.semesters.includes(Number(state.semester))) return false;
      if (omittedKey !== "day" && state.day && entry.dayKey !== state.day) return false;
      if (omittedKey !== "shift" && state.shift && entry.shift !== state.shift) return false;
      return true;
    }

    function availableValuesFor(filterKey) {
      const candidates = entries.filter((entry) => entryMatchesStructuredFilters(entry, filterKey));
      if (filterKey === "course") return new Set(candidates.flatMap((entry) => entry.courseAliases));
      if (filterKey === "discipline") return new Set(candidates.map((entry) => entry.subject));
      if (filterKey === "semester") return new Set(candidates.flatMap((entry) => entry.semesters).filter((value) => value >= 2 && value <= 10));
      if (filterKey === "day") return new Set(candidates.map((entry) => entry.dayKey));
      if (filterKey === "shift") return new Set(candidates.map((entry) => entry.shift));
      return new Set();
    }

    function sanitizeFilterState(preferredKey = "") {
      const validationOrder = [
        ...STRUCTURED_FILTER_KEYS.filter((key) => key !== preferredKey && key !== "scope"),
        ...(preferredKey && preferredKey !== "scope" ? [preferredKey] : [])
      ];

      if (!["all", "veteran"].includes(state.scope)) state.semester = "";

      for (let pass = 0; pass < validationOrder.length; pass += 1) {
        let changed = false;
        validationOrder.forEach((key) => {
          const value = state[key];
          if (!value) return;
          const candidateValue = key === "semester" ? Number(value) : value;
          if (!availableValuesFor(key).has(candidateValue)) {
            state[key] = "";
            changed = true;
          }
        });
        if (!changed) break;
      }
    }

    function replaceSelectOptions(select, placeholder, values, selectedValue, formatter = (value) => value) {
      select.replaceChildren();
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = placeholder;
      select.appendChild(defaultOption);
      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = formatter(value);
        select.appendChild(option);
      });
      select.value = selectedValue;
    }

    function syncFilterButtons() {
      elements.dayFilter.querySelectorAll("[data-day]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.day === state.day));
      });
      elements.shiftFilter.querySelectorAll("[data-shift]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.shift === state.shift));
      });
      elements.scopeTabs.forEach((tab) => {
        tab.setAttribute("aria-selected", String(tab.dataset.scope === state.scope));
      });
    }

    function updateResponsiveFilters() {
      const courses = [...availableValuesFor("course")].sort(collator.compare);
      replaceSelectOptions(elements.course, "Todos os cursos", courses, state.course);

      const disciplines = [...availableValuesFor("discipline")].sort(collator.compare);
      replaceSelectOptions(elements.discipline, "Todas as disciplinas", disciplines, state.discipline);

      const showSemester = ["all", "veteran"].includes(state.scope);
      elements.semesterField.hidden = !showSemester;
      elements.filtersGrid.classList.toggle("semester-hidden", !showSemester);
      const semesters = [...availableValuesFor("semester")].sort((a, b) => a - b);
      replaceSelectOptions(elements.semester, "Todos os semestres", semesters, state.semester, (value) => `${value}º semestre`);

      const availableDays = availableValuesFor("day");
      elements.dayFilter.querySelectorAll("[data-day]").forEach((button) => {
        button.hidden = !availableDays.has(button.dataset.day);
      });

      const availableShifts = availableValuesFor("shift");
      elements.shiftFilter.querySelectorAll("[data-shift]").forEach((button) => {
        button.hidden = !availableShifts.has(button.dataset.shift);
      });

      syncFilterButtons();
      updateFavoriteUI();
    }

    function setStructuredFilter(key, value) {
      state[key] = value;
      sanitizeFilterState(key);
      updateResponsiveFilters();
      render();
    }

    function currentStructuredFilters() {
      return {
        scope: state.scope,
        course: state.course,
        discipline: state.discipline,
        semester: state.semester,
        day: state.day,
        shift: state.shift
      };
    }

    function hasStructuredSelection(filters = currentStructuredFilters()) {
      return filters.scope !== "all" || Boolean(filters.course || filters.discipline || filters.semester || filters.day || filters.shift);
    }

    function sameStructuredFilters(first, second) {
      return Boolean(first && second) && STRUCTURED_FILTER_KEYS.every((key) => first[key] === second[key]);
    }

    function describeFilters(filters) {
      const parts = [];
      if (filters.scope === "freshman") parts.push("Calouros");
      if (filters.scope === "veteran") parts.push("Veteranos");
      if (filters.scope === "special") parts.push("Estágio, TCC e PI");
      if (filters.course) parts.push(filters.course);
      if (filters.discipline) parts.push(filters.discipline);
      if (filters.semester) parts.push(`${filters.semester}º semestre`);
      if (filters.day) parts.push(DAY_DEFINITIONS[filters.day]?.label || filters.day);
      if (filters.shift) parts.push(filters.shift);
      return parts.join(" · ");
    }

    function loadFavorite() {
      try {
        const stored = localStorage.getItem(FAVORITE_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const validScope = ["all", "freshman", "veteran", "special"].includes(parsed.scope);
        const validStrings = ["course", "day", "shift"].every((key) => typeof parsed[key] === "string");
        if (!validScope || !validStrings) return;
        savedFavorite = {
          scope: parsed.scope,
          course: parsed.course,
          discipline: typeof parsed.discipline === "string" ? parsed.discipline : "",
          semester: typeof parsed.semester === "string" ? parsed.semester : "",
          day: parsed.day,
          shift: parsed.shift
        };
        Object.assign(state, savedFavorite);
      } catch (error) {
        savedFavorite = null;
      }
    }

    function updateFavoriteUI() {
      const current = currentStructuredFilters();
      const hasSelection = hasStructuredSelection(current);
      const matchesSaved = sameStructuredFilters(current, savedFavorite);
      elements.favoriteButton.disabled = !hasSelection;
      elements.favoriteButton.classList.toggle("is-saved", matchesSaved);
      elements.favoriteHeart.textContent = matchesSaved ? "♥" : "♡";
      elements.removeFavorite.hidden = !savedFavorite;

      if (!hasSelection) {
        elements.favoriteButtonLabel.textContent = savedFavorite ? "Selecione filtros para atualizar" : "Salvar minha turma";
      } else if (!savedFavorite) {
        elements.favoriteButtonLabel.textContent = "Salvar minha turma";
      } else if (matchesSaved) {
        elements.favoriteButtonLabel.textContent = "Minha turma salva";
      } else {
        elements.favoriteButtonLabel.textContent = "Atualizar turma salva";
      }

      elements.favoriteSummary.textContent = savedFavorite
        ? `Favorito: ${describeFilters(savedFavorite)}`
        : "Escolha os filtros que deseja abrir automaticamente.";
    }

    function saveFavorite() {
      const current = currentStructuredFilters();
      if (!hasStructuredSelection(current)) return;
      savedFavorite = current;
      try { localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(savedFavorite)); } catch (error) {}
      updateFavoriteUI();
    }

    function removeFavorite() {
      savedFavorite = null;
      try { localStorage.removeItem(FAVORITE_STORAGE_KEY); } catch (error) {}
      updateFavoriteUI();
    }

    function hasActiveFilters() {
      return state.scope !== "all" || Boolean(state.query || state.course || state.discipline || state.semester || state.day || state.shift);
    }

    function entryMatches(entry) {
      if (!scopeMatches(entry)) return false;
      if (state.course && !entry.courseAliases.includes(state.course)) return false;
      if (state.discipline && entry.subject !== state.discipline) return false;
      if (state.semester && !entry.semesters.includes(Number(state.semester))) return false;
      if (state.day && entry.dayKey !== state.day) return false;
      if (state.shift && entry.shift !== state.shift) return false;

      if (state.query) {
        const normalizedQuery = searchable(state.query);
        if (/^\d+$/.test(normalizedQuery)) {
          return searchable(entry.location.original).includes(normalizedQuery);
        }

        const haystack = searchable([
          entry.code,
          entry.subject,
          entry.course,
          entry.courseAliases.join(" "),
          entry.semesterLabel,
          entry.type,
          entry.shift,
          entry.location.original,
          entry.dayKey,
          entry.time
        ].filter(Boolean).join(" "));
        if (!haystack.includes(normalizedQuery)) return false;
      }

      return true;
    }

    function compareEntries(a, b) {
      const dayDifference = DAY_DEFINITIONS[a.dayKey].order - DAY_DEFINITIONS[b.dayKey].order;
      if (dayDifference) return dayDifference;
      const shiftOrder = { "Manhã": 1, "Noturno": 2 };
      const shiftDifference = (shiftOrder[a.shift] || 99) - (shiftOrder[b.shift] || 99);
      if (shiftDifference) return shiftDifference;
      const roomA = Number.isFinite(a.location.roomNumber) ? a.location.roomNumber : Number.MAX_SAFE_INTEGER;
      const roomB = Number.isFinite(b.location.roomNumber) ? b.location.roomNumber : Number.MAX_SAFE_INTEGER;
      if (roomA !== roomB) return roomA - roomB;
      const locationDifference = collator.compare(a.location.original, b.location.original);
      return locationDifference || collator.compare(a.subject, b.subject);
    }

    function pluralize(count, singular, plural) {
      return `${count} ${count === 1 ? singular : plural}`;
    }

    function classCard(entry, index) {
      const day = DAY_DEFINITIONS[entry.dayKey];
      const locationTextClass = entry.location.roomNumber === null ? " is-text" : "";
      const timeLabel = entry.time || "Horário não informado";
      const sourceLabel = entry.isSpecial ? "Estágio, TCC ou PI" : "Sala de aula";
      const shiftClass = entry.shift === "Manhã" ? "chip-shift-morning" : "chip-shift-night";
      const shiftIcon = entry.shift === "Manhã" ? "☀" : "☾";
      const meta = [];

      if (entry.code) meta.push(`<span class="meta-item"><strong>Código:</strong> ${escapeHtml(entry.code)}</span>`);
      if (entry.semesterLabel) meta.push(`<span class="meta-item"><strong>Semestre:</strong> ${escapeHtml(entry.semesterLabel)}</span>`);
      if (entry.type) meta.push(`<span class="meta-item"><strong>Tipo:</strong> ${escapeHtml(entry.type)}</span>`);

      return `
        <article class="class-card" style="--day-color:${day.color}; animation-delay:${Math.min(index, 8) * 24}ms" aria-label="${escapeHtml(entry.subject)}, ${escapeHtml(entry.location.original)}">
          <div class="location-tile">
            <span class="location-label">${escapeHtml(entry.location.tileLabel)}</span>
            <span class="location-value${locationTextClass}">${escapeHtml(entry.location.tileValue)}</span>
            <span class="location-subtitle">${escapeHtml(entry.location.tileSubtitle)}</span>
          </div>
          <div class="card-content">
            <div class="card-topline">
              <p class="course-name">${escapeHtml(entry.course)}</p>
              ${entry.isFreshman ? '<span class="freshman-badge">Calouros</span>' : ""}
            </div>
            <h3 class="discipline-name">${escapeHtml(entry.subject)}</h3>
            <div class="card-chips">
              <span class="chip chip-day"><span class="chip-dot" aria-hidden="true"></span>${escapeHtml(entry.dayKey)}</span>
              <span class="chip chip-time"><span class="chip-dot" aria-hidden="true"></span>${escapeHtml(timeLabel)}</span>
              <span class="chip chip-shift ${shiftClass}"><span aria-hidden="true">${shiftIcon}</span>${escapeHtml(entry.shift)}</span>
              <span class="chip">${sourceLabel}</span>
            </div>
          </div>
          ${meta.length ? `<div class="card-meta">${meta.join("")}</div>` : ""}
        </article>`;
    }

    function render() {
      const filtered = entries.filter(entryMatches).sort(compareEntries);
      const groups = new Map();
      filtered.forEach((entry) => {
        if (!groups.has(entry.dayKey)) groups.set(entry.dayKey, []);
        groups.get(entry.dayKey).push(entry);
      });

      elements.results.innerHTML = [...groups.entries()].map(([dayKey, dayEntries]) => {
        const day = DAY_DEFINITIONS[dayKey];
        const headingId = `day-${searchable(dayKey).replace(/\s/g, "-")}`;
        return `
          <section class="day-group" aria-labelledby="${headingId}">
            <div class="day-heading" style="--day-color:${day.color}">
              <span class="day-color" aria-hidden="true"></span>
              <h3 class="day-name" id="${headingId}">${day.label}</h3>
              <span class="day-count">${pluralize(dayEntries.length, "aula", "aulas")}</span>
            </div>
            <div class="cards-grid">${dayEntries.map(classCard).join("")}</div>
          </section>`;
      }).join("");

      elements.summary.textContent = `${pluralize(filtered.length, "aula encontrada", "aulas encontradas")}${PROFILE_COPY[state.scope]}.`;
      elements.empty.classList.toggle("is-visible", filtered.length === 0);
      elements.reset.classList.toggle("is-visible", hasActiveFilters());
      elements.clearSearch.classList.toggle("is-visible", Boolean(state.query));
    }

    function setScope(scope) {
      setStructuredFilter("scope", scope);
    }

    function resetFilters() {
      Object.assign(state, FILTER_DEFAULTS, { query: "" });
      elements.search.value = "";
      updateResponsiveFilters();
      render();
    }

    function scrollToFinder() {
      const offset = Number.parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height"), 10) + 12;
      window.scrollTo({ top: elements.finder.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
    }

    function bindEvents() {
      elements.search.addEventListener("input", (event) => {
        state.query = event.target.value;
        render();
      });

      elements.search.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && state.query) {
          state.query = "";
          elements.search.value = "";
          render();
        }
      });

      elements.clearSearch.addEventListener("click", () => {
        state.query = "";
        elements.search.value = "";
        elements.search.focus();
        render();
      });

      elements.course.addEventListener("change", (event) => setStructuredFilter("course", event.target.value));
      elements.discipline.addEventListener("change", (event) => setStructuredFilter("discipline", event.target.value));
      elements.semester.addEventListener("change", (event) => setStructuredFilter("semester", event.target.value));
      elements.dayFilter.addEventListener("click", (event) => {
        const button = event.target.closest("[data-day]");
        if (!button) return;
        setStructuredFilter("day", state.day === button.dataset.day ? "" : button.dataset.day);
      });
      elements.shiftFilter.addEventListener("click", (event) => {
        const button = event.target.closest("[data-shift]");
        if (!button) return;
        setStructuredFilter("shift", state.shift === button.dataset.shift ? "" : button.dataset.shift);
      });
      elements.scopeTabs.forEach((tab) => tab.addEventListener("click", () => setScope(tab.dataset.scope)));
      elements.reset.addEventListener("click", resetFilters);
      elements.emptyReset.addEventListener("click", resetFilters);
      elements.favoriteButton.addEventListener("click", saveFavorite);
      elements.removeFavorite.addEventListener("click", removeFavorite);

      elements.freshmanCta.addEventListener("click", () => {
        setScope("freshman");
        scrollToFinder();
      });

      elements.browseCta.addEventListener("click", () => {
        resetFilters();
        scrollToFinder();
      });
    }

    function initialize() {
      populateFilters();
      loadFavorite();
      sanitizeFilterState();
      updateResponsiveFilters();
      bindEvents();
      render();
    }

    initialize();