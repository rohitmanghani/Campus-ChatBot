// --- Add Message to Chat Window ---
function addMessage(sender, text) {
  const chatBox = document.getElementById("chatBox");

  const message = document.createElement("div");
  message.classList.add("message", sender);
  message.innerHTML = text;

  chatBox.appendChild(message);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// --- Automatic Welcome Message ---
function sendWelcomeMessage() {
  addMessage("bot", "👋 Hi! I am your Campus Chatbot. How can I help you today?");
}
sendWelcomeMessage(); // Send when page loads

// --- Send Message to Backend ---
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const query = input.value.trim();
  if (!query) return;

  // Show user message
  addMessage("user", query);
  input.value = "";

  try {
    const response = await fetch("http://127.0.0.1:5000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query })
    });

    const data = await response.json();
    addMessage("bot", data.answer || "⚠️ I couldn't understand that.");
  } 
  catch (error) {
    addMessage("bot", "⚠️ Server not reachable. Make sure Python backend is running.");
  }
}

// --- Send on ENTER Key ---
document.getElementById("chatInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter") sendMessage();
});
