// Select elements
const chatToggleBtn = document.getElementById("chatbot-button");
const chatWindow = document.getElementById("chatbot-window");
const chatMessages = document.getElementById("chatbot-messages");
const chatInput = document.getElementById("chatbot-input");

// Toggle chatbot window
chatToggleBtn.addEventListener("click", () => {
  chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";

  // First open → send greeting once
  if (chatMessages.childElementCount === 0) {
    addMessage("bot", "👋 Hi! I’m your Campus Chatbot. How can I help you today?");
    showQuickReplies(["Library Hours", "Class Schedules", "Office Location"]);
  }
});

// Add simple text bubble
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = sender === "user" ? "chat-user" : "chat-bot";
  msg.innerText = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show quick reply buttons
function showQuickReplies(buttons = []) {
  removeQuickReplies();
  if (buttons.length === 0) return;

  const container = document.createElement("div");
  container.id = "quick-replies";
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.gap = "6px";
  container.style.marginTop = "6px";

  buttons.forEach(text => {
    const btn = document.createElement("button");
    btn.className = "quick-reply-btn";
    btn.innerText = text;
    btn.onclick = () => {
      chatInput.value = text;
      sendMessage();
    };
    container.appendChild(btn);
  });

  chatMessages.appendChild(container);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeQuickReplies() {
  const qr = document.getElementById("quick-replies");
  if (qr) qr.remove();
}

// Typing indicator
function showTyping() {
  const typing = document.createElement("div");
  typing.className = "chat-bot";
  typing.id = "typing";
  typing.innerText = "typing...";
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById("typing");
  if (typing) typing.remove();
}

// MAIN sendMessage function
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  chatInput.value = "";
  removeQuickReplies();

  // Local greeting shortcuts
  if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
    addMessage("bot", "👋 Hello! How can I assist you today?");
    showQuickReplies(["Library Hours", "Campus Map", "Exam Info"]);
    return;
  }

  // Local thanks response
  if (["thanks", "thank you", "thx"].includes(text.toLowerCase())) {
    addMessage("bot", "You're welcome! 😊 Let me know if you need anything else.");
    return;
  }

  showTyping();

  try {
    const res = await fetch("http://127.0.0.1:5000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: text })
    });

    const data = await res.json();
    hideTyping();

    // ⬇️ Use rich bot handler (supports links/images/PDFs)
    addBotMessage(data);

    if (data.quick_replies && data.quick_replies.length > 0) {
      showQuickReplies(data.quick_replies);
    }

  } catch (err) {
    hideTyping();
    addMessage("bot", "⚠️ Could not connect to the server. Please check if backend is running.");
  }
}

// Send on Enter
chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// RICH MESSAGE HANDLER (links, images, PDFs)
function addBotMessage(data) {
  const msgBox = document.getElementById("chatbot-messages");

  // Answer bubble
  const botMsg = document.createElement("div");
  botMsg.classList.add("chat-bot");
  botMsg.innerText = data.answer;
  msgBox.appendChild(botMsg);

  // Show image  
  if (data.image) {
    const img = document.createElement("img");
    img.src = data.image;
    img.style.maxWidth = "100%";
    img.style.borderRadius = "10px";
    img.style.marginTop = "6px";
    msgBox.appendChild(img);
  }

  // Show PDF as a quick-reply style button
  if (data.file) {
      const pdfBtn = document.createElement("button");
      pdfBtn.className = "quick-reply-btn";
      pdfBtn.innerText = "📄 Download PDF";
      pdfBtn.onclick = () => {
          window.open(data.file, "_blank");
      };

      const wrapper = document.createElement("div");
      wrapper.appendChild(pdfBtn);

      msgBox.appendChild(wrapper);
  }

  // Show external link
  if (data.link) {
    const linkBtn = document.createElement("button");
    linkBtn.className = "quick-reply-btn";
    linkBtn.innerText = "🔗Open Link";
    linkBtn.onclick = () => {
        window.open(data.link, "_blank");
    };

    const wrapper = document.createElement("div");
    wrapper.appendChild(linkBtn);

    msgBox.appendChild(wrapper);
}

  msgBox.scrollTop = msgBox.scrollHeight;
}
