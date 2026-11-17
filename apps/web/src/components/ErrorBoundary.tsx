import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../i18n'

interface State {
  failed: boolean
}

/** Last line of defence: a crash shows a plain message and a reload button instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl">{i18n.t('shell.errorTitle')}</h1>
        <p className="my-3 text-mute">{i18n.t('shell.errorBody')}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          {i18n.t('shell.reload')}
        </button>
      </div>
    )
  }
}
