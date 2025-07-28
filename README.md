# Custom Logo Position

A Millennium plugin that allows for the arbitrary repositioning of application logos.

## Features
- If `show_button` is set to `true` in `config.json`
    - Click the `ML` bettuon in the application header to enable moving the logo
    - Move application logo by dragging it
    - Click the `Done` button or the `ML` button again to lock the Logo
- If `context_menu` is set to `true` in `config.json`
    - Right click the header and select "Move Logo"
    - Move application logo by dragging it
    - Click the `Done` button or select the menu item again to lock the Logo

## Configuration
- `<STEAM>\plugins\steam-logo-pos\config.json`

## Prerequisites
- [Millennium](https://steambrew.app/)

## Contributors

<a href="https://github.com/luthor112/steam-logo-pos/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=luthor112/steam-logo-pos" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

## Troubleshooting
- In the case manual modification is needed, the positions are stored in `<STEAM>\plugins\steam-logo-pos\pos-db.json`