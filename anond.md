---
layout: layout.vto
title: "匿名ダイアリー"
---

<div class="header">
  <h1>匿名ダイアリー</h1>
  <p>誰でも書ける。誰も読まない。</p>
</div>

<div class="anond-post">
  <textarea class="anond-textarea" placeholder="何か書いてみて" rows="5"></textarea>
  <button class="anond-submit">投稿する</button>
</div>

<div class="anond-entries"></div>

<style>
.anond-post {
  margin-bottom: 2rem;
}
.anond-textarea {
  width: 100%;
  background: var(--card-bg);
  color: var(--text);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 1rem;
  font-family: 'Noto Sans JP', sans-serif;
  font-size: 0.95rem;
  line-height: 1.8;
  resize: vertical;
  outline: none;
}
.anond-textarea:focus {
  border-color: var(--accent);
}
.anond-submit {
  margin-top: 0.5rem;
  background: var(--code-bg);
  color: var(--text);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 0.5rem 1.2rem;
  cursor: pointer;
  font-size: 0.9rem;
}
.anond-submit:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.anond-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.anond-entry {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  padding: 1.2rem 1.5rem;
  margin-bottom: 1rem;
}
.anond-entry-meta {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
.anond-entry-text {
  font-size: 0.95rem;
  line-height: 1.8;
  white-space: pre-wrap;
}
.anond-more {
  text-align: center;
  margin-top: 1rem;
}
.anond-more button {
  background: var(--code-bg);
  color: var(--text-muted);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 0.85rem;
}
.anond-more button:hover {
  color: var(--text);
}
</style>

<script>
(function() {
  var API = "https://anond.poptones.workers.dev";
  var textarea = document.querySelector(".anond-textarea");
  var submitBtn = document.querySelector(".anond-submit");
  var entriesEl = document.querySelector(".anond-entries");
  var offset = 0;
  var total = 0;

  function timeAgo(ts) {
    var diff = Date.now() - ts;
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return sec + "秒前";
    var min = Math.floor(sec / 60);
    if (min < 60) return min + "分前";
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + "時間前";
    var d = Math.floor(hr / 24);
    return d + "日前";
  }

  function renderEntry(entry) {
    var div = document.createElement("div");
    div.className = "anond-entry";
    div.innerHTML = '<div class="anond-entry-meta">' + timeAgo(entry.ts) + '</div>'
      + '<div class="anond-entry-text"></div>';
    div.querySelector(".anond-entry-text").textContent = entry.text;
    return div;
  }

  function loadEntries(append) {
    fetch(API + "/entries?offset=" + offset + "&limit=20")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        total = data.total;
        if (!append) entriesEl.innerHTML = "";
        data.entries.forEach(function(e) {
          entriesEl.appendChild(renderEntry(e));
        });
        // Remove old "more" button
        var old = entriesEl.querySelector(".anond-more");
        if (old) old.remove();
        // Add "more" if needed
        offset += data.entries.length;
        if (offset < total) {
          var more = document.createElement("div");
          more.className = "anond-more";
          more.innerHTML = "<button>もっと読む</button>";
          more.querySelector("button").addEventListener("click", function() {
            loadEntries(true);
          });
          entriesEl.appendChild(more);
        }
      });
  }

  submitBtn.addEventListener("click", function() {
    var text = textarea.value.trim();
    if (!text) return;
    submitBtn.disabled = true;
    fetch(API + "/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text })
    })
    .then(function(r) { return r.json(); })
    .then(function(entry) {
      textarea.value = "";
      submitBtn.disabled = false;
      // Prepend new entry
      var el = renderEntry(entry);
      entriesEl.insertBefore(el, entriesEl.firstChild);
    })
    .catch(function() {
      submitBtn.disabled = false;
    });
  });

  loadEntries(false);
})();
</script>
