const chatToggleBtn = document.getElementById("chatbot-button");
const suggestionTooltip = document.getElementById("suggestion-tooltip");
const tooltipCloseBtn = document.getElementById("tooltip-close");
const chatWindow = document.getElementById("chatbot-window");
const closeBtn = document.getElementById("close-btn");
const chatMessages = document.getElementById("chatbot-messages");
const chatInput = document.getElementById("chatbot-input");
const chatForm = document.getElementById("chatbot-form");
const sendBtn = document.getElementById("send-btn") || null;

let storedSessionId = null;
const MAX_SUGGESTIONS = 2;

// inactivity & conversation state
let inactivityTimer = null;
let inactivityTimeoutSec = 60;
let conversationEnded = false;

// tooltip show timer
let tooltipTimer = null;
const TOOLTIP_DELAY_MS = 2000;

// helper: start a fresh conversation (clears messages, session, enables input)
function startNewConversation() {
  conversationEnded = false;
  storedSessionId = null;
  clearInactivityTimer();
  chatMessages.innerHTML = "";
  setInputEnabled(true);

  addMessage("bot", "👋 Hi! I’m your Campus Chatbot. How can I help you today?");
  showQuickReplies(["Library Hours", "Campus Map", "Exam Info"]);
  startInactivityTimer(inactivityTimeoutSec);
}

// Toggle pulsing class helper
function setPulsing(enabled) {
  if (!chatToggleBtn) return;
  if (enabled) chatToggleBtn.classList.add("pulsing");
  else chatToggleBtn.classList.remove("pulsing");
}

// Show suggestion tooltip after delay (only when chat is closed)
function scheduleTooltip() {
  clearTimeout(tooltipTimer);
  tooltipTimer = setTimeout(() => {
    // Only show tooltip if chat window is not visible and conversation not started
    if (!chatWindow.classList.contains("show") && !conversationEnded) {
      suggestionTooltip.style.display = "flex";
      setPulsing(false); // stop pulsing while tooltip visible
    }
  }, TOOLTIP_DELAY_MS);
}

function hideTooltip() {
  suggestionTooltip.style.display = "none";
  // resume pulsing when tooltip closed and chat not open
  if (!chatWindow.classList.contains("show") && !conversationEnded) setPulsing(true);
  clearTimeout(tooltipTimer);
}

// Toggle chat window when floating button is clicked
chatToggleBtn.addEventListener("click", () => {
  // if conversation previously ended and chat hidden -> open and start new
  if (conversationEnded && !chatWindow.classList.contains("show")) {
    chatWindow.classList.add("show");
    startNewConversation();
    hideTooltip();
    setPulsing(false);
    return;
  }

  // otherwise toggle normally
  const willShow = !chatWindow.classList.contains("show");
  chatWindow.classList.toggle("show");

  // on open, if empty start conversation
  if (willShow) {
    hideTooltip();
    setPulsing(false);
    if (chatMessages.childElementCount === 0) {
      startNewConversation();
    }
  } else {
    // closed: schedule tooltip again
    scheduleTooltip();
    setPulsing(true);
  }
});

// Tooltip click: open chat and start conversation
suggestionTooltip.addEventListener("click", (e) => {
  // ignore clicks on the close button (handled separately)
  if (e.target === tooltipCloseBtn) return;
  hideTooltip();
  setPulsing(false);
  if (!chatWindow.classList.contains("show")) chatWindow.classList.add("show");
  // first open greeting handled by startNewConversation
  if (chatMessages.childElementCount === 0) startNewConversation();
  chatInput.focus();
});

// Tooltip close button
tooltipCloseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  hideTooltip();
  // keep pulsing (invite user to click button)
  setPulsing(true);
});

// Close button inside header
closeBtn.addEventListener("click", () => {
  chatWindow.classList.remove("show");
  // when closed, show tooltip after delay
  scheduleTooltip();
  setPulsing(true);
});

