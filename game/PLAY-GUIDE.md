# SuperCitycon — how to play

**https://atiffhussainkhan.github.io/SuperCitycon/**

Click the link and the city is live in your browser. Nothing to install.

---

## The 30-second version

1. Pick a building from the **shop strip** along the bottom.
2. **Click the map** to place it.
3. Watch **RESIDENTIAL** demand and **RESIDENTS** in the top bar.
4. Add roads, power, water and services so the city keeps growing.
5. Press **Space** to speed the day along.

That is the whole loop. Everything below is the detail.

---

## Controls

### Mouse

| Action | Result |
|---|---|
| **Left-click** | use the active tool on that cell (place, bulldoze, road, paint, raise) |
| **Right-click** | **lower** the ground — and only that, and only while the TERRAFORM tool is active. It does **not** bulldoze: to remove a building, select the BULLDOZE tool and left-click it |
| **Left-drag** | pan the camera |
| **Right-drag** | rotate and tilt the camera |
| **Wheel** | zoom in / out |
| **Click a HUD widget** | opens its panel |

### Keyboard

| Key | Action |
|---|---|
| **1** – **7** | select a tool |
| **W A S D** | pan the camera |
| **Q / E** | rotate the camera left / right |
| **R** | reset the camera |
| **Wheel** | zoom |
| **Space** | pause / resume |
| **Shift + 1…4** | simulation speed: slow, normal, fast, ultra |
| **Ctrl + S** | save the city |
| **B** | building shop |
| **G** | government overview (all eight services) |
| **I** | information about the selected building |
| **L** | save / load |
| **T** | time panel (clock, speed, time of day) |
| **H** | help — the same list, in the game |
| **Esc** | close the open panel, or cancel the active tool |

---

## The seven tools

| Key | Tool | What a click does |
|---|---|---|
| **1** | **INSPECT** | Look around. Click a building to select it; **I** then shows its details. |
| **2** | **BUILD** | Place the building you picked in the shop. |
| **3** | **BULLDOZE** | Left-click a building to remove it. It also scrapes the scenery off that cell. A bulldozed building refunds **no money** — that is the published rule. |
| **4** | **ROAD** | Lay a road. Roads are what connect your city: traffic, and the services that reach your buildings, follow them. |
| **5** | **TERRAFORM** | **Left-click raises** the ground, **right-click lowers** it. Flatten a site before you build on a slope. |
| **6** | **PAINT** | Paint a zone (residential) on empty ground. |
| **7** | **STUDIO** | Opens **SCC Studio**, the voxel editor: sculpt a model in the grid and export it as an OBJ. |

**The bulldozer clears the scenery under the building** and refunds nothing.
Its right-click does nothing — the buildings domain only acts on the left
button.

---

## The shop strip (bottom of the screen)

Sixteen categories, each with the number of buildings in it:

`RESIDENTIAL 12` · `COMMERCIAL 10` · `INDUSTRIAL 4` · `ENERGY 5` · `WATER 4` ·
`FOOD & AGRICULTURE 6` · `HEALTH CARE 2` · `POLICE & SECURITY 2` · `FIRE 2` ·
`EDUCATION 6` · `TRANSIT 5` · `PARKS & LEASURE 2` · `DECORATION 28` ·
`INFRASTRUCTURE 19` · `WASTE 4` · `SPECIAL / CITY UPGRADES 4`

- **Click a card** to select that building. It arms the build tool and closes
  the shop, so your next click on the map places it.
- The **SEARCH** field at the bottom-left filters the cards.
- **B** opens the same shop as a full-screen panel.
- A selected card is outlined in gold.

---

## Reading the HUD

**Top bar, left to right**

| Block | Meaning |
|---|---|
| **MAYOR** | the city's overall score — it shows `—` until the game has one to publish |
| **TREASURY** | your money. Every build is charged against it |
| **RESIDENTS** | how many people live in your city |
| **HAPPINESS** | the mood of the population (0–100) |
| **LOYALTY** | how attached the population is to your city (0–100) |
| **DAY / clock** | the in-game date and time |

**Second row — DEMAND (the left three)**

`RESIDENTIAL` · `COMMERCIAL` · `INDUSTRIAL` as percentages.

- **100 %** = you need more of that type of building.
- The bars fall as you build the matching category.

**Second row — USAGE (the right four)**

`ENERGY` · `WATER` · `FOOD` · `WASTE`.

- These show **consumption against production**, so you can see whether your
  power plants, water and farms are keeping up.
- The published rule the game follows: **below 90 % usage is fine; from 90 %
  city growth is reduced; at 100 % the city stops growing.**

**The ticker** (under the top bar, left) is the running event log — population
changes, refusals, and what you just built.

**The licence line** (bottom-left of the shop strip) says that the 2D icons come
from the asset library and are **not yet licence-cleared**. It is not an error.

---

## The panels

| Key | Panel | What it shows |
|---|---|---|
| **B** | BUILDING SHOP | the full shop, pickable, with the category tabs and the search field |
| **G** | GOVERNMENT | the eight service blocks — energy, water, food, waste, health care, security, fire, education. Each block has a **coverage circle** and a **usage bar**; the circle is full when the service reaches everyone, the bar is low when there is headroom |
| **I** | BUILDING | the selected building: its cost, its footprint, and what it does |
| **L** | SAVE / LOAD | the save slots in this browser |
| **T** | TIME | the clock, the speed buttons, and the named times of day |
| **H** | HOW TO PLAY | the control list, in the game |

Every panel is closed by its **X**, by clicking outside it, or with **Esc**.

---

## Time and speed

- **Space** pauses and resumes.
- The five buttons in the top bar are `II` (pause), `S` (×1 slow), `N` (×2
  normal), `F` (×4 fast), `U` (×8 ultra).
- **Shift + 1…4** does the same from the keyboard.
- **T** also gives you the time-of-day presets; the lighting changes immediately.

---

## Saving

- **Ctrl + S** saves to a slot in this browser's local storage.
- **L** opens the save/load panel to see the slots and load one.
- A save keeps your buildings, your money, your roads and your population.
  Loading it in a fresh tab rebuilds the whole city.

---

## Things worth knowing before you start

1. **You start with ONE construction slot.** Only one building can be under
   construction at a time, and nothing in the catalogue grants another yet — so
   the **Monorail Station** (which needs two) cannot be built. If a placement
   is refused you get a toast naming the slots required and free.
2. **Money and slots are both gates.** A placement is refused if you cannot
   afford it or have no free slot, and the refusal is explained rather than
   silent.
3. **A failed charge never drives you negative.** It is booked as debt and
   settled at the next monthly settlement.
4. **Bulldozing refunds nothing.**
5. **Some numbers in the HUD are marked as assumed.** The demand bars, the
   happiness and the loyalty scale are design decisions the publisher never
   published; the game labels them rather than presenting them as fact.

---

## If something looks wrong

| Symptom | Cause |
|---|---|
| The map does not respond | a panel is open — press **Esc**, or click outside it |
| A building will not place | no free construction slot, or not enough money — read the toast |
| The camera feels stuck | press **R** to reset it |
| The icons look plain | you are on the cleared build (no 2D art) — the HUD still works |
