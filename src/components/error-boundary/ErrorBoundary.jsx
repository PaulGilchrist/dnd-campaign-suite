// @maintained-by-ai
/**
 * ErrorBoundary — render-crash containment for the main view outlet.
 *
 * Mounted around the view area in App.jsx (and the map-editor mount in
 * MapsAreaView) so a render throw in ONE view degrades to a "reload the
 * view" card instead of blanking the whole SPA (bug-hex-arrival-null-echo
 * crash family: header/sidebar/app chrome must survive a view crash).
 *
 * Recovery: the button clears the caught error; the child subtree was never
 * committed (React discards it when the boundary fires), so resetting the
 * state freshly re-mounts the view. No timers (turn-based app rule).
 *
 * `resetKey` (optional): auto-clears a stale fallback when the caller moves
 * on (view switch / map switch) so the next view never inherits the card.
 */

import { Component } from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught a render error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  handleReload() {
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ct-container error-boundary">
          <div className="ct-empty-state">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>This view ran into an error and could not be displayed.</span>
            <button
              type="button"
              className="ct-btn ct-btn-primary error-boundary-reload-btn"
              onClick={this.handleReload}
            >
              Reload the view
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
