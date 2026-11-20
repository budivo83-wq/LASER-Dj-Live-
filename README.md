# Laser DJ Live – Desktop Edition 1.2

Samostatná **offline aplikace pro Windows** pro navrhování virtuálních laserových
animací a zkoušení převodu videa na vektorové kontury.

**Pozor: aplikace neřídí skutečný laser. USB a ILDA výstupy nejsou implementované.**
Je to náhledový a návrhový software. Softwarem nakreslené masky a virtuální
BLACKOUT nejsou bezpečnostní zařízení.

## Rychlé spuštění (Windows 10/11)

1. Nainstaluj **Node.js LTS** s npm (pouze pro tento zdrojový balíček).
2. Rozbal celý ZIP do jedné složky.
3. Dvakrát klikni na `START_WINDOWS.cmd`.
4. Při prvním spuštění se doinstaluje Electron. Potřebuješ internet, dále může
   aplikace běžet offline.

Z terminálu lze stejně použít `npm install`, potom `npm start`.

## Novinka 1.2: více nezávislých vektorových cest

1. Vyber **Custom Shape** nebo klikni **USE SHAPE** v levém editoru.
2. V seznamu **VECTOR PATHS** vyber aktivní cestu. Do ní zapisují režimy
   DRAW POINT, SELECT/MOVE, INSERT ON LINE a DELETE POINT.
3. Klikni **+ NEW PATH**. Vytvoří se další, samostatná prázdná cesta. Neexistuje
   žádná svítící spojnice z konce předchozí cesty do jejího začátku.
4. U aktivní cesty lze změnit **Path name**, **Path color** a přepínač
   **Selected path visible**. Barvy a zapnutí jednotlivých cest jsou nezávislé.
5. **PATH UP** a **PATH DOWN** mění pořadí cest v animaci. Pokud chceš přesně
   dodržet toto pořadí i ve výpočtu, vypni **Nearest-path ordering** v
   sekci **Path optimizer**; jinak planner může cesty seřadit podle vzdálenosti.
6. **DELETE PATH** odstraní aktivní cestu (s potvrzením, pokud obsahuje body).
   Zůstane vždy alespoň jedna, třeba prázdná cesta.
7. **UNDO EDIT / REDO EDIT** nyní vrací také vložení, smazání, přejmenování,
   zapnutí a přesouvání cest v seznamu.
8. **SAVE SCENE / LOAD SCENE** a export/import scénové banky zachovávají názvy,
   barvy, zapnutí, uzavřenost, geometrii i pořadí všech cest.

Limity: nejvýše **16 cest a 1000 souřadnicových bodů na vrstvu**. Body kreslí
všechny cesty ve společné souřadnicové rovině a sdílejí animované transformace
své vrstvy (position, scale, rotation). Samostatné keyframes pro každou cestu
zatím nejsou implementované.

Scény verzí 0.2–1.1 zůstávají kompatibilní. Dřívější pole `custom` se při
načtení bezpečně převede na první samostatnou cestu. Obě vrstvy a virtuální
maskování zůstávají oddělené.

## Z verze 1.1: pokročilý editor vektorových tvarů

1. Vlevo přejdi na **Custom vector editor**.
2. Zvol **DRAW POINT** a klikáním vytvářej body otevřené geometrie.
3. Pomocí **SELECT / MOVE** klikni na existující bod a přetáhni jej.
4. **INSERT ON LINE** vloží bod na nejbližší úsečku (včetně uzavírací).
5. **DELETE POINT** odstraní kliknutý bod; **DELETE SELECTED** vymaže vybraný.
6. Zapni **Snap to 1/8 grid**, pokud chceš přesné geometrické rozložení.
7. **UNDO EDIT** a **REDO EDIT** vracejí/přidávají úpravy zvlášť pro každou
   vrstvu. Udržuje se nejvýše 80 kroků. Na klávesnici funguje Ctrl+Z,
   Ctrl+Y nebo Ctrl+Shift+Z, pokud má fokus kreslicí plocha.
