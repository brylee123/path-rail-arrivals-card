/* PATH Rail arrival board. No dependencies or network requests. */
const PATH_STATIONS = {
  NWK: "Newark", HAR: "Harrison", JSQ: "Journal Square", GRV: "Grove Street",
  NEW: "Newport", EXP: "Exchange Place", HOB: "Hoboken", WTC: "World Trade Center",
  CHR: "Christopher Street", "09S": "9th Street", "14S": "14th Street",
  "23S": "23rd Street", "33S": "33rd Street",
};

class PathRailArrivalsCard extends HTMLElement {
  static getConfigForm() {
    const entities = { entity: { domain: "sensor", multiple: true } };
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        { name: "mode", default: "single", selector: { select: { options: [
          { value: "single", label: "Single direction" },
          { value: "bidirectional", label: "Bidirectional" },
        ], mode: "dropdown" } } },
        { name: "color_mode", default: "auto", selector: { select: { options: [
          { value: "auto", label: "Follow Home Assistant" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ], mode: "dropdown" } } },
        { name: "entities", visible: { field: "mode", value: "single" }, selector: entities },
        { name: "left_title", visible: { field: "mode", value: "bidirectional" }, selector: { text: {} } },
        { name: "left_entities", visible: { field: "mode", value: "bidirectional" }, selector: entities },
        { name: "right_title", visible: { field: "mode", value: "bidirectional" }, selector: { text: {} } },
        { name: "right_entities", visible: { field: "mode", value: "bidirectional" }, selector: entities },
        { name: "max_rows", default: 2, selector: { number: { min: 1, max: 10, mode: "box" } } },
        { name: "row_height", default: 96, selector: { number: { min: 88, max: 200, mode: "box", unit_of_measurement: "px" } } },
        { name: "min_height", default: 0, selector: { number: { min: 0, max: 1600, mode: "box", unit_of_measurement: "px" } } },
        { name: "show_alerts", default: true, selector: { boolean: {} } },
        { name: "alert_entities", selector: entities },
        { name: "station", selector: { select: { options: Object.entries(PATH_STATIONS).map(
          ([value, label]) => ({ value, label: `${label} (${value})` })
        ), mode: "dropdown" } } },
      ],
      computeLabel: (schema) => ({ title: "Title", mode: "Board layout", color_mode: "Appearance", entities: "Destination arrival sensors",
        left_title: "Left heading", right_title: "Right heading", left_entities: "Left destinations",
        right_entities: "Right destinations", max_rows: "Rows per side", show_alerts: "Show alert ticker",
        row_height: "Minimum row height", min_height: "Minimum card height (0 = automatic)",
        alert_entities: "Alert sensors (optional)", station: "Station for alerts (optional)" })[schema.name],
      computeHelper: (schema) => ({ entities: "Select next-arrival sensors, not countdowns. Each sensor represents one destination.",
        left_entities: "Choose the destinations to display on the left. This does not assign a physical platform.",
        right_entities: "Choose the destinations to display on the right.",
        alert_entities: "Leave empty to find PATH service and accessibility alert sensors automatically.",
        station: "Normally detected from the arrival sensors. Station and line-related notices plus unscoped PATH notices are included.",
        row_height: "Use the same row height and rows per side on adjacent cards to align their rows and tickers.",
        min_height: "Optional extra height. Cards fill the height supplied by a horizontal stack or grid." })[schema.name],
    };
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass.states).find((id) =>
      hass.states[id].attributes.board_type === "destination" && Array.isArray(hass.states[id].attributes.arrivals));
    return { mode: "single", color_mode: "auto", entities: entity ? [entity] : [], max_rows: 2, show_alerts: true };
  }

  setConfig(config) {
    const mode = config.mode || "single";
    if (!["single", "bidirectional"].includes(mode)) throw new Error("Choose single or bidirectional layout.");
    const colorMode = config.color_mode || "auto";
    if (!["auto", "light", "dark"].includes(colorMode)) throw new Error("Choose auto, light, or dark appearance.");
    const maxRows = Number(config.max_rows ?? 2);
    if (!Number.isInteger(maxRows) || maxRows < 1 || maxRows > 10) throw new Error("Rows per side must be between 1 and 10.");
    const rowHeight = Number(config.row_height ?? 96);
    const minHeight = Number(config.min_height ?? 0);
    if (!Number.isInteger(rowHeight) || rowHeight < 88 || rowHeight > 200) throw new Error("Minimum row height must be between 88 and 200 pixels.");
    if (!Number.isInteger(minHeight) || minHeight < 0 || minHeight > 1600) throw new Error("Minimum card height must be between 0 and 1600 pixels.");
    for (const key of ["entities", "left_entities", "right_entities", "alert_entities"]) {
      if (config[key] !== undefined && (!Array.isArray(config[key]) || config[key].some((id) => typeof id !== "string" || !id.startsWith("sensor.")))) {
        throw new Error(`${key} must be a list of sensor entity IDs.`);
      }
    }
    this._config = { ...config, mode, color_mode: colorMode, max_rows: maxRows, row_height: rowHeight, min_height: minHeight };
    this._lastStates = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    if (this._resize && this._ticker) this._resize.observe(this._ticker);
    if (!this._clockTimer) this._clockTimer = setInterval(() => this._updateClock(), 30000);
    this._updateClock();
  }

  disconnectedCallback() {
    clearInterval(this._clockTimer);
    this._clockTimer = null;
    this._resize?.disconnect();
  }

  _ids() {
    const config = this._config;
    return [...new Set(config.mode === "single" ? (config.entities || []) :
      [...(config.left_entities || []), ...(config.right_entities || [])])];
  }

  _alertIds() {
    if (this._config.alert_entities?.length) return [...new Set(this._config.alert_entities)];
    return Object.keys(this._hass.states).filter((id) =>
      ["Alerts", "Elevators & Escalators"].includes(this._hass.states[id].attributes.section));
  }

  _build() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { display:flex; flex-direction:column; min-width:0; height:100%; container-type:inline-size; }
      ha-card { display:flex; flex-direction:column; flex:1; box-sizing:border-box; min-height:var(--path-min-height,0px); overflow:hidden; background:var(--path-background,var(--ha-card-background,var(--card-background-color,#fff))); color:var(--path-text,var(--primary-text-color,#171b20)); border-radius:var(--ha-card-border-radius,12px); }
      ha-card[data-color-mode="light"] { --path-background:#fff; --path-text:#171b20; --path-secondary:#59636d; --path-divider:#ddd; --path-ticker:#0876aa; }
      ha-card[data-color-mode="dark"] { --path-background:#181e26; --path-text:#edf2f7; --path-secondary:#b4c0ce; --path-divider:#35404e; --path-ticker:#075579; }
      ha-card[data-color-mode="auto"][data-ha-dark] { --path-background:var(--ha-card-background,var(--card-background-color,#181e26)); --path-text:var(--primary-text-color,#edf2f7); --path-secondary:var(--secondary-text-color,#b4c0ce); --path-divider:var(--divider-color,#35404e); --path-ticker:#075579; }
      h2 { flex:none; box-sizing:border-box; height:64px; display:flex; align-items:center; font-size:1rem; line-height:1.25; font-weight:600; margin:0; padding:10px 14px; overflow:hidden; }
      h2 span { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; overflow-wrap:anywhere; }
      .board { flex:1; display:grid; grid-template-columns:minmax(0,1fr); min-height:calc(var(--path-row-count) * var(--path-row-height)); }
      .board.two { grid-template-columns:repeat(2,minmax(0,1fr)); min-height:calc(var(--path-row-count) * var(--path-row-height) + 40px); }
      .column { min-width:0; display:grid; grid-template-rows:repeat(var(--path-row-count),minmax(min-content,1fr)); }
      .board.two .column { grid-template-rows:40px repeat(var(--path-row-count),minmax(min-content,1fr)); }
      .column + .column { border-left:1px solid var(--path-divider,var(--divider-color,#ddd)); }
      h3 { box-sizing:border-box; font-size:.85rem; line-height:16px; max-height:40px; overflow:hidden; font-weight:500; padding:4px 14px; margin:0; color:var(--path-secondary,var(--secondary-text-color,#59636d)); }
      .row { appearance:none; box-sizing:border-box; min-width:0; min-height:var(--path-row-height); border:0; border-top:1px solid var(--path-divider,var(--divider-color,#ddd)); background:none; color:inherit; width:100%; display:grid; grid-template-columns:20px minmax(0,1fr) auto; gap:12px; align-items:center; padding:16px 18px; text-align:left; font:inherit; cursor:pointer; }
      .placeholder { box-sizing:border-box; min-height:var(--path-row-height); border-top:1px solid var(--path-divider,var(--divider-color,#ddd)); }
      .row:focus-visible { outline:2px solid var(--primary-color,#168acc); outline-offset:-3px; }
      .dot { width:20px; height:20px; border-radius:50%; box-shadow:inset 0 0 0 1px #0002; background:#89939d; }
      .destination { font-size:clamp(1rem,5cqi,1.4rem); line-height:1.2; overflow-wrap:anywhere; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; }
      .arrival { white-space:nowrap; font-size:clamp(1rem,5cqi,1.4rem); font-variant-numeric:tabular-nums; }
      .empty { grid-row:1 / -1; margin:0; padding:16px 18px; color:var(--path-secondary,var(--secondary-text-color,#59636d)); }
      .board.two .empty { grid-row:2 / -1; }
      .status .destination,.status .arrival { font-size:.9rem; }
      footer { flex:none; background:var(--path-ticker,#0876aa); color:#fff; display:flex; align-items:center; gap:12px; min-height:38px; padding:0 14px; }
      time { flex:none; font-size:.8rem; font-weight:600; font-variant-numeric:tabular-nums; }
      .ticker { overflow:hidden; min-width:0; flex:1; padding:8px 0; }
      .track { display:flex; width:max-content; }
      .track span { white-space:nowrap; padding-right:3rem; font-size:.82rem; }
      .track span + span { display:none; }
      footer[data-scroll] .track { animation: path-ticker var(--ticker-duration,40s) linear infinite; }
      footer[data-scroll] .track span + span { display:block; }
      footer:hover .track,footer:focus-within .track { animation-play-state:paused; }
      @keyframes path-ticker { to { transform:translateX(-50%); } }
      .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
      [hidden] { display:none !important; }
      @container(max-width:480px) { .row { gap:7px; padding:12px 10px; grid-template-columns:14px minmax(0,1fr) auto; } .dot { width:14px;height:14px; } h3 { padding-left:10px; } }
      @media(prefers-reduced-motion:reduce) { .track { animation:none !important; width:100%; } .track span { white-space:normal; padding-right:0; } .track span + span { display:none !important; } }
    `;
    this._card = document.createElement("ha-card");
    this._title = document.createElement("h2");
    this._titleText = document.createElement("span"); this._title.append(this._titleText);
    this._board = document.createElement("div"); this._board.className = "board";
    this._footer = document.createElement("footer"); this._footer.tabIndex = 0;
    this._footer.setAttribute("aria-label", "PATH alerts. Focus or hover to pause scrolling.");
    this._clock = document.createElement("time");
    this._ticker = document.createElement("div"); this._ticker.className = "ticker";
    this._track = document.createElement("div"); this._track.className = "track";
    this._track.setAttribute("aria-hidden", "true");
    this._tickerText = document.createElement("span");
    this._tickerCopy = document.createElement("span");
    this._track.append(this._tickerText, this._tickerCopy);
    this._accessibleAlerts = document.createElement("span"); this._accessibleAlerts.className = "sr-only";
    this._accessibleAlerts.setAttribute("aria-live", "polite");
    this._ticker.append(this._track, this._accessibleAlerts);
    this._footer.append(this._clock, this._ticker);
    this._card.append(this._title, this._board, this._footer);
    shadow.append(style, this._card);
    this._resize = new ResizeObserver(() => this._measureTicker());
    this._resize.observe(this._ticker);
  }

  _rows(ids) {
    const lists = [...new Set(ids)].map((id) => {
      const state = this._hass.states[id];
      const name = state?.attributes.destination || state?.attributes.friendly_name || id;
      if (!state || state.state === "unavailable") return [{ id, name, text: "Unavailable", colors: [], status: true }];
      if (!Array.isArray(state.attributes.arrivals)) return [{ id, name, text: "Select an arrival sensor", colors: [], status: true }];
      if (!state.attributes.arrivals.length || state.state === "unknown") return [{ id, name, text: "No predictions", colors: [], status: true }];
      return state.attributes.arrivals.map((train) => ({
        id, name: train.destination || state.attributes.destination || train.head_sign || train.target || "Unknown destination",
        text: typeof train.arrival_time_message === "string" ? train.arrival_time_message : "Unknown",
        colors: (Array.isArray(train.colors) ? train.colors : String(train.line_color || "").split(",").map((color) => `#${color}`))
          .filter((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)),
      }));
    });
    // Show one prediction for each selected destination before its later trains.
    const rows = [];
    for (let rank = 0; rank < this._config.max_rows && rows.length < this._config.max_rows; rank++) {
      for (const list of lists) if (list[rank] && rows.length < this._config.max_rows) rows.push(list[rank]);
    }
    return rows;
  }

  _column(ids, heading) {
    const column = document.createElement("section"); column.className = "column";
    if (heading) { const title = document.createElement("h3"); title.textContent = heading; title.title = heading; column.append(title); }
    const rows = this._rows(ids);
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Select destination arrival sensors in the card editor."; column.append(empty); }
    for (const row of rows) {
      const button = document.createElement("button"); button.className = `row${row.status ? " status" : ""}`;
      button.setAttribute("aria-label", `${row.name}: ${row.text}`);
      button.title = `${row.name}: ${row.text}`;
      const dot = document.createElement("span"); dot.className = "dot"; dot.setAttribute("aria-hidden", "true");
      if (row.colors.length === 1) dot.style.background = row.colors[0];
      else if (row.colors.length > 1) dot.style.background = `linear-gradient(90deg,${row.colors.map((color, i) => `${color} ${100*i/row.colors.length}% ${100*(i+1)/row.colors.length}%`).join(",")})`;
      const destination = document.createElement("span"); destination.className = "destination"; destination.textContent = row.name;
      const arrival = document.createElement("span"); arrival.className = "arrival"; arrival.textContent = row.text;
      button.append(dot, destination, arrival);
      button.addEventListener("click", () => this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: row.id }, bubbles: true, composed: true,
      })));
      column.append(button);
    }
    if (rows.length) for (let index = rows.length; index < this._config.max_rows; index++) {
      const placeholder = document.createElement("div"); placeholder.className = "placeholder";
      placeholder.setAttribute("aria-hidden", "true"); column.append(placeholder);
    }
    return column;
  }

  _alerts(ids) {
    const stations = [...new Set(this._ids().map((id) => this._hass.states[id]?.attributes.station_code).filter(Boolean))];
    const station = this._config.station || (stations.length === 1 ? stations[0] : null);
    if (!station) return "Select one station for this card's alert filtering.";
    if (!ids.length) return "PATH alert source not configured.";
    const messages = new Map(); let unavailable = false;
    for (const id of ids) {
      const state = this._hass.states[id];
      if (!state || ["unknown", "unavailable"].includes(state.state)) { unavailable = true; continue; }
      if (!Array.isArray(state.attributes.announcements)) { unavailable = true; continue; }
      for (const alert of state.attributes.announcements) {
        if (alert.active !== true || alert.source_state === "Closed") continue;
        const related = alert.related_stations || alert.stations || [];
        if (related.length && !related.includes(station)) continue;
        const message = typeof alert.message === "string" ? alert.message.trim() : "";
        if (message) messages.set(alert.incident_id || message, message.replace(/\s+/g, " "));
      }
    }
    const text = [...messages.values()].join("   •   ");
    if (unavailable) return `PATH alert source unavailable.${text ? `   •   ${text}` : ""}`;
    return text || "No active alerts reported for this station in the current feed.";
  }

  _updateClock() {
    if (this._clock) this._clock.textContent = new Date().toLocaleTimeString(this._hass?.locale?.language, { hour: "numeric", minute: "2-digit" });
  }

  _measureTicker() {
    if (this._footer) this._footer.toggleAttribute("data-scroll", this._tickerText.scrollWidth > this._ticker.clientWidth);
  }

  _render() {
    if (!this._config || !this._hass) return;
    this._build();
    this._card.style.setProperty("--path-row-count", this._config.max_rows);
    this._card.style.setProperty("--path-row-height", `${this._config.row_height}px`);
    this._card.style.setProperty("--path-min-height", `${this._config.min_height}px`);
    this._card.dataset.colorMode = this._config.color_mode;
    this._card.toggleAttribute("data-ha-dark", this._hass.themes?.darkMode === true);
    const ids = this._ids();
    const alertIds = this._config.show_alerts === false ? [] : this._alertIds();
    const states = [...ids, ...alertIds].map((id) => this._hass.states[id]);
    const locale = this._hass.locale?.language;
    if (this._lastStates?.length === states.length && states.every((state, i) => state === this._lastStates[i]) && this._lastLocale === locale) return;
    this._lastStates = states; this._lastLocale = locale;
    const stationName = ids.map((id) => this._hass.states[id]?.attributes.station_name).find(Boolean);
    this._titleText.textContent = this._config.title || (stationName ? `PATH ${stationName}` : "PATH arrivals");
    this._title.title = this._titleText.textContent;
    this._board.classList.toggle("two", this._config.mode === "bidirectional");
    this._board.replaceChildren(...(this._config.mode === "single"
      ? [this._column(this._config.entities || [], "")]
      : [this._column(this._config.left_entities || [], this._config.left_title || "Direction 1"),
         this._column(this._config.right_entities || [], this._config.right_title || "Direction 2")]));
    this._footer.hidden = this._config.show_alerts === false;
    const alertText = this._alerts(alertIds);
    if (this._tickerText.textContent !== alertText) {
      this._tickerText.textContent = alertText; this._tickerCopy.textContent = alertText;
      this._accessibleAlerts.textContent = alertText;
      this._footer.title = alertText;
      this._footer.style.setProperty("--ticker-duration", `${Math.max(20, Math.min(120, alertText.length * .12))}s`);
    }
    this._updateClock();
    requestAnimationFrame(() => this._measureTicker());
  }

  getCardSize() {
    const content = 64 + (this._config?.max_rows ?? 2) * (this._config?.row_height ?? 96)
      + (this._config?.mode === "bidirectional" ? 40 : 0) + (this._config?.show_alerts === false ? 0 : 38);
    return Math.ceil(Math.max(content, this._config?.min_height ?? 0) / 50);
  }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }
}

if (!customElements.get("path-rail-arrivals-card")) customElements.define("path-rail-arrivals-card", PathRailArrivalsCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "path-rail-arrivals-card")) window.customCards.push({
  type: "path-rail-arrivals-card", name: "PATH arrival board",
  description: "Destination arrival rows with single-direction or bidirectional layouts and a station alert ticker.",
  preview: false, documentationURL: "https://github.com/brylee123/path-rail-arrivals-card#configuration",
});
