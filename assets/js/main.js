(function () {
  // Hero: daily ISPU strip (Jakarta, highest reading across five stations)
  var box = document.getElementById("airstrip");
  if (box && window.ISPU_DAILY) {
    var data = window.ISPU_DAILY;
    var W = 1000, H = 190, top = 12, bottom = 22, maxV = 210;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Daily air quality index for Jakarta from January 2024 to November 2025. 14 good days, 524 moderate days, 162 unhealthy days.");
    var plotH = H - top - bottom;
    var y = function (v) { return top + plotH - (v / maxV) * plotH; };
    var bw = W / data.length;
    var color = function (v) { return v <= 50 ? "var(--green)" : v <= 100 ? "var(--blue)" : "var(--amber)"; };
    var label = function (v) { return v <= 50 ? "Good" : v <= 100 ? "Moderate" : "Unhealthy"; };

    [50, 100].forEach(function (t) {
      var l = document.createElementNS(ns, "line");
      l.setAttribute("x1", 0); l.setAttribute("x2", W);
      l.setAttribute("y1", y(t)); l.setAttribute("y2", y(t));
      l.setAttribute("class", "thr");
      l.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(l);
    });

    var bars = [];
    data.forEach(function (d, i) {
      var r = document.createElementNS(ns, "rect");
      r.setAttribute("x", (i * bw).toFixed(2));
      r.setAttribute("width", Math.max(bw - 0.35, 0.6).toFixed(2));
      r.setAttribute("y", y(d[1]).toFixed(2));
      r.setAttribute("height", (top + plotH - y(d[1])).toFixed(2));
      r.setAttribute("fill", color(d[1]));
      r.setAttribute("class", "bar");
      svg.appendChild(r);
      bars.push(r);
    });

    var chart = box.querySelector(".airstrip-chart");
    [[50, "50"], [100, "100"]].forEach(function (t) {
      var s = document.createElement("span");
      s.className = "thr-label";
      s.style.top = ((y(t[0]) / H) * 100) + "%";
      s.textContent = t[1];
      chart.appendChild(s);
    });
    data.forEach(function (d, i) {
      if (d[0].slice(5) === "01-01") {
        var s = document.createElement("span");
        s.className = "year-label";
        s.style.left = ((i / data.length) * 100) + "%";
        s.textContent = d[0].slice(0, 4);
        chart.appendChild(s);
      }
    });

    chart.appendChild(svg);
    var tip = document.createElement("div");
    tip.className = "air-tip";
    chart.appendChild(tip);

    var fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
    var last = null;
    function show(clientX) {
      var rect = svg.getBoundingClientRect();
      var i = Math.min(data.length - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * data.length)));
      if (last !== null) bars[last].classList.remove("on");
      bars[i].classList.add("on");
      last = i;
      var d = data[i];
      tip.textContent = fmt.format(new Date(d[0] + "T00:00:00")) + ", ISPU " + d[1] + ", " + label(d[1]);
      var x = ((i + 0.5) / data.length) * rect.width;
      x = Math.min(Math.max(x, 90), rect.width - 90);
      tip.style.left = x + "px";
      tip.classList.add("show");
    }
    function hide() {
      if (last !== null) bars[last].classList.remove("on");
      last = null;
      tip.classList.remove("show");
    }
    svg.addEventListener("pointermove", function (e) { show(e.clientX); });
    svg.addEventListener("pointerleave", hide);
  }

  // Show "Download CV" buttons only when the CV file is actually deployed
  var cvLinks = document.querySelectorAll("[data-cv]");
  if (cvLinks.length && window.fetch) {
    fetch(cvLinks[0].getAttribute("href"), { method: "HEAD" }).then(function (r) {
      if (r.ok) cvLinks.forEach(function (a) { a.hidden = false; });
    }).catch(function () {});
  }

  // Project type tabs (Data Analyst / System Analyst): linkable as #data and #system, remembered for this visit
  var tabs = document.querySelectorAll('.ptabs [role="tab"]');
  if (tabs.length) {
    var store = { get: function () { try { return sessionStorage.getItem("ptab"); } catch (e) { return null; } },
                  set: function (v) { try { sessionStorage.setItem("ptab", v); } catch (e) {} } };
    var ids = Array.prototype.map.call(tabs, function (t) { return t.id; });
    function activate(id, focus) {
      if (ids.indexOf(id) === -1) return;
      tabs.forEach(function (t) {
        var on = t.id === id;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
        if (on && focus) t.focus();
      });
      store.set(id);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        activate(t.id);
        if (history.replaceState) history.replaceState(null, "", "#" + t.id);
      });
      t.addEventListener("keydown", function (e) {
        var k = e.key, n = null;
        if (k === "ArrowRight") n = (i + 1) % tabs.length;
        else if (k === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
        else if (k === "Home") n = 0;
        else if (k === "End") n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault(); tabs[n].click(); tabs[n].focus();
      });
    });
    // Links on this page that point at a tab (header, hero) switch it before the browser scrolls
    document.querySelectorAll('a[href$="#data"], a[href$="#system"]').forEach(function (a) {
      a.addEventListener("click", function () { activate(a.getAttribute("href").split("#")[1]); });
    });
    window.addEventListener("hashchange", function () { activate(location.hash.slice(1)); });
    var fromHash = location.hash.slice(1);
    if (ids.indexOf(fromHash) !== -1) {
      activate(fromHash);
      var target = document.getElementById(fromHash);
      if (target) setTimeout(function () { target.scrollIntoView(); }, 0);
    } else {
      activate(store.get() || ids[0]);
    }
  }

  // Project filters with counts and live status, one per section (informative feedback, easy reversal)
  document.querySelectorAll(".filters").forEach(function (group) {
    var scope = group.closest("[data-filter-scope]") || group.closest("section") || document;
    var filters = group.querySelectorAll("button");
    var items = scope.querySelectorAll(".cards [data-tools]");
    var status = scope.querySelector(".filter-status");
    var noun = (status && status.getAttribute("data-noun")) || "projects";
    var prep = (status && status.getAttribute("data-prep")) || "using";
    function matches(it, f) { return f === "all" || it.getAttribute("data-tools").split(" ").indexOf(f) !== -1; }
    filters.forEach(function (b) {
      var f = b.getAttribute("data-filter");
      var n = 0; items.forEach(function (it) { if (matches(it, f)) n++; });
      b.insertAdjacentHTML("beforeend", ' <span class="count">' + n + "</span>");
      b.addEventListener("click", function () {
        var shown = 0;
        filters.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        items.forEach(function (it) { var ok = matches(it, f); it.hidden = !ok; if (ok) shown++; });
        scope.querySelectorAll(".card-group").forEach(function (g) { g.hidden = !g.querySelector(".cards [data-tools]:not([hidden])"); });
        if (status) {
          status.innerHTML = f === "all" ? "Showing all " + shown + " " + noun
            : "Showing " + shown + " of " + items.length + " " + noun + " " + prep + " " + b.firstChild.textContent.trim() + ' <button type="button" class="linklike clear-filter">Show all</button>';
          var c = status.querySelector(".clear-filter");
          if (c) c.addEventListener("click", function () { filters[0].click(); filters[0].focus(); });
        }
      });
    });
  });

  // Toast for closure after an action
  var toast = document.createElement("div");
  toast.className = "toast"; toast.setAttribute("role", "status"); toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);
  var tt;
  function say(msg) {
    toast.textContent = msg; toast.classList.add("show");
    clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove("show"); }, 2600);
  }
  document.querySelectorAll("[data-toast]").forEach(function (a) {
    a.addEventListener("click", function () { say(a.getAttribute("data-toast")); });
  });

  // Copy email / phone, a fallback when no mail app is set up (error prevention)
  document.querySelectorAll("button.copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.getAttribute("data-copy");
      var done = function () { b.textContent = "Copied"; say(v + " copied to clipboard"); setTimeout(function () { b.textContent = "Copy"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, function () { say("Could not copy, please select the text"); });
      else say("Could not copy, please select the text");
    });
  });

  // External links: say they open a new tab
  document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
    if (!a.querySelector(".sr-only")) a.insertAdjacentHTML("beforeend", '<span class="sr-only"> (opens in a new tab)</span>');
    a.classList.add("ext");
  });

  // Current section in the header (reduce memory load)
  var navLinks = document.querySelectorAll('.site-nav a[href^="index.html#"]');
  if (navLinks.length && "IntersectionObserver" in window) {
    var map = {};
    navLinks.forEach(function (a) { map[a.getAttribute("href").split("#")[1]] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          navLinks.forEach(function (a) { a.removeAttribute("aria-current"); });
          map[e.target.id].setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Back to top (user in control, easy reversal)
  var top = document.createElement("a");
  top.href = "#main"; top.className = "to-top"; top.textContent = "↑ Top"; top.setAttribute("aria-label", "Back to top");
  document.body.appendChild(top);
  window.addEventListener("scroll", function () { top.classList.toggle("show", window.scrollY > 900); }, { passive: true });

  // Slide lightbox
  var dlg = document.querySelector("dialog.lightbox");
  if (dlg) {
    var img = dlg.querySelector("img");
    document.querySelectorAll(".gallery button, .docview-pages button").forEach(function (b) {
      b.addEventListener("click", function () {
        var src = b.querySelector("img");
        img.src = src.src;
        img.alt = src.alt;
        dlg.showModal();
      });
    });
    dlg.querySelector("button").setAttribute("aria-label", "Close enlarged slide");
    dlg.querySelector("button").addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }
})();
