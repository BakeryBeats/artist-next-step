"use strict";
const P = ArtistPlanner;
const C = ArtistContent;
const STORAGE_KEY = "artist-next-step.v1";
const views = ["overzicht", "scan", "plan", "tools", "reflectie"];
const viewNames = { overzicht: "Jouw artiestenwerkplek", scan: "Mijn startscan", plan: "Mijn vierwekenplan", tools: "Werkbank", reflectie: "Terugblik" };
let state = P.emptyState();
let activeView = "";
let selectedWeek = 1;
let selectedTool = "bio";
let toastTimer;
let storageAvailable = true;

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text, className, action) {
  const element = el("button", className, text);
  element.type = "button";
  element.addEventListener("click", action);
  return element;
}

function notify(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4500);
}

function warnStorage(message) {
  const warning = document.getElementById("storage-warning");
  warning.textContent = message;
  warning.hidden = false;
  document.getElementById("save-status").textContent = "Maak een back-up van je werk";
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageAvailable = true;
    document.getElementById("save-status").textContent = "Bewaard op dit apparaat";
    document.getElementById("storage-warning").hidden = true;
  } catch {
    storageAvailable = false;
    warnStorage("Je browser kan je werk niet bewaren. Je kunt doorgaan en via Download back-up je werk meenemen voordat je de pagina sluit.");
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = P.normalizeState(JSON.parse(saved));
  } catch {
    storageAvailable = false;
    warnStorage("Je opgeslagen plan kon niet worden geopend. Open een geldige back-up of maak een nieuw plan. Download je werk om het zelf te bewaren.");
  }
}

