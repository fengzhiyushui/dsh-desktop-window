window.__ModuleLoader__.load({
	id: "dsh-desktop-window",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var CSS = `
  .dsh-desktop-header-btn {
    min-height: 28px;
    color: var(--dsw-alias-label-tertiary);
    cursor: pointer;
    background: transparent;
    border: 0;
    border-radius: 6px;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    font-family: inherit;
    font-size: 12px;
    line-height: 18px;
    display: inline-flex;
  }
  .dsh-desktop-header-btn:hover,
  .dsh-desktop-header-btn:focus-visible { color: var(--dsw-alias-label-secondary); }
  .dsh-desktop-header-btn[data-active='true'] { color: var(--dsw-alias-label-primary); }
  .dsh-desktop-header-btn:disabled { opacity: 0.55; cursor: default; }
  .dsh-desktop-auto-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    font-size: 13px;
  }
`;
async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body === void 0 ? {} : body)
  });
  if (!res.ok) throw new Error("desktop-window api " + res.status);
  return res.json();
}
function WindowIcon(props) {
  const closing = !!(props && props.closing);
  if (closing) {
    return (0, import_react.createElement)(
      "svg",
      {
        width: 14,
        height: 14,
        viewBox: "0 0 16 16",
        "aria-hidden": true,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.5,
        strokeLinecap: "round"
      },
      (0, import_react.createElement)("path", { d: "M4.5 4.5l7 7M11.5 4.5l-7 7" })
    );
  }
  return (0, import_react.createElement)(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 16 16",
      "aria-hidden": true,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.5
    },
    (0, import_react.createElement)("rect", { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2 }),
    (0, import_react.createElement)("rect", { x: 4.5, y: 5.5, width: 7, height: 5, rx: 1 })
  );
}
function HeaderAction() {
  const [state, setState] = (0, import_react.useState)({ open: false, busy: false });
  (0, import_react.useEffect)(() => {
    let alive = true;
    const refresh = () => {
      api("/desktop-window/status").then((s) => {
        if (alive) setState((prev) => ({ ...prev, open: s.open === true }));
      }).catch(() => {
      });
    };
    refresh();
    const timer = setInterval(refresh, 4e3);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const toggle = () => {
    if (state.busy) return;
    setState((prev) => ({ open: prev.open, busy: true }));
    api("/desktop-window/toggle").then((r) => {
      setState({ open: r.open === true, busy: false });
    }).catch(() => {
      setState((prev) => ({ open: prev.open, busy: false }));
    });
  };
  const open = state.open;
  return (0, import_react.createElement)(
    "button",
    {
      type: "button",
      className: "dsh-desktop-header-btn",
      "data-active": open ? "true" : "false",
      title: open ? "\u5173\u95ED\u72EC\u7ACB\u5E94\u7528\u7A97\u53E3" : "\u5728\u72EC\u7ACB\u5E94\u7528\u7A97\u53E3\u4E2D\u6253\u5F00",
      "aria-label": open ? "\u5173\u95ED\u72EC\u7ACB\u7A97\u53E3" : "\u6253\u5F00\u72EC\u7ACB\u7A97\u53E3",
      disabled: state.busy,
      onClick: toggle
    },
    (0, import_react.createElement)(WindowIcon, { closing: open }),
    (0, import_react.createElement)("span", null, open ? "\u5173\u95ED\u7A97\u53E3" : "\u72EC\u7ACB\u7A97\u53E3")
  );
}
function AutoRow() {
  const [auto, setAuto] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let alive = true;
    api("/desktop-window/status").then((s) => {
      if (alive) setAuto(s.auto === true);
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, []);
  const onChange = () => {
    if (auto === null) return;
    const next = !auto;
    setAuto(next);
    api("/desktop-window/set-auto", { auto: next }).catch(() => {
    });
  };
  return (0, import_react.createElement)(
    "label",
    { className: "dsh-desktop-auto-row" },
    (0, import_react.createElement)("span", null, "\u542F\u52A8\u65F6\u81EA\u52A8\u6253\u5F00\u72EC\u7ACB\u7A97\u53E3"),
    (0, import_react.createElement)("input", {
      type: "checkbox",
      checked: auto === true,
      disabled: auto === null,
      onChange
    })
  );
}
function apply(ctx) {
  const slots = ctx.get("slots");
  if (slots === void 0) return;
  const style = document.createElement("style");
  style.dataset.plugin = "dsh-desktop-window";
  style.textContent = CSS;
  document.head.appendChild(style);
  ctx.effect(() => () => {
    style.remove();
  }, "desktop-window-client");
  slots.inject("conversation.session.header.actions", () => slots.register(
    { name: "conversation.session.header.actions", id: "desktop-window", order: 30 },
    () => (0, import_react.createElement)(HeaderAction)
  ));
  slots.inject("settings.general.item", () => slots.register(
    { name: "settings.general.item", id: "desktop-auto", order: 30 },
    () => (0, import_react.createElement)(AutoRow)
  ));
}
var inject = ["slots"];

		return module.exports;
	}
});

