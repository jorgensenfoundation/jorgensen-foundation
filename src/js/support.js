/* AI customer-support chat widget.
 *
 * Talks to the backend POST /support/chat (support.py → Anthropic). Keeps the
 * conversation id in sessionStorage so a refresh continues the same thread, and
 * attaches the logged-in user's Bearer token when available so the ticket is
 * associated with their account.
 */
(function () {
  "use strict";

  var API = window.JF_API;
  var CONV_KEY = "jf_support_conversation";
  var GREETING =
    "Hi! I'm the Jorgensen Foundation assistant. Tell me what you're trying to do or what's going wrong, and I'll help — or pass it to our team if it needs a person.";

  function el(id) {
    return document.getElementById(id);
  }

  function authHeaders() {
    try {
      if (window.JFAuth && JFAuth.getToken && JFAuth.getToken()) {
        return { Authorization: "Bearer " + JFAuth.getToken() };
      }
    } catch (e) {}
    return {};
  }

  function init() {
    var root = el("jf-support");
    if (!root) return;

    var toggle = el("jf-support-toggle");
    var panel = el("jf-support-panel");
    var closeBtn = el("jf-support-close");
    var log = el("jf-support-log");
    var form = el("jf-support-form");
    var input = el("jf-support-input");
    var sendBtn = el("jf-support-send");

    var conversationId = null;
    try {
      conversationId = sessionStorage.getItem(CONV_KEY) || null;
    } catch (e) {}
    var greeted = false;
    var busy = false;

    function open() {
      panel.hidden = false;
      root.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      if (!greeted) {
        addMessage("assistant", GREETING);
        greeted = true;
      }
      setTimeout(function () {
        input.focus();
      }, 50);
    }

    function close() {
      panel.hidden = true;
      root.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }

    function addMessage(role, text) {
      var wrap = document.createElement("div");
      wrap.className = "jf-support-msg jf-support-msg--" + role;
      var bubble = document.createElement("div");
      bubble.className = "jf-support-bubble";
      bubble.textContent = text; // textContent — never inject HTML
      wrap.appendChild(bubble);
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return wrap;
    }

    function showTyping() {
      var wrap = document.createElement("div");
      wrap.className = "jf-support-msg jf-support-msg--assistant jf-support-typing";
      wrap.innerHTML =
        '<div class="jf-support-bubble"><span class="jf-support-dot"></span>' +
        '<span class="jf-support-dot"></span><span class="jf-support-dot"></span></div>';
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return wrap;
    }

    function setBusy(state) {
      busy = state;
      input.disabled = state;
      sendBtn.disabled = state;
    }

    function send(text) {
      addMessage("user", text);
      setBusy(true);
      var typing = showTyping();

      fetch(API + "/support/chat", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          page_url: window.location.href.slice(0, 500),
        }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, status: r.status, data: data };
          });
        })
        .then(function (res) {
          typing.remove();
          if (!res.ok) {
            var detail =
              (res.data && res.data.detail) ||
              "Sorry, something went wrong. Please email info@jorgensenfoundation.org.";
            addMessage("assistant", typeof detail === "string" ? detail : "Sorry, something went wrong.");
            return;
          }
          if (res.data.conversation_id) {
            conversationId = res.data.conversation_id;
            try {
              sessionStorage.setItem(CONV_KEY, conversationId);
            } catch (e) {}
          }
          addMessage("assistant", res.data.reply || "");
          if (res.data.escalated) {
            var note = addMessage("assistant", "✓ I've passed this to our team — they'll follow up.");
            note.classList.add("jf-support-escalated");
          }
        })
        .catch(function () {
          typing.remove();
          addMessage(
            "assistant",
            "I couldn't reach our system just now. Please email info@jorgensenfoundation.org and we'll help."
          );
        })
        .then(function () {
          setBusy(false);
          input.focus();
        });
    }

    toggle.addEventListener("click", function () {
      if (panel.hidden) open();
      else close();
    });
    closeBtn.addEventListener("click", close);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = "";
      send(text);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
