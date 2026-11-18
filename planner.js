(function (root) {
  "use strict";
  const content = root.ArtistContent;
  const taskIds = new Set(content.tasks.map(task => task.id));
  const toolIds = new Set(content.tools.map(tool => tool.id));
  const fields = ["artist", "song", "genre", "releaseDate", "stage", "goal", "hours", "theme", "audience"];
  const goals = {
    first: "je eerste release zorgvuldig voorbereiden",
    audience: "meer betrokken luisteraars bereiken",
    consistent: "een haalbaar promotieritme opbouwen"
  };

  function today() {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function addDays(value, days) {
    const date = new Date(value + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function daysUntil(value, from = today()) {
    return Math.round((new Date(value + "T12:00:00Z") - new Date(from + "T12:00:00Z")) / 86400000);
  }

  function formatDate(value) {
    return new Date(value + "T12:00:00Z").toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
  }

  function emptyState() {
    return { version: 1, profile: null, completed: [], notes: {}, templates: {}, reflections: {} };
  }

  function normalizeProfile(input) {
    const profile = {};
    for (const field of fields) {
      if (typeof input[field] !== "string" || input[field].length > 500) {
        throw new Error("De startscan bevat ongeldige gegevens.");
      }
      profile[field] = input[field].trim();
    }
    if (!profile.artist || !profile.song || !profile.genre || !validDate(profile.releaseDate)) {
      throw new Error("Vul een artiestennaam, releasetitel, genre en geldige datum in.");
    }
    if (!["finishing", "ready", "delivered"].includes(profile.stage) ||
        !Object.hasOwn(goals, profile.goal) || !["1", "3", "5"].includes(profile.hours)) {
      throw new Error("Controleer je keuzes in de startscan.");
    }
    return profile;
  }

  function normalizeState(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.completed)) {
      throw new Error("Dit is geen ondersteunde Artist Next Step-back-up.");
    }
    const state = emptyState();
    if (input.profile !== null) state.profile = normalizeProfile(input.profile);
    state.completed = [...new Set(input.completed.filter(id => taskIds.has(id)))];
    for (const [key, allowed] of [["notes", taskIds], ["templates", toolIds]]) {
      for (const id of allowed) {
        const value = input[key]?.[id];
        if (typeof value === "string") state[key][id] = value.slice(0, 30000);
      }
    }
    for (const week of ["1", "2", "3", "4"]) {
      const reflection = input.reflections?.[week];
      if (!reflection || typeof reflection !== "object") continue;
      state.reflections[week] = {
        channel: String(reflection.channel || "").slice(0, 100),
        worked: String(reflection.worked || "").slice(0, 5000),
        next: String(reflection.next || "").slice(0, 5000),
        reach: normalizeMetric(reflection.reach),
        clicks: normalizeMetric(reflection.clicks)
      };
    }
    return state;
  }

  function normalizeMetric(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 1000000000) {
      throw new Error("Gebruik hele, positieve aantallen voor je resultaten.");
    }
    return number;
  }

  function getTasks(profile) {
    return content.tasks.map(task => {
      const result = { ...task, steps: [...task.steps], minutes: 35, date: null };
      if (!profile) return result;
      result.minutes = { "1": 20, "3": 35, "5": 60 }[profile.hours];
      result.date = addDays(profile.releaseDate, task.offset);
      if (task.id === "direction") {
        result.steps[0] = "Je focus is " + goals[profile.goal] + ". Beschrijf wat een betekenisvolle stap voor jou zou zijn.";
      }
      if (task.id === "story" && profile.audience) {
        result.steps[2] = "Je wilt " + profile.audience + " bereiken. Kies één detail dat je aan deze luisteraar zou laten horen of zien.";
      }
      if (task.id === "delivery" && profile.stage === "finishing") {
        result.title = "Maak je nummer en aanlevering concreet";
        result.steps[0] = "Maak een lijst van wat nog af moet aan je audio. Kies de eerstvolgende afmaakactie en spreek een deadline af.";
      }
      if (task.id === "delivery" && profile.stage === "delivered") {
        result.title = "Controleer je aangeleverde release";
        result.steps[2] = "Controleer bij je distributeur de status, de releasedatum en de gekoppelde artiestenprofielen.";
      }
      if (task.id === "content" && profile.hours === "1") {
        result.steps[1] = "Film één eenvoudige opname met je telefoon. Houd de montage beperkt tot het begin en einde.";
      }
      if (task.id === "connect" && profile.hours === "1") {
        result.title = "Leg één passend contact";
        result.steps[0] = "Kies één persoon, community of lokaal initiatief dat past bij jouw muziek.";
        result.output = "Eén passend contact en een korte notitie over de aansluiting.";
      }
      return result;
    });
  }

  function defaultTemplateProfile(profile) {
    return profile || {
      artist: "[Artiestennaam]", song: "[Releasetitel]", genre: "[jouw genre]",
      theme: "", audience: "", releaseDate: "[releasedatum]", hours: "[jouw aantal]"
    };
  }

  root.ArtistPlanner = { today, validDate, addDays, daysUntil, formatDate, emptyState, normalizeProfile, normalizeState, normalizeMetric, getTasks, defaultTemplateProfile, goals };
  if (typeof module !== "undefined" && module.exports) module.exports = root.ArtistPlanner;
})(globalThis);