8. **CLOSE / OPEN** přepne obrazec mezi uzavřenou a otevřenou cestou.
9. **STAR / HEXAGON / WAVE** vloží připravené body. Před nahrazením vlastní
   geometrie přijde potvrzovací dialog; výměnu lze vrátit přes Undo.
10. Klikni **USE SHAPE** a sleduj vlastní geometrii ve virtuální projekci.

Geometrie i uzavřenost cest jsou součástí vrstev uložených přes **SAVE SCENE**
a také scénové banky. Historie Undo/Redo se neukládá a při načtení scény nebo
přepnutí banky se vyčistí. Scény verzí 0.2–1.1 lze dále načíst.

## Z verze 1.0: vlastní virtuální masky

1. Otevři panel **Custom virtual blackout zones**.
2. V náhledové ploše **tažením myši** vyznač obdélníkovou masku.
3. Přidávej další obdélníky (maximálně 16), případně použij **UNDO ZONE**
   nebo **CLEAR ZONES**.
4. Přepínač **Enable custom blackout zones** zapíná/vypíná jejich vliv na
   virtuální vykreslování. Staré masky Bottom/Left/Right zůstávají použitelné.
5. **SAVE SCENE** uloží souřadnice zón do JSON; **LOAD SCENE** je zase načte.
   Scény ze starších verzí 0.2–1.1 jsou nadále podporovány.

Masky vytmaví body uvnitř obdélníků a dokážou přerušit virtuální přímku,
která protíná masku i mezi dvěma vzorkovanými body. Masky jsou globální
pro daný editor, takže se při přepnutí scén z banky automaticky nepřesouvají.
**Nejde o kalibrovanou ochranu proti ozáření publika:** skutečná laserová
bezpečnost vyžaduje nezávislé ochranné okruhy a měření.

## Z verze 1.0: stabilnější Video → Vector

Nový posuvník **Contour stability / hysteresis** omezuje blikání hran
při malých změnách jasu videa. Při hodnotě `0` je stabilizace vypnutá.
Vyšší hodnota stabilizuje obrysy, ale může krátce držet konturu i po
drobném zeslabení obrazu. Stav se resetuje při změně zdroje videa.

## Testovací DEMO INPUT (od verze 0.9)

1. V programu otevři sekci **Video → Vector Input**.
2. Klikni **DEMO INPUT**. Spustí se generátor geometrických obrazců.
3. Automaticky se na L1 vybere režim **Video → Vector**.
4. Měň Threshold, Contour stability a Blur; kontroluj kontury a virtuální projekci.
5. **STOP INPUT** zdroj vypne. Výstup do laseru je po celou dobu zakázaný.

## Přímý Spout z Resolume (jen Windows)

**Spout je volitelná nativní součást, jejíž Windows build a příjem reálného
obrazu zatím nebylo možné v tomto prostředí otestovat.** Bez ní zůstává
CAPTURE WINDOW, LOAD VIDEO a DEMO INPUT funkční.

1. V Resolume zapni **Output → Spout**. V Arena můžeš také nastavit
   **Output → Advanced** a samostatný Spout výstup.
2. Nainstaluj Visual Studio C++ Build Tools a CMake.
3. Stáhni Spout2 SDK ze stránky
   https://github.com/leadedge/Spout2 a rozbal jej do `third_party/Spout2`
   tak, aby existoval soubor
   `third_party/Spout2/SPOUTSDK/SpoutLibrary/SpoutLibrary.h`.
4. Získej **x64 SpoutLibrary.dll ze stejné verze Spout2 SDK**. Zkopíruj jej
   do `native/bin/SpoutLibrary.dll`. DLL není součástí tohoto ZIPu.
5. Spusť `BUILD_SPOUT_WINDOWS.cmd`. V `native/bin` vznikne
   `LaserSpoutReceiver.exe`. Pokud se nepodaří jej sestavit, použij dál
   DEMO nebo CAPTURE WINDOW.
