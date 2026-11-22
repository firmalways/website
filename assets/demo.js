/* In-browser demo of FirmAlways Gate. It mirrors Gate 0.3's main rules (ID checksum,
 * phones, email, bank accounts, titled names, full Thai addresses, birth dates,
 * nationality, secrets and PDPA section 26 data) but runs only on this page:
 * nothing you type is sent anywhere. */
(function () {
  "use strict";
  var input = document.getElementById("demo-input");
  var output = document.getElementById("demo-output");
  var status = document.getElementById("demo-status");
  if (!input || !output) return;

  var TEXT = {
    th: {
      secret: "บล็อก: มีรหัสผ่านหรือ API key ข้อความนี้จะไม่ถูกส่งให้ AI",
      s26: "บล็อก: มีข้อมูลอ่อนไหวตาม PDPA มาตรา 26 คู่กับตัวบุคคล ข้อความนี้จะไม่ถูกส่งให้ AI",
      masked: function (n) { return "ซ่อนข้อมูลส่วนบุคคล " + n + " จุด แล้วใส่ค่าจริงคืนในคำตอบให้คุณ"; },
      none: "ไม่พบข้อมูลส่วนบุคคล ส่งต่อได้ตามเดิม",
    },
    en: {
      secret: "Blocked: contains a password or API key. This text would not be sent to the AI.",
      s26: "Blocked: contains PDPA section 26 sensitive data about a person. This text would not be sent to the AI.",
      masked: function (n) { return "Masked " + n + " personal data item" + (n === 1 ? "" : "s") + "; the real values come back in your answer."; },
      none: "No personal data found; the text is sent as is.",
    },
  };

  var T = "[ก-ฺเ-๎]";
  var D = "[0-9๐-๙]";
  var NUM = D + "+(?:/" + D + "+)?";

  function validId(raw) {
    var d = raw.replace(/[^0-9๐-๙]/g, "").replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0e50); });
    if (d.length !== 13) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
    return (11 - (sum % 11)) % 10 === Number(d[12]);
  }

  var IDENTIFIERS = { THAI_NATIONAL_ID: 1, PHONE: 1, EMAIL: 1, BANK_ACCOUNT: 1, PERSON: 1, THAI_ADDRESS: 1, DATE_OF_BIRTH: 1 };
  var TITLE_STOP = /^(ภาพ|ค่า|สมบัติ|ช่วย|ครับ|ค่ะ|คะ|จ้าง|หน้า|แบบ|ความ|กรัฐ|พยาบาล)/;
  var SURNAME_STOP = /^(เลข|โทร|อายุ|ที่|เป็น|และ|กับ|บัตร|อีเมล|ขอ|ช่วย|ติดต่อ|ค้าง|วันเกิด|เกิด|สัญชาติ|กรุ๊ป|ผล)/;

  var rules = [
    { type: "SECRET", block: "secret", re: /(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|(?:password|passwd|รหัสผ่าน)\s*[:=]\s*\S{4,})/gi },
    { type: "THAI_NATIONAL_ID", re: new RegExp("(?<!" + D + ")" + D + "[- ]?" + D + "{4}[- ]?" + D + "{5}[- ]?" + D + "{2}[- ]?" + D + "(?!" + D + ")", "g"), check: validId },
    { type: "PHONE", re: /(?<![\d+])(?:\+66[- ]?|0)(?:[689](?:[-. ]?\d){8}|[2-57](?:[-. ]?\d){7})(?!\d)/g },
    { type: "EMAIL", re: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9-])/g },
    { type: "BANK_ACCOUNT", re: /(?<!\d)\d{3}-\d-\d{5}-\d(?!\d)/g },
    { type: "DATE_OF_BIRTH", group: 1, re: new RegExp("(?:วันเกิด|เกิดวันที่|เกิดเมื่อ|date of birth|dob|birthday)\\s*[:：]?\\s*(" + D + "{1,2}\\s*[/.-]\\s*" + D + "{1,2}\\s*[/.-]\\s*" + D + "{2,4}|\\d{4}-\\d{2}-\\d{2}|" + D + "{1,2}\\s*(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.)\\s*(?:พ\\.ศ\\.\\s*)?" + D + "{2,4})", "gi") },
    { type: "PERSON", group: 1, re: new RegExp("(?:เด็กชาย|เด็กหญิง|ด\\.ช\\.|ด\\.ญ\\.|นางสาว|น\\.ส\\.|นาง|นาย|คุณ)\\s?(" + T + "{2,20}(?: " + T + "{2,25})?)(?!" + T + ")", "g"), stop: TITLE_STOP },
    { type: "PERSON", group: 1, re: /(?<![A-Za-z])(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g },
  ];

  var ADDRESS_PART = new RegExp([
    "(?<!" + T + ")" + T + "{0,25}?(?:คอนโดมิเนียม|คอนโด|อาคาร|ทาวน์โฮม|อพาร์ตเมนต์|อพาร์ทเมนท์|แมนชั่น)(?:\\s*" + T + "+)?",
    "(?:บ้านเลขที่|เลขที่)\\s*" + NUM,
    "(?<![0-9๐-๙/])" + D + "{1,5}/" + D + "{1,5}(?![0-9๐-๙/])",
    "หมู่บ้าน\\s*" + T + "+",
    "(?:หมู่ที่|หมู่|ม\\.)\\s*" + D + "{1,3}",
    "(?:ซอย|ซ\\.)\\s*(?:" + T + "+(?:\\s*" + NUM + ")?|" + NUM + ")",
    "(?:ถนน|ถ\\.)\\s*" + T + "+",
    "(?:ตำบล|แขวง|ต\\.)\\s*" + T + "+",
    "(?:อำเภอ|เขต|อ\\.)\\s*" + T + "+",
    "(?:จังหวัด|จ\\.)\\s*" + T + "+",
    "กรุงเทพมหานคร|กรุงเทพฯ|กทม\\.?",
    "(?<!" + D + ")[1-9]" + D + "{4}(?!" + D + ")",
  ].join("|"), "g");

  var LINKED = [
    { type: "SENSITIVE", block: "s26", re: /(ผู้ป่วย|คนไข้|เบาหวาน|มะเร็ง|เอชไอวี|เอดส์|ซึมเศร้า|ตั้งครรภ์|ผลตรวจเลือด|กรุ๊ปเลือด|หมู่เลือด|ประวัติการรักษา|ประวัติอาชญากรรม|นับถือศาสนา(?:พุทธ|อิสลาม|คริสต์)?|ผู้พิการ|ลายนิ้วมือ|สหภาพแรงงาน|(?<![A-Za-z])(?:HIV|cancer|diabetes|diagnosed)(?![A-Za-z]))/gi },
    { type: "NATIONALITY", re: new RegExp("สัญชาติ\\s*" + T + "{2,15}(?!" + T + ")", "g") },
  ];

  function collect(text, list, out) {
    list.forEach(function (rule) {
      rule.re.lastIndex = 0;
      var m;
      while ((m = rule.re.exec(text))) {
        if (m[0] === "") { rule.re.lastIndex++; continue; }
        var value = rule.group ? m[rule.group] : m[0];
        var start = m.index + (rule.group ? m[0].lastIndexOf(value) : 0);
        if (rule.check && !rule.check(value)) continue;
        if (rule.stop && rule.stop.test(value)) continue;
        if (rule.type === "PERSON" && value.indexOf(" ") > 0 && SURNAME_STOP.test(value.split(" ")[1])) value = value.split(" ")[0];
        out.push({ type: rule.type, start: start, end: start + value.length, value: value, block: rule.block });
      }
    });
  }

  function addresses(text, out) {
    var groups = [];
    ADDRESS_PART.lastIndex = 0;
    var m;
    while ((m = ADDRESS_PART.exec(text))) {
      if (m[0] === "") { ADDRESS_PART.lastIndex++; continue; }
      var last = groups[groups.length - 1];
      if (last && /^[\s,]{0,3}$/.test(text.slice(last.end, m.index))) { last.end = m.index + m[0].length; last.count++; }
      else groups.push({ start: m.index, end: m.index + m[0].length, count: 1 });
    }
    groups.forEach(function (g) {
      if (g.count < 2) return;
      var lead = /^(ส่งไปที่|ไปที่|อยู่ที่|ส่งที่|ที่)/.exec(text.slice(g.start, g.end));
      var start = lead && g.end - g.start > lead[0].length + 4 ? g.start + lead[0].length : g.start;
      out.push({ type: "THAI_ADDRESS", start: start, end: g.end, value: text.slice(start, g.end) });
    });
  }

  function find(text) {
    var found = [];
    collect(text, rules, found);
    addresses(text, found);
    if (found.some(function (e) { return IDENTIFIERS[e.type]; })) collect(text, LINKED, found);
    found.sort(function (a, b) { return (b.end - b.start) - (a.end - a.start) || a.start - b.start; });
    var kept = [];
    found.forEach(function (e) {
      if (kept.every(function (k) { return e.end <= k.start || e.start >= k.end; })) kept.push(e);
    });
    return kept.sort(function (a, b) { return a.start - b.start; });
  }

  var shown = {};
  function render() {
    var text = input.value;
    var entities = find(text);
    var t = TEXT[document.documentElement.lang] || TEXT.th;
    var blocked = entities.filter(function (e) { return e.block; });
    output.textContent = "";
    if (blocked.length) {
      status.className = "demo-status blocked";
      status.textContent = blocked.some(function (e) { return e.block === "secret"; }) ? t.secret : t.s26;
      return;
    }
    var numbers = {}, tokens = {}, pos = 0;
    entities.forEach(function (e) {
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
    status.className = "demo-status";
    status.textContent = entities.length ? t.masked(entities.length) : t.none;
  }
  input.addEventListener("input", render);
  render();
})();
