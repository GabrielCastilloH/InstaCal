import logoLarge from '../assets/logo-large.svg'
import './PageHeader.css'

interface PageHeaderProps {
  useLogo?: boolean
  title?: string
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
}

export default function PageHeader({ useLogo = false, title, leftButton, rightButton }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="header-slot">{leftButton}</div>
      <div className="header-center">
        {useLogo
          ? <img src={logoLarge} alt="InstaCal" className="header-logo" />
          : <h1 className="header-title">{title}</h1>
        }
      </div>
      <div className="header-slot">{rightButton}</div>
    </div>
  )
}
