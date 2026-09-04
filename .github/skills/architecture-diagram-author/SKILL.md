---
name: architecture-diagram-author
description: >
  Crée et maintient un diagramme d'architecture technique double format :
  (1) un .drawio ÉDITABLE avec les icônes officielles Microsoft, et
  (2) une SVG AUTO-CONTENUE (+ PNG) pour README et slides.
  Garantit des colonnes logiques, des couloirs de routage dédiés (aucune
  flèche ne traverse une boîte non concernée), des rectangles colorés à
  angles droits, et la synchro README ↔ deck. Icônes EXCLUSIVEMENT depuis
  la collection officielle https://aka.ms/MsiconsCollections.
  UTILISER QUAND : "diagramme d'architecture", "schéma technique",
  "drawio", "mets à jour l'archi", "flèches qui se croisent", "icônes Azure".
---

# Skill — Auteur de diagrammes d'architecture (drawio + SVG/PNG)

## Objectif
Produire un schéma d'architecture *lisible* et *maintenable*, livré en deux artefacts
qui restent cohérents :
- `docs/architecture.drawio` — source **éditable** (mxGraph XML), icônes officielles MS.
- `docs/images/architecture.svg` — **auto-contenue** (formes + texte uniquement, AUCUNE
  référence externe) → rendable par GitHub et par Remotion/slides.
- `docs/images/architecture.png` — rasterisée depuis la SVG.

## Règles de mise en page (NON négociables)
1. **Conteneurs = domaines** (ex. Fabric, Foundry, Azure, M365, Client), rectangles
   pointillés colorés, coins **droits** (`rounded=0` / `rx=0`).
2. **Colonnes logiques dans chaque conteneur** : ordonne les sous-boîtes selon le flux
   (ex. front → backend → pipeline ; data-agent → ontologie → lakehouse → SQL → BI).
   Place la boîte qui parle à un AUTRE conteneur sur le **bord le plus proche** de sa cible.
3. **Rectangles à fond coloré par composant** (une teinte cohérente par domaine, variée
   par nœud), texte lisible en clair ET sombre.
4. **Aucune flèche ne survole une boîte non concernée.** On y arrive avec des **couloirs**.

## Recette de routage (le cœur du skill)
Ne PAS se fier à l'auto-routage : dans mxGraph, `orthogonalEdgeStyle` évite seulement
source/cible, pas les autres boîtes. Il faut **épingler** chaque arête longue avec des
points d'ancrage + waypoints :
- Style d'arête : `exitX/exitY/exitDx/exitDy` (côté sortie), `entryX/entryY/...` (côté entrée),
  et un `<Array as="points"><mxPoint x=".." y=".."/></Array>` dans la `mxGeometry`.
- **Couloir haut** (au-dessus de tous les conteneurs) pour les longs sauts horizontaux.
- **Couloirs bas** (sous tous les conteneurs), un par arête, en parallèle.
- **Gouttière inter-conteneurs élargie** (≥ 80 px) découpée en **sous-couloirs** (ex. x=1132,
  1148, 1164, 1178) : une seule verticale longue par sous-couloir → jamais de chevauchement.
- **Couloirs internes inter-colonnes** (petites gouttières x/y libres entre deux colonnes)
  pour les arêtes qui « sautent » une boîte dans la même colonne.
- Les croisements **flèche/flèche** sont tolérés ; les croisements **flèche/boîte** sont interdits.
- Décale les points d'entrée/sortie qui partagent un même bord (ex. `entryY=0.42` vs `0.52`).

En SVG, applique la même logique avec des `path` à segments orthogonaux (`M.. L.. L..`) et
des `marker` de flèche colorés ; regroupe des blocs déplaçables via `<g transform="translate()">`.

## Icônes officielles Microsoft — SOURCE OBLIGATOIRE : https://aka.ms/MsiconsCollections
**Toutes** les icônes du `.drawio` DOIVENT provenir de la collection officielle
**https://aka.ms/MsiconsCollections** (Azure / Fabric / Entra / Microsoft 365 /
Power Platform). N'utilise AUCUNE autre source d'icônes (pas de FontAwesome, pas
d'icônes génériques mxgraph, pas d'images tierces).

- La collection est hébergée (GitHub Pages) sous la base
  `https://tomkiljo.github.io/ms-icons/icons/` — c'est la cible de `aka.ms/MsiconsCollections`.
  Utilise cette base pour les URLs `image=` du drawio.
- drawio : `shape=image;image=<URL>` ou nœud `label` avec
  `image=<URL>;imageAlign=left;imageVerticalAlign=middle`.
