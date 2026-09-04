import './TutorialOverlay.css'

// First-launch orientation: explains the two schemes and lets the player
// pick one before ever touching the controls. NOT a full interactive
// practice level (a dedicated tutorial area with guided drills is real
// scope beyond a controls redesign) - this is the lightweight stand-in,
// shown once (see ControlConfig.hasSeenTutorial) with a skip option.
export function TutorialOverlay({ controlConfig, onDismiss }) {
  function choose(scheme) {
    controlConfig.setScheme(scheme)
    controlConfig.markTutorialSeen()
    onDismiss()
  }

  function skip() {
    controlConfig.markTutorialSeen()
    onDismiss()
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-panel">
        <h1>HORIZON RAIDER</h1>
        <p className="tutorial-lead">Choose how you want to fly. You can switch anytime in Settings.</p>

        <div className="tutorial-schemes">
          <div className="tutorial-scheme">
            <h2>Realistic Simulation</h2>
            <p>Cyclic &amp; collective helicopter physics. W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl collective.</p>
          </div>
          <div className="tutorial-scheme">
            <h2>Arcade FPS-Style</h2>
            <p>Direct WASD movement, mouse steers the nose. Familiar if you've played a shooter.</p>
          </div>
        </div>

        <p className="tutorial-lead">Keyboard, mouse, and an Xbox/PC controller all work - use whichever you like.</p>

        <div className="tutorial-actions">
          <button type="button" onClick={() => choose('sim')}>
            Fly Realistic Simulation
          </button>
          <button type="button" onClick={() => choose('arcade')}>
            Fly Arcade FPS-Style
          </button>
        </div>
        <button type="button" className="tutorial-skip" onClick={skip}>
          Skip
        </button>
      </div>
    </div>
  )
}
