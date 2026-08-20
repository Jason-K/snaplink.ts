# LOGITECH G502X REMAP PLAN

## ENUM

| Logitech    | Description     | BTT                 | Karabiner Alias |
| ----------- | --------------- | ------------------- | --------------- |
| G1          | Left button     | Leftclick           | button1 / left  |
| G2          | Right button    | Rightclick          | button2 / right |
| G3          | Middle button   | Middle mouse button | button3 / wheel |
| G4          | Back            | Button 3            | button4 / back  |
| G5          | Forward         | Button 5            | button6 / forward |
| G6          | DPI shift       | Button 4            | button5 / shift_button |
| G7          | DPI down        | Button 10           | button11 / leftBack |
| G8          | DPI up          | Button 9            | button10 / leftForward |
| G9          | Profile cycling | Button 8            | button9 / middleBack |
| Wheel Up    | Scroll up       | Scroll Up           | -               |
| Wheel Down  | Scroll down     | Scroll Down         | -               |
| Wheel Left  | Tilt Left       | Button 6            | button7 / wheelLeft |
| Wheel Right | Tilt Right      | Button 7            | button8 / wheelRight |

## APP IDENTIFIERS

| App Name     | Bundle ID / Scope                 | Notes                                    |
| ------------ | --------------------------------- | ---------------------------------------- |
| Zen Browser  | `app.zen-browser.zen`             | Primary browser                          |
| Brave        | `com.brave.Browser`               | Secondary browser                        |
| 1Piece       | `jp.fuji.1Piece`                  | Window manager (excludes `jp.fuji.1PiecePreferences`) |
| SideNotes    | `com.apptorium.SideNotes-setapp`  | Notes app                                |
| PopClip      | `com.pilotmoon.showPopclip`       | Text action popup                        |

---

## FUNCTIONS

### G1 (Left Button / BTT: Leftclick)

G1 (Default / When G2 is NOT held)

- Tap (in `jp.fuji.1Piece`, except `jp.fuji.1PiecePreferences`): `return_or_enter`
- Tap (all other apps): standard Left Click
- Hold: standard Left Click hold / drag

G2+G1 in Zen Browser (`app.zen-browser.zen`)

- Tap (delayed single tap): `left_command` + Left Click (open link in background tab)
- Hold: `option` + Left Click (open link in Glance)
- Double Tap: run `open -u "rectangle-pro://execute-action?name=next-display"` (move window to next display)

G2+G1 in Non-Zen (All other apps)

- Tap (delayed single tap): run `open -g "hammerspoon://window?action=toggle_maximize"` (toggle maximize / fill screen)
- Double Tap: run `open -u "rectangle-pro://execute-action?name=next-display"` (move window to next display)

---

### G2 (Right Button / BTT: Rightclick)

G2 (Default)

- Tap: standard Right Click
- Hold: chord modifier (signals `right_button_pressed` for chords with G1, G3, G4, G5, G6, G9, Wheel Left, Wheel Right, and Motion to Scroll)

G2 Hold + Pointer Movement (Motion to Scroll)

- Hold G2 and move mouse pointer: Scroll (speed multiplier: 0.5)

---

### G3 (Middle Button / Wheel Click / BTT: Middle mouse button)

G3 (Default)

- Tap: standard Middle Click
- Hold: run `open -g "hammerspoon://window?action=toggle_maximize"` (toggle maximize / fill screen)

G2+G3 in Zen Browser (`app.zen-browser.zen`)

- Press / Tap: `option` + Left Click (open link in Glance)

---

### G4 (Back Button / BTT: Button 3)

G4 (Default)

- Tap: standard mouse Back (`button4`)
- Hold: `left_command+tab` (Application Switcher)

G2+G4 in Zen Browser (`app.zen-browser.zen`)

- Tap: `left_command+left_shift+close_bracket` (Previous tab)

G2+G4 in Brave (`com.brave.Browser`)

- Tap: `left_control+tab` (Next tab)

---

### G5 (Forward Button / BTT: Button 5)

G5 (Default)

- Tap: standard mouse Forward (`button5`)
- Hold: `left_control+down_arrow` (Application Exposé / show windows of active app)

G2+G5 in Zen Browser (`app.zen-browser.zen`)

- Tap: `left_command+left_shift+open_bracket` (Next tab)

G2+G5 in Brave (`com.brave.Browser`)

- Tap: `left_control+left_shift+tab` (Previous tab)

---

### G6 (DPI Shift / BTT: Button 4)

G6 (Default)

- Tap: `left_control+up_arrow` (Show Mission Control)
- Hold: `left_option+left_control+left_shift` down until released (Hyper / Rectangle modifier key)

G2+G6

- Press / Tap: show mission control (`vk_mission_control`)

---

### G7 (DPI Down / BTT: Button 10)

G7 (Default)

- Tap: run `open -g "hammerspoon://window?action=toggle_maximize"` (toggle maximize / fill screen)
- Hold: run `open -u "rectangle-pro://execute-action?name=next-display"` (move window to next display)

---

### G8 (DPI Up / BTT: Button 9)

G8 (Default)

- Tap: run `osascript -e 'tell application "Popclip" to appear'` (show PopClip at cursor position)
- Hold: `left_command+left_option+left_shift+f10` (show SideNotes)

---

### G9 (Profile Cycling / Middle-Back / BTT: Button 8)

G9 (Default / When G2 is NOT held)

- Tap: run `open -u "cleanshot://capture-text?linebreaks=false"` (CleanShot OCR: capture text without line breaks)
- Hold: run `"$HOME/Scripts/.venv/shared_venv/bin/python" "$HOME/Scripts/ui/screenshot_to_md/shot_to_md.py"` (take screenshot and convert to markdown)

G2+G9 (When G2 is held)

- Tap: run `open -u "cleanshot://capture-text"` (CleanShot OCR: capture text preserving line breaks)

---

### Wheel Left (Tilt Left / BTT: Button 6)

Wheel Left (Default)

- Hold: run `open -g "hammerspoon://window?action=primary_half"` (window to top-left 1/2)

G2+Wheel Left in Zen Browser (`app.zen-browser.zen`)

- Tap: `left_arrow+left_command+left_control+left_shift` (switch workspace / move tab left)

---

### Wheel Right (Tilt Right / BTT: Button 7)

Wheel Right (Default)

- Hold: run `open -g "hammerspoon://window?action=secondary_half"` (window to bottom-right 1/2)

G2+Wheel Right in Zen Browser (`app.zen-browser.zen`)

- Tap: `right_arrow+left_command+left_control+left_shift` (switch workspace / move tab right)
