/* In-browser demo of FirmAlways Gate masking. A small subset of Gate's real rules,
 * running only on this page: nothing you type is sent anywhere. */
(function () {
  "use strict";
  var input = document.getElementById("demo-input");
  var output = document.getElementById("demo-output");
  var status = document.getElementById("demo-status");
  if (!input || !output) return;

  var TEXT = {
    th: {
      blocked: "ข้อความนี้จะไม่ถูกส่งให้ AI เพราะมีรหัสผ่านหรือ API key",
      masked: function (n) { return "ซ่อนข้อมูลส่วนบุคคล " + n + " จุด แล้วใส่ค่าจริงคืนในคำตอบให้คุณ"; },
      none: "ไม่พบข้อมูลส่วนบุคคล ส่งต่อได้ตามเดิม",
    },
    en: {
      blocked: "This text would not be sent to the AI because it contains a password or API key.",
      masked: function (n) { return "Masked " + n + " personal data item" + (n === 1 ? "" : "s") + "; the real values come back in your answer."; },
      none: "No personal data found; the text is sent as is.",
    },
  };
  var T = "[ก-ฺเ-๎]";
  function validId(raw) {
    var d = raw.replace(/\D/g, "");
    if (d.length !== 13) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
    return (11 - (sum % 11)) % 10 === Number(d[12]);
  }
  var rules = [
    { type: "SECRET", re: /(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|(?:password|รหัสผ่าน)\s*[:=]\s*\S{4,})/gi, block: true },
    { type: "THAI_NATIONAL_ID", re: /(?<!\d)\d[- ]?\d{4}[- ]?\d{5}[- ]?\d{2}[- ]?\d(?!\d)/g, check: validId },
    { type: "PHONE", re: /(?<![\d+])(?:\+66[- ]?|0)(?:[689](?:[-. ]?\d){8}|[2-57](?:[-. ]?\d){7})(?!\d)/g },
    { type: "EMAIL", re: /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
    { type: "BANK_ACCOUNT", re: /(?<!\d)\d{3}-\d-\d{5}-\d(?!\d)/g },
    { type: "PERSON", re: new RegExp("(?:นางสาว|นาง|นาย|คุณ|ด\\.ช\\.|ด\\.ญ\\.)(" + T + "{2,20}(?: " + T + "{2,25})?)(?!" + T + ")", "g"), group: 1,
      stop: /^(ภาพ|ค่า|สมบัติ|ช่วย|ครับ|ค่ะ|จ้าง|หน้า|แบบ|ความ)/ },
  ];
  var surnameStop = /^(เลข|โทร|อายุ|ที่|เป็น|และ|กับ|บัตร|อีเมล|ขอ|ช่วย|ติดต่อ|ค้าง)/;

  function find(text) {
    var found = [];
    rules.forEach(function (rule) {
      rule.re.lastIndex = 0;
      var m;
      while ((m = rule.re.exec(text))) {
        var value = rule.group ? m[rule.group] : m[0];
        var start = m.index + (rule.group ? m[0].indexOf(value) : 0);
        if (rule.check && !rule.check(value)) continue;
        if (rule.stop && rule.stop.test(value)) continue;
        if (rule.type === "PERSON" && value.indexOf(" ") > 0 && surnameStop.test(value.split(" ")[1])) {
          value = value.split(" ")[0];
        }
        found.push({ type: rule.type, start: start, end: start + value.length, value: value, block: !!rule.block });
      }
    });
    found.sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var kept = [], last = -1;
    found.forEach(function (e) { if (e.start >= last) { kept.push(e); last = e.end; } });
    return kept;
  }

  var shown = {};
  function render() {
    var text = input.value;
    var entities = find(text);
    var numbers = {}, tokens = {}, pos = 0, blocked = [];
    output.textContent = "";
    entities.forEach(function (e) {
      if (e.block) { blocked.push(e.type); return; }
      output.appendChild(document.createTextNode(text.slice(pos, e.start)));
      var key = e.type + ":" + e.value.replace(/[\s-]/g, "");
      if (!tokens[key]) { numbers[e.type] = (numbers[e.type] || 0) + 1; tokens[key] = "«" + e.type + "_" + numbers[e.type] + "»"; }
      var span = document.createElement("span");
      span.className = "tok" + (shown[tokens[key]] ? "" : " new");
      span.textContent = tokens[key];
      output.appendChild(span);
      pos = e.end;
    });
    output.appendChild(document.createTextNode(text.slice(pos)));
    shown = {};
    Object.keys(tokens).forEach(function (k) { shown[tokens[k]] = true; });
    var masked = entities.length - blocked.length;
    var t = TEXT[document.documentElement.lang] || TEXT.th;
    if (blocked.length) {
      status.className = "demo-status blocked";
      status.textContent = t.blocked;
      output.textContent = "";
    } else {
      status.className = "demo-status";
      status.textContent = masked ? t.masked(masked) : t.none;
    }
  }
  input.addEventListener("input", render);
  render();
})();
