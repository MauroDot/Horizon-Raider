import { Component } from 'react'
import './ErrorBoundary.css'

// Wraps <App/> (see main.jsx). Without this, an uncaught render error
// anywhere in the tree unmounts everything with no visible feedback - the
// player just sees the page's plain background color, which looks
// indistinguishable from "the game failed to load" with zero information
// to act on. This turns that into a message with two concrete recovery
// options.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Horizon Raider crashed:', error, info.componentStack)
  }

  _resetLocalData = () => {
    try {
      localStorage.removeItem('horizon-raider:progress')
      localStorage.removeItem('horizon-raider:saves')
      localStorage.removeItem('horizon-raider:controls')
    } catch {
      // localStorage unavailable - nothing to clear, just reload below.
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash-screen">
        <div className="crash-panel">
          <h1>Something went wrong</h1>
          <p className="crash-message">{this.state.error.message}</p>
          <p className="crash-note">
            This is usually a stale save from an older version. Reloading fixes most cases; if it keeps happening,
            resetting local data will clear your saved progress and start fresh.
          </p>
          <div className="crash-actions">
            <button type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button type="button" className="crash-reset" onClick={this._resetLocalData}>
              Reset local data &amp; reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