6. V Laser DJ Live stiskni **FIND SPOUT**, vyber sender (nebo Active sender),
   pak **START SPOUT**. Pro převod obrazu aktivuj Video → Vector na L1/L2.

Nativní receiver přijme GPU obraz přes SpoutLibrary, zmenší ho na 96×54 RGBA
a přes jednosměrný procesní kanál pošle pixely do Electronu.
Spout funguje na stejném počítači a nepotřebuje Ethernet.
Tento prototyp používá CPU readback, a proto cíluje nejvýše na 20 FPS
spoutového vstupu; optimalizaci pro 60 FPS budeme řešit později.

## Alternativní vstup z okna Resolume

1. V Resolume spusť grafický obsah (například bílé geometrické čáry na černé).
2. V Laser DJ Live klikni **CAPTURE WINDOW** a v nabídce vyber konkrétní
   okno Resolume (případně plochu s jeho výstupem).
3. Klikni **USE ON L1**, nastav Threshold, Blur, Minimum contour a Simplification.
4. Pro MIDI klikni **CONNECT MIDI INPUT**, zvol cílovou funkci a **LEARN**.

CAPTURE WINDOW zachovává funkčnost bez instalace nativního Spout přijímače.

## Vytvoření EXE

`BUILD_WINDOWS.cmd` (nebo `npm run dist:win`) připraví instalační a přenosnou
verzi do složky `dist`. Bez podpisového certifikátu může Windows při
spouštění zobrazit upozornění SmartScreen.

Pokud chceš mít v instalátoru i Spout, **nejdříve** sestav receiver podle
předchozího návodu a potom spusť BUILD_WINDOWS.cmd. Předem dodaný balíček
neobsahuje cizí Spout DLL ani předkompilovaný nativní EXE.

## Co zůstává z předchozích verzí

- Dvouvrstvý mixer a vlastní vektorový editor.
- Masky pouze pro virtuální náhled.
- Optimalizace cesty a diagnostika počtu bodů.
- Keyframe animace, osm scén, crossfade.
- Šestnáctikrokový sekvencer, MIDI Learn.
- Video-to-vector z videosouboru i zachyceného okna.
- V desktopovém režimu zpracování kontur ve Web Workeru, s původním
  synchronním algoritmem jako fallback.

## Architektura pro další vývoj

`app/index.html` – uživatelské rozhraní a virtuální renderer.

`app/vector-worker.js` – zpracování obrazu mimo hlavní renderovací smyčku.

`app/mask-zones.js` – normalizace geometrie, kontrola průsečíků úseček
s virtuálními zakázanými obdélníky a validace dat při importu.

`app/vector-edit.js` – testované geometrické operace pro výběr a vkládání
bodů, přichytávání k mřížce a připravené vektorové šablony.

`app/vector-paths.js` – datový model více cest, převod staršího formátu a
validace importovaných bodů, barev i velikostních limitů.

`electron/main.cjs` – bezpečné desktopové okno, lokální zabezpečený protokol
`laserstudio://` a výběr zdroje videa.

`electron/preload.cjs` – jen informace o desktopovém režimu;
úzce vymezené operace Spout, bez přístupu k USB a bez libovolného IPC.

`electron/spout-bridge.cjs` – řídí volitelný nativní přijímač, čte
zprávy z jeho stdout, validuje snímky a předává je do editoru.

`native/spout-receiver.cpp` – zdroj nativního pomocného procesu;
závisí na oficiálním Spout2 SDK, sestavuje se zvlášť ve Windows.

Další kroky: ověření nativního Spout receiveru na Windows,
oddělený bodový engine a protokol PC→Teensy 4.1 po USB. Teprve po
ověření DAC, galvanometrů, nezávislého shutteru, E-STOP a scan-fail
ochran lze uvažovat o fyzickém ILDA výstupu.

## Testy

`npm run check` ověří syntaxi Electron souborů a základní funkčnost balíčku.
Není to hardwarová ani bezpečnostní certifikace. Windows sestavení je potřeba
otestovat přímo na cílovém počítači.