function showView(view, focus = true) {
  if (!views.includes(view)) view = "overzicht";
  activeView = view;
  for (const name of views) document.getElementById("view-" + name).hidden = name !== view;
  for (const item of document.querySelectorAll(".nav-button")) {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  document.getElementById("view-label").textContent = viewNames[view];
  if (view === "overzicht") renderOverview();
  if (view === "scan") fillScan();
  if (view === "plan") renderPlan();
  if (view === "tools") renderTools();
  if (view === "reflectie") renderReflectionSummary();
  if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
  if (focus) {
    document.getElementById("main").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function makeProgress() {
  const wrap = el("div", "progress");
  const bar = el("div", "progress-track");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Afgeronde opdrachten");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "12");
  bar.setAttribute("aria-valuenow", String(state.completed.length));
  const fill = el("span");
  fill.style.width = (state.completed.length / 12 * 100) + "%";
  bar.append(fill);
  wrap.append(el("p", "progress-label", state.completed.length + " van 12 opdrachten afgerond"), bar);
  return wrap;
}

function renderOverview() {
  const profile = state.profile;
  document.getElementById("welcome-hero").hidden = Boolean(profile);
  const personal = document.getElementById("personal-overview");
  personal.hidden = !profile;
  personal.replaceChildren();
  if (profile) {
    personal.append(el("p", "eyebrow", "Jouw volgende stap"), el("h1", "", "Aan de slag, " + profile.artist + "."));
    personal.append(el("p", "intro", "Je werkt aan “" + profile.song + "”, met als focus " + P.goals[profile.goal] + "."));
    const tasks = P.getTasks(profile);
    const nextTask = tasks.find(task => !state.completed.includes(task.id));
    const nextCard = el("article", "next-card");
    if (nextTask) {
      const copy = el("div");
      copy.append(el("p", "eyebrow", "Dit kun je nu oppakken"), el("h2", "", nextTask.title), el("p", "", nextTask.output));
      nextCard.append(copy, button("Open opdracht ↗", "button light", () => openTask(nextTask.id)));
    } else {
      nextCard.append(el("div", "", "Je hebt alle opdrachten afgerond. Leg vast wat je wilt meenemen naar je volgende release."), button("Mijn terugblik ↗", "button light", () => showView("reflectie")));
    }
    personal.append(nextCard, makeProgress());
  }
  const weeks = document.getElementById("week-overview");
  weeks.replaceChildren();
  C.weeks.forEach((week, index) => {
    const card = el("article", "week-preview");
    const count = C.tasks.filter(task => task.week === index + 1 && state.completed.includes(task.id)).length;
    card.append(el("p", "week-label", "Week " + (index + 1)), el("h3", "", week.title), el("p", "", week.description));
    card.append(button(profile ? count + "/3 afgerond · open week ↗" : "Bekijk opdrachten ↗", "text-button", () => { selectedWeek = index + 1; showView("plan"); }));
    weeks.append(card);
  });
}

function fillScan() {
  const form = document.getElementById("scan-form");
  form.reset();
  form.elements.releaseDate.value = P.addDays(P.today(), 21);
  if (state.profile) {
    for (const [name, value] of Object.entries(state.profile)) form.elements[name].value = value;
  }
}

function renderPlan() {
  const profile = state.profile;
  const notice = document.getElementById("plan-notice");
  const summary = document.getElementById("plan-summary");
  notice.replaceChildren();
  summary.replaceChildren();
  document.getElementById("print-button").disabled = !profile;
  document.getElementById("plan-description").textContent = profile
    ? "Voor “" + profile.song + "” · release " + P.formatDate(profile.releaseDate) + " · circa " + profile.hours + " uur per week"
    : "Je kunt alle opdrachten alvast bekijken. Maak je startscan voor persoonlijke datums en accenten.";
  if (!profile) {
    const banner = el("div", "notice");
    banner.append(el("span", "", "Maak je plan passend bij jouw release en beschikbare tijd."), button("Vul mijn startscan in ↗", "text-button", () => showView("scan")));
    notice.append(banner);
  } else {
    const days = P.daysUntil(profile.releaseDate);
    if (days < 7) {
      notice.append(el("p", "notice warning", "Je releasedatum is dichtbij of al voorbij. Pak de openstaande taken op die nog passen. Een officiële Spotify-songpitch vraagt minimaal zeven dagen vóór release. Controleer de planning bij je distributeur."));
    }
    if (profile.stage === "finishing") {
      notice.append(el("p", "notice", "Je nummer is nog in de maak. Begin met je afmaakactie en bevestig de aanleverdeadline voordat je de releasedatum definitief communiceert."));
    }
    summary.append(makeProgress());
  }
  const tabs = document.getElementById("week-tabs");
  tabs.replaceChildren();
  C.weeks.forEach((week, index) => {
    const tab = button("Week " + (index + 1) + " · " + week.short, "week-tab", () => { selectedWeek = index + 1; renderPlan(); document.getElementById("week-tab-" + selectedWeek).focus(); });
    tab.id = "week-tab-" + (index + 1);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(selectedWeek === index + 1));
    tab.tabIndex = selectedWeek === index + 1 ? 0 : -1;
    tab.setAttribute("aria-controls", "week-detail");
    tab.addEventListener("keydown", event => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") selectedWeek = 1;
      else if (event.key === "End") selectedWeek = 4;
      else selectedWeek = (selectedWeek + (event.key === "ArrowRight" ? 0 : 2)) % 4 + 1;
      renderPlan();
      document.getElementById("week-tab-" + selectedWeek).focus();
    });
    tabs.append(tab);
  });
  const detail = document.getElementById("week-detail");
  detail.replaceChildren();
  detail.setAttribute("aria-labelledby", "week-tab-" + selectedWeek);
  detail.append(el("h2", "week-title", C.weeks[selectedWeek - 1].title), el("p", "week-description", C.weeks[selectedWeek - 1].description));
  for (const task of P.getTasks(profile).filter(item => item.week === selectedWeek)) {
    const done = state.completed.includes(task.id);
    const card = el("article", "task-card" + (done ? " completed" : ""));
    const check = button(done ? "✓" : "", "task-check", () => toggleTask(task.id));
    check.setAttribute("aria-label", task.title + (done ? " opnieuw openen" : " afronden"));
    check.setAttribute("aria-pressed", String(done));
    const copy = el("div", "task-copy");
    copy.append(el("h3", "", task.title), el("p", "", task.output));
    const meta = el("div", "task-meta");
    meta.append(el("span", "", "± " + task.minutes + " min"));
    if (task.date) meta.append(el("span", "", P.formatDate(task.date) + (!done && P.daysUntil(task.date) < 0 ? " · inhalen" : "")));
    if (state.notes[task.id]) meta.append(el("span", "", "Uitwerking bewaard"));
    copy.append(meta);
    card.append(check, copy, button("Werk hieraan ↗", "text-button", () => openTask(task.id)));
    detail.append(card);
  }
}

function toggleTask(id) {
  if (state.completed.includes(id)) state.completed = state.completed.filter(value => value !== id);
  else state.completed.push(id);
  saveState();
  if (activeView === "plan") renderPlan();
  if (activeView === "overzicht") renderOverview();
}

function openTask(id) {
  const task = P.getTasks(state.profile).find(item => item.id === id);
  const content = document.getElementById("task-content");
  content.replaceChildren();
  content.append(el("p", "eyebrow", "Week " + task.week + " · ± " + task.minutes + " min"));
  const title = el("h2", "", task.title);
  title.id = "task-title";
  content.append(title, el("p", "task-purpose", task.purpose));
  const steps = el("ol", "task-steps");
  for (const step of task.steps) steps.append(el("li", "", step));
  content.append(steps);
  const output = el("div", "output-note");
  output.append(el("strong", "", "Dit maak je"), el("p", "", task.output));
  content.append(output);
  if (state.profile?.hours === "1") content.append(el("p", "form-help", "Houd je eerste versie klein. Bewaar wat nog openstaat als volgende actie."));
  const label = el("label", "task-notes-label", "Mijn uitwerking en notities");
  const notes = el("textarea", "task-notes");
  notes.rows = 5;
  notes.maxLength = 30000;
  notes.placeholder = "Werk je opdracht hier uit. Je tekst wordt automatisch bewaard.";
  notes.value = state.notes[id] || "";
  notes.addEventListener("input", () => { state.notes[id] = notes.value; saveState(); });
  label.append(notes);
  content.append(label);
  const actions = el("div", "dialog-actions");
  if (task.tool) actions.append(button("Open bijpassende template ↗", "button secondary", () => { document.getElementById("task-dialog").close(); selectedTool = task.tool; showView("tools"); }));
  if (task.id === "review") actions.append(button("Open mijn terugblik ↗", "button secondary", () => { document.getElementById("task-dialog").close(); showView("reflectie"); }));
  const completion = button(state.completed.includes(id) ? "Markeer als open" : "Opdracht afgerond ✓", "button primary", () => {
    toggleTask(id);
    document.getElementById("task-dialog").close();
    notify(state.completed.includes(id) ? "Opdracht afgerond. Je voortgang is bewaard." : "Opdracht staat weer open.");
  });
  actions.append(completion);
  content.append(actions);
  if (task.source) {
    const source = el("a", "source-link", task.source.title + " ↗");
    source.href = task.source.url;
    source.target = "_blank";
    source.rel = "noopener";
    content.append(source);
  }
  document.getElementById("task-dialog").showModal();
}

function renderTools() {
  const list = document.getElementById("tool-list");
  list.replaceChildren();
  for (const tool of C.tools) {
    const choice = button("", "tool-choice" + (tool.id === selectedTool ? " active" : ""), () => { selectedTool = tool.id; renderTools(); });
    choice.append(el("span", "tool-category", tool.category), el("strong", "", tool.title), el("span", "tool-arrow", "↗"));
    choice.setAttribute("aria-pressed", String(tool.id === selectedTool));
    list.append(choice);
  }
  const tool = C.tools.find(item => item.id === selectedTool);
  const editor = document.getElementById("tool-editor");
  editor.replaceChildren();
  editor.append(el("p", "eyebrow", tool.category), el("h2", "", tool.title), el("p", "editor-description", tool.description));
  const example = el("details", "example");
  example.append(el("summary", "", "Bekijk een voorbeeld"), el("p", "", tool.example));
  editor.append(example);
  const draft = el("textarea", "template-draft");
  draft.id = "template-draft";
  draft.rows = 16;
  draft.maxLength = 30000;
  draft.setAttribute("aria-label", tool.title + " uitwerken");
  draft.spellcheck = true;
  draft.value = state.templates[tool.id] ?? tool.create(P.defaultTemplateProfile(state.profile));
  draft.addEventListener("input", () => { state.templates[tool.id] = draft.value; saveState(); });
  editor.append(draft);
  const actions = el("div", "editor-actions");
  actions.append(button("Kopieer mijn tekst ↓", "button primary", async () => {
    try {
      await navigator.clipboard.writeText(draft.value);
      notify("Je tekst is gekopieerd.");
    } catch {
      draft.focus();
      draft.select();
      notify("Je tekst is geselecteerd. Gebruik Ctrl+C of de kopieerfunctie van je apparaat.");
    }
  }));
  actions.append(button("Opnieuw invullen", "text-button", () => {
    if (!confirm("Je eigen tekst in deze template vervangen door de startversie?")) return;
    delete state.templates[tool.id];
    saveState();
    renderTools();
  }));
  editor.append(actions, el("p", "form-help", "Je eigen tekst wordt automatisch bewaard op dit apparaat."));
}

function fillReflection() {
  const form = document.getElementById("reflection-form");
  const week = form.elements.week.value;
  const entry = state.reflections[week] || {};
  for (const field of ["channel", "reach", "clicks", "worked", "next"]) form.elements[field].value = entry[field] ?? "";
}

function renderReflectionSummary() {
  const wrap = document.getElementById("reflection-summary");
  wrap.replaceChildren();
  const entries = Object.entries(state.reflections);
  if (!entries.length) {
    wrap.append(el("p", "notice", "Bewaar je eerste terugblik om een overzicht van je weken op te bouwen. Ook kleine observaties zijn waardevol."));
    return;
  }
  const grid = el("div", "reflection-grid");
  for (const [week, reflection] of entries) {
    const card = el("article", "reflection-card");
    card.append(el("p", "week-label", "Week " + week), el("h3", "", reflection.channel || "Mijn observaties"));
    const numbers = el("p", "reflection-numbers");
    numbers.textContent = (reflection.reach === null ? "—" : reflection.reach.toLocaleString("nl-NL")) + " bereik · " + (reflection.clicks === null ? "—" : reflection.clicks.toLocaleString("nl-NL")) + " linkkliks";
    card.append(numbers, el("p", "", reflection.next || reflection.worked || "Je cijfers zijn bewaard."));
    card.append(button("Bewerk terugblik ↗", "text-button", () => { document.getElementById("reflection-form").elements.week.value = week; fillReflection(); document.getElementById("reflection-form").elements.channel.focus(); }));
    grid.append(card);
  }
  wrap.append(grid);
}

document.querySelectorAll("[data-view]").forEach(item => item.addEventListener("click", () => showView(item.dataset.view)));
document.getElementById("start-button").addEventListener("click", () => showView("scan"));
document.getElementById("profile-button").addEventListener("click", () => showView("scan"));
document.getElementById("scan-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    state.profile = P.normalizeProfile(Object.fromEntries(new FormData(event.currentTarget)));
    saveState();
    selectedWeek = P.getTasks(state.profile).find(task => !state.completed.includes(task.id))?.week || 4;
    showView("plan");
    notify(storageAvailable ? "Je persoonlijke plan staat klaar." : "Je plan staat klaar. Download een back-up om het te bewaren.");
  } catch (error) {
    notify(error.message);
  }
});

