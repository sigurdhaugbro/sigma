import { createElement, createScreen, IOS_BLUE, type Project, uid } from "./model";

/** A working iPhone Messages-style app plus a Mac Notes window. */
export function createSampleProject(): Project {
  const list = createScreen("iphone", { name: "Messages", x: 0, y: 0 });
  const chat = createScreen("iphone", { name: "Chat — Maya", x: 493, y: 0 });
  const details = createScreen("iphone", { name: "Contact Details", x: 986, y: 0, background: "#F2F2F7" });
  const notes = createScreen("mac", { name: "Notes (Mac)", x: 1579, y: 0 });
  const board = createScreen("canvas", { name: "Storyboard", x: 0, y: 972, background: "#F7F4EE" });

  // ---------- Conversation list ----------
  list.elements.push(
    createElement("statusbar"),
    createElement("button", {
      name: "Edit",
      text: "Edit",
      x: 16,
      y: 58,
      width: 40,
      height: 28,
      fill: "transparent",
      textColor: IOS_BLUE,
      fontWeight: 400,
      textAlign: "left",
      props: { variant: "plain" },
    }),
    createElement("button", {
      name: "Compose",
      text: "",
      x: 345,
      y: 56,
      width: 32,
      height: 32,
      fill: "transparent",
      textColor: IOS_BLUE,
      props: { variant: "plain", icon: "compose" },
    }),
    createElement("text", { name: "Large Title", text: "Messages", x: 16, y: 92, width: 300, height: 41, fontSize: 34, fontWeight: 700 }),
    createElement("textfield", {
      name: "Search",
      x: 16,
      y: 140,
      width: 361,
      height: 36,
      fill: "#EEEEF0",
      radius: 10,
      props: { placeholder: "Search", fieldStyle: "search", variable: "search" },
    }),
  );
  const convos: [string, string, string, string, string][] = [
    ["Maya Chen", "{{messages.last}}", "9:41 AM", "MC", "#FF9F0A"],
    ["Dad", "Did you call your grandmother?", "Yesterday", "D", "#64D2FF"],
    ["Jordan Park", "Sending the call sheet now", "Yesterday", "JP", "#BF5AF2"],
    ["Nina", "lol that's so him", "Tuesday", "N", "#FF375F"],
    ["Sam (Work)", "Can you push the meeting to 3?", "Monday", "S", "#30D158"],
    ["+1 (555) 013-2291", "Your verification code is 482913", "Sunday", "#", "#8E8E93"],
  ];
  convos.forEach(([name, preview, time, initials, color], i) => {
    list.elements.push(
      createElement("listrow", {
        name: `Row — ${name}`,
        text: name,
        x: 0,
        y: 190 + i * 78,
        width: 393,
        height: 78,
        fontWeight: 600,
        props: { subtitle: preview, detail: time, avatar: initials, iconBg: color, chevron: true, separator: true },
        interactions:
          i === 0 ? [{ id: uid("ix_"), trigger: "tap", action: { type: "navigate", screenId: chat.id, transition: "push" } }] : [],
      }),
    );
  });
  list.elements.push(
    createElement("button", {
      name: "Muted indicator",
      text: "",
      x: 280,
      y: 228,
      width: 18,
      height: 18,
      fill: "transparent",
      textColor: "#8E8E93",
      fontSize: 13,
      showIf: "muted",
      props: { variant: "plain", icon: "bell-off" },
    }),
  );

  // ---------- Chat ----------
  chat.elements.push(
    createElement("messagelist", {
      name: "Messages",
      x: 0,
      y: 98,
      width: 393,
      height: 650,
      props: { variable: "messages", keyboardAware: true },
    }),
    createElement("statusbar"),
    createElement("navbar", {
      name: "Nav Bar",
      x: 0,
      y: 54,
      width: 393,
      height: 44,
      fill: "rgba(249,249,249,0.94)",
      props: { title: "Maya Chen", backLabel: "", rightIcon: "video" },
      interactions: [
        { id: uid("ix_"), trigger: "tap", action: { type: "navigate", screenId: details.id, transition: "push" } },
      ],
    }),
    createElement("rect", { name: "Input bar bg", x: 0, y: 752, width: 393, height: 100, fill: "#FFFFFF", radius: 0, props: { keyboardAware: true } }),
    createElement("button", {
      name: "Plus",
      text: "",
      x: 12,
      y: 758,
      width: 34,
      height: 34,
      fill: "#E9E9EB",
      textColor: "#7C7C80",
      radius: 17,
      props: { variant: "filled", icon: "plus", keyboardAware: true },
    }),
    createElement("textfield", {
      name: "Message field",
      x: 54,
      y: 758,
      width: 327,
      height: 34,
      fill: "#FFFFFF",
      radius: 17,
      props: { placeholder: "iMessage", fieldStyle: "pill", variable: "draft", keyboardAware: true },
      interactions: [
        {
          id: uid("ix_"),
          trigger: "submit",
          action: {
            type: "sendMessage",
            from: "draft",
            to: "messages",
            replies: ["Haha yes 😂", "Ok see you at 8!", "Wait, who's driving?", "👀", "Don't be late this time"],
            replyDelayMs: 1800,
          },
        },
      ],
    }),
    createElement("button", {
      name: "Send",
      text: "",
      x: 351,
      y: 761,
      width: 28,
      height: 28,
      fill: IOS_BLUE,
      textColor: "#FFFFFF",
      radius: 14,
      showIf: "draft",
      props: { variant: "filled", icon: "arrow-up", keyboardAware: true },
      interactions: [
        {
          id: uid("ix_"),
          trigger: "tap",
          action: {
            type: "sendMessage",
            from: "draft",
            to: "messages",
            replies: ["Haha yes 😂", "Ok see you at 8!", "Wait, who's driving?", "👀", "Don't be late this time"],
            replyDelayMs: 1800,
          },
        },
      ],
    }),
  );

  // ---------- Contact details ----------
  details.elements.push(
    createElement("statusbar"),
    createElement("navbar", {
      x: 0,
      y: 54,
      fill: "#F2F2F7",
      props: { title: "", backLabel: "Back" },
    }),
    createElement("rect", {
      name: "Avatar",
      text: "MC",
      x: 146,
      y: 110,
      width: 100,
      height: 100,
      radius: 50,
      fill: "#FF9F0A",
      fontSize: 40,
      fontWeight: 600,
      textColor: "#FFFFFF",
      textAlign: "center",
    }),
    createElement("text", { name: "Name", text: "Maya Chen", x: 0, y: 222, width: 393, height: 34, fontSize: 28, fontWeight: 600, textAlign: "center" }),
    createElement("rect", { name: "Group", x: 16, y: 290, width: 361, height: 156, fill: "#FFFFFF", radius: 12 }),
    createElement("listrow", {
      text: "Share My Location",
      x: 16,
      y: 290,
      width: 361,
      height: 52,
      fill: "transparent",
      props: { chevron: false, separator: true },
    }),
    createElement("toggle", { x: 310, y: 300, props: { on: false } }),
    createElement("listrow", {
      text: "Hide Alerts",
      x: 16,
      y: 342,
      width: 361,
      height: 52,
      fill: "transparent",
      props: { chevron: false, separator: true },
    }),
    createElement("toggle", { name: "Hide Alerts toggle", x: 310, y: 352, props: { on: false, variable: "muted" } }),
    createElement("listrow", {
      text: "Send Read Receipts",
      x: 16,
      y: 394,
      width: 361,
      height: 52,
      fill: "transparent",
      props: { chevron: false, separator: false },
    }),
    createElement("toggle", { x: 310, y: 404, props: { on: true } }),
    createElement("text", {
      name: "Muted hint",
      text: "Alerts are hidden. You won't be notified of new messages from Maya.",
      x: 32,
      y: 454,
      width: 329,
      height: 36,
      fontSize: 13,
      textColor: "#6D6D72",
      showIf: "muted",
    }),
  );

  // ---------- Mac Notes ----------
  notes.elements.push(
    createElement("rect", { name: "Sidebar", x: 0, y: 0, width: 260, height: 760, fill: "#F3F3F3", radius: 0 }),
    createElement("mactitlebar", { x: 0, y: 0, width: 1200, height: 52, fill: "transparent", props: { title: "" } }),
    createElement("text", { name: "iCloud", text: "iCloud", x: 20, y: 64, width: 200, height: 18, fontSize: 11, fontWeight: 700, textColor: "#8E8E93" }),
  );
  ["Shooting schedule", "Scene 14 — lines", "Groceries", "Gift ideas"].forEach((t, i) => {
    notes.elements.push(
      createElement("listrow", {
        text: t,
        x: 10,
        y: 88 + i * 52,
        width: 240,
        height: 50,
        radius: 8,
        fontSize: 13,
        fontWeight: 600,
        fill: i === 1 ? "#FFE58F" : "transparent",
        props: { subtitle: i === 1 ? "10/30/26  INT. KITCHEN – NIGHT" : "10/2" + i + "/26", chevron: false, separator: false },
      }),
    );
  });
  notes.elements.push(
    createElement("rect", { name: "Divider", x: 260, y: 0, width: 1, height: 760, fill: "#DADADA", radius: 0 }),
    createElement("text", {
      name: "Date",
      text: "October 30, 2026 at 9:41 AM",
      x: 261,
      y: 60,
      width: 939,
      height: 18,
      fontSize: 12,
      textColor: "#9A9A9A",
      textAlign: "center",
    }),
    createElement("textarea", {
      name: "Note body",
      x: 300,
      y: 90,
      width: 860,
      height: 640,
      fill: "transparent",
      fontSize: 15,
      textColor: "#1D1D1F",
      props: { variable: "note", placeholder: "Start writing…" },
    }),
  );

  board.elements.push(
    createElement("text", {
      name: "Board title",
      text: "Scene 14 — kitchen",
      x: 48,
      y: 36,
      width: 520,
      height: 40,
      fontSize: 28,
      fontWeight: 700,
      textColor: "#1D1D1F",
    }),
    createElement("rect", {
      name: "Panel 1",
      x: 48,
      y: 100,
      width: 340,
      height: 280,
      fill: "#FFFFFF",
      stroke: "#111111",
      strokeWidth: 2,
      radius: 8,
    }),
    createElement("rect", {
      name: "Panel 2",
      x: 428,
      y: 100,
      width: 340,
      height: 280,
      fill: "#FFFFFF",
      stroke: "#111111",
      strokeWidth: 2,
      radius: 8,
    }),
    createElement("rect", {
      name: "Panel 3",
      x: 808,
      y: 100,
      width: 340,
      height: 280,
      fill: "#FFFFFF",
      stroke: "#111111",
      strokeWidth: 2,
      radius: 8,
    }),
    createElement("ellipse", {
      name: "Face",
      x: 158,
      y: 160,
      width: 120,
      height: 120,
      fill: "#FFE08A",
      stroke: "#111111",
      strokeWidth: 3,
    }),
    createElement("path", {
      name: "Smile",
      x: 186,
      y: 230,
      width: 64,
      height: 28,
      fill: "transparent",
      stroke: "#111111",
      strokeWidth: 3,
      points: [
        { x: 0, y: 0.2 },
        { x: 0.35, y: 0.9 },
        { x: 0.65, y: 0.9 },
        { x: 1, y: 0.2 },
      ],
    }),
    createElement("text", { name: "Panel 1 label", text: "INT. KITCHEN – NIGHT", x: 64, y: 340, width: 308, height: 20, fontSize: 13, fontWeight: 600 }),
    createElement("rect", {
      name: "Phone",
      x: 548,
      y: 180,
      width: 100,
      height: 160,
      fill: "#111111",
      radius: 18,
      stroke: "#111111",
      strokeWidth: 2,
    }),
    createElement("rect", {
      name: "Phone screen",
      x: 558,
      y: 198,
      width: 80,
      height: 124,
      fill: "#0A84FF",
      radius: 6,
    }),
    createElement("text", { name: "Panel 2 label", text: "Phone lights up", x: 444, y: 340, width: 308, height: 20, fontSize: 13, fontWeight: 600, textAlign: "center" }),
    createElement("line", {
      name: "Look line",
      x: 860,
      y: 180,
      width: 220,
      height: 80,
      stroke: "#FF3B30",
      strokeWidth: 3,
      points: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
    }),
    createElement("path", {
      name: "Hand",
      x: 900,
      y: 220,
      width: 160,
      height: 90,
      fill: "transparent",
      stroke: "#111111",
      strokeWidth: 3,
      points: [
        { x: 0, y: 0.8 },
        { x: 0.25, y: 0.2 },
        { x: 0.45, y: 0.7 },
        { x: 0.7, y: 0.15 },
        { x: 1, y: 0.55 },
      ],
    }),
    createElement("text", { name: "Panel 3 label", text: "She reaches for it", x: 824, y: 340, width: 308, height: 20, fontSize: 13, fontWeight: 600, textAlign: "center" }),
  );

  const now = Date.now();
  return {
    id: uid("prj_"),
    version: 1,
    kind: "prototype",
    name: "Sample — Messages",
    startScreenId: list.id,
    screens: [list, chat, details, notes, board],
    variables: [
      {
        name: "messages",
        type: "messages",
        initial: [
          { id: "m1", from: "them", text: "Are you still coming tonight?" },
          { id: "m2", from: "me", text: "Yes!! What time again?" },
          { id: "m3", from: "them", text: "8. Bring the thing" },
          { id: "m4", from: "me", text: "What thing" },
          { id: "m5", from: "them", text: "You know what thing 🙃" },
        ],
      },
      { name: "draft", type: "text", initial: "" },
      { name: "search", type: "text", initial: "" },
      { name: "muted", type: "boolean", initial: false },
      {
        name: "note",
        type: "text",
        initial:
          "Scene 14 — lines\n\nMAYA: You said eight.\nSAM: I said eight-ish.\n\n(Remember: phone face-up on the counter, screen lit when the text comes in.)",
      },
    ],
    updatedAt: now,
  };
}

