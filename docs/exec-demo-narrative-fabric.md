# Fabric Fraud Intelligence — Narratif exécutif orienté Fabric

> **Pitch en une phrase :** Microsoft Fabric réunit la donnée, la sémantique, le temps
> réel, l'analytique et l'application d'investigation dans une plateforme gouvernée,
> sans multiplier les copies ni les outils.

**Durée cible :** 8–10 minutes · **Audience :** direction data, risque, conformité et IT
**App :** https://tangy-cove-9493188f6d-centralus.webapp.fabricapps.net

---

## 1. Le problème à résoudre (45 s)

Une équipe fraude ne manque généralement pas de données. Elle manque d'une vue cohérente :
les transactions sont dans un entrepôt, les alertes dans un outil métier, les événements
clients dans des flux et les preuves dans des dossiers séparés. Chaque enquête commence
donc par une reconstruction manuelle.

> *« Le défi n'est pas de produire un score de plus. Le défi est de relier les faits,
> de les rendre compréhensibles et de conserver leur gouvernance jusqu'à la décision. »*

## 2. Pourquoi Fabric (1 min)

Présenter la solution comme une chaîne continue :

1. **OneLake et Lakehouse** centralisent les faits gouvernés dans 11 tables Delta.
2. **Fabric IQ Ontology** traduit ces tables en concepts métier et en relations.
3. **Data Agent** permet d'interroger ces données en langage naturel avec des réponses
   fondées sur les résultats de requête.
4. **Eventhouse** porte les signaux temps réel et les analyses KQL.
5. **Power BI** fournit le cockpit analytique.
6. **Rayfin Fabric App** place l'investigation et l'action dans une expérience sécurisée.

**Message clé :** la même donnée gouvernée alimente l'analyse, l'IA et l'application.
La logique métier n'est pas réinventée dans chaque outil.

## 3. Parcours de démonstration

### Écran 1 — Le cockpit opérationnel (1 min)

- Ouvrir le **Dashboard** et montrer les alertes ouvertes, les cas critiques et les
  montants exposés.
- Ouvrir la **file d'alertes** pour passer du KPI agrégé au dossier individuel.
- Basculer le rôle **Analyst → Auditor** et montrer le masquage automatique des PII.

> *« Fabric ne sépare pas l'analytique de l'opérationnel : l'utilisateur passe du signal
> à l'enquête sans sortir de la plateforme, avec les mêmes règles d'accès. »*

### Écran 2 — Du parcours client au signal fraude (2 min)

- Ouvrir **Fraud Flow** et afficher les quelque 10 000 parcours clients.
- Activer **Fraud events only** pour isoler Card Fraud, Account Takeover, Money Mule
  et Identity Fraud.
- Survoler un flux, puis descendre vers la carte pour montrer un déplacement impossible.

> *« Nous transformons une suite d'événements en histoire lisible. L'analyste voit la
> séquence qui mène à la fraude, pas seulement une ligne marquée en rouge. »*

### Écran 3 — La valeur de l'ontologie (2 min)

- Ouvrir **Entity Graph** et expliquer que les nœuds représentent des concepts métier
  reliés à partir des données du Lakehouse.
- Passer de **Degree** à **Betweenness** pour faire ressortir les points de passage d'un
  réseau potentiel.
- Cliquer sur un client et montrer le narratif, les signaux et les relations associés.

> *« L'ontologie fournit un langage commun aux analystes, aux rapports et aux agents.
> Client, compte, transaction, alerte et preuve gardent le même sens partout. »*

### Écran 4 — Interroger le Data Agent (1–2 min)

Dans le **Fraud Intelligence Data Agent**, saisir :

> *« Quels dossiers ouverts faut-il traiter en priorité ? Classe-les par score de risque
> et indique l'analyste assigné ainsi que l'identifiant de l'alerte associée. »*

- Montrer que la réponse cite les identifiants des enregistrements.
- Demander ensuite : *« Quels réparateurs concentrent le plus de sinistres ? »*
- Souligner que les réponses utilisent uniquement les 11 tables sélectionnées et
  signalent les données absentes au lieu de les inventer.

### Écran 5 — De l'analyse à l'action (1–2 min)

- Ouvrir **Case Detail** : preuves, chronologie, synthèse et recommandation.
- Montrer une décision explicite : escalade, demande de documents ou clôture.
- Ouvrir **Settings & Governance** pour afficher la matrice des rôles et l'audit trail.

> *« L'IA conseille, mais la décision reste humaine, explicite et traçable. La gouvernance
> couvre toute la chaîne, de la donnée source à l'action. »*

## 4. Ce qui est réellement déployé (1 min)

- Une **Fabric App** publique utilisant des données synthétiques et des réponses agentiques
  déterministes pour la démonstration anonyme.
- Un **Lakehouse** avec 11 tables Delta et environ 12,8 k lignes.
- Une **Ontology Fabric IQ** avec 11 types d'entités et 11 types de relations.
- Un **Fabric Data Agent** publié et fondé sur les 11 tables.
- Un **Eventhouse**, une base KQL, un modèle sémantique et un rapport Power BI.

La partie Data Agent nécessite une identité autorisée dans le workspace Fabric. L'application
publique ne donne aucun accès anonyme au Lakehouse, à l'ontologie ou aux autres artefacts.

## 5. Conclusion (30 s)

> *« Fabric transforme une collection de données et d'outils en un système d'investigation
> cohérent : une seule fondation gouvernée, une sémantique partagée et un passage direct du
> signal à la décision. »*

**Prochaine étape proposée :** connecter un premier périmètre de données réelles, retenir
deux typologies prioritaires et mesurer le temps d'investigation, le taux de faux positifs
et la qualité des preuves avant/après.

### Aide-mémoire

- **11** tables Delta gouvernées
- **11** types d'entités et **11** types de relations
- **~12,8 k** lignes synthétiques chargées
- **~10 000** parcours clients visualisés
- **1** Data Agent publié sur les données gouvernées
- **0** accès anonyme aux artefacts Fabric sous-jacents