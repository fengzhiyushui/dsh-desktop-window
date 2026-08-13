import { createElement as h, useEffect, useState } from 'react'

const CSS = `
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
`

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body === undefined ? {} : body),
  })
  if (!res.ok) throw new Error('desktop-window api ' + res.status)
  return res.json()
}

function WindowIcon(props) {
  const closing = !!(props && props.closing)
  if (closing) {
    return h('svg', {
      width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true,
      fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round',
    },
      h('path', { d: 'M4.5 4.5l7 7M11.5 4.5l-7 7' }),
    )
  }
  return h('svg', {
    width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true,
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
  },
    h('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2 }),
    h('rect', { x: 4.5, y: 5.5, width: 7, height: 5, rx: 1 }),
  )
}

function HeaderAction() {
  const [state, setState] = useState({ open: false, busy: false })
  useEffect(() => {
    let alive = true
    const refresh = () => {
      api('/desktop-window/status').then((s) => {
        if (alive) setState((prev) => ({ ...prev, open: s.open === true }))
      }).catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 4000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])
  const toggle = () => {
    if (state.busy) return
    setState((prev) => ({ open: prev.open, busy: true }))
    api('/desktop-window/toggle').then((r) => {
      setState({ open: r.open === true, busy: false })
    }).catch(() => {
      setState((prev) => ({ open: prev.open, busy: false }))
    })
  }
  const open = state.open
  return h('button', {
    type: 'button',
    className: 'dsh-desktop-header-btn',
    'data-active': open ? 'true' : 'false',
    title: open ? '关闭独立应用窗口' : '在独立应用窗口中打开',
    'aria-label': open ? '关闭独立窗口' : '打开独立窗口',
    disabled: state.busy,
    onClick: toggle,
  },
    h(WindowIcon, { closing: open }),
    h('span', null, open ? '关闭窗口' : '独立窗口'),
  )
}

function AutoRow() {
  const [auto, setAuto] = useState(null)
  useEffect(() => {
    let alive = true
    api('/desktop-window/status').then((s) => {
      if (alive) setAuto(s.auto === true)
    }).catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const onChange = () => {
    if (auto === null) return
    const next = !auto
    setAuto(next)
    api('/desktop-window/set-auto', { auto: next }).catch(() => {})
  }
  return h('label', { className: 'dsh-desktop-auto-row' },
    h('span', null, '启动时自动打开独立窗口'),
    h('input', {
      type: 'checkbox',
      checked: auto === true,
      disabled: auto === null,
      onChange,
    }),
  )
}

function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-desktop-window'
  style.textContent = CSS
  document.head.appendChild(style)
  ctx.effect(() => () => {
    style.remove()
  }, 'desktop-window-client')

  slots.inject('conversation.session.header.actions', () => slots.register(
    { name: 'conversation.session.header.actions', id: 'desktop-window', order: 30 },
    () => h(HeaderAction),
  ))
  slots.inject('settings.general.item', () => slots.register(
    { name: 'settings.general.item', id: 'desktop-auto', order: 30 },
    () => h(AutoRow),
  ))
}

export { apply }
export const inject = ['slots']
