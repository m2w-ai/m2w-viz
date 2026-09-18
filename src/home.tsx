import { HOME_CARDS } from './content/tools'
import { MenuPage } from './shell/menu-page'

export function HomeMenu() {
  return (
    <MenuPage
      section="Internal Tools"
      eyebrow="Choose a view"
      heading="Pick a tool to open"
      blurb="Several surfaces share this app. Pick one to continue."
      cards={HOME_CARDS}
    />
  )
}
