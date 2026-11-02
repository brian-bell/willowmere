import { QUESTS, journalEntries } from "../content/journal.js";

// The village's HTML overlay: toasts, the quest card and inventory, the
// conversation box, the journal and the modal dialogs.

const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];

/**
 * `state` is the save the counters show. `onCapture()` runs when a
 * conversation or a dialog takes over input: it releases the look and stops
 * walking. Focus returns to `canvas` when they close.
 */
export function createHud({ canvas, state, onCapture }) {
  let toastTimeout,
    dialogue = null;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $("#toast").classList.remove("show"), 3600);
  }
  function updateUI() {
    $("#game").classList.toggle("quest-complete", Object.values(state.quests).every(Boolean));
    for (const [key, done] of Object.entries(state.quests))
      $(`[data-quest="${key}"]`).classList.toggle("done", done);
    $("#quest-count").textContent =
      `${Object.values(state.quests).filter(Boolean).length} / ${QUESTS.length}`;
    $("#flower-count").textContent = `${Math.min(state.flowers, 3)}/3`;
    $("#inventory-flower").textContent = state.flowers;
    $("#inventory-seed").textContent = state.seeds;
    $("#coin-count").textContent = state.coins;
  }
  const modalOpen = () => !!document.querySelector("dialog[open]");
  function openDialogue(name, lines, onFinish) {
    onCapture();
    dialogue = { name, lines, index: 0, onFinish };
    $("#speaker").textContent = name;
    $("#dialogue-text").textContent = lines[0];
    $("#dialogue-next").innerHTML =
      lines.length > 1 ? "Continue <span>→</span>" : "Lovely <span>✓</span>";
    $("#dialogue").hidden = false;
    $("#dialogue-next").focus();
  }
  function nextDialogue() {
    if (!dialogue) return;
    dialogue.index++;
    if (dialogue.index < dialogue.lines.length) {
      $("#dialogue-text").textContent = dialogue.lines[dialogue.index];
      $("#dialogue-next").innerHTML =
        dialogue.index === dialogue.lines.length - 1
          ? "Lovely <span>✓</span>"
          : "Continue <span>→</span>";
    } else {
      const finish = dialogue.onFinish;
      dialogue = null;
      $("#dialogue").hidden = true;
      finish?.();
      canvas.focus();
    }
  }
  /** Closes the conversation without finishing it. */
  function dismissDialogue() {
    dialogue = null;
    $("#dialogue").hidden = true;
  }
  function refreshJournal(here) {
    $("#journal-content").replaceChildren(
      ...journalEntries(state, here).map(([title, body]) => {
        const d = document.createElement("div");
        d.className = "journal-entry";
        const b = document.createElement("b");
        b.textContent = title;
        const s = document.createElement("span");
        s.textContent = body;
        d.append(b, s);
        return d;
      }),
    );
  }
  function openModal(id) {
    onCapture();
    const d = $(id);
    if (d.open) d.close();
    else d.showModal();
  }
  /** Wires the conversation button and the dialogs' close and backdrop clicks. */
  function bindControls() {
    $("#dialogue-next").onclick = nextDialogue;
    $$(".close-modal").forEach((b) => (b.onclick = () => b.closest("dialog").close()));
    $$("dialog").forEach((d) => {
      d.addEventListener("click", (e) => {
        if (e.target === d) {
          const r = d.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
            d.close();
        }
      });
      d.addEventListener("close", () => canvas.focus());
    });
  }
  return {
    toast,
    updateUI,
    modalOpen,
    openModal,
    refreshJournal,
    bindControls,
    get inDialogue() {
      return !!dialogue;
    },
    openDialogue,
    nextDialogue,
    dismissDialogue,
  };
}