// Basic helper: add a chat bubble
function addMessage(sender, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${sender}`;
  const bubble = document.createElement("div");
  bubble.className = sender === "user" ? "chat-user" : "chat-bot";
  bubble.textContent = text;
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Quick replies container
function showQuickReplies(buttons = []) {
  removeQuickReplies();
  if (!buttons || buttons.length === 0) return;
  const container = document.createElement("div");
  container.id = "quick-replies";
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "8px";
  container.style.marginTop = "8px";
  buttons.forEach(text => {
    const btn = document.createElement("button");
    btn.className = "quick-reply-btn";
    btn.textContent = text;
    btn.onclick = () => {
      if (conversationEnded) return;
      chatInput.value = text;
      userInteracted();
      sendMessage();
    };
    container.appendChild(btn);
  });
  chatMessages.appendChild(container);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeQuickReplies() {
  const el = document.getElementById("quick-replies");
  if (el) el.remove();
}

function makeQuickBtn(label, onClick) {
  const btn = document.createElement("button");
  btn.className = "quick-reply-btn";
  btn.textContent = label;
  btn.onclick = () => {
    if (conversationEnded) return;
    userInteracted();
    onClick();
  };
  btn.style.marginTop = "6px";
  return btn;
}

// Render bot answer with resources + suggestions + follow-up
function addBotMessage(data) {
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper bot";

  const bubble = document.createElement("div");
  bubble.className = "chat-bot";
  bubble.textContent = data.answer || "🤔 I am not sure about that.";
  wrapper.appendChild(bubble);

  const resourceContainer = document.createElement("div");
  resourceContainer.className = "bot-resources";
  resourceContainer.style.display = "flex";
  resourceContainer.style.flexDirection = "column";
  resourceContainer.style.gap = "6px";
  resourceContainer.style.marginTop = "8px";

  if (data.file) {
    const pdfBtn = makeQuickBtn("📄 Download PDF", () => window.open(data.file, "_blank"));
    resourceContainer.appendChild(pdfBtn);
  }
  if (data.link) {
    const linkBtn = makeQuickBtn("🔗 Open Link", () => window.open(data.link, "_blank"));
    resourceContainer.appendChild(linkBtn);
  }
  if (data.image) {
    const img = document.createElement("img");
    img.src = data.image;
    img.style.maxWidth = "220px";
    img.style.borderRadius = "8px";
    img.style.marginTop = "6px";
    resourceContainer.appendChild(img);
  }

  // combine suggestions and related
  const combined = [];
  if (Array.isArray(data.suggestions)) combined.push(...data.suggestions);
  if (Array.isArray(data.related)) combined.push(...data.related);

  const seen = new Set();
  const unique = [];
  for (const item of combined) {
    if (!item || typeof item.faq_idx === "undefined") continue;
    if (seen.has(item.faq_idx)) continue;
    seen.add(item.faq_idx);
    unique.push(item);
    if (unique.length >= MAX_SUGGESTIONS) break;
  }

  if (unique.length > 0) {
    const suggestionTitle = document.createElement("div");
    suggestionTitle.style.marginTop = "8px";
    suggestionTitle.style.fontSize = "13px";
    suggestionTitle.style.color = "#333";
    suggestionTitle.textContent = "Did you mean:";
    resourceContainer.appendChild(suggestionTitle);

    unique.forEach(s => {
      const label = s.question || s;
      const btn = makeQuickBtn(label, () => {
        addMessage("user", label);
        sendQueryToBackend(label);
      });
      resourceContainer.appendChild(btn);
    });
  }

  if (resourceContainer.childElementCount > 0) wrapper.appendChild(resourceContainer);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Follow up prompt handling
  if (data.follow_up_text) {
    setTimeout(() => {
      addMessage("bot", data.follow_up_text);
      const t = data.end_convo_timeout || inactivityTimeoutSec;
      startInactivityTimer(t);
    }, 350);
  } else {
    // default inactivity timer
    startInactivityTimer(inactivityTimeoutSec);
  }
}

// send message flow
async function sendMessage() {
  if (conversationEnded) {
    // show end divider CTA
    showEndDivider();
    return;
  }

  const text = chatInput.value.trim();
  if (!text) return;

  userInteracted();
  addMessage("user", text);
  chatInput.value = "";
  removeQuickReplies();

  // typing indicator
  const typing = document.createElement("div");
  typing.className = "chat-bot typing";
  typing.textContent = "typing...";
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  await sendQueryToBackend(text);

  typing.remove();
}

// low-level request
async function sendQueryToBackend(text) {
  try {
    const res = await fetch("http://127.0.0.1:5000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text, session_id: storedSessionId })
    });
    const data = await res.json();
    if (data.session_id) storedSessionId = data.session_id;

    addBotMessage(data);

    if (data.quick_replies && data.quick_replies.length) showQuickReplies(data.quick_replies);

  } catch (err) {
    addMessage("bot", "⚠️ Could not connect to the server. Check if backend is running.");
    console.error(err);
  }
}

// form hooks
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// inactivity timer handling
function startInactivityTimer(seconds) {
  clearInactivityTimer();
  inactivityTimeoutSec = seconds || inactivityTimeoutSec;
  inactivityTimer = setTimeout(() => {
    conversationEnded = true;
    setInputEnabled(false);
    showEndDivider();
    storedSessionId = null;
    removeQuickReplies();
  }, inactivityTimeoutSec * 1000);
}
function clearInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}
function userInteracted() {
  clearInactivityTimer();
}

// conversation end divider + button
function showEndDivider() {
  // remove old
  const existing = document.getElementById("convo-end-divider");
  if (existing) existing.remove();

  const dividerWrap = document.createElement("div");
  dividerWrap.id = "convo-end-divider";
  dividerWrap.style.display = "flex";
  dividerWrap.style.flexDirection = "column";
  dividerWrap.style.alignItems = "center";
  dividerWrap.style.gap = "8px";
  dividerWrap.style.margin = "12px auto";
  dividerWrap.style.width = "100%";

  const line = document.createElement("div");
  line.style.height = "1px";
  line.style.width = "90%";
  line.style.background = "#e2e8f0";
  dividerWrap.appendChild(line);

  const text = document.createElement("div");
  text.textContent = "Conversation ended";
  text.style.fontSize = "13px";
  text.style.color = "#4a5568";
  dividerWrap.appendChild(text);

  const btn = document.createElement("button");
  btn.id = "start-new-chat-btn";
  btn.className = "quick-reply-btn";
  btn.textContent = "Start new chat";
  btn.onclick = () => {
    chatMessages.innerHTML = "";
    startNewConversation();
    hideTooltip();
    setPulsing(false);
  };
  dividerWrap.appendChild(btn);

  chatMessages.appendChild(dividerWrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// input enabling
function setInputEnabled(enabled) {
  chatInput.disabled = !enabled;
  if (sendBtn) sendBtn.disabled = !enabled;
  chatInput.placeholder = enabled ? "Type your message..." : "Conversation closed start new chat";
}

// clear timer while user types so they don't get timed out while composing
chatInput.addEventListener("input", () => {
  if (!conversationEnded) clearInactivityTimer();
});

// initial UI state
setPulsing(true);
scheduleTooltip();

// If user closes browser chat or navigates away you may want to clear timers (optional)
window.addEventListener("beforeunload", () => {
  clearInactivityTimer();
  clearTimeout(tooltipTimer);
});
