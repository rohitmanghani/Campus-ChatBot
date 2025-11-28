    const chatToggleBtn = document.getElementById("chatbot-button");
    const chatWindow = document.getElementById("chatbot-window");
    const closeBtn = document.getElementById("close-btn");
    const chatMessages = document.getElementById("chatbot-messages");
    const chatInput = document.getElementById("chatbot-input");
    const chatForm = document.getElementById("chatbot-form");
    const sendBtn = document.getElementById("send-btn");
    const suggestionTooltip = document.getElementById("suggestion-tooltip");
    const tooltipCloseBtn = document.getElementById("tooltip-close");

    let isFirstOpen = true;

    // Show suggestion tooltip after 2 seconds
    setTimeout(() => {
      if (!chatWindow.classList.contains("show")) {
        suggestionTooltip.style.display = "flex";
        // Stop pulsing when tooltip shows
        chatToggleBtn.classList.remove("pulsing");
      }
    }, 2000);

    // Close tooltip when clicking X button
    tooltipCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      suggestionTooltip.style.display = "none";
      // Resume pulsing when tooltip is closed
      chatToggleBtn.classList.add("pulsing");
    });

    // Click suggestion to open chat
    suggestionTooltip.addEventListener("click", (e) => {
      if (e.target === tooltipCloseBtn) return;
      suggestionTooltip.style.display = "none";
      // Stop pulsing when chat opens
      chatToggleBtn.classList.remove("pulsing");
      chatWindow.classList.add("show");
      if (isFirstOpen) {
        isFirstOpen = false;
        setTimeout(() => {
          addMessage("bot", "👋 Hi! I'm your Campus Assistant. How can I help you today?");
          showQuickReplies(["Library Hours", "Campus Map", "Exam Info"]);
        }, 300);
      }
      chatInput.focus();
    });

    // Toggle chat window
    chatToggleBtn.addEventListener("click", () => {
      suggestionTooltip.style.display = "none";
      chatWindow.classList.toggle("show");
      // Stop pulsing when chat is open
      if (chatWindow.classList.contains("show")) {
        chatToggleBtn.classList.remove("pulsing");
      }
      if (chatWindow.classList.contains("show") && isFirstOpen) {
        isFirstOpen = false;
        setTimeout(() => {
          addMessage("bot", "👋 Hi! I'm your Campus Assistant. How can I help you today?");
          showQuickReplies(["Library Hours", "Campus Map", "Exam Info"]);
        }, 300);
      }
      if (chatWindow.classList.contains("show")) {
        chatInput.focus();
      }
    });

    closeBtn.addEventListener("click", () => {
      chatWindow.classList.remove("show");
    });

    // Add message with avatar
    function addMessage(sender, text) {
      const wrapper = document.createElement("div");
      wrapper.className = `message-wrapper ${sender}`;

      if (sender === "bot") {
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        const img = document.createElement("img");
        img.src = "images/logo.png";
        img.alt = "Bot";
        avatar.appendChild(img);
        wrapper.appendChild(avatar);
      }

      const msg = document.createElement("div");
      msg.className = sender === "user" ? "chat-user" : "chat-bot";
      msg.textContent = text;
      wrapper.appendChild(msg);

      if (sender === "user") {
        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "👤";
        wrapper.appendChild(avatar);
      }

      chatMessages.appendChild(wrapper);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Quick replies
    function showQuickReplies(buttons = []) {
      removeQuickReplies();
      if (buttons.length === 0) return;

      const container = document.createElement("div");
      container.id = "quick-replies";

      buttons.forEach(text => {
        const btn = document.createElement("button");
        btn.className = "quick-reply-btn";
        btn.textContent = text;
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
      const wrapper = document.createElement("div");
      wrapper.className = "message-wrapper bot";
      wrapper.id = "typing";

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      const img = document.createElement("img");
      img.src = "images/logo.png";
      img.alt = "Bot";
      avatar.appendChild(img);
      wrapper.appendChild(avatar);

      const typing = document.createElement("div");
      typing.className = "typing-indicator";
      typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
      wrapper.appendChild(typing);

      chatMessages.appendChild(wrapper);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
      const typing = document.getElementById("typing");
      if (typing) typing.remove();
    }

    // Send message
    async function sendMessage() {
      const text = chatInput.value.trim();
      if (!text) return;

      addMessage("user", text);
      chatInput.value = "";
      removeQuickReplies();
      sendBtn.disabled = true;
      showTyping();

      try {
        const res = await fetch("http://127.0.0.1:5000/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: text })
        });

        const data = await res.json();
        hideTyping();

        addBotMessage(data);

        if (data.quick_replies && data.quick_replies.length > 0) {
          showQuickReplies(data.quick_replies);
        }

      } catch (err) {
        hideTyping();
        addMessage("bot", "⚠️ Could not connect to the server. Please check if backend is running.");
      }

      sendBtn.disabled = false;
    }

    // Rich message handler
    function addBotMessage(data) {
      const wrapper = document.createElement("div");
      wrapper.className = "message-wrapper bot";

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      const img = document.createElement("img");
      img.src = "images/logo.png";
      img.alt = "Bot";
      avatar.appendChild(img);
      wrapper.appendChild(avatar);

      const contentDiv = document.createElement("div");

      const botMsg = document.createElement("div");
      botMsg.className = "chat-bot";
      botMsg.textContent = data.answer;
      contentDiv.appendChild(botMsg);

      // Image
      if (data.image) {
        const mediaDiv = document.createElement("div");
        mediaDiv.className = "bot-media";
        const img = document.createElement("img");
        img.src = data.image;
        mediaDiv.appendChild(img);
        contentDiv.appendChild(mediaDiv);
      }

      // PDF
      if (data.file) {
        const pdfBtn = document.createElement("button");
        pdfBtn.className = "quick-reply-btn";
        pdfBtn.style.marginTop = "8px";
        pdfBtn.textContent = "📄 Download PDF";
        pdfBtn.onclick = () => window.open(data.file, "_blank");
        contentDiv.appendChild(pdfBtn);
      }

      // Link
      if (data.link) {
        const linkBtn = document.createElement("button");
        linkBtn.className = "quick-reply-btn";
        linkBtn.style.marginTop = "8px";
        linkBtn.textContent = "🔗 Open Link";
        linkBtn.onclick = () => window.open(data.link, "_blank");
        contentDiv.appendChild(linkBtn);
      }

      wrapper.appendChild(contentDiv);
      chatMessages.appendChild(wrapper);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Form submit
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });

    // Enter to send
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });