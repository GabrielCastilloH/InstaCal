import './SettingsFooter.css'

export default function SettingsFooter() {
  return (
    <div className="settings-footer">
      <div className="settings-footer-contact">
        <span className="settings-footer-label">Bugs or feedback?</span>
        <ul className="settings-footer-emails">
          <li><a href="mailto:yh2299@cornell.edu">yh2299@cornell.edu</a></li>
          <li><a href="mailto:gac232@cornell.edu">gac232@cornell.edu</a></li>
        </ul>
      </div>

      <p className="settings-footer-credit">Made with ♡ by Yaelin and Gabriel</p>
    </div>
  )
}
