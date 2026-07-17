# Fabric Fraud Intelligence — Narratif de démo exécutive

> **Pitch en une phrase :** une plateforme unique, de la donnée à la décision, qui
> détecte, explique et permet d'agir sur la fraude — construite entièrement sur
> Microsoft Fabric, avec une couche sémantique d'entreprise (Fabric IQ Ontology)
> et des narratifs générés par l'IA.

**Durée cible :** 10–12 minutes · **Audience :** COMEX / direction risques & conformité
**App :** https://fleet-north-8c279cc767-swedencentral.webapp.fabricapps.net

---

## 1. Le problème (30 s)

La fraude coûte aux institutions financières des milliards chaque année, mais le vrai
coût est opérationnel : les équipes jonglent entre des dizaines d'outils, les alertes
arrivent sans contexte, et chaque enquête demande de reconstituer manuellement l'histoire
du client. **Résultat : des délais, des faux positifs, et des décisions difficiles à
auditer.**

> *« Aujourd'hui, un analyste passe l'essentiel de son temps à rassembler le contexte,
> pas à décider. Nous avons inversé ce ratio. »*

---

## 2. Une plateforme, quatre couches (1 min)

| Couche | Ce que l'exec doit retenir |
| --- | --- |
| **Données** — `fraud_lakehouse` | Toutes les données clients, transactions, alertes et parcours dans un lakehouse gouverné (tables Delta). Une seule source de vérité. |
| **Sémantique** — Fabric IQ Ontology | 11 concepts métier (Client, Compte, Transaction, Alerte, Cas…) et leurs relations, définis une fois et réutilisés partout — par les humains **et** par l'IA. |
| **Application** — Rayfin Fabric App | Une expérience d'investigation moderne, sécurisée par rôle, directement dans Fabric. |
| **IA** — narratifs & copilotes | L'IA explique chaque signal en langage naturel et recommande une action. |

**Message clé : pas d'intégration à bâtir, pas de données à copier — tout vit dans Fabric.**

---

## 3. Le parcours de démo

### Écran 1 — Dashboard (1 min)
- Ouvrir l'app. Montrer les **KPI** (alertes ouvertes, cas critiques, montants à risque).
- Basculer le **rôle** (Analyst → Auditor) en haut à droite : les **données PII se masquent
  automatiquement**. 
- **Talking point :** *« La gouvernance n'est pas une couche ajoutée après coup : le rôle
  détermine ce que chacun voit, nativement. »*

### Écran 2 — Fraud Flow : le parcours client à grande échelle (2–3 min)
- Montrer le **Sankey** : ~10 000 parcours clients, des premières actions jusqu'à
  l'événement final (fraude ou activité normale).
- **Survoler** un ruban → le nombre exact de clients qui suivent ce chemin s'affiche.
- Cocher **« Fraud events only »** : ne restent que les typologies de fraude
  (Card Fraud, Account Takeover, Money Mule, Identity Fraud).
- Descendre sur la **carte des localisations** : le parcours d'un client fraudé s'affiche
  géographiquement — on *voit* le saut impossible (ex. Paris → Beijing en quelques minutes).
- **Talking point :** *« On ne regarde plus des lignes de transactions, on lit une histoire.
  L'anomalie saute aux yeux. »*

### Écran 3 — Entity Graph : le réseau et l'explication IA (3–4 min · le clou du spectacle)
- Le graphe se construit **à partir des événements réels** : les **hubs rouges** sont les
  typologies de fraude, les autres nœuds les **clients** dont le parcours y aboutit.
- Changer **« Size by »** (Degree → Betweenness) : les nœuds qui **font le pont** entre
  plusieurs fraudes grossissent → ce sont les points d'orchestration probables d'un réseau.
- Utiliser le **filtre fraude** pour isoler une ou plusieurs typologies.
- **Cliquer sur un client** → panneau de droite :
  - ses métriques de centralité,
  - un **narratif généré par l'IA** qui explique *ce qui se passe* : la séquence du parcours,
    le signal décisif, le lien de collusion éventuel, et **l'action recommandée**.
- **Talking point :** *« L'IA ne se contente pas de scorer : elle raconte le cas et propose
  la décision, en s'appuyant sur la même ontologie que nos équipes. »*

### Écran 4 — De l'alerte à la décision (1–2 min)
- **Alert Queue → Case Detail** : ouvrir un cas, montrer les **preuves** rassemblées, la
  **timeline**, et le **copilote** qui rédige une synthèse d'investigation.
- Montrer la **décision** (escalade / SAR / clôture) et la traçabilité pour l'audit.
- **AML Copilot** / **Claims Fraud** : mêmes patterns pour le blanchiment et la fraude à
  l'assurance — *un socle, plusieurs métiers.*

---

## 4. Ce qui rend cela unique (1 min)

1. **Fabric IQ Ontology** — une couche sémantique d'entreprise gouvernée : les mêmes
   définitions métier alimentent les tableaux de bord, les agents et les workflows.
2. **Zéro copie de données** — l'app, le lakehouse et l'ontologie partagent OneLake.
3. **IA de confiance** — les narratifs sont *ancrés* dans les données réelles et l'ontologie,
   pas des hallucinations.
4. **Gouvernance native** — rôles, masquage PII et audit intégrés dès la conception.
5. **Time-to-value** — déployé et itéré en jours, pas en mois.

---

## 5. Conclusion & prochaines étapes (30 s)

> *« Nous sommes passés d'alertes brutes à des décisions expliquées et auditables — sur une
> seule plateforme. La prochaine étape : brancher vos sources réelles et calibrer les
> typologies sur vos scénarios. »*

**Appel à l'action :** un atelier de cadrage d'une demi-journée pour identifier 2–3
typologies prioritaires et un pilote sur un périmètre réel.

---

### Aide-mémoire chiffres

- **11** entités métier · **11** relations dans l'ontologie `fraud_ontology`
- **11** tables Delta gouvernées dans `fraud_lakehouse` (~12,8k lignes chargées en démo)
- **~10 000** parcours clients analysés dans le Fraud Flow
- **4** typologies de fraude + **5** parcours bénins modélisés
