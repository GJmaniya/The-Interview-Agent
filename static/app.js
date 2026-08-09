const els = {
  select: document.getElementById("candidateSelect"),
  dossierCard: document.getElementById("dossierCard"),
  dCallsign: document.getElementById("dCallsign"),
  dName: document.getElementById("dName"),
  dRole: document.getElementById("dRole"),
  beginBtn: document.getElementById("beginBtn"),
  resetBtn: document.getElementById("resetBtn"),
  log: document.getElementById("log"),
  logEmpty: document.getElementById("logEmpty"),
  replyForm: document.getElementById("replyForm"),
  replyInput: document.getElementById("replyInput"),
  sendBtn: document.getElementById("sendBtn"),
  statusDot: document.getElementById("statusDot"),
  statusLabel: document.getElementById("statusLabel"),
  pulseDot: document.getElementById("pulseDot"),
  progressPanel: document.getElementById("progressPanel"),
  progressBar: document.getElementById("progressBar"),
  progressCount: document.getElementById("progressCount"),
  daysCount: document.getElementById("daysCount"),
  dayChips: document.getElementById("dayChips"),
  briefPanel: document.getElementById("briefPanel"),
  briefText: document.getElementById("briefText"),
  rightTitle: document.getElementById("rightTitle"),
  debrief: document.getElementById("debrief"),
  fSummary: document.getElementById("fSummary"),
  fStrengths: document.getElementById("fStrengths"),
  fGaps: document.getElementById("fGaps"),
  fNext: document.getElementById("fNext"),
  errorBanner: document.getElementById("errorBanner"),
};

let candidates = [];
let sessionId = null;

function newSessionId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "sess-" + Math.random().toString(36).slice(2) + Date.now();
}

function showError(message) {
  els.errorBanner.textContent = message;
  els.errorBanner.hidden = false;
}
function clearError() {
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = "";
}

function setStatus(state) {
  // state: 'standby' | 'listening' | 'processing' | 'done'
  const map = {
    standby: { label: "STANDBY", dotClass: "bg-outline-variant", pulseClass: "" },
    listening: { label: "LISTENING", dotClass: "bg-secondary", pulseClass: "agent-pulse-listening" },
    processing: { label: "PROCESSING", dotClass: "bg-primary", pulseClass: "agent-pulse-processing" },
    done: { label: "COMPLETE", dotClass: "bg-secondary", pulseClass: "" },
  };
  const s = map[state] || map.standby;
  els.statusLabel.textContent = s.label;
  els.statusDot.className = "w-1.5 h-1.5 rounded-full " + s.dotClass;
  els.pulseDot.className = "absolute -bottom-1 -right-1 w-2 h-2 rounded-full " + s.dotClass + " " + s.pulseClass;
}

function appendLine(kind, tag, text) {
  els.logEmpty.hidden = true;
  const wrap = document.createElement("div");

  if (kind === "you") {
    wrap.className = "chat-line flex flex-col items-end gap-1 max-w-[85%] self-end";
    wrap.innerHTML = `
      <div class="text-on-surface-variant font-technical-label text-[10px] uppercase">${tag}</div>
      <div class="bg-surface-variant border border-outline-variant/30 rounded-lg rounded-tr-none px-4 py-3 text-on-surface font-body-sm shadow-sm"></div>`;
    wrap.querySelector("div:last-child").textContent = text;
  } else if (kind === "agent") {
    wrap.className = "chat-line flex flex-col items-start gap-1 max-w-[85%] self-start";
    wrap.innerHTML = `
      <div class="text-secondary font-technical-label text-[10px] uppercase">${tag}</div>
      <div class="glass-panel border-l-2 border-l-secondary rounded-lg rounded-tl-none px-4 py-3 text-on-surface font-body-sm shadow-md"></div>`;
    wrap.querySelector("div:last-child").textContent = text;
  } else {
    wrap.className = "chat-line flex flex-col items-start gap-1 max-w-[85%] self-start mt-1";
    wrap.innerHTML = `
      <div class="glass-panel rounded-lg px-4 py-2 flex items-center gap-3">
        <span class="material-symbols-outlined text-secondary opacity-70 animate-spin" style="font-size:16px">sync</span>
        <span class="font-technical-label text-[10px] text-secondary opacity-70 tracking-widest uppercase"></span>
      </div>`;
    wrap.querySelector("span:last-child").textContent = text;
  }

  els.log.appendChild(wrap);
  els.log.scrollTop = els.log.scrollHeight;
  return wrap;
}

function updateProgress(progress) {
  if (!progress) return;
  const qPct = Math.min(100, Math.round((progress.questionsAsked / progress.minQuestions) * 100));
  els.progressBar.style.width = qPct + "%";
  els.progressCount.textContent = `${progress.questionsAsked} / ${progress.minQuestions} QUESTIONS`;
  els.daysCount.textContent = `${progress.daysCovered.length} / ${progress.minDistinctDays}`;
  els.dayChips.innerHTML = "";
  progress.daysCovered.forEach((day) => {
    const chip = document.createElement("span");
    chip.className = "day-chip";
    chip.textContent = "DAY " + day;
    els.dayChips.appendChild(chip);
  });
}

async function loadCandidates() {
  try {
    const res = await fetch("/api/candidates");
    const data = await res.json();
    candidates = data.candidates || [];

    els.select.innerHTML = "";
    if (candidates.length === 0) {
      els.select.innerHTML = '<option value="">No candidates found</option>';
      return;
    }
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— choose a candidate —";
    els.select.appendChild(placeholder);

    for (const c of candidates) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = `${c.id} · ${c.name} · ${c.jobRole}`;
      els.select.appendChild(opt);
    }
    els.select.disabled = false;
  } catch (err) {
    showError("Could not load the candidate roster. Is the server running?");
  }
}