- Familles : `Azure_Public_Service_Icons/Icons/<cat>/...`,
  `Microsoft_Fabric_icons/general/...`, `Microsoft_Entra_architecture_icons/...`,
  `Microsoft_365_Content_Icons/...`, `Azure_UX_Patterns_icons/...`.

### Chemins vérifiés (à réutiliser tels quels)
```
# base = https://tomkiljo.github.io/ms-icons/icons/   (= aka.ms/MsiconsCollections)
Function Apps        Azure_Public_Service_Icons/Icons/compute/10029-icon-service-Function-Apps.svg
Storage Accounts     Azure_Public_Service_Icons/Icons/storage/10086-icon-service-Storage-Accounts.svg
Managed Identities   Azure_Public_Service_Icons/Icons/identity/10227-icon-service-Managed-Identities.svg
Application Insights  Azure_Public_Service_Icons/Icons/management%20+%20governance/00012-icon-service-Application-Insights.svg
AI Studio / Foundry  Azure_Public_Service_Icons/Icons/ai%20+%20machine%20learning/03513-icon-service-AI-Studio.svg
Azure OpenAI         Azure_Public_Service_Icons/Icons/ai%20+%20machine%20learning/03438-icon-service-Azure-OpenAI.svg
Cognitive Search     Azure_Public_Service_Icons/Icons/ai%20+%20machine%20learning/10044-icon-service-Cognitive-Search.svg
Cognitive Services   Azure_Public_Service_Icons/Icons/ai%20+%20machine%20learning/10162-icon-service-Cognitive-Services.svg
Entra ID (couleur)   Microsoft_Entra_architecture_icons/Microsoft%20Entra%20color%20icons%20SVG/Microsoft%20Entra%20ID%20color%20icon.svg
Graph (logo MS)      Azure_UX_Patterns_icons/microsoft.svg
Fabric (général)     Microsoft_Fabric_icons/general/<lakehouse_64_item|sql_database_64_item|data_warehouse_64_item|event_house_64_item|power_bi_32_color|notebook_64_item|one_lake_48_color|function_64_item|copilot_48_color|app_development_48_color|fabric_48_color|data_factory_48_color>.svg
Teams Bot            Microsoft_365_Content_Icons/Teams%20Purple/48x48%20Dark%20Purple%20Icon/Bot.svg
Teams Chat (client)  Microsoft_365_Content_Icons/Teams%20Purple/48x48%20Dark%20Purple%20Icon/Chat.svg
Person (analyste)    Microsoft_365_Content_Icons/Microsoft%20Blue/48x48%20Dark%20Blue%20Icon/Person.svg
```
Note : les espaces et le `+` dans les chemins doivent rester **URL-encodés** (`%20`, `%20+%20`).

- **Important** : la SVG du README NE DOIT PAS pointer ces URLs (sinon GitHub ne rend rien) —
  n'y mets que des formes/texte ; garde les icônes officielles pour le `.drawio`. Si tu veux les
  icônes dans la SVG, **inline-les** (copie le contenu `<svg>` de la source aka.ms) plutôt que de
  les référencer par URL.

## Rendu & validation (environnement sans headless Chrome)
- SVG → PNG : `@resvg/resvg-js` (n'exige pas Chromium). Script Node jetable :
  `new Resvg(svg,{fitTo:{mode:"width",value:1920}}).render().asPng()`.
- Valider le XML avant commit (PowerShell) : `[xml](Get-Content <fichier> -Raw)`.
- Pas de CLI draw.io ? Le PNG du README vient de la **SVG**, pas du `.drawio`.

## Synchro des assets démo (OBLIGATOIRE)
Si un écran/feature change : régénère le(s) PNG, copie-les dans le deck
(`video/.../public/`), mets à jour l'ordre/les légendes du deck (`slides.ts`) ET la section
README correspondante. Ne jamais livrer un README ou un deck avec des captures périmées.

## Checklist de vérification
- [ ] **Toutes** les icônes proviennent de https://aka.ms/MsiconsCollections (aucune autre source).
- [ ] `.drawio` XML valide ; SVG XML valide.
- [ ] Aucune flèche ne traverse une boîte non concernée (vérifier le PNG rendu).
- [ ] Colonnes ordonnées selon le flux ; boîtes “sortantes” au bord de leur cible.
- [ ] SVG README 100 % auto-contenue (aucune URL externe).
- [ ] PNG re-rendu + copié dans le deck ; README pointe le bon PNG.
- [ ] Commit atomique (`docs(arch): …`) ; push sur la branche de la PR uniquement.