/** A short 16:9 deck used as the slides sample — distinct from app prototypes. */
export function createSampleDeck(): Project {
  const title = createScreen("slide", { name: "Title", background: "#0B0C10" });
  const agenda = createScreen("slide", { name: "Agenda", background: "#111318" });
  const feature = createScreen("slide", { name: "Present", background: "#111318" });
  const end = createScreen("slide", { name: "Close", background: "#0B0C10" });

  title.elements.push(
    createElement("rect", {
      name: "Accent bar",
      x: 160,
      y: 360,
      width: 72,
      height: 8,
      fill: "#F5B942",
      radius: 4,
    }),
    createElement("text", {
      name: "Eyebrow",
      text: "SIGMA",
      x: 160,
      y: 392,
      width: 800,
      height: 36,
      fontSize: 18,
      fontWeight: 700,
      textColor: "#F5B942",
    }),
    createElement("text", {
      name: "Title",
      text: "Presentations\nfor the set.",
      x: 160,
      y: 440,
      width: 1400,
      height: 220,
      fontSize: 88,
      fontWeight: 700,
      textColor: "#F5F5F7",
    }),
    createElement("text", {
      name: "Subtitle",
      text: "16:9 slides. Fullscreen present. Same editor chrome.",
      x: 160,
      y: 700,
      width: 1200,
      height: 40,
      fontSize: 24,
      fontWeight: 400,
      textColor: "#A1A1AA",
    }),
  );

  agenda.elements.push(
    createElement("text", {
      name: "Kicker",
      text: "AGENDA",
      x: 160,
      y: 120,
      width: 400,
      height: 28,
      fontSize: 16,
      fontWeight: 700,
      textColor: "#F5B942",
    }),
    createElement("text", {
      name: "Heading",
      text: "What this deck is for",
      x: 160,
      y: 168,
      width: 1400,
      height: 72,
      fontSize: 52,
      fontWeight: 700,
      textColor: "#F5F5F7",
    }),
  );

  const cards: [string, string, string][] = [
    ["01", "App prototypes", "iPhone and Mac screens that actually work on camera."],
    ["02", "Slides", "A separate 16:9 deck — no device chrome, just slides."],
    ["03", "Present", "Fullscreen. Arrows or click to move. Esc to leave."],
  ];
  cards.forEach(([num, heading, body], i) => {
    const x = 160 + i * 560;
    agenda.elements.push(
      createElement("rect", {
        name: `Card ${num}`,
        x,
        y: 360,
        width: 520,
        height: 480,
        fill: "#1A1C24",
        radius: 20,
      }),
      createElement("text", {
        name: `Num ${num}`,
        text: num,
        x: x + 36,
        y: 400,
        width: 200,
        height: 40,
        fontSize: 22,
        fontWeight: 700,
        textColor: "#F5B942",
      }),
      createElement("text", {
        name: `Card title ${num}`,
        text: heading,
        x: x + 36,
        y: 500,
        width: 448,
        height: 80,
        fontSize: 32,
        fontWeight: 700,
        textColor: "#F5F5F7",
      }),
      createElement("text", {
        name: `Card body ${num}`,
        text: body,
        x: x + 36,
        y: 600,
        width: 448,
        height: 140,
        fontSize: 22,
        fontWeight: 400,
        textColor: "#A1A1AA",
      }),
    );
  });

  feature.elements.push(
    createElement("rect", {
      name: "Stage",
      x: 160,
      y: 200,
      width: 1600,
      height: 680,
      fill: "#1A1C24",
      radius: 24,
    }),
    createElement("text", {
      name: "Kicker",
      text: "PRESENT MODE",
      x: 240,
      y: 320,
      width: 600,
      height: 28,
      fontSize: 16,
      fontWeight: 700,
      textColor: "#38BDF8",
    }),
    createElement("text", {
      name: "Heading",
      text: "16:9. No chrome.",
      x: 240,
      y: 380,
      width: 1400,
      height: 90,
      fontSize: 72,
      fontWeight: 700,
      textColor: "#F5F5F7",
    }),
    createElement("text", {
      name: "Body",
      text: "Arrow keys or click to go next and previous.\nEscape exits. The editor stays out of the way.",
      x: 240,
      y: 500,
      width: 1400,
      height: 120,
      fontSize: 28,
      fontWeight: 400,
      textColor: "#A1A1AA",
    }),
    createElement("text", {
      name: "Hint",
      text: "←  previous     next  →",
      x: 240,
      y: 720,
      width: 600,
      height: 40,
      fontSize: 22,
      fontWeight: 600,
      textColor: "#F5F5F7",
    }),
  );

  end.elements.push(
    createElement("text", {
      name: "Thanks",
      text: "Thank you.",
      x: 160,
      y: 430,
      width: 1600,
      height: 100,
      fontSize: 80,
      fontWeight: 700,
      textColor: "#F5F5F7",
      textAlign: "center",
    }),
    createElement("text", {
      name: "Credit",
      text: "Made in Sigma",
      x: 160,
      y: 560,
      width: 1600,
      height: 40,
      fontSize: 22,
      fontWeight: 500,
      textColor: "#F5B942",
      textAlign: "center",
    }),
  );

  return {
    id: uid("prj_"),
    version: 1,
    kind: "deck",
    name: "Sample — Presentation",
    startScreenId: title.id,
    screens: [title, agenda, feature, end],
    variables: [],
    updatedAt: Date.now(),
  };
}