function onCandidateChange() {
  const id = els.select.value;
  const candidate = candidates.find((c) => c.id === id);
  if (!candidate) {
    els.dossierCard.hidden = true;
    els.beginBtn.disabled = true;
    els.briefText.textContent = "No candidate selected yet.";
    return;
  }
  els.dCallsign.textContent = candidate.id;
  els.dName.textContent = candidate.name;
  els.dRole.textContent = candidate.jobRole;
  els.dossierCard.hidden = false;
  els.beginBtn.disabled = false;
  els.briefText.textContent = `${candidate.name} — target role: ${candidate.jobRole}. Interview questions are drawn from their actual mission history.`;
}

async function callInterview(body) {
  const res = await fetch("/api/interview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function renderFeedback(feedback) {
  els.fSummary.textContent = feedback.summary || "";
  const fill = (listEl, items) => {
    listEl.innerHTML = "";
    (items || []).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      listEl.appendChild(li);
    });
    if (!items || items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Nothing noted.";
      listEl.appendChild(li);
    }
  };
  fill(els.fStrengths, feedback.strengths);
  fill(els.fGaps, feedback.gaps);

  els.fNext.innerHTML = "";
  (feedback.next && feedback.next.length ? feedback.next : ["No specific recommendation noted."]).forEach((item) => {
    const card = document.createElement("div");
    card.className = "directive-card";
    card.innerHTML = `
      <div class="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1.5">
        <span class="material-symbols-outlined" style="font-size:16px">lightbulb</span> Recommended
      </div>
      <p class="text-on-surface-variant text-sm leading-relaxed"></p>`;
    card.querySelector("p").textContent = item;
    els.fNext.appendChild(card);
  });

  els.rightTitle.textContent = "Session Evaluation";
  els.progressPanel.hidden = true;
  els.briefPanel.hidden = true;
  els.debrief.hidden = false;
}

function endSession() {
  els.replyInput.disabled = true;
  els.sendBtn.disabled = true;
  els.replyInput.placeholder = "Interview complete.";
  els.resetBtn.hidden = false;
  setStatus("done");
}

async function beginInterview() {
  const candidateId = els.select.value;
  if (!candidateId) return;

  clearError();
  els.beginBtn.disabled = true;
  els.select.disabled = true;
  sessionId = newSessionId();
  setStatus("processing");

  try {
    const data = await callInterview({ sessionId, candidateId });
    setStatus("listening");
    appendLine("agent", "THE EXPERT OBSERVER", data.reply);
    updateProgress(data.progress);
    els.replyInput.disabled = false;
    els.sendBtn.disabled = false;
    els.replyInput.placeholder = "Type your response…";
    els.replyInput.focus();
  } catch (err) {
    showError("Could not start the interview: " + err.message);
    setStatus("standby");
    els.select.disabled = false;
    els.beginBtn.disabled = false;
  }
}

async function sendReply(event) {
  event.preventDefault();
  const message = els.replyInput.value.trim();
  if (!message || !sessionId) return;

  clearError();
  appendLine("you", "CANDIDATE", message);
  els.replyInput.value = "";
  els.replyInput.disabled = true;
  els.sendBtn.disabled = true;
  setStatus("processing");
  const thinking = appendLine("system", "", "Analyzing input stream…");

  try {
    const data = await callInterview({ sessionId, message });
    thinking.remove();
    appendLine("agent", "THE EXPERT OBSERVER", data.reply);

    if (data.done) {
      endSession();
      if (data.feedback) renderFeedback(data.feedback);
    } else {
      setStatus("listening");
      updateProgress(data.progress);
      els.replyInput.disabled = false;
      els.sendBtn.disabled = false;
      els.replyInput.focus();
    }
  } catch (err) {
    thinking.remove();
    showError("Something went wrong: " + err.message);
    setStatus("listening");
    els.replyInput.disabled = false;
    els.sendBtn.disabled = false;
  }
}

function resetConsole() {
  sessionId = null;
  els.log.innerHTML = "";
  els.logEmpty.hidden = false;
  els.log.appendChild(els.logEmpty);

  els.debrief.hidden = true;
  els.progressPanel.hidden = false;
  els.briefPanel.hidden = false;
  els.rightTitle.textContent = "Session Telemetry";
  els.progressBar.style.width = "0%";
  els.progressCount.textContent = "0 / 8 QUESTIONS";
  els.daysCount.textContent = "0 / 4";
  els.dayChips.innerHTML = "";

  els.resetBtn.hidden = true;
  els.replyInput.value = "";
  els.replyInput.placeholder = "Awaiting session start…";
  els.select.disabled = false;
  els.beginBtn.disabled = els.select.value === "";
  clearError();
  setStatus("standby");
}

els.select.addEventListener("change", onCandidateChange);
els.beginBtn.addEventListener("click", beginInterview);
els.replyForm.addEventListener("submit", sendReply);
els.resetBtn.addEventListener("click", resetConsole);

setStatus("standby");
loadCandidates().then(() => {
  const preselect = window.__PRESELECT_CANDIDATE__;
  if (preselect && candidates.some((c) => c.id === preselect)) {
    els.select.value = preselect;
    onCandidateChange();
  }
});