const taskDialog = document.getElementById("task-dialog");
document.getElementById("close-task").addEventListener("click", () => taskDialog.close());
taskDialog.addEventListener("click", event => { if (event.target === taskDialog) taskDialog.close(); });
taskDialog.addEventListener("close", () => { if (activeView === "plan") renderPlan(); });
document.getElementById("print-button").addEventListener("click", () => {
  if (!state.profile) return;
  const section = el("section", "print-plan");
  section.append(el("h1", "", state.profile.artist + " — " + state.profile.song));
  section.append(el("p", "", "Release " + P.formatDate(state.profile.releaseDate) + " · " + state.profile.hours + " uur per week"));
  for (const task of P.getTasks(state.profile)) {
    section.append(el("h2", "", (state.completed.includes(task.id) ? "✓ " : "□ ") + task.title + " · " + P.formatDate(task.date)));
    const list = el("ol");
    task.steps.forEach(step => list.append(el("li", "", step)));
    section.append(list);
    if (state.notes[task.id]) section.append(el("p", "print-notes", state.notes[task.id]));
  }
  document.body.append(section);
  window.addEventListener("afterprint", () => section.remove(), { once: true });
  window.print();
});

document.getElementById("reflection-form").elements.week.addEventListener("change", fillReflection);
document.getElementById("reflection-form").addEventListener("submit", event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    state.reflections[data.week] = { channel: data.channel.trim(), reach: P.normalizeMetric(data.reach), clicks: P.normalizeMetric(data.clicks), worked: data.worked, next: data.next };
    saveState();
    renderReflectionSummary();
    notify("Je terugblik is bewaard.");
  } catch (error) {
    notify(error.message);
  }
});

