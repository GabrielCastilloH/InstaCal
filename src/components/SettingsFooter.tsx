import './SettingsFooter.css'

interface SettingsFooterProps {
  onSignOut: () => void
}

export default function SettingsFooter({ onSignOut }: SettingsFooterProps) {
  return (
    <div className="settings-footer">
      <div className="settings-footer-contact">
        <span className="settings-footer-label">Bugs or feedback?</span>
        <div className="settings-footer-emails">
          <a href="mailto:yh2299@cornell.edu">yh2299@cornell.edu</a>
          <span className="settings-footer-dot">·</span>
          <a href="mailto:gac232@cornell.edu">gac232@cornell.edu</a>
        </div>
      </div>

      <button className="settings-footer-signout" onClick={onSignOut}>
        Sign out
      </button>

      <p className="settings-footer-credit">Made with ♡ by Yaelin and Gabriel</p>
    </div>
  )
}