document.getElementById("export-button").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a");
  link.href = url;
  link.download = "artist-next-step-" + P.today() + ".json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Je back-up wordt gedownload. Bewaar dit bestand op een veilige plek.");
});
document.getElementById("import-button").addEventListener("click", () => document.getElementById("import-file").click());
document.getElementById("import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("Deze back-up is te groot. Gebruik een Artist Next Step-bestand tot 2 MB.");
    const imported = P.normalizeState(JSON.parse(await file.text()));
    if (!confirm("Je huidige plan vervangen door deze back-up? Download eerst je huidige back-up als je die wilt houden.")) return;
    state = imported;
    saveState();
    fillReflection();
    showView("overzicht");
    notify("Je back-up is geopend.");
  } catch (error) {
    notify("Back-up niet geopend. " + error.message);
  } finally {
    event.target.value = "";
  }
});

window.addEventListener("hashchange", () => {
  const target = location.hash.slice(1);
  if (target === "main") {
    document.getElementById("main").focus();
    return;
  }
  if (target !== activeView) showView(target);
});
window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY) return;
  loadState();
  showView(activeView, false);
  if (activeView === "reflectie") fillReflection();
  notify("Je plan is bijgewerkt vanuit een ander tabblad.");
});

loadState();
fillReflection();
showView(location.hash.slice(1) || "overzicht", false);